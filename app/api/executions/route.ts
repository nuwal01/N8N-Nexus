import { demoExecutions } from "../../../lib/demo-data";
import { apiError, n8nFetch, requireConnection } from "../../../lib/n8n";
import type { Execution } from "../../../lib/types";

export async function GET(request: Request) {
  try {
    const connection = await requireConnection(request);
    if (connection.mode === "demo") return Response.json({ data: demoExecutions });
    return Response.json(await n8nFetch<{ data: Execution[] }>(connection, "/executions?limit=50&includeData=true"));
  } catch (error) {
    return apiError(error);
  }
}
