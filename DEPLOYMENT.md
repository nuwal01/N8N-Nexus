# Supabase and Render deployment

N8N Nexus runs as a standard Next.js Node service on Render. Supabase provides email/password Auth and PostgreSQL. The application does not use Cloudflare D1 or Worker bindings in this deployment path.

Supabase Auth stores users and sessions in its managed PostgreSQL `auth` schema. Nexus does not duplicate passwords or session tokens in public tables. The previous D1 accounts and encrypted credentials are deliberately not migrated; each user creates a Supabase account and reconnects n8n and the optional LLM provider.

## 1. Create and configure Supabase

1. Sign in to Supabase and create a project in the region closest to the expected users.
2. Open **SQL Editor**, create a new query, paste the complete contents of `supabase/migrations/20260927000000_nexus_schema.sql`, and run it once.
3. In **Database → Tables**, confirm these public tables exist:
   - `profiles`
   - `n8n_connections`
   - `ai_settings`
4. Open each table and confirm Row Level Security is enabled. The migration creates owner-only policies for the `authenticated` role.
5. In **Authentication → Providers → Email**, keep email/password enabled. Choose whether users must confirm their email before the first login. Nexus supports either setting.
6. If email confirmation is enabled, open **Authentication → Email Templates → Confirm signup** and change the confirmation link to:

   ```text
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
   ```

7. In **Authentication → URL Configuration**, add local development first:
   - Site URL: `http://localhost:3000`
   - Redirect URL: `http://localhost:3000/**`
8. In **Project Settings → API**, copy the project URL and the publishable key. A legacy anon key also works if the project has not yet issued publishable keys, but a publishable key is preferred.

Do not copy or configure the service-role or secret key. Nexus intentionally performs database operations with the signed-in user's JWT so RLS remains enforced.

## 2. Configure local development

1. Copy `.env.example` to `.env.local`.
2. Set `SUPABASE_URL` to the project URL.
3. Set `SUPABASE_PUBLISHABLE_KEY` to the project's publishable key.
4. Generate `DATA_ENCRYPTION_KEY` locally. For example, in PowerShell:

   ```powershell
   $bytes = New-Object byte[] 48
   [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
   [Convert]::ToBase64String($bytes)
   ```

5. Put the generated value only in `.env.local`. Never commit it.
6. Run `npm install`, then `npm run dev`.

Changing `DATA_ENCRYPTION_KEY` later makes already-saved n8n and LLM configurations unreadable. Users would need to reconnect them.

## 3. Create the Render service

After the migration is reviewed and pushed to GitHub:

1. Sign in to Render and choose **New → Blueprint**.
2. Connect the `nuwal01/N8N-Nexus` repository and select its main branch.
3. Render reads `render.yaml` and creates the `n8n-nexus` Node web service.
4. Enter these environment values in Render when prompted:
   - `SUPABASE_URL`: the Supabase project URL
   - `SUPABASE_PUBLISHABLE_KEY`: the Supabase publishable key
   - `DATA_ENCRYPTION_KEY`: the independently generated encryption value
   - `APP_URL`: the exact public Render origin, such as `https://n8n-nexus-o075.onrender.com`
5. Do not add an n8n API key or LLM API key to Render. Each user enters those in Nexus, and Nexus stores only AES-256-GCM ciphertext.
6. Create the service. The Blueprint has automatic deploys disabled, so deploy manually after reviewing each change.

The Render commands are:

```text
Build: npm ci && npm run build
Start: npm start
Health check: /api/health
```

## 4. Finish Auth URL configuration

After Render assigns the public HTTPS URL:

1. Return to **Supabase → Authentication → URL Configuration**.
2. Change the Site URL to the exact Render URL: `https://n8n-nexus-o075.onrender.com`.
3. Add the exact redirect pattern: `https://n8n-nexus-o075.onrender.com/**`.
4. Keep the localhost redirect only if local development should remain allowed.

For the existing manually created Render service, verify its dashboard settings match `render.yaml`: build with `npm ci && npm run build`, start with `npm start`, set `/api/health` as the health check, and disable automatic deploys until the migration has been reviewed.

## 5. Manual acceptance checks

1. Register two different email accounts and confirm login, refresh persistence, and logout.
2. Connect different n8n instances or demo workspaces in the two accounts.
3. Confirm each account sees only its own connection, workflows, executions, and Nexus AI settings.
4. Confirm disconnect keeps the encrypted saved connection inactive, while remove deletes it.
5. Configure OpenAI or Anthropic separately per account and verify model discovery.
6. Preview and reject an AI workflow change; confirm n8n is unchanged.
7. Preview and approve a safe test change; confirm only the selected account's n8n instance changes and the workflow is not automatically activated.
8. Confirm a hosted Render service rejects localhost/private n8n URLs with the existing guidance message.
