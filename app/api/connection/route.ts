import { apiError, n8nFetch, normalizeBaseUrl } from "../../../lib/n8n";
import { clearedConnectionCookie, clearedLlmCookie, connectionCookie, getConnection, sealConnection } from "../../../lib/session";

export async function GET(request: Request) {
  const connection = await getConnection(request);
  return Response.json({
    connected: Boolean(connection),
    mode: connection?.mode || null,
    baseUrl: connection?.baseUrl || null,
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { baseUrl?: string; apiKey?: string; demo?: boolean };
    if (body.demo) {
      const token = await sealConnection({ mode: "demo", baseUrl: "Demo workspace" });
      return Response.json({ connected: true, mode: "demo", baseUrl: "Demo workspace" }, { headers: { "set-cookie": connectionCookie(token) } });
    }

    if (!body.baseUrl?.trim() || !body.apiKey?.trim()) {
      return Response.json({ error: "Enter both your n8n URL and API key." }, { status: 400 });
    }
    const connection = { mode: "live" as const, baseUrl: normalizeBaseUrl(body.baseUrl), apiKey: body.apiKey.trim() };
    await n8nFetch(connection, "/workflows?limit=1");
    const token = await sealConnection(connection);
    return Response.json({ connected: true, mode: "live", baseUrl: connection.baseUrl }, { headers: { "set-cookie": connectionCookie(token) } });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE() {
  const headers = new Headers();
  headers.append("set-cookie", clearedConnectionCookie());
  headers.append("set-cookie", clearedLlmCookie());
  return Response.json({ connected: false }, { headers });
}
