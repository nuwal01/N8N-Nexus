import type { Connection, LlmConfig } from "./types";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const COOKIE_NAME = "nexus_connection";
const LLM_COOKIE_NAME = "nexus_llm";

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function encryptionKey() {
  const fallback = "n8n-nexus-local-development-session-key";
  const raw = process.env.SESSION_SECRET || fallback;
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(raw));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function sealValue(value: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(),
    encoder.encode(JSON.stringify(value)),
  );
  const payload = new Uint8Array(iv.length + encrypted.byteLength);
  payload.set(iv);
  payload.set(new Uint8Array(encrypted), iv.length);
  return toBase64Url(payload);
}

export async function unsealConnection(token: string): Promise<Connection | null> {
  return unsealValue<Connection>(token);
}

export async function unsealValue<T>(token: string): Promise<T | null> {
  try {
    const payload = fromBase64Url(token);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: payload.slice(0, 12) },
      await encryptionKey(),
      payload.slice(12),
    );
    return JSON.parse(decoder.decode(decrypted)) as T;
  } catch {
    return null;
  }
}

export const sealConnection = (connection: Connection) => sealValue(connection);

export function readCookie(request: Request) {
  return readConnectionToken(request.headers.get("cookie"));
}

function readConnectionToken(cookieHeader: string | null) {
  return readNamedCookie(cookieHeader, COOKIE_NAME);
}

function readNamedCookie(cookieHeader: string | null, name: string) {
  const token = (cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  return token ? decodeURIComponent(token) : null;
}


export function llmCookie(token: string) {
  return `${LLM_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export function clearedLlmCookie() {
  return `${LLM_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

export async function getLlmConfig(request: Request) {
  const token = readNamedCookie(request.headers.get("cookie"), LLM_COOKIE_NAME);
  return token ? unsealValue<LlmConfig>(token) : null;
}

export function connectionCookie(token: string) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export function clearedConnectionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

export async function getConnection(request: Request) {
  const token = readCookie(request);
  return token ? unsealConnection(token) : null;
}

export async function getConnectionFromCookieHeader(cookieHeader: string | null) {
  const token = readConnectionToken(cookieHeader);
  return token ? unsealConnection(token) : null;
}
