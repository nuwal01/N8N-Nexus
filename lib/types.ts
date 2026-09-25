export type Connection = {
  mode: "live" | "demo";
  baseUrl: string;
  apiKey?: string;
};

export type Workflow = {
  id: string;
  name: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  nodes?: unknown[];
  tags?: Array<{ id?: string; name: string }>;
};

export type Execution = {
  id: string;
  finished?: boolean;
  mode?: string;
  retryOf?: string | null;
  retrySuccessId?: string | null;
  startedAt?: string;
  stoppedAt?: string;
  status?: string;
  workflowId?: string;
  workflowData?: { id?: string; name?: string; nodes?: Array<{ name: string }> };
  data?: {
    resultData?: {
      error?: N8nError;
      lastNodeExecuted?: string;
    };
  };
};

export type N8nError = {
  message?: string;
  description?: string;
  name?: string;
  stack?: string;
  node?: { name?: string; type?: string };
};

export type LlmProvider = "openai" | "anthropic" | "demo";
export type LlmConfig = { provider: LlmProvider; model: string; apiKey?: string };

export type WorkflowDocument = {
  name: string;
  nodes: Array<Record<string, unknown>>;
  connections: Record<string, unknown>;
  settings: Record<string, unknown>;
};

export type AiProposal = {
  action: "create" | "update" | "guidance";
  title: string;
  summary: string;
  targetWorkflowId: string | null;
  safeToApply: boolean;
  blockedReason: string | null;
  changes: Array<{ path: string; before: string | null; after: string; reason: string }>;
  workflow: WorkflowDocument | null;
  guidance: string[];
  editorUrl: string | null;
};
