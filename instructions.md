# EcoReport setup

EcoReport lets users report environmental issues, see reports on a map/feed, classify recyclables from photos, and explore environmental lessons and watershed data.

## 1. Add your environment variables

Copy `.env.example` to `.env.local` in the project root (or edit your existing `.env.local`):

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
VITE_OPENROUTER_API_KEY=your_openrouter_key
VITE_OPENROUTER_MODEL=openrouter/free
```

Get your OpenRouter key from <https://openrouter.ai/settings/keys>. The analyzer calls OpenRouter directly from the browser, using `openrouter/free` for free text/photo analysis. No Supabase CLI, function deployment, or secrets upload is needed. You can analyze reports before configuring Supabase; Supabase is required to save them.

This temporary setup exposes the OpenRouter key in the browser. `.env.local` is ignored by Git, but `VITE_` values are included in the built app. Use this setup for testing with a key you can revoke. The earlier `.env.openrouter` file is no longer used.

## 2. Set up Supabase for saving reports

1. Create a project at <https://supabase.com/dashboard> and copy its URL and publishable/anon key into `.env.local`.
2. In Authentication settings, enable the **Email** provider and **Confirm email**. Users create an account with an email and password, click the standard verification link in their email, and then sign in to the app with their password. Keep Supabase's default email template; no template edits are needed.
   **Required once:** Open **Authentication → URL Configuration**, set **Site URL** to `https://www.google.com/`, add `https://www.google.com/` to **Redirect URLs**, and save. The app explicitly requests this destination when signing up; the dashboard must allow it or Supabase may fall back to its Site URL. Changing Site URL away from localhost also fixes that fallback. See [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).
   Clicking the verification link verifies the email and opens Google. Return to EcoReport and sign in with the email and password; Google does not create a session in EcoReport. Anonymous sign-ins are optional for guest reports.
   Supabase's default email service can be used for testing with project team addresses. It restricts recipients and has low sending limits; public users still require your own email delivery provider. This is a Supabase delivery restriction, independent of whether the email contains a link or a code. You do not need custom SMTP just to use the default link template with eligible test addresses.
3. In the dashboard's **SQL Editor**, run these files in order:
   - `supabase/migrations/20260905191116_create_reports_table.sql`
   - `supabase/migrations/20261025000000_complete_report_integration.sql`
   - `supabase/migrations/20261025010000_admin_and_report_resolution.sql`
   Run only migrations you have not already applied. These create the report table, access policies, photo bucket, admin role, and resolve function. The second migration also contains an unused counter from the earlier server-based analyzer; the direct analyzer does not use it.

Reports, locations, and uploaded photos are public. Photos support JPEG, PNG, and WebP up to 5 MB. Signed-in sessions persist across reloads. Use **Sign out** in the header to end the session on this browser. Report statuses can be managed from the Supabase dashboard.

## Admin account and resolving reports

1. In **Supabase → Authentication → Users → Add user → Create new user**, create `vvrukshav@gmail.com` with the password you supplied in the conversation, and enable **Auto Confirm User**. If the account already exists, use its existing credentials or change the password through Supabase's account management flow. Passwords belong in Supabase Auth, never in the frontend, env examples, or SQL migrations.
2. Run `supabase/migrations/20261025010000_admin_and_report_resolution.sql` in the **SQL Editor** once. You may do this before or after creating the account. It grants the designated verified account admin access, including when that account is confirmed later. Sign out and back in after setup.
3. Sign in as the admin, select a report marker on the map, and use **Edit**, **Delete**, or **Add report**. Edit supports title, description, category, status, coordinates, and address. Delete asks for confirmation. **Add report** opens the existing report form, where admins can enter latitude/longitude and choose **Use coordinates** instead of GPS. After creation, use Edit to change its status if needed. The map's + button also adds reports when the map is empty.
4. Any signed-in, verified member can select a marker and click **Resolve**. The status updates immediately on the map and persists to Supabase. Guests are prompted to sign in. Only admins can reopen reports, edit their contents, or delete them.

Permissions are enforced by database policies and the resolve function. An ordinary user cannot obtain admin access by changing browser state or profile metadata. Do not add service-role keys to the frontend. This workspace's public Supabase key cannot create confirmed users or apply migrations, so the two dashboard setup steps above are required before the new controls work against the live project.

## 3. Run the app

```powershell
npm install
npm run dev
```

Open the URL Vite prints. Restart the dev server after editing `.env.local`.

In **Report**, enter a description, optionally attach a photo, and choose **Analyze with AI**. Review the suggested category, severity, and summary. Allow location access and submit to save the report to Supabase. **Continue without AI** is also available. AI analysis does not require signing in.

The analyzer requests a strict JSON schema, allows room for models that reason before answering, and retries incomplete or malformed answers once with a larger token budget. This can take up to two minutes if a provider is slow. It handles markdown-wrapped JSON and text blocks and displays specific errors for authentication, quotas, timeouts, or provider refusals.

Descriptions and photos used for AI analysis are sent to OpenRouter and its selected provider; GPS coordinates are not included in that request. Free models have availability and quota limits. If AI fails, check your key, [provider privacy settings](https://openrouter.ai/settings/privacy), and [free-model availability](https://openrouter.ai/openrouter/free). Reports can still be submitted manually.

## GitHub Pages

For a deployed test build, add the same four variable names under repository **Settings → Secrets and variables → Actions**, then rerun the Pages workflow. The workflow currently builds the `Watershed-Lens` branch. The OpenRouter key will also be visible in this deployed browser app.

## Checks

```powershell
npm run build
npm run test:report-ai
npm run test:flows
npm run test:permissions
```

The analyzer tests mock OpenRouter and do not spend API quota. Live verification requires your key and Supabase project settings.

`test:flows` exercises the real React components in a simulated DOM, covering password sign-in, signup links targeting Google, errors, sign-out, restored sessions, AI/manual reports, photo uploads, and failed-save cleanup with mocked backend calls.

`test:permissions` runs the actual migrations in an isolated local Postgres engine and checks admin provisioning, blocked privilege escalation, member resolution, admin edits/deletes, and validation. It does not touch the live Supabase project.

To make one live AI request with your configured key and check Supabase's public auth settings and report schema, run `node scripts/check-services.mjs`. Add `--image` to include a synthetic blank PNG and check image routing. This script does not create accounts or publish reports, and it never prints credentials.
