import "server-only";

import { createSupabaseServerClient } from "./supabase/server";
import type { Connection, LlmConfig } from "./types";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type UserRecord = { id: string; name: string; email: string; created_at: string };

function encryptionSecret() {
  const value = process.env.DATA_ENCRYPTION_KEY;
  if (!value || value.length < 32) {
    throw new StorageError("Secure storage is not configured. Set DATA_ENCRYPTION_KEY to at least 32 characters.", 500, "ENCRYPTION_NOT_CONFIGURED");
  }
  return value;
}

async function encryptionKey() {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(encryptionSecret()));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function sealValue(value: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), encoder.encode(JSON.stringify(value)));
  const payload = new Uint8Array(iv.length + encrypted.byteLength);
  payload.set(iv);
  payload.set(new Uint8Array(encrypted), iv.length);
  return Buffer.from(payload).toString("base64url");
}

export async function unsealValue<T>(token: string): Promise<T | null> {
  try {
    const payload = new Uint8Array(Buffer.from(token, "base64url"));
    if (payload.length < 29) return null;
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: payload.slice(0, 12) }, await encryptionKey(), payload.slice(12));
    return JSON.parse(decoder.decode(decrypted)) as T;
  } catch (error) {
    if (error instanceof StorageError) throw error;
    return null;
  }
}

export class AuthError extends Error {
  constructor(message: string, public status = 401) { super(message); }
}

export class StorageError extends Error {
  constructor(message: string, public status = 503, public code = "STORAGE_UNAVAILABLE") { super(message); }
}

function storageError(error: unknown) {
  if (error instanceof StorageError) return error;
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code || "") : "";
  if (["42P01", "PGRST205"].includes(code)) {
    return new StorageError("Nexus storage is not initialized. Apply the Supabase migration, then try again.", 503, "STORAGE_NOT_READY");
  }
  if (["42501", "PGRST301"].includes(code)) {
    return new StorageError("Nexus could not access this account's private data. Verify the Supabase RLS policies and grants.", 503, "STORAGE_ACCESS_DENIED");
  }
  return new StorageError("Nexus could not access your private account data. Please try again.");
}

async function authenticatedContext() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userId = typeof claims?.sub === "string" ? claims.sub : null;
  if (error || !claims || !userId) {
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: unknown }).status) : 0;
    if (status >= 500) throw new StorageError("Supabase Auth is temporarily unavailable. Please try again.", 503, "AUTH_UNAVAILABLE");
    throw new AuthError("Log in to continue.", 401);
  }
  return { supabase, userId, claims };
}

export async function getUser(_request?: Request): Promise<UserRecord | null> {
  void _request;
  try {
    const { supabase, userId, claims } = await authenticatedContext();
    const { data: profile, error } = await supabase.from("profiles").select("name, created_at").eq("id", userId).maybeSingle();
    if (error) throw storageError(error);
    const metadata = claims.user_metadata && typeof claims.user_metadata === "object" ? claims.user_metadata as Record<string, unknown> : {};
    const email = typeof claims.email === "string" ? claims.email : "";
    const metadataName = typeof metadata.name === "string" ? metadata.name.trim() : "";
    return { id: userId, name: profile?.name || metadataName || email.split("@")[0] || "Nexus user", email, created_at: profile?.created_at || "" };
  } catch (error) {
    if (error instanceof AuthError) return null;
    throw error;
  }
}

export async function requireUser(request?: Request) {
  const user = await getUser(request);
  if (!user) throw new AuthError("Log in to continue.", 401);
  return user;
}

async function userClient(expectedUserId?: string) {
  const context = await authenticatedContext();
  if (expectedUserId && expectedUserId !== context.userId) throw new AuthError("You cannot access another user's data.", 403);
  return context;
}

export async function getConnection(_request?: Request, includeInactive = false): Promise<Connection | null> {
  const { supabase, userId } = await userClient();
  const { data, error } = await supabase.from("n8n_connections").select("encrypted_connection, active").eq("user_id", userId).maybeSingle();
  if (error) throw storageError(error);
  if (!data?.encrypted_connection || (!includeInactive && !data.active)) return null;
  const connection = await unsealValue<Connection>(data.encrypted_connection);
  if (!connection) throw new StorageError("Your saved n8n connection could not be decrypted. Verify that this environment uses the same DATA_ENCRYPTION_KEY that encrypted it.", 500, "DECRYPTION_FAILED");
  return connection;
}

export async function saveConnection(userId: string, connection: Connection) {
  const { supabase } = await userClient(userId);
  const { error } = await supabase.from("n8n_connections").upsert({ user_id: userId, encrypted_connection: await sealValue(connection), active: true, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw storageError(error);
}

export async function setConnectionActive(userId: string, active: boolean) {
  const { supabase } = await userClient(userId);
  const { error } = await supabase.from("n8n_connections").update({ active, updated_at: new Date().toISOString() }).eq("user_id", userId);
  if (error) throw storageError(error);
}

export async function removeConnection(userId: string) {
  const { supabase } = await userClient(userId);
  const { error } = await supabase.from("n8n_connections").delete().eq("user_id", userId);
  if (error) throw storageError(error);
}

export async function getLlmConfig(_request?: Request) {
  void _request;
  const { supabase, userId } = await userClient();
  const { data, error } = await supabase.from("ai_settings").select("encrypted_config").eq("user_id", userId).maybeSingle();
  if (error) throw storageError(error);
  if (!data?.encrypted_config) return null;
  const config = await unsealValue<LlmConfig>(data.encrypted_config);
  if (!config) throw new StorageError("Your saved Nexus AI settings could not be decrypted. Verify that this environment uses the same DATA_ENCRYPTION_KEY that encrypted them.", 500, "DECRYPTION_FAILED");
  return config;
}

export async function saveLlmConfig(userId: string, config: LlmConfig) {
  const { supabase } = await userClient(userId);
  const { error } = await supabase.from("ai_settings").upsert({ user_id: userId, encrypted_config: await sealValue(config), updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw storageError(error);
}

export async function removeLlmConfig(userId: string) {
  const { supabase } = await userClient(userId);
  const { error } = await supabase.from("ai_settings").delete().eq("user_id", userId);
  if (error) throw storageError(error);
}
