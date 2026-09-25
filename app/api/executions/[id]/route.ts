import { demoExecutions } from "../../../../lib/demo-data";
import { apiError, n8nFetch, requireConnection } from "../../../../lib/n8n";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const connection = await requireConnection(request);
    const { id } = await context.params;
    if (connection.mode === "demo") {
      const execution = demoExecutions.find((item) => item.id === id);
      return execution ? Response.json(execution) : Response.json({ error: "Execution not found." }, { status: 404 });
    }
    return Response.json(await n8nFetch(connection, `/executions/${encodeURIComponent(id)}?includeData=true`));
  } catch (error) {
    return apiError(error);
  }
}
