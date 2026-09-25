# N8N Nexus

Stage 1 is a single-workspace operations dashboard for n8n. It includes a public product site and a private connection-based dashboard for workflows and executions.

## Included

- Connect to n8n Cloud or a self-hosted/local n8n instance with its URL and API key
- List workflows and activate/deactivate them
- List execution history and inspect execution errors
- Show the failed node, message, description, and stack when n8n returns them
- Retry failed executions
- Demo mode for testing without an n8n instance

Nexus AI, persistent user accounts, and multi-user organizations are intentionally out of scope for Stage 1.

## Local development

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open the local URL shown by the development server. Click **Explore with demo data** to test the full interface without credentials.

For a real connection, create an API key in n8n under **Settings → API**, then enter the instance URL and key on the Nexus connection screen. When n8n is running locally, use `http://localhost:5678`.

## Secrets

All `.env*` files are ignored except `.env.example`. In production, set a strong `SESSION_SECRET` in the hosting environment. n8n connection details are encrypted into an HTTP-only session cookie and are not written to the repository or browser storage.

> The repository's original `QUICK_START.md` contained an API key in Git history. Revoke that key before using this project.
