import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { AuthError, getConnection, StorageError } from "./session";
import type { Connection } from "./types";

export class N8nApiError extends Error {
  constructor(message: string, public status = 502, public code?: string) {
    super(message);
  }
}

export function normalizeBaseUrl(value: string) {
  let parsed: URL;
  try { parsed = new URL(value.trim()); }
  catch { throw new N8nApiError("Enter a valid n8n instance URL.", 400, "INVALID_N8N_URL"); }
  if (!["http:", "https:"].includes(parsed.protocol)) throw new N8nApiError("Use an http:// or https:// URL.", 400, "INVALID_N8N_URL");
  if (parsed.username || parsed.password) throw new N8nApiError("Do not include a username or password in the n8n URL.", 400, "INVALID_N8N_URL");
  parsed.hash = "";
  parsed.search = "";
  parsed.pathname = parsed.pathname.replace(/\/$/, "").replace(/\/api\/v1$/i, "");
  return parsed.toString().replace(/\/$/, "");
}

function isPrivateAddress(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (["localhost", "::", "::1"].includes(host) || host.endsWith(".local")) return true;
  if (isIP(host) === 4) {
    const octets = host.split(".").map(Number);
    return octets[0] === 10 || octets[0] === 127 || octets[0] === 0 ||
      (octets[0] === 169 && octets[1] === 254) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168);
  }
  if (isIP(host) === 6) {
    if (/^(?:fc|fd)/.test(host) || /^fe[89ab]/.test(host)) return true;
    const mapped = host.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }
  return false;
}

export async function validateConnectionUrl(baseUrl: string, requestUrl: string) {
  const target = new URL(baseUrl);
  const nexus = new URL(requestUrl);
  const localNames = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
  const hostedNexus = process.env.RENDER === "true" || (nexus.protocol === "https:" && !localNames.has(nexus.hostname));
  if (hostedNexus && target.protocol !== "https:") {
    throw new N8nApiError("Hosted Nexus can only connect to n8n over HTTPS. Use an HTTPS n8n URL or a secure tunnel.", 400, "HTTPS_REQUIRED");
  }
  if (hostedNexus && isPrivateAddress(target.hostname)) {
    throw new N8nApiError("Hosted Nexus cannot reach a local or private n8n address. Use an internet-reachable HTTPS URL for your n8n instance.", 400, "LOCALHOST_UNREACHABLE");
  }
  if (hostedNexus && !isIP(target.hostname.replace(/^\[|\]$/g, ""))) {
    try {
      const addresses = await lookup(target.hostname, { all: true, verbatim: true });
      if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
        throw new N8nApiError("Hosted Nexus cannot connect to an n8n hostname that resolves to a private address. Use an internet-reachable HTTPS URL.", 400, "LOCALHOST_UNREACHABLE");
      }
    } catch (error) {
      if (error instanceof N8nApiError) throw error;
      throw new N8nApiError("The n8n hostname could not be resolved. Check the URL and DNS settings.", 400, "N8N_DNS_FAILED");
    }
  }
  return baseUrl;
}

export async function requireConnection(request: Request): Promise<Connection> {
  const connection = await getConnection(request);
  if (!connection) throw new N8nApiError("Connect an n8n instance first.", 409, "CONNECTION_REQUIRED");
  return connection;
}

export function redactSensitiveText(value: string) {
  return value
    .replace(/sk-(?:ant-)?[A-Za-z0-9_-]{8,}/g, "[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/gi, "Bearer [redacted]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/([?&](?:api_?key|token|access_token|secret|password)=)[^&\s]+/gi, "$1[redacted]");
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
    let body: Record<string, unknown> | null = null;
    if (text) {
      try { body = JSON.parse(text) as Record<string, unknown>; }
      catch { body = null; }
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new N8nApiError("n8n rejected this API key. Create or copy a valid key in n8n Settings → API, then reconnect.", 401, "N8N_AUTH_FAILED");
      }
      const nestedError = body?.error && typeof body.error === "object" ? body.error as Record<string, unknown> : null;
      const detail = typeof body?.message === "string"
        ? body.message
        : typeof body?.error === "string"
          ? body.error
          : typeof nestedError?.message === "string"
            ? nestedError.message
            : "";
      const message = detail || (text && text.length < 300 ? text : "") || `n8n returned HTTP ${response.status}.`;
      throw new N8nApiError(redactSensitiveText(message), response.status, "N8N_REQUEST_FAILED");
    }
    if (text && body === null) throw new N8nApiError("n8n returned an invalid response instead of JSON.", 502, "N8N_INVALID_RESPONSE");
    return body as unknown as T;
  } catch (error) {
    if (error instanceof N8nApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new N8nApiError("The n8n instance did not respond in time.", 504, "N8N_TIMEOUT");
    throw new N8nApiError("Could not reach the n8n instance. Check the URL and confirm it is reachable from the internet.", 502, "N8N_UNREACHABLE");
  } finally {
    clearTimeout(timeout);
  }
}

export function apiError(error: unknown) {
  const known = error instanceof N8nApiError || error instanceof AuthError || error instanceof StorageError;
  const status = known ? error.status : 500;
  const rawMessage = known ? error.message : "Unexpected server error.";
  const message = redactSensitiveText(rawMessage);
  const code = /cannot be activated because it has no trigger node/i.test(message)
    ? "MISSING_TRIGGER"
    : error instanceof N8nApiError
      ? error.code
      : error instanceof StorageError
        ? error.code
      : error instanceof AuthError
        ? "AUTH_REQUIRED"
        : "SERVER_ERROR";
  return Response.json({ error: message, code }, { status });
}
