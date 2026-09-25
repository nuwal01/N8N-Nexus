import { demoExecutions, demoWorkflows } from "../../../../lib/demo-data";
import { generateProposal, sanitizeExecution, sanitizeWorkflow } from "../../../../lib/ai";
import { apiError, n8nFetch, requireConnection } from "../../../../lib/n8n";
import { getLlmConfig, sealValue } from "../../../../lib/session";
import type { Execution } from "../../../../lib/types";

export async function POST(request: Request) {
  try {
    const connection = await requireConnection(request);
    const config = await getLlmConfig(request);
    if (!config) return Response.json({ error: "Configure an LLM provider before using Nexus AI." }, { status: 412 });
    const body = await request.json() as { mode?: "create" | "edit" | "diagnose"; request?: string; workflowId?: string; executionId?: string };
    if (!body.mode || !["create", "edit", "diagnose"].includes(body.mode) || !body.request?.trim()) return Response.json({ error: "Choose an action and describe what you need." }, { status: 400 });

    let rawWorkflow: Record<string, unknown> | undefined;
    let execution: Execution | undefined;
    if (body.mode === "edit") {
      if (!body.workflowId) return Response.json({ error: "Choose a workflow to edit." }, { status: 400 });
      rawWorkflow = connection.mode === "demo" ? demoWorkflows.find((item) => item.id === body.workflowId) as Record<string, unknown> : await n8nFetch(connection, `/workflows/${encodeURIComponent(body.workflowId)}`);
    }
    if (body.mode === "diagnose") {
      if (!body.executionId) return Response.json({ error: "Choose a failed execution." }, { status: 400 });
      execution = connection.mode === "demo" ? demoExecutions.find((item) => item.id === body.executionId) : await n8nFetch(connection, `/executions/${encodeURIComponent(body.executionId)}?includeData=true`);
      const workflowId = execution?.workflowId || execution?.workflowData?.id;
      if (workflowId) rawWorkflow = connection.mode === "demo" ? demoWorkflows.find((item) => item.id === workflowId) as Record<string, unknown> : await n8nFetch(connection, `/workflows/${encodeURIComponent(workflowId)}`);
    }
    const workflow = rawWorkflow ? { ...sanitizeWorkflow(rawWorkflow), id: String(rawWorkflow.id || body.workflowId || execution?.workflowId || "") } : undefined;
    const proposal = await generateProposal({ config, connection, mode: body.mode, request: body.request.trim(), workflow, execution: execution ? sanitizeExecution(execution) : undefined });
    const approvalToken = proposal.safeToApply && proposal.workflow ? await sealValue({ proposal, issuedAt: Date.now(), expiresAt: Date.now() + 15 * 60_000 }) : null;
    return Response.json({ proposal, approvalToken });
  } catch (error) {
    return apiError(error);
  }
}
