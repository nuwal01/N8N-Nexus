import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import { z } from "zod";
import type { AiProposal, Connection, Execution, LlmConfig, WorkflowDocument } from "./types";

export const providerDefaults = {
  openai: "gpt-5-mini",
  anthropic: "claude-sonnet-5",
} as const;

export class ProviderSetupError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

const workflowSchema = z.object({
  name: z.string(),
  nodes: z.array(z.record(z.string(), z.unknown())),
  connections: z.record(z.string(), z.unknown()),
  settings: z.record(z.string(), z.unknown()),
});

const proposalSchema = z.object({
  action: z.enum(["create", "update", "guidance"]),
  title: z.string(),
  summary: z.string(),
  targetWorkflowId: z.string().nullable(),
  safeToApply: z.boolean(),
  blockedReason: z.string().nullable(),
  changes: z.array(z.object({ path: z.string(), before: z.string().nullable(), after: z.string(), reason: z.string() })),
  workflow: workflowSchema.nullable(),
  guidance: z.array(z.string()),
  editorUrl: z.string().nullable(),
});

export function sanitizeWorkflow(value: Record<string, unknown>): WorkflowDocument {
  const nodes = Array.isArray(value.nodes) ? value.nodes.map((node) => {
    const item = node as Record<string, unknown>;
    const safe = { ...item };
    delete safe.credentials;
    return safe;
  }) : [];
  return {
    name: String(value.name || "Untitled workflow"),
    nodes,
    connections: (value.connections as Record<string, unknown>) || {},
    settings: (value.settings as Record<string, unknown>) || {},
  };
}

export function sanitizeExecution(value: Execution) {
  const error = value.data?.resultData?.error;
  return {
    id: value.id,
    status: value.status,
    workflowId: value.workflowId || value.workflowData?.id,
    workflowName: value.workflowData?.name,
    lastNodeExecuted: value.data?.resultData?.lastNodeExecuted,
    error: error ? { name: error.name, message: error.message, description: error.description, node: error.node } : null,
  };
}

function hasForbiddenKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(([key, child]) =>
    /credential|api.?key|password|secret|access.?token|auth/i.test(key) || hasForbiddenKey(child),
  );
}

export function validateProposal(proposal: AiProposal, mode: "create" | "edit" | "diagnose") {
  if (proposal.action === "guidance") return proposal;
  if (!proposal.workflow) return { ...proposal, safeToApply: false, blockedReason: "The model did not return a complete workflow." };
  if (hasForbiddenKey(proposal.workflow)) return { ...proposal, action: "guidance" as const, safeToApply: false, blockedReason: "The proposal includes credential or secret fields. Nexus AI will not create or modify credentials.", workflow: null };
  if (proposal.workflow.nodes.length > 30) return { ...proposal, action: "guidance" as const, safeToApply: false, blockedReason: "The proposed workflow is too large to apply safely in Stage 2.", workflow: null };
  if (mode !== "create" && !proposal.targetWorkflowId) return { ...proposal, action: "guidance" as const, safeToApply: false, blockedReason: "No target workflow was identified.", workflow: null };
  return proposal;
}

function modelFor(config: LlmConfig) {
  if (!config.apiKey) throw new Error("Add an LLM API key in Nexus AI settings first.");
  if (config.provider === "openai") return createOpenAI({ apiKey: config.apiKey })(config.model);
  if (config.provider === "anthropic") return createAnthropic({ apiKey: config.apiKey })(config.model);
  throw new Error("Demo AI can only be used with the demo n8n workspace.");
}

export async function validateProvider(config: LlmConfig) {
  if (config.provider === "demo") return;
  await generateText({ model: modelFor(config), prompt: "Reply with OK.", maxOutputTokens: 16 });
}

type ModelDiscovery = { model: string; availableModels: string[]; discovery: "discovered" | "fallback"; discoveryMessage: string };

function chooseModel(provider: "openai" | "anthropic", models: string[]) {
  const preferred = provider === "openai"
    ? [/^gpt-5-mini$/, /^gpt-5(?:\.\d+)?$/, /^gpt-4\.1-mini$/, /^gpt-4o-mini$/]
    : [/^claude-sonnet-5(?:-|$)/, /^claude-sonnet-4-6(?:-|$)/, /^claude-sonnet-4-5(?:-|$)/, /^claude-haiku-4-5(?:-|$)/];
  return preferred.map((pattern) => models.find((id) => pattern.test(id))).find(Boolean) || null;
}

