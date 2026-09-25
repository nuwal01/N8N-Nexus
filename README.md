# N8N Nexus

N8N Nexus is a multi-user operations dashboard for n8n with an optional, approval-gated AI workflow assistant.

## Included

- Private name/email/password accounts with database-backed sessions
- A separate encrypted n8n URL and API key for every account
- Per-user OpenAI or Anthropic configuration for Nexus AI
- Workflow and execution monitoring, activation controls, failed-run details, and retries
- AI workflow creation, editing, diagnosis, exact previews, and explicit save approval
- Demo mode for evaluating the interface without external credentials

## Local development

Requirements: Node.js 22.13 or newer.

1. Copy `.env.example` to `.env.local` and replace both values with different random secrets of at least 32 characters.
2. Install packages with `npm install`.
3. Start the app with `npm run dev`.
4. Open the local URL and create an account.

The D1 database is bound as `DB`. Local development uses the project-local Wrangler database. The schema is initialized safely at runtime and is also recorded in `migrations/0001_multi_user.sql` for deployment review.

For local n8n, use `http://localhost:5678` while Nexus is also running on the same computer. A hosted Nexus server cannot directly reach a user’s localhost; use n8n Cloud or expose the self-hosted instance through a secure HTTPS URL.

## Secrets

All `.env*` files are ignored except `.env.example`. `SESSION_SECRET` protects session-token hashes and `DATA_ENCRYPTION_KEY` encrypts saved n8n and LLM configurations. Keys are not returned by APIs, stored in browser storage, or written to logs.

Existing Stage 2 connection cookies are deliberately not migrated into user accounts. Reconnect after creating an account.

> The repository's original `QUICK_START.md` contained an API key in Git history. Revoke that key before using this project.
