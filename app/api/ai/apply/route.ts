import { restoreCredentials } from "../../../../lib/ai";
import { apiError, n8nFetch, requireConnection } from "../../../../lib/n8n";
import { requireUser, unsealValue } from "../../../../lib/session";
import type { AiProposal } from "../../../../lib/types";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const connection = await requireConnection(request);
    const body = await request.json() as { approvalToken?: string };
    if (!body.approvalToken) return Response.json({ error: "Approval token is missing. Generate the preview again." }, { status: 400 });
    const sealed = await unsealValue<{ proposal: AiProposal; userId: string; expiresAt: number }>(body.approvalToken);
    if (!sealed || sealed.userId !== user.id || sealed.expiresAt < Date.now()) return Response.json({ error: "This preview is invalid or expired. Generate it again before approving." }, { status: 400 });
    const proposal = sealed.proposal;
    if (!proposal.safeToApply || !proposal.workflow || proposal.action === "guidance") return Response.json({ error: "This proposal is guidance only and cannot be applied." }, { status: 400 });
    if (connection.mode === "demo") return Response.json({ applied: true, simulated: true, message: "Demo approval completed. No n8n workflow was changed." });
    if (proposal.action === "create") {
      const created = await n8nFetch<Record<string, unknown>>(connection, "/workflows", { method: "POST", body: JSON.stringify(proposal.workflow) });
      return Response.json({ applied: true, simulated: false, workflowId: created.id, message: "Workflow created inactive. Review it in n8n before activating." });
    }
    if (!proposal.targetWorkflowId) return Response.json({ error: "Target workflow is missing." }, { status: 400 });
    const original = await n8nFetch<Record<string, unknown>>(connection, `/workflows/${encodeURIComponent(proposal.targetWorkflowId)}`);
    const update = restoreCredentials(original, proposal.workflow);
    await n8nFetch(connection, `/workflows/${encodeURIComponent(proposal.targetWorkflowId)}`, { method: "PUT", body: JSON.stringify(update) });
    return Response.json({ applied: true, simulated: false, workflowId: proposal.targetWorkflowId, message: "Approved changes saved. Workflow activation state was not changed." });
  } catch (error) {
    return apiError(error);
  }
}
