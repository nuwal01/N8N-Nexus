import { demoExecutions } from "../../../../lib/demo-data";
import { sanitizeExecutionForClient } from "../../../../lib/ai";
import { apiError, n8nFetch, requireConnection } from "../../../../lib/n8n";
import type { Execution } from "../../../../lib/types";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const connection = await requireConnection(request);
    const { id } = await context.params;
    if (connection.mode === "demo") {
      const execution = demoExecutions.find((item) => item.id === id);
      return execution ? Response.json(sanitizeExecutionForClient(execution)) : Response.json({ error: "Execution not found." }, { status: 404 });
    }
    const execution = await n8nFetch<Execution>(connection, `/executions/${encodeURIComponent(id)}?includeData=true`);
    return Response.json(sanitizeExecutionForClient(execution));
  } catch (error) {
    return apiError(error);
  }
}
