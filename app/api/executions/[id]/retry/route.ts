import { apiError, n8nFetch, requireConnection } from "../../../../../lib/n8n";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const connection = await requireConnection(request);
    const { id } = await context.params;
    if (connection.mode === "demo") return Response.json({ id: `${id}-retry`, status: "new", retryOf: id });
    return Response.json(await n8nFetch(connection, `/executions/${encodeURIComponent(id)}/retry`, { method: "POST", body: JSON.stringify({ loadWorkflow: true }) }));
  } catch (error) {
    return apiError(error);
  }
}
