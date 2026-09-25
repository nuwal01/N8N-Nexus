import { apiError, n8nFetch, normalizeBaseUrl } from "../../../lib/n8n";
import { getConnection, removeConnection, requireUser, saveConnection, setConnectionActive } from "../../../lib/session";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const active = await getConnection(request);
    const saved = active || await getConnection(request, true);
    return Response.json({ connected: Boolean(active), saved: Boolean(saved), mode: active?.mode || null, baseUrl: saved?.baseUrl || null, user: { name: user.name, email: user.email } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await request.json() as { baseUrl?: string; apiKey?: string; demo?: boolean; saved?: boolean };
    if (body.saved) {
      const saved = await getConnection(request, true);
      if (!saved) return Response.json({ error: "No saved n8n connection was found." }, { status: 404 });
      if (saved.mode === "live") await n8nFetch(saved, "/workflows?limit=1");
      await setConnectionActive(user.id, true);
      return Response.json({ connected: true, saved: true, mode: saved.mode, baseUrl: saved.baseUrl });
    }
    if (body.demo) {
      const connection = { mode: "demo" as const, baseUrl: "Demo workspace" };
      await saveConnection(user.id, connection);
      return Response.json({ connected: true, saved: true, mode: "demo", baseUrl: connection.baseUrl });
    }
    if (!body.baseUrl?.trim() || !body.apiKey?.trim()) return Response.json({ error: "Enter both your n8n URL and API key." }, { status: 400 });
    const connection = { mode: "live" as const, baseUrl: normalizeBaseUrl(body.baseUrl), apiKey: body.apiKey.trim() };
    await n8nFetch(connection, "/workflows?limit=1");
    await saveConnection(user.id, connection);
    return Response.json({ connected: true, saved: true, mode: "live", baseUrl: connection.baseUrl });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request);
    const remove = new URL(request.url).searchParams.get("remove") === "true";
    if (remove) await removeConnection(user.id); else await setConnectionActive(user.id, false);
    return Response.json({ connected: false, saved: !remove });
  } catch (error) { return apiError(error); }
}