export async function discoverProviderModel(provider: "openai" | "anthropic", apiKey: string, override?: string): Promise<ModelDiscovery> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  const url = provider === "openai" ? "https://api.openai.com/v1/models" : "https://api.anthropic.com/v1/models?limit=100";
  const headers = provider === "openai"
    ? { authorization: `Bearer ${apiKey}` }
    : { "x-api-key": apiKey, "anthropic-version": "2023-06-01" };
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    if (response.status === 401 || response.status === 403) throw new ProviderSetupError(`The ${provider === "openai" ? "OpenAI" : "Anthropic"} API key was rejected. Check the key and its permissions.`, 401);
    if (!response.ok) {
      if (![404, 405, 501].includes(response.status)) throw new ProviderSetupError(`${provider === "openai" ? "OpenAI" : "Anthropic"} could not be reached successfully (HTTP ${response.status}). Try again shortly.`, 502);
      const fallback = override?.trim() || providerDefaults[provider];
      await validateProvider({ provider, apiKey, model: fallback });
      return { model: fallback, availableModels: [], discovery: "fallback", discoveryMessage: `This provider did not make model discovery available (HTTP ${response.status}). Nexus validated and selected the supported default ${fallback}.` };
    }
    const body = await response.json() as { data?: Array<{ id?: string }> };
    const models = [...new Set((body.data || []).map((item) => item.id).filter((id): id is string => Boolean(id)))];
    const requested = override?.trim();
    if (requested && !models.includes(requested)) throw new ProviderSetupError(`The manual model override “${requested}” is not available to this API key.`, 400);
    const selected = requested || chooseModel(provider, models);
    if (!selected) {
      const fallback = providerDefaults[provider];
      await validateProvider({ provider, apiKey, model: fallback });
      return { model: fallback, availableModels: models, discovery: "fallback", discoveryMessage: `The provider returned a model list, but none matched Nexus AI's supported model families. Nexus validated and selected ${fallback}.` };
    }
    return { model: selected, availableModels: models, discovery: "discovered", discoveryMessage: `Discovered ${models.length} models available to this key and selected ${selected}.` };
  } catch (error) {
    if (error instanceof ProviderSetupError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new ProviderSetupError(`${provider === "openai" ? "OpenAI" : "Anthropic"} did not respond in time. Check your network and try again.`, 504);
    throw new ProviderSetupError(`${provider === "openai" ? "OpenAI" : "Anthropic"} could not be reached. Check your network and try again.`, 502);
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateProposal(input: {
  config: LlmConfig;
  connection: Connection;
  mode: "create" | "edit" | "diagnose";
  request: string;
  workflow?: WorkflowDocument & { id?: string };
  execution?: ReturnType<typeof sanitizeExecution>;
}) {
  if (input.config.provider === "demo") return demoProposal(input);
  const editorUrl = input.workflow?.id && input.connection.mode === "live" ? `${input.connection.baseUrl}/workflow/${encodeURIComponent(input.workflow.id)}` : null;
  const { output } = await generateText({
    model: modelFor(input.config),
    output: Output.object({ schema: proposalSchema }),
    system: `You are Nexus AI, a cautious n8n workflow assistant. Produce a concrete proposal, never an already-applied result. Never add, expose, replace, or describe credentials or secrets. Never activate a workflow or retry an execution. New workflows must be saved inactive. Use valid n8n workflow JSON with nodes, connections, and settings. If uncertain, choose action guidance, set safeToApply false, explain blockedReason, and give manual steps. For edits, preserve the workflow's intent and make the smallest change. The exact editor URL is ${editorUrl || "unavailable"}.`,
    prompt: JSON.stringify({ task: input.mode, userRequest: input.request, workflow: input.workflow || null, execution: input.execution || null }),
  });
  return validateProposal({ ...output, editorUrl: output.editorUrl || editorUrl }, input.mode);
}

function demoProposal(input: Parameters<typeof generateProposal>[0]): AiProposal {
  const editorUrl = input.workflow?.id ? `http://localhost:5678/workflow/${encodeURIComponent(input.workflow.id)}` : null;
  if (/credential|api key|password|secret/i.test(input.request)) return {
    action: "guidance", title: "Manual credential change required", summary: "Nexus AI cannot create or modify credentials.", targetWorkflowId: input.workflow?.id || null, safeToApply: false,
    blockedReason: "Credential changes are deliberately blocked. Open the workflow in n8n and update the credential there.", changes: [], workflow: null,
    guidance: ["Open the workflow in n8n.", "Select the affected node and choose an existing credential.", "Save and run the workflow manually."], editorUrl,
  };
  if (input.mode === "create") {
    const workflow = { name: "Demo: Manual message logger", nodes: [
      { id: "manual-trigger", name: "When clicking Test workflow", type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [260, 300], parameters: {} },
      { id: "set-message", name: "Set message", type: "n8n-nodes-base.set", typeVersion: 3.4, position: [500, 300], parameters: { assignments: { assignments: [{ id: "message", name: "message", value: input.request, type: "string" }] } } },
    ], connections: { "When clicking Test workflow": { main: [[{ node: "Set message", type: "main", index: 0 }]] } }, settings: {} };
    return { action: "create", title: "Create an inactive demo workflow", summary: "A manual-trigger workflow will set a message from your request.", targetWorkflowId: null, safeToApply: true, blockedReason: null, changes: [{ path: "workflow", before: null, after: `${workflow.name} with 2 nodes`, reason: "Creates a safe, manually triggered starting point." }], workflow, guidance: ["Review the JSON before approval.", "The new workflow will remain inactive."], editorUrl: null };
  }
  const workflow = input.workflow || { name: "Demo workflow", nodes: [], connections: {}, settings: {} };
  const updated = { ...workflow, name: `${workflow.name.replace(/ \(reviewed\)$/, "")} (reviewed)` };
  return { action: "update", title: input.mode === "diagnose" ? "Small fix for the failed workflow" : "Rename the workflow for review", summary: input.mode === "diagnose" ? "The saved error was considered; this demo proposal makes a harmless name-only change." : "This demo proposal makes one reversible name change.", targetWorkflowId: workflow.id || null, safeToApply: true, blockedReason: null, changes: [{ path: "name", before: workflow.name, after: updated.name, reason: "Safe demonstration of the approval flow." }], workflow: updated, guidance: ["Demo approval is simulated and never contacts n8n."], editorUrl };
}

export function restoreCredentials(original: Record<string, unknown>, proposed: WorkflowDocument) {
  const originals = new Map((Array.isArray(original.nodes) ? original.nodes : []).map((node) => {
    const item = node as Record<string, unknown>;
    return [String(item.id || item.name), item.credentials];
  }));
  return { ...proposed, nodes: proposed.nodes.map((node) => {
    const credentials = originals.get(String(node.id || node.name));
    return credentials ? { ...node, credentials } : node;
  }) };
}
