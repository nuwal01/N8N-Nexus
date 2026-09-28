import { apiError, n8nFetch, requireConnection } from "../../../../../lib/n8n";
import { demoExecutions } from "../../../../../lib/demo-data";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const connection = await requireConnection(request);
    const { id } = await context.params;
    if (connection.mode === "demo") {
      const execution = demoExecutions.find((item) => item.id === id);
      if (!execution) return Response.json({ error: "Execution not found." }, { status: 404 });
      if (!["error", "crashed"].includes(execution.status || "")) return Response.json({ error: "Only failed executions can be retried." }, { status: 409 });
      return Response.json({ id: `${id}-retry`, status: "new", retryOf: id });
    }
    return Response.json(await n8nFetch(connection, `/executions/${encodeURIComponent(id)}/retry`, { method: "POST", body: JSON.stringify({ loadWorkflow: true }) }));
  } catch (error) {
    return apiError(error);
  }
}
