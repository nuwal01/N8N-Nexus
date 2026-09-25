import { demoWorkflows } from "../../../lib/demo-data";
import { apiError, n8nFetch, requireConnection } from "../../../lib/n8n";
import type { Workflow } from "../../../lib/types";

export async function GET(request: Request) {
  try {
    const connection = await requireConnection(request);
    if (connection.mode === "demo") return Response.json({ data: demoWorkflows });
    return Response.json(await n8nFetch<{ data: Workflow[] }>(connection, "/workflows?limit=100"));
  } catch (error) {
    return apiError(error);
  }
}
