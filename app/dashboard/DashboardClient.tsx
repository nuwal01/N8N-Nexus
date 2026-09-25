"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Execution, Workflow } from "../../lib/types";
import NexusAi from "./NexusAi";

type ConnectionState = { connected: boolean; saved: boolean; mode: "live" | "demo" | null; baseUrl: string | null; user: { name: string; email: string } };
type WorkflowIssue = { id: string; name: string; message: string; href: string };

class ApiRequestError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const body = await response.json();
  if (!response.ok) throw new ApiRequestError(body.error || "Something went wrong.", response.status, body.code);
  return body as T;
}

function relativeTime(value?: string) {
  if (!value) return "—";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

function duration(item: Execution) {
  if (!item.startedAt || !item.stoppedAt) return item.finished ? "—" : "Running";
  const ms = new Date(item.stoppedAt).getTime() - new Date(item.startedAt).getTime();
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
}

function executionStatus(item: Execution) {
  if (item.status) return item.status === "crashed" ? "error" : item.status;
  return item.finished ? "success" : "running";
}

export default function DashboardClient({ initialConnection }: { initialConnection: ConnectionState }) {
  const [connection, setConnection] = useState<ConnectionState>(initialConnection);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [selected, setSelected] = useState<Execution | null>(null);
  const [section, setSection] = useState<"overview" | "workflows" | "executions" | "ai" | "account">("overview");
  const [loading, setLoading] = useState(initialConnection.connected);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [workflowIssue, setWorkflowIssue] = useState<WorkflowIssue | null>(null);
  const [toast, setToast] = useState("");

  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true); else setRefreshing(true);
    setError("");
    try {
      const [workflowResult, executionResult] = await Promise.all([
        api<{ data: Workflow[] }>("/api/workflows"),
        api<{ data: Execution[] }>("/api/executions"),
      ]);
      setWorkflows(workflowResult.data || []);
      setExecutions(executionResult.data || []);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) {
        window.location.assign("/login");
      }
      setError(err instanceof Error ? err.message : "Could not load n8n data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!initialConnection.connected) return;
    const loadTimer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(loadTimer);
  }, [initialConnection.connected, loadData]);

  const stats = useMemo(() => {
    const active = workflows.filter((workflow) => workflow.active).length;
    const successful = executions.filter((item) => executionStatus(item) === "success").length;
    const failed = executions.filter((item) => executionStatus(item) === "error").length;
    return { active, successful, failed, rate: executions.length ? Math.round((successful / executions.length) * 1000) / 10 : 0 };
  }, [workflows, executions]);

  async function connect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true); setError("");
    try {
      const state = await api<Omit<ConnectionState, "user">>("/api/connection", { method: "POST", body: JSON.stringify({ baseUrl: form.get("baseUrl"), apiKey: form.get("apiKey") }) });
      setConnection({ ...state, user: connection.user });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed.");
      setLoading(false);
    }
  }

  async function connectDemo() {
    setLoading(true); setError("");
    try {
      const state = await api<Omit<ConnectionState, "user">>("/api/connection", { method: "POST", body: JSON.stringify({ demo: true }) });
      setConnection({ ...state, user: connection.user });
      await loadData();
    } catch (err) { setError(err instanceof Error ? err.message : "Demo could not load."); setLoading(false); }
  }

  async function disconnect() {
    await api("/api/connection", { method: "DELETE" });
    setConnection((current) => ({ ...current, connected: false, saved: true, mode: null }));
    setWorkflows([]); setExecutions([]); setSelected(null); setWorkflowIssue(null); setError("");
  }

  async function reconnectSaved() {
    setLoading(true); setError("");
    try { const state = await api<Omit<ConnectionState, "user">>("/api/connection", { method: "POST", body: JSON.stringify({ saved: true }) }); setConnection({ ...state, user: connection.user }); await loadData(); }
    catch (err) { setError(err instanceof Error ? err.message : "Saved connection could not be reached."); setLoading(false); }
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST", body: "{}" });
    window.location.assign("/login");
  }

  async function removeSavedConnection() {
    await api("/api/connection?remove=true", { method: "DELETE" });
    setConnection((current) => ({ ...current, connected: false, saved: false, mode: null, baseUrl: null }));
    setWorkflows([]); setExecutions([]); setSection("overview"); showToast("Saved n8n connection removed.");
  }

  async function toggleWorkflow(workflow: Workflow) {
    const next = !workflow.active;
    setWorkflowIssue((issue) => issue?.id === workflow.id ? null : issue);
    setWorkflows((items) => items.map((item) => item.id === workflow.id ? { ...item, active: next } : item));
    try {
      await api("/api/workflows/toggle", { method: "POST", body: JSON.stringify({ id: workflow.id, active: next }) });
      showToast(`${workflow.name} ${next ? "activated" : "deactivated"}.`);
    } catch (err) {
      setWorkflows((items) => items.map((item) => item.id === workflow.id ? { ...item, active: !next } : item));
      if (next && err instanceof ApiRequestError && err.code === "MISSING_TRIGGER") {
        const editorBaseUrl = connection.mode === "demo" ? "http://localhost:5678" : connection.baseUrl?.replace(/\/$/, "");
        const href = `${editorBaseUrl}/workflow/${encodeURIComponent(workflow.id)}`;
        setWorkflowIssue({
          id: workflow.id,
          name: workflow.name,
          message: "This workflow cannot be activated until it has a trigger node. Add a trigger in n8n, save the workflow, then try again.",
          href,
        });
        return;
      }
      setError(err instanceof Error ? err.message : "Could not update workflow.");
    }
  }

  async function inspectExecution(item: Execution) {
    setSelected(item);
    try {
      const detail = await api<Execution>(`/api/executions/${encodeURIComponent(item.id)}`);
      setSelected(detail);
    } catch { /* list payload may already contain the useful error */ }
  }

  async function retryExecution(item: Execution) {
    try {
      await api(`/api/executions/${encodeURIComponent(item.id)}/retry`, { method: "POST", body: "{}" });
      showToast(`Execution #${item.id} queued for retry.`);
      setSelected(null);
      await loadData(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Retry failed."); }
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }

  if (!connection.connected) {
    return <main className="connect-page">
      <div className="connect-grid" />
      <Link className="brand connect-brand" href="/"><span className="brand-mark">N</span><span>N8N Nexus</span></Link>
      <button className="connect-logout" onClick={logout}>Log out</button>
      <section className="connect-card">
        <div className="connect-intro"><span className="kicker">{connection.user.name}&apos;S WORKSPACE</span><h1>Connect your<br />n8n instance.</h1><p>Use an HTTPS URL for n8n Cloud or an internet-reachable self-hosted instance. A hosted Nexus server cannot reach n8n running at localhost on your computer.</p><small className="privacy-note">Your URL and API key are encrypted server-side and belong only to this account.</small></div>
        <form className="connect-form" onSubmit={connect}>
          <label>n8n instance URL<input name="baseUrl" type="url" placeholder="http://localhost:5678" defaultValue="http://localhost:5678" required autoComplete="url" /></label>
          <label>API key<span className="label-note">n8n Settings → API</span><input name="apiKey" type="password" placeholder="Paste your n8n API key" required autoComplete="off" /></label>
          {error && <div className="form-error" role="alert"><span>!</span>{error}</div>}
          <button className="button button-primary connect-submit" disabled={loading}>{loading ? "Connecting…" : "Connect securely"}<span>→</span></button>
          {connection.saved && <button className="saved-connect-button" type="button" onClick={reconnectSaved} disabled={loading}>Reconnect saved instance <span>→</span></button>}
          {connection.saved && <button className="remove-saved-button" type="button" onClick={removeSavedConnection} disabled={loading}>Remove saved connection</button>}
          <div className="or"><span />or<span /></div>
          <button className="demo-button" type="button" onClick={connectDemo} disabled={loading}>Explore with demo data <span>↗</span></button>
        </form>
        <div className="connection-foot"><span>◈ Encrypted session</span><span>◉ Works with cloud & local</span></div>
      </section>
      <p className="connect-note">Stage 3 · Signed in as {connection.user.email}</p>
    </main>;
  }

  const visibleExecutions = section === "overview" ? executions.slice(0, 6) : executions;
  const visibleWorkflows = section === "overview" ? workflows.slice(0, 5) : workflows;

  return <div className="app-shell">
    <aside className="sidebar">
      <Link className="brand sidebar-brand" href="/"><span className="brand-mark">N</span><span>N8N Nexus</span></Link>
      <nav className="app-nav" aria-label="Dashboard sections">
        <button className={section === "overview" ? "active" : ""} onClick={() => setSection("overview")}><span>⌂</span>Overview</button>
        <button className={section === "workflows" ? "active" : ""} onClick={() => setSection("workflows")}><span>⌁</span>Workflows<small>{workflows.length}</small></button>
        <button className={section === "executions" ? "active" : ""} onClick={() => setSection("executions")}><span>↯</span>Executions<small>{stats.failed || ""}</small></button>
        <button className={section === "ai" ? "active" : ""} onClick={() => setSection("ai")}><span>✦</span>Nexus AI<small>NEW</small></button>
        <button className={section === "account" ? "active" : ""} onClick={() => setSection("account")}><span>◎</span>Account</button>
      </nav>
      <div className="sidebar-bottom"><div className="user-card"><small>{connection.user.name}</small><strong>{connection.user.email}</strong></div><div className="instance-card"><span className="instance-dot" /><div><small>{connection.mode === "demo" ? "DEMO MODE" : "CONNECTED INSTANCE"}</small><strong>{connection.baseUrl?.replace(/^https?:\/\//, "")}</strong></div></div><button className="disconnect-button" onClick={disconnect}>Disconnect n8n <span>↗</span></button><button className="disconnect-button" onClick={logout}>Log out <span>→</span></button></div>
    </aside>
    <main className="dashboard-main">
      <header className="dashboard-header"><div><span className="kicker">OPERATIONS CONTROL</span><h1>{section === "ai" ? "Nexus AI" : section[0].toUpperCase() + section.slice(1)}</h1></div><div className="header-actions"><span className="last-updated">Live data</span><button className="refresh-button" onClick={() => loadData(true)} disabled={refreshing}>{refreshing ? "Refreshing…" : "↻ Refresh"}</button><button className="mobile-disconnect-button" onClick={disconnect}>Disconnect</button></div></header>
      {error && <div className="dashboard-error"><span>!</span><p><strong>We hit a snag</strong>{error}</p><button onClick={() => setError("")}>×</button></div>}
      {loading ? <DashboardSkeleton /> : <>
        {section === "ai" && <NexusAi workflows={workflows} executions={executions} mode={connection.mode} onChanged={() => loadData(true)} notify={showToast} />}
        {section === "account" && <AccountSettings connection={connection} onDisconnect={disconnect} onRemove={removeSavedConnection} onLogout={logout} />}
        {section === "overview" && <section className="metric-grid">
          <article className="metric-card"><small>ACTIVE WORKFLOWS</small><div><strong>{stats.active}</strong><span>of {workflows.length}</span></div><i className="metric-bar"><b style={{ width: `${workflows.length ? stats.active / workflows.length * 100 : 0}%` }} /></i></article>
          <article className="metric-card"><small>SUCCESS RATE</small><div><strong>{stats.rate}%</strong><span>last {executions.length} runs</span></div><i className="metric-spark">⌁</i></article>
          <article className={`metric-card ${stats.failed ? "metric-card-alert" : ""}`}><small>NEEDS ATTENTION</small><div><strong>{stats.failed}</strong><span>failed runs</span></div><i className="alert-ring">!</i></article>
        </section>}
        {(section === "overview" || section === "workflows") && <section className="data-panel"><div className="panel-heading"><div><span className="kicker">AUTOMATIONS</span><h2>{section === "overview" ? "Workflow health" : "All workflows"}</h2></div>{section === "overview" && <button onClick={() => setSection("workflows")}>View all <span>→</span></button>}</div><div className="workflow-list">{visibleWorkflows.map((workflow) => <div className="workflow-item" key={workflow.id}><div className="workflow-row"><span className={`workflow-symbol ${workflow.active ? "is-active" : ""}`}>⌁</span><div className="workflow-title"><strong>{workflow.name}</strong><span>{workflow.nodes?.length || "—"} nodes · Updated {relativeTime(workflow.updatedAt)}</span></div><span className={`pill ${workflow.active ? "pill-success" : "pill-muted"}`}>● {workflow.active ? "Active" : "Inactive"}</span><label className="switch" aria-label={`${workflow.active ? "Deactivate" : "Activate"} ${workflow.name}`}><input type="checkbox" checked={workflow.active} onChange={() => toggleWorkflow(workflow)} /><span /></label></div>{workflowIssue?.id === workflow.id && <div className="workflow-issue" role="alert"><span className="workflow-issue-icon">!</span><div><strong>{workflowIssue.name} needs a trigger</strong><p>{workflowIssue.message}</p></div><a href={workflowIssue.href} target="_blank" rel="noreferrer">Open in n8n <span>↗</span></a></div>}</div>)}{!visibleWorkflows.length && <EmptyState message="No workflows found on this instance." />}</div></section>}
        {(section === "overview" || section === "executions") && <section className="data-panel execution-panel"><div className="panel-heading"><div><span className="kicker">RECENT ACTIVITY</span><h2>{section === "overview" ? "Latest executions" : "Execution history"}</h2></div>{section === "overview" && <button onClick={() => setSection("executions")}>View all <span>→</span></button>}</div><div className="execution-table"><div className="execution-row execution-head"><span>STATUS</span><span>WORKFLOW</span><span>STARTED</span><span>DURATION</span><span /></div>{visibleExecutions.map((item) => { const status = executionStatus(item); return <button className="execution-row" key={item.id} onClick={() => inspectExecution(item)}><span><b className={`status-dot status-${status}`} />{status}</span><span><strong>{item.workflowData?.name || `Workflow ${item.workflowId || "unknown"}`}</strong><small>#{item.id}</small></span><span>{relativeTime(item.startedAt)}</span><span>{duration(item)}</span><span>→</span></button>; })}{!visibleExecutions.length && <EmptyState message="No executions found yet." />}</div></section>}
      </>}
    </main>
    {selected && <ExecutionDrawer execution={selected} onClose={() => setSelected(null)} onRetry={() => retryExecution(selected)} />}
    {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
  </div>;
}

function EmptyState({ message }: { message: string }) { return <div className="empty-state"><span>◇</span><p>{message}</p></div>; }

function DashboardSkeleton() { return <div className="dashboard-skeleton"><div /><div /><div /><section /><section /></div>; }

function AccountSettings({ connection, onDisconnect, onRemove, onLogout }: { connection: ConnectionState; onDisconnect: () => void; onRemove: () => void; onLogout: () => void }) {
  return <section className="account-panel"><header><span className="kicker">PRIVATE ACCOUNT</span><h2>{connection.user.name}</h2><p>{connection.user.email}</p></header><div className="account-setting"><div><strong>n8n connection</strong><p>{connection.baseUrl || "No saved connection"}</p><small>{connection.connected ? "Active for this account" : connection.saved ? "Saved but disconnected" : "Not configured"}</small></div><div className="account-actions">{connection.connected && <button onClick={onDisconnect}>Disconnect</button>}{connection.saved && <button className="danger-action" onClick={onRemove}>Remove saved connection</button>}</div></div><div className="account-setting"><div><strong>Local n8n</strong><p>Localhost works while Nexus runs on this same computer. A hosted Nexus deployment cannot directly reach localhost; expose n8n through a secure HTTPS URL instead.</p></div></div><div className="account-setting"><div><strong>Session</strong><p>Logging out ends this browser session but keeps your encrypted account connections for your next login.</p></div><button onClick={onLogout}>Log out</button></div></section>;
}

function ExecutionDrawer({ execution, onClose, onRetry }: { execution: Execution; onClose: () => void; onRetry: () => void }) {
  const status = executionStatus(execution);
  const details = execution.data?.resultData;
  const node = details?.error?.node?.name || details?.lastNodeExecuted;
  return <div className="drawer-backdrop"><aside className="drawer" aria-label="Execution details"><div className="drawer-header"><div><span className={`pill pill-${status === "success" ? "success" : status === "error" ? "error" : "muted"}`}>● {status}</span><h2>Execution #{execution.id}</h2><p>{execution.workflowData?.name || `Workflow ${execution.workflowId || ""}`}</p></div><button onClick={onClose} aria-label="Close details">×</button></div><div className="drawer-meta"><div><small>STARTED</small><strong>{execution.startedAt ? new Date(execution.startedAt).toLocaleString() : "—"}</strong></div><div><small>DURATION</small><strong>{duration(execution)}</strong></div></div>{status === "error" ? <><section className="failure-card"><span className="failure-icon">!</span><div><small>FAILED NODE</small><h3>{node || "Unavailable"}</h3>{details?.error?.node?.type && <p>{details.error.node.type}</p>}</div></section><section className="error-detail"><small>ERROR MESSAGE</small><h3>{details?.error?.message || "n8n did not return an error message."}</h3>{details?.error?.description && <p>{details.error.description}</p>}</section>{details?.error?.stack && <details className="stack-detail"><summary>Technical details</summary><pre>{details.error.stack}</pre></details>}<button className="button button-primary retry-button" onClick={onRetry}>↻ Retry failed execution</button></> : <section className="success-detail"><span>✓</span><h3>{status === "success" ? "Execution completed" : "Execution is in progress"}</h3><p>{status === "success" ? "Every node finished without an error." : "This execution has not finished yet."}</p></section>}</aside></div>;
}
