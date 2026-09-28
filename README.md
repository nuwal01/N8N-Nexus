# N8N Nexus

N8N Nexus is a multi-user operations dashboard for n8n with an optional, approval-gated AI workflow assistant.

## Included

- Supabase email/password accounts and session management
- PostgreSQL Row Level Security for account data isolation
- A separate encrypted n8n URL and API key for every account
- Per-user encrypted OpenAI or Anthropic configuration for Nexus AI
- Workflow and execution monitoring, activation controls, failed-run details, and retries
- AI workflow creation, editing, diagnosis, exact previews, and explicit save approval
- Demo mode for evaluating the interface without external credentials

## Local development

Requirements: Node.js 22.13 or newer and a Supabase project initialized with the SQL migration.

1. Copy `.env.example` to `.env.local`.
2. Add the Supabase project URL and publishable key.
3. Generate a private `DATA_ENCRYPTION_KEY` of at least 32 random characters.
4. Set `APP_URL` to `http://localhost:3000` so confirmation links return to the local app.
5. Install packages with `npm install`.
6. Start the app with `npm run dev`.
7. Open `http://localhost:3000` and create an account.

For local n8n, use `http://localhost:5678` while Nexus is also running on the same computer. A hosted Nexus server cannot directly reach a user's localhost; use n8n Cloud or expose the self-hosted instance through a secure HTTPS URL.

## Production

The production target is a standard Next.js Node web service on Render. Supabase Auth stores users and sessions in Supabase's managed `auth` schema; Nexus stores profiles and encrypted per-user settings in RLS-protected public tables. See `DEPLOYMENT.md` for setup and deployment instructions.

No service-role key is required by the application. The Supabase publishable key identifies the project but does not bypass RLS. `DATA_ENCRYPTION_KEY` remains server-only and encrypts saved n8n and LLM configurations with AES-256-GCM.
