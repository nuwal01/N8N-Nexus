import { demoExecutions, demoWorkflows } from "../../../../lib/demo-data";
import { generateProposal, hasEmbeddedSecrets, ProviderSetupError, sanitizeExecution, sanitizeWorkflow, workflowFingerprint } from "../../../../lib/ai";
import { apiError, n8nFetch, requireConnection } from "../../../../lib/n8n";
import { getLlmConfig, requireUser, sealValue } from "../../../../lib/session";
import type { Execution } from "../../../../lib/types";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const connection = await requireConnection(request);
    const config = await getLlmConfig(request);
    if (!config) return Response.json({ error: "Configure an LLM provider before using Nexus AI." }, { status: 412 });
    const body = await request.json() as { mode?: "create" | "edit" | "diagnose"; request?: string; workflowId?: string; executionId?: string };
    if (!body.mode || !["create", "edit", "diagnose"].includes(body.mode) || !body.request?.trim()) return Response.json({ error: "Choose an action and describe what you need." }, { status: 400 });
    if (body.request.trim().length > 8000) return Response.json({ error: "Keep the request under 8,000 characters." }, { status: 400 });

    let rawWorkflow: Record<string, unknown> | undefined;
    let execution: Execution | undefined;
    if (body.mode === "edit") {
      if (!body.workflowId) return Response.json({ error: "Choose a workflow to edit." }, { status: 400 });
      rawWorkflow = connection.mode === "demo" ? demoWorkflows.find((item) => item.id === body.workflowId) as Record<string, unknown> : await n8nFetch(connection, `/workflows/${encodeURIComponent(body.workflowId)}`);
    }
    if (body.mode === "diagnose") {
      if (!body.executionId) return Response.json({ error: "Choose a failed execution." }, { status: 400 });
      execution = connection.mode === "demo" ? demoExecutions.find((item) => item.id === body.executionId) : await n8nFetch(connection, `/executions/${encodeURIComponent(body.executionId)}?includeData=true`);
      if (!execution) return Response.json({ error: "The selected execution was not found." }, { status: 404 });
      if (!["error", "crashed"].includes(execution.status || "")) return Response.json({ error: "Choose an execution that failed or crashed." }, { status: 400 });
      const workflowId = execution?.workflowId || execution?.workflowData?.id;
      if (workflowId) rawWorkflow = connection.mode === "demo" ? demoWorkflows.find((item) => item.id === workflowId) as Record<string, unknown> : await n8nFetch(connection, `/workflows/${encodeURIComponent(workflowId)}`);
    }
    const workflowDocument = rawWorkflow ? sanitizeWorkflow(rawWorkflow) : undefined;
    const workflow = workflowDocument ? { ...workflowDocument, id: String(rawWorkflow?.id || body.workflowId || execution?.workflowId || "") } : undefined;
    let proposal = await generateProposal({ config, connection, mode: body.mode, request: body.request.trim(), workflow, execution: execution ? sanitizeExecution(execution) : undefined });
    if (rawWorkflow && hasEmbeddedSecrets(rawWorkflow) && proposal.safeToApply) {
      proposal = {
        ...proposal,
        action: "guidance",
        safeToApply: false,
        blockedReason: "This workflow contains secret-like values inside node parameters. Nexus did not send those values to the model and will not risk overwriting them. Apply the change manually in n8n.",
        workflow: null,
        guidance: [...proposal.guidance, "Open the workflow in n8n and make the reviewed change manually."],
      };
    }
    const sourceFingerprint = workflowDocument && body.mode !== "create" ? await workflowFingerprint(workflowDocument) : null;
    const approvalToken = proposal.safeToApply && proposal.workflow ? await sealValue({ proposal, userId: user.id, sourceFingerprint, issuedAt: Date.now(), expiresAt: Date.now() + 15 * 60_000 }) : null;
    return Response.json({ proposal, approvalToken });
  } catch (error) {
    if (error instanceof ProviderSetupError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
    return apiError(error);
  }
}
