import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";

const port = 3217;
let server;

test.before(async () => {
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: "ignore",
  });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch { /* wait for the production server */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Next.js production server did not become ready.");
});

test.after(() => server?.kill());

test("server-renders the N8N Nexus public site", async () => {
  const response = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /N8N Nexus/);
  assert.match(html, /Your automations/);
  assert.match(html, /Under control/);
});

test("exposes the Render health endpoint", async () => {
  const response = await fetch(`http://127.0.0.1:${port}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
});

test("serves authentication pages by direct URL", async () => {
  for (const path of ["/login", "/signup", "/auth/error"]) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  }
});

test("protects the dashboard and every private API without a session", async () => {
  const dashboard = await fetch(`http://127.0.0.1:${port}/dashboard`, { redirect: "manual" });
  assert.equal(dashboard.status, 307);
  assert.equal(dashboard.headers.get("location"), "/login");

  for (const path of ["/api/auth/me", "/api/connection", "/api/workflows", "/api/executions", "/api/ai/settings"]) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    assert.equal(response.status, 401, path);
    const body = await response.json();
    assert.equal(body.code, "AUTH_REQUIRED", path);
  }
});

test("rejects invalid registration data before contacting Supabase", async () => {
  const response = await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "x", email: "invalid", password: "short" }),
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /name between 2 and 80/i);
});

test("returns invalid confirmation links to the visible auth error page", async () => {
  for (const path of ["/auth/callback?code=invalid", "/auth/confirm?token_hash=invalid&type=email"]) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { redirect: "manual" });
    assert.equal(response.status, 307, path);
    assert.equal(new URL(response.headers.get("location")).pathname, "/auth/error");
  }
});

test("sends security and no-store headers", async () => {
  const publicResponse = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(publicResponse.headers.get("x-content-type-options"), "nosniff");
  assert.equal(publicResponse.headers.get("x-frame-options"), "DENY");

  const apiResponse = await fetch(`http://127.0.0.1:${port}/api/auth/me`);
  assert.match(apiResponse.headers.get("cache-control") ?? "", /no-store/i);
});
