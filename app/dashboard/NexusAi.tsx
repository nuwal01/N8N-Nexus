"use client";

import { useEffect, useMemo, useState } from "react";
import type { AiProposal, Execution, LlmProvider, Workflow } from "../../lib/types";

type Settings = { configured: boolean; provider: LlmProvider | null; model: string | null; discovery?: "discovered" | "fallback"; discoveryMessage?: string };
type Props = { workflows: Workflow[]; executions: Execution[]; mode: "live" | "demo" | null; onChanged: () => Promise<void>; notify: (message: string) => void };

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Request failed.");
  return body;
}

export default function NexusAi({ workflows, executions, mode, onChanged, notify }: Props) {
  const [settings, setSettings] = useState<Settings>({ configured: false, provider: null, model: null });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [action, setAction] = useState<"create" | "edit" | "diagnose">("create");
  const [target, setTarget] = useState("");
  const [prompt, setPrompt] = useState("");
  const [proposal, setProposal] = useState<AiProposal | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const failed = useMemo(() => executions.filter((item) => ["error", "crashed"].includes(item.status || "")), [executions]);
  useEffect(() => { void call<Settings>("/api/ai/settings").then(setSettings).catch(() => undefined); }, []);

  async function propose(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setProposal(null); setConfirming(false);
    try {
      const result = await call<{ proposal: AiProposal; approvalToken: string | null }>("/api/ai/propose", { method: "POST", body: JSON.stringify({ mode: action, request: prompt, workflowId: action === "edit" ? target : undefined, executionId: action === "diagnose" ? target : undefined }) });
      setProposal(result.proposal); setToken(result.approvalToken);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not prepare a proposal."); } finally { setBusy(false); }
  }

  async function apply() {
    if (!token) return; setBusy(true); setError("");
    try {
      const result = await call<{ message: string; simulated: boolean }>("/api/ai/apply", { method: "POST", body: JSON.stringify({ approvalToken: token }) });
      notify(result.message); setProposal(null); setToken(null); setConfirming(false); setPrompt("");
      if (!result.simulated) await onChanged();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The approved change could not be saved."); } finally { setBusy(false); }
  }

  function reject() { setProposal(null); setToken(null); setConfirming(false); notify("Proposal rejected. Nothing was changed."); }

  return <section className="ai-workspace">
    <div className="ai-banner"><div><span className="kicker">OPTIONAL · REVIEW FIRST</span><h2>Describe the workflow. Keep control of the save.</h2><p>Nexus AI prepares a proposal using selected n8n context. It cannot activate workflows, retry runs, or change credentials.</p></div><button className="ai-settings-button" onClick={() => setSettingsOpen(true)}>{settings.configured ? `${settings.provider} · ${settings.model}` : "Configure AI"}</button></div>
    {!settings.configured ? <div className="ai-empty"><span>✦</span><h3>Connect an LLM when you need it</h3><p>Stage 1 continues to work without an LLM. Keys stay in an encrypted HTTP-only server session—not Git or browser storage.</p><button className="button button-primary" onClick={() => setSettingsOpen(true)}>Choose a provider</button></div> : <>
      <form className="ai-composer" onSubmit={propose}>
        <div className="ai-tabs">{(["create", "edit", "diagnose"] as const).map((item) => <button type="button" key={item} className={action === item ? "active" : ""} onClick={() => { setAction(item); setTarget(""); setProposal(null); }}>{item === "create" ? "Create workflow" : item === "edit" ? "Edit workflow" : "Help failed run"}</button>)}</div>
        {action === "edit" && <label>Workflow<select value={target} onChange={(event) => setTarget(event.target.value)} required><option value="">Choose a workflow…</option>{workflows.map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.name}</option>)}</select></label>}
        {action === "diagnose" && <label>Failed execution<select value={target} onChange={(event) => setTarget(event.target.value)} required><option value="">Choose a failed run…</option>{failed.map((item) => <option key={item.id} value={item.id}>#{item.id} · {item.workflowData?.name || item.workflowId}</option>)}</select></label>}
        <label>{action === "create" ? "What should the workflow do?" : action === "edit" ? "What should change?" : "What help or small fix do you want?"}<textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Be specific about triggers, inputs, conditions, and output." required minLength={8} /></label>
        <div className="ai-composer-foot"><span>No changes happen at this step.</span><button className="button button-dark" disabled={busy}>{busy ? "Preparing preview…" : "Generate preview →"}</button></div>
      </form>
      {error && <div className="dashboard-error" role="alert"><span>!</span><p><strong>Nexus AI stopped safely</strong>{error}</p></div>}
      {proposal && <article className="proposal-card"><header><div><span className={`pill ${proposal.safeToApply ? "pill-success" : "pill-error"}`}>{proposal.safeToApply ? "READY FOR REVIEW" : "GUIDANCE ONLY"}</span><h3>{proposal.title}</h3><p>{proposal.summary}</p></div>{proposal.editorUrl && <a href={proposal.editorUrl} target="_blank" rel="noreferrer">Open in n8n ↗</a>}</header>{proposal.blockedReason && <div className="proposal-blocked"><strong>Not safe to apply</strong><p>{proposal.blockedReason}</p></div>}{proposal.changes.length > 0 && <div className="change-list"><h4>Exact proposed changes</h4>{proposal.changes.map((change, index) => <div className="change-row" key={`${change.path}-${index}`}><code>{change.path}</code><div><small>BEFORE</small><p>{change.before || "Not present"}</p></div><span>→</span><div><small>AFTER</small><p>{change.after}</p></div><em>{change.reason}</em></div>)}</div>}{proposal.workflow && <details className="json-preview"><summary>Review proposed workflow JSON</summary><pre>{JSON.stringify(proposal.workflow, null, 2)}</pre></details>}{proposal.guidance.length > 0 && <ul className="proposal-guidance">{proposal.guidance.map((item) => <li key={item}>{item}</li>)}</ul>}<footer><button className="reject-button" onClick={reject}>Reject proposal</button>{token && !confirming && <button className="button button-primary" onClick={() => setConfirming(true)}>Approve changes</button>}{token && confirming && <div className="final-confirm"><span>This saves exactly the preview. It will not activate or retry anything.</span><button className="button button-primary" disabled={busy} onClick={apply}>{busy ? "Saving…" : "Confirm save to n8n"}</button></div>}</footer></article>}
    </>}
    {settingsOpen && <SettingsDialog current={settings} demo={mode === "demo"} onClose={() => setSettingsOpen(false)} onSaved={(next) => { setSettings(next); setSettingsOpen(false); notify(next.discoveryMessage || `LLM provider connected with ${next.model}.`); }} />}
  </section>;
}

function SettingsDialog({ current, demo, onClose, onSaved }: { current: Settings; demo: boolean; onClose: () => void; onSaved: (value: Settings) => void }) {
  const [provider, setProvider] = useState<LlmProvider>(demo ? "demo" : current.provider === "anthropic" ? "anthropic" : "openai");
  const [model, setModel] = useState(""); const [advanced, setAdvanced] = useState(false); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function save(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError(""); try { onSaved(await call<Settings>("/api/ai/settings", { method: "POST", body: JSON.stringify({ provider, model, apiKey: form.get("apiKey") }) })); } catch (cause) { setError(cause instanceof Error ? cause.message : "Provider could not be connected."); } finally { setBusy(false); } }
  return <div className="modal-backdrop"><form className="settings-modal" onSubmit={save}><header><div><span className="kicker">NEXUS AI SETTINGS</span><h2>Choose one provider</h2></div><button type="button" onClick={onClose} aria-label="Close">×</button></header><p>Choose OpenAI or Anthropic and paste that provider&apos;s key. Nexus validates it, discovers the models available to the key, and selects a suitable model automatically.</p><label>Provider<select value={provider} onChange={(event) => { setProvider(event.target.value as LlmProvider); setModel(""); }}><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option>{demo && <option value="demo">Built-in demo AI</option>}</select></label>{provider !== "demo" && <label>{provider === "openai" ? "OpenAI" : "Anthropic"} API key<input name="apiKey" type="password" autoComplete="off" required placeholder={provider === "openai" ? "sk-…" : "sk-ant-…"} /></label>}{provider !== "demo" && <details className="advanced-settings" open={advanced} onToggle={(event) => setAdvanced(event.currentTarget.open)}><summary>Advanced settings</summary><label>Manual model override <span className="label-note">Optional</span><input value={model} onChange={(event) => setModel(event.target.value)} placeholder="Leave blank for automatic selection" /></label><p>Use an exact model ID only when automatic selection is unsuitable. Nexus verifies that the model is available to this key.</p></details>}<small>The API key is sent only to the selected provider from the server and stored in an encrypted HTTP-only session. It is never returned by this settings API.</small>{error && <div className="form-error" role="alert"><span>!</span>{error}</div>}<footer><button type="button" className="reject-button" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? "Validating key and discovering models…" : "Save provider"}</button></footer></form></div>;
}
