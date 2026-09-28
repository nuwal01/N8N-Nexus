import { demoWorkflows } from "../../../../lib/demo-data";
import { apiError, n8nFetch, requireConnection } from "../../../../lib/n8n";

export async function POST(request: Request) {
  try {
    const connection = await requireConnection(request);
    const body = (await request.json()) as { id?: string; active?: boolean };
    if (!body.id || typeof body.active !== "boolean") return Response.json({ error: "Workflow id and state are required." }, { status: 400 });
    if (connection.mode === "demo") {
      const workflow = demoWorkflows.find((item) => item.id === body.id);
      if (!workflow) return Response.json({ error: "Workflow not found." }, { status: 404 });
      if (body.id === "wf-03" && body.active) {
        return Response.json(
          { error: "Workflow cannot be activated because it has no trigger node.", code: "MISSING_TRIGGER" },
          { status: 400 },
        );
      }
      return Response.json({ ...workflow, active: body.active });
    }
    const action = body.active ? "activate" : "deactivate";
    return Response.json(await n8nFetch(connection, `/workflows/${encodeURIComponent(body.id)}/${action}`, { method: "POST", body: "{}" }));
  } catch (error) {
    return apiError(error);
  }
}
