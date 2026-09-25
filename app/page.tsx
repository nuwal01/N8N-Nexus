import Link from "next/link";

export const metadata = {
  title: "N8N Nexus — Your automation control room",
  description: "Monitor workflows, investigate failures, and manage your n8n instance from one focused dashboard.",
};

const features = [
  ["01", "See the whole system", "Workflows, activation state, recent runs, and failure rate — without hunting through tabs."],
  ["02", "Act in one click", "Pause a risky workflow, bring it back online, or retry a failed execution from the same view."],
  ["03", "Find the break fast", "Jump straight to the failed node, the error message, and the details that help you fix it."],
];

export default function Home() {
  return (
    <main className="landing">
      <nav className="site-nav wrap" aria-label="Primary navigation">
        <Link className="brand" href="/" aria-label="N8N Nexus home"><span className="brand-mark">N</span><span>N8N Nexus</span></Link>
        <div className="nav-links"><a href="#capabilities">Capabilities</a><a href="#security">Security</a></div>
        <div className="landing-auth"><Link className="text-link" href="/login">Log in</Link><Link className="button button-small button-dark" href="/signup">Sign up <span>↗</span></Link></div>
      </nav>

      <section className="hero wrap">
        <div className="eyebrow"><span className="live-dot" /> Stage 3 · private n8n operations</div>
        <h1>Your automations.<br /><em>Under control.</em></h1>
        <p className="hero-copy">One clear place to monitor workflows, understand failures, and keep every n8n automation moving.</p>
        <div className="hero-actions">
          <Link className="button button-primary" href="/signup">Create your private workspace <span>→</span></Link>
          <a className="text-link" href="#capabilities">See what it does <span>↓</span></a>
        </div>
        <div className="hero-board" aria-label="Dashboard preview">
          <div className="preview-top"><span className="preview-logo">N</span><span>Operations overview</span><span className="preview-connected"><i /> Connected</span></div>
          <div className="preview-grid">
            <div className="preview-metric"><small>ACTIVE WORKFLOWS</small><strong>12</strong><span>of 15 total</span></div>
            <div className="preview-metric"><small>SUCCESS RATE · 24H</small><strong>97.4%</strong><span className="positive">↑ 2.1%</span></div>
            <div className="preview-metric preview-alert"><small>NEEDS ATTENTION</small><strong>2</strong><span>failed runs</span></div>
          </div>
          <div className="preview-table">
            <div className="preview-row preview-head"><span>Workflow</span><span>Status</span><span>Last run</span></div>
            <div className="preview-row"><span><b className="node-icon orange">⌁</b> New lead → CRM</span><span className="status success">● Active</span><span>2 min ago</span></div>
            <div className="preview-row"><span><b className="node-icon violet">◇</b> Daily revenue digest</span><span className="status success">● Active</span><span>18 min ago</span></div>
            <div className="preview-row"><span><b className="node-icon blue">↗</b> Customer onboarding</span><span className="status error">● Failed</span><span>31 min ago</span></div>
          </div>
        </div>
      </section>

      <section className="signal-strip"><div className="wrap"><span>BUILT FOR OPERATORS</span><span>•</span><span>WORKS WITH N8N CLOUD</span><span>•</span><span>WORKS WITH SELF-HOSTED</span><span>•</span><span>YOUR KEY STAYS PRIVATE</span></div></section>

      <section className="features wrap" id="capabilities">
        <div className="section-heading"><span className="kicker">THE CONTROL LAYER</span><h2>Less tab-hopping.<br />More knowing.</h2></div>
        <div className="feature-grid">{features.map(([number, title, copy]) => <article className="feature-card" key={number}><span className="feature-number">{number}</span><div className="feature-glyph" aria-hidden="true"><i /><i /><i /></div><h3>{title}</h3><p>{copy}</p></article>)}</div>
      </section>

      <section className="security-section" id="security"><div className="wrap security-inner"><div><span className="kicker light">ACCOUNT-LEVEL SECURITY</span><h2>Your credentials are<br />not our product.</h2></div><p>Every account has its own encrypted n8n and optional LLM connection. Credentials remain server-side and are never shared between Nexus users, committed to source control, or stored in browser storage.</p></div></section>

      <section className="cta wrap"><div><span className="kicker">READY WHEN YOU ARE</span><h2>Bring calm to<br />your automations.</h2></div><Link className="button button-primary button-large" href="/signup">Create account <span>→</span></Link></section>
      <footer className="site-footer wrap"><Link className="brand" href="/"><span className="brand-mark">N</span><span>N8N Nexus</span></Link><p>Stage 3 · Private workspaces</p><p>Built for n8n teams.</p></footer>
    </main>
  );
}
