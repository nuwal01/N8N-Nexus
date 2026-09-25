import { getConnection } from "./session";
import type { Connection } from "./types";

export class N8nApiError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

export function normalizeBaseUrl(value: string) {
  const parsed = new URL(value.trim());
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error("Use an http:// or https:// URL.");
  parsed.hash = "";
  parsed.search = "";
  parsed.pathname = parsed.pathname.replace(/\/$/, "");
  return parsed.toString().replace(/\/$/, "");
}

export async function requireConnection(request: Request): Promise<Connection> {
  const connection = await getConnection(request);
  if (!connection) throw new N8nApiError("Connect an n8n instance first.", 401);
  return connection;
}

export async function n8nFetch<T>(connection: Connection, path: string, init: RequestInit = {}) {
  if (connection.mode !== "live" || !connection.apiKey) throw new N8nApiError("A live n8n connection is required.", 400);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${connection.baseUrl}/api/v1${path}`, {
      ...init,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "X-N8N-API-KEY": connection.apiKey,
        ...init.headers,
      },
      signal: controller.signal,
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const message = body?.message || body?.error || `n8n returned ${response.status}`;
      throw new N8nApiError(message, response.status);
    }
    return body as T;
  } catch (error) {
    if (error instanceof N8nApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new N8nApiError("The n8n instance did not respond in time.", 504);
    throw new N8nApiError(error instanceof Error ? error.message : "Could not reach the n8n instance.");
  } finally {
    clearTimeout(timeout);
  }
}

export function apiError(error: unknown) {
  const status = error instanceof N8nApiError ? error.status : 500;
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  const code = /cannot be activated because it has no trigger node/i.test(message)
    ? "MISSING_TRIGGER"
    : undefined;
  return Response.json({ error: message, code }, { status });
}
