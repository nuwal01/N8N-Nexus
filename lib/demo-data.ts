import type { Execution, Workflow } from "./types";

const now = Date.now();
const iso = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();

export const demoWorkflows: Workflow[] = [
  { id: "wf-01", name: "New lead → CRM + Slack", active: true, updatedAt: iso(42), nodes: [{}, {}, {}, {}], tags: [{ name: "Sales" }] },
  { id: "wf-02", name: "Daily revenue digest", active: true, updatedAt: iso(180), nodes: [{}, {}, {}], tags: [{ name: "Finance" }] },
  { id: "wf-03", name: "Manual data clean-up", active: false, updatedAt: iso(1440), nodes: [{}, {}, {}, {}, {}], tags: [{ name: "Operations" }] },
  { id: "wf-04", name: "Customer onboarding", active: true, updatedAt: iso(2800), nodes: [{}, {}, {}, {}, {}, {}], tags: [{ name: "Success" }] },
];

export const demoExecutions: Execution[] = [
  { id: "10482", status: "success", finished: true, startedAt: iso(8), stoppedAt: iso(7.7), workflowId: "wf-01", workflowData: { name: "New lead → CRM + Slack" } },
  { id: "10481", status: "error", finished: true, startedAt: iso(24), stoppedAt: iso(23.8), workflowId: "wf-04", workflowData: { name: "Customer onboarding" }, data: { resultData: { lastNodeExecuted: "Create HubSpot contact", error: { name: "NodeApiError", message: "The resource already exists", description: "A contact with this email address already exists in HubSpot.", node: { name: "Create HubSpot contact", type: "n8n-nodes-base.hubspot" }, stack: "NodeApiError: The resource already exists\n    at ExecuteContext.requestWithAuthentication\n    at processTicksAndRejections" } } } },
  { id: "10480", status: "success", finished: true, startedAt: iso(65), stoppedAt: iso(64), workflowId: "wf-02", workflowData: { name: "Daily revenue digest" } },
  { id: "10479", status: "waiting", finished: false, startedAt: iso(93), workflowId: "wf-03", workflowData: { name: "Manual data clean-up" } },
  { id: "10478", status: "error", finished: true, startedAt: iso(130), stoppedAt: iso(129), workflowId: "wf-01", workflowData: { name: "New lead → CRM + Slack" }, data: { resultData: { lastNodeExecuted: "Post to Slack", error: { message: "Channel not found", description: "Check the channel ID and the Slack credential permissions.", node: { name: "Post to Slack", type: "n8n-nodes-base.slack" } } } } },
];
