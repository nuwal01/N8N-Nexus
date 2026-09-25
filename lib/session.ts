import { env } from "cloudflare:workers";
import { database, type UserRecord } from "./db";
import type { Connection, LlmConfig } from "./types";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const AUTH_COOKIE = "nexus_auth";
const SESSION_DAYS = 14;

function runtimeSecret(name: "SESSION_SECRET" | "DATA_ENCRYPTION_KEY") {
  const bindings = env as unknown as Record<string, string | undefined>;
  const value = bindings[name] || process.env[name];
  if (!value || value.length < 32) throw new Error(`${name} must be configured with at least 32 characters.`);
  return value;
}

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

function randomToken(bytes = 32) { return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes))); }

async function sha256(value: string) {
  return toBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

async function encryptionKey() {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(runtimeSecret("DATA_ENCRYPTION_KEY")));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function sealValue(value: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), encoder.encode(JSON.stringify(value)));
  const payload = new Uint8Array(iv.length + encrypted.byteLength);
  payload.set(iv); payload.set(new Uint8Array(encrypted), iv.length);
  return toBase64Url(payload);
}

export async function unsealValue<T>(token: string): Promise<T | null> {
  try {
    const payload = fromBase64Url(token);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: payload.slice(0, 12) }, await encryptionKey(), payload.slice(12));
    return JSON.parse(decoder.decode(decrypted)) as T;
  } catch { return null; }
}

function readNamedCookie(cookieHeader: string | null, name: string) {
  const token = (cookieHeader || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
  return token ? decodeURIComponent(token) : null;
}

export function authCookie(token: string) {
  return `${AUTH_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export function clearedAuthCookie() { return `${AUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`; }

export async function hashPassword(password: string, salt = randomToken(18)) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: 210_000 }, key, 256);
  return { hash: toBase64Url(new Uint8Array(bits)), salt };
}

export async function verifyPassword(password: string, salt: string, expected: string) {
  const actual = (await hashPassword(password, salt)).hash;
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}

export async function createSession(userId: string) {
  runtimeSecret("SESSION_SECRET");
  const token = randomToken();
  const tokenHash = await sha256(`${runtimeSecret("SESSION_SECRET")}:${token}`);
  const db = await database();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400_000);
  await db.prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), userId, tokenHash, expires.toISOString(), now.toISOString()).run();
  return token;
}

export async function getUser(request: Request): Promise<UserRecord | null> {
  const token = readNamedCookie(request.headers.get("cookie"), AUTH_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(`${runtimeSecret("SESSION_SECRET")}:${token}`);
  const db = await database();
  const row = await db.prepare(`SELECT users.id, users.name, users.email, users.created_at
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ? LIMIT 1`).bind(tokenHash, new Date().toISOString()).first<UserRecord>();
  return row || null;
}

export async function requireUser(request: Request) {
  const user = await getUser(request);
  if (!user) throw new AuthError("Log in to continue.", 401);
  return user;
}

export async function deleteSession(request: Request) {
  const token = readNamedCookie(request.headers.get("cookie"), AUTH_COOKIE);
  if (!token) return;
  const tokenHash = await sha256(`${runtimeSecret("SESSION_SECRET")}:${token}`);
  const db = await database();
  await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
}

export class AuthError extends Error { constructor(message: string, public status = 401) { super(message); } }

export async function getConnection(request: Request, includeInactive = false): Promise<Connection | null> {
  const user = await requireUser(request);
  const db = await database();
  const row = await db.prepare("SELECT n8n_connection, n8n_active FROM user_secrets WHERE user_id = ?").bind(user.id).first<{ n8n_connection: string | null; n8n_active: number }>();
  if (!row?.n8n_connection || (!includeInactive && !row.n8n_active)) return null;
  return unsealValue<Connection>(row.n8n_connection);
}

export async function saveConnection(userId: string, connection: Connection) {
  const db = await database(); const encrypted = await sealValue(connection); const now = new Date().toISOString();
  await db.prepare(`INSERT INTO user_secrets (user_id, n8n_connection, n8n_active, updated_at) VALUES (?, ?, 1, ?)
    ON CONFLICT(user_id) DO UPDATE SET n8n_connection = excluded.n8n_connection, n8n_active = 1, updated_at = excluded.updated_at`).bind(userId, encrypted, now).run();
}

export async function setConnectionActive(userId: string, active: boolean) {
  const db = await database();
  await db.prepare("UPDATE user_secrets SET n8n_active = ?, updated_at = ? WHERE user_id = ?").bind(active ? 1 : 0, new Date().toISOString(), userId).run();
}

export async function removeConnection(userId: string) {
  const db = await database();
  await db.prepare("UPDATE user_secrets SET n8n_connection = NULL, n8n_active = 0, updated_at = ? WHERE user_id = ?").bind(new Date().toISOString(), userId).run();
}

export async function getLlmConfig(request: Request) {
  const user = await requireUser(request); const db = await database();
  const row = await db.prepare("SELECT llm_config FROM user_secrets WHERE user_id = ?").bind(user.id).first<{ llm_config: string | null }>();
  return row?.llm_config ? unsealValue<LlmConfig>(row.llm_config) : null;
}

export async function saveLlmConfig(userId: string, config: LlmConfig) {
  const db = await database(); const encrypted = await sealValue(config); const now = new Date().toISOString();
  await db.prepare(`INSERT INTO user_secrets (user_id, llm_config, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET llm_config = excluded.llm_config, updated_at = excluded.updated_at`).bind(userId, encrypted, now).run();
}

export async function removeLlmConfig(userId: string) {
  const db = await database();
  await db.prepare("UPDATE user_secrets SET llm_config = NULL, updated_at = ? WHERE user_id = ?").bind(new Date().toISOString(), userId).run();
}
