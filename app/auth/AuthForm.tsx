"use client";

import Link from "next/link";
import { useState } from "react";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/auth/${mode === "signup" ? "register" : "login"}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: form.get("name"), email: form.get("email"), password: form.get("password") }),
      });
      const text = await response.text();
      let body: { error?: string; requiresEmailConfirmation?: boolean } = {};
      try { body = text ? JSON.parse(text) as typeof body : {}; } catch { /* use the safe fallback below */ }
      if (!response.ok) throw new Error(body.error || "The server could not complete this request. Please try again.");
      if (body.requiresEmailConfirmation) {
        setMessage("Check your email to confirm the account, then return here to log in.");
        setBusy(false);
        return;
      }
      window.location.assign("/dashboard");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reach Nexus. Check your connection and try again.");
      setBusy(false);
    }
  }

  return <main className="auth-page">
    <Link className="brand auth-brand" href="/"><span className="brand-mark">N</span><span>N8N Nexus</span></Link>
    <section className="auth-card">
      <span className="kicker">PRIVATE WORKSPACE</span>
      <h1>{mode === "signup" ? "Create your Nexus account." : "Welcome back."}</h1>
      <p>{mode === "signup" ? "Your n8n and AI connections belong only to your account." : "Log in to your private n8n operations dashboard."}</p>
      <form onSubmit={submit}>
        {mode === "signup" && <label>Name<input name="name" autoComplete="name" required minLength={2} maxLength={80} /></label>}
        <label>Email<input name="email" type="email" autoComplete="email" required /></label>
        <label>Password<input name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={12} /><small>{mode === "signup" ? "Use at least 12 characters." : ""}</small></label>
        {error && <div className="form-error" role="alert"><span>!</span>{error}</div>}
        {message && <div className="form-message" role="status">{message}</div>}
        <button className="button button-primary" disabled={busy || Boolean(message)}>{busy ? "Please wait…" : mode === "signup" ? "Create account →" : "Log in →"}</button>
      </form>
      <div className="auth-switch">{mode === "signup" ? <>Already have an account? <Link href="/login">Log in</Link></> : <>New to Nexus? <Link href="/signup">Create an account</Link></>}</div>
    </section>
  </main>;
}
