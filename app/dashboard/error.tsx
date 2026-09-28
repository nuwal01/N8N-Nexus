"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Keep error details out of the browser console because upstream errors can contain sensitive context.
    void error.digest;
  }, [error]);

  return <main className="auth-page">
    <Link className="brand auth-brand" href="/"><span className="brand-mark">N</span><span>N8N Nexus</span></Link>
    <section className="auth-card">
      <span className="kicker">PRIVATE WORKSPACE</span>
      <h1>Your workspace could not load.</h1>
      <p>Nexus could not reach Supabase or read this account&apos;s private settings. Check the server environment, database migration, and RLS policies, then try again.</p>
      <button className="button button-primary" onClick={reset}>Try again →</button>
      <div className="auth-switch"><Link href="/">Return to the public homepage</Link></div>
    </section>
  </main>;
}
