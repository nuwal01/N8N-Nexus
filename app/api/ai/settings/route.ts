import { discoverProviderModel, ProviderSetupError } from "../../../../lib/ai";
import { apiError, requireConnection } from "../../../../lib/n8n";
import { getLlmConfig, removeLlmConfig, requireUser, saveLlmConfig } from "../../../../lib/session";
import type { LlmConfig, LlmProvider } from "../../../../lib/types";

export async function GET(request: Request) {
  try {
    await requireUser(request);
    const config = await getLlmConfig(request);
    return Response.json({ configured: Boolean(config), provider: config?.provider || null, model: config?.model || null });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const connection = await requireConnection(request);
    const body = await request.json() as { provider?: LlmProvider; apiKey?: string; model?: string };
    if (!body.provider || !["openai", "anthropic", "demo"].includes(body.provider)) return Response.json({ error: "Choose a supported provider." }, { status: 400 });
    if (body.provider === "demo" && connection.mode !== "demo") return Response.json({ error: "Demo AI is only available in the demo workspace." }, { status: 400 });
    const apiKey = body.apiKey?.trim();
    if (body.provider !== "demo" && !apiKey) return Response.json({ error: "Enter an API key for this provider." }, { status: 400 });
    if (body.provider === "openai" && !apiKey?.startsWith("sk-")) return Response.json({ error: "That does not look like an OpenAI API key." }, { status: 400 });
    if (body.provider === "anthropic" && !apiKey?.startsWith("sk-ant-")) return Response.json({ error: "That does not look like an Anthropic API key." }, { status: 400 });
    const discovery = body.provider === "demo"
      ? { model: "nexus-demo", availableModels: ["nexus-demo"], discovery: "discovered" as const, discoveryMessage: "Using the built-in demo model. No external provider was contacted." }
      : await discoverProviderModel(body.provider, apiKey!, body.model);
    const config: LlmConfig = { provider: body.provider, model: discovery.model, apiKey };
    await saveLlmConfig(user.id, config);
    return Response.json({ configured: true, provider: config.provider, model: config.model, discovery: discovery.discovery, discoveryMessage: discovery.discoveryMessage });
  } catch (error) {
    if (error instanceof ProviderSetupError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request);
    await removeLlmConfig(user.id);
    return Response.json({ configured: false, provider: null, model: null });
  } catch (error) { return apiError(error); }
}
