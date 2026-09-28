import Link from "next/link";

export const metadata = { title: "Confirmation link problem" };

export default function AuthErrorPage() {
  return <main className="auth-page">
    <Link className="brand auth-brand" href="/"><span className="brand-mark">N</span><span>N8N Nexus</span></Link>
    <section className="auth-card">
      <span className="kicker">ACCOUNT CONFIRMATION</span>
      <h1>This confirmation link could not be used.</h1>
      <p>The link may be invalid or expired. Return to login, or create the account again to request a new confirmation email.</p>
      <Link className="button button-primary" href="/login">Return to login →</Link>
    </section>
  </main>;
}
