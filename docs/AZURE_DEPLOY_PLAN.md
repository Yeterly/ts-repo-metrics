# Azure deployment plan (Job191, Istinye University)

Status: proposal. Nothing here is built yet. Target URL: `https://job191.yeterly.ai`.

Goal: run the course app on Azure, replace Supabase (auth and database), and serve it at
`job191.yeterly.ai` with DNS in AWS Route 53.

## What Supabase does today

- **Auth.** Google sign-in for students, GitHub OAuth linked to the same account
  (`linkIdentity`), cookie sessions (`middleware.ts`, `app/auth/callback/route.ts`), and the
  GitHub `provider_token`, which the app encrypts into `user_github_tokens`.
- **Database.** Postgres with 16 tables (`analyses`, `cse_*`, `user_github_tokens`), 11
  migrations in `supabase/migrations/`, and 4 SQL functions: `submit_cse_assignment`,
  `release_cse_assignment_submission`, `requeue_cse_grading_job`, `claim_cse_grading_job`.
- **Client.** About 45 files query through `supabase-js`. Most use the service-role client
  (`getSupabase()`). Eight use the signed-in user's client and rely on RLS:
  `api/ai-usage`, `api/analyze`, `api/doc-review`, `api/results/[id]` (and its `ai-usage`,
  `doc-review`), `lib/cse115a/server.ts`, `lib/getReportById.ts`.
- **Supabase-specific SQL.** Foreign keys to `auth.users`, and RLS policies using
  `auth.uid()` and the `authenticated` role.
- Not used: Supabase Storage, Realtime.

## Target architecture

One region. Proposed: Germany West Central or West Europe. Azure has no Turkey region, and
student data falls under KVKK, so confirm the region with the university.

| Piece | Azure service | Notes |
|---|---|---|
| Web app | Container Apps, app `web` | Existing `Dockerfile` (Next.js standalone, `git` in the image). Scale 1–3. Health probe `/api/health`. |
| Grading worker | Container Apps, app `worker` | Same image, `CSE115A_WORKER=true`, exactly 1 replica. |
| Database | PostgreSQL Flexible Server | Burstable B1ms to start, private access, automated backups. |
| Secrets | Key Vault | Read by the apps through a managed identity. |
| Images | Container Registry | Basic tier. |
| Logs | Log Analytics, Application Insights | |
| CI/CD | GitHub Actions | OIDC federated login (no stored Azure secret). Build, push to ACR, deploy. A Container Apps job runs migrations. |

Rough monthly cost at class scale: about $40–70 (Postgres $15–25, Container Apps $0–30,
ACR $5, Key Vault and logs a few dollars). OpenAI grading calls are extra.

## Replacing Supabase

### A. Auth: Auth.js (NextAuth v5)

- Providers: Google and GitHub. Users, accounts and sessions in Postgres (Auth.js Postgres
  adapter).
- The email allow list (`CSE115A_ALLOWED_EMAIL_DOMAINS`, `CSE115A_ADMIN_EMAILS`,
  `lib/courseUcscAuth.ts`) moves into the `signIn` callback: verified Google email, exact
  domain or listed admin.
- GitHub is linked while signed in. Auth.js stores the access token on the account row; keep
  encrypting it with `GITHUB_OAUTH_ENCRYPTION_KEY` into `user_github_tokens`, or encrypt the
  account row directly.
- Replaces: `signInWithOAuth`/`linkIdentity` in the buttons, `middleware.ts`,
  `app/auth/callback/route.ts`, `getCourseIdentity`, and the `supabase.auth.getUser` calls.
- New OAuth apps owned by Yeterly:
  - Google OAuth client, redirect `https://job191.yeterly.ai/api/auth/callback/google`
  - GitHub OAuth app, callback `https://job191.yeterly.ai/api/auth/callback/github`

If Istinye students use Microsoft 365 rather than Google Workspace, use the Microsoft Entra ID
provider instead of Google. The rest of this plan is unchanged.

### B. Data access: typed query layer

- Replace `supabase-js` with Kysely or Drizzle on `node-postgres`, behind small modules per
  area: courses and memberships, submissions, grading jobs, benchmark, analyses, GitHub tokens.
- Call the 4 SQL functions directly.
- About 45 files change, mostly mechanically.

### C. Migrations

- Make the 11 files plain Postgres: `user_id` references the Auth.js `users` table instead
  of `auth.users`; drop the `auth.uid()` RLS policies and grants to Supabase roles.
- Authorization lives in the app. The API routes already check identity, course membership
  and staff role; audit the 8 RLS-reliant files listed above.
- Run migrations in order with a small migration tool (for example `node-pg-migrate`), from
  the CI migration job.

### D. Data

New course, so no data is copied from the UCSC Supabase project.

## Environment variables

Remove: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

Add: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_GITHUB_ID`,
`AUTH_GITHUB_SECRET`, `APP_ORIGIN=https://job191.yeterly.ai`.

Keep: `GITHUB_OAUTH_ENCRYPTION_KEY`, `OPENAI_API_KEY`, `CSE115A_SITE=true`,
`CSE115A_WORKER` (worker only), `CSE115A_ALLOWED_EMAIL_DOMAINS`, `CSE115A_ADMIN_EMAILS`, and
the `NEXT_PUBLIC_COURSE_*` names. `NEXT_PUBLIC_*` values are inlined at build time, so pass
them as Docker build args.

## DNS: job191.yeterly.ai in Route 53

1. Add the custom domain `job191.yeterly.ai` to the `web` container app. Azure shows a
   domain verification ID.
2. In the `yeterly.ai` hosted zone:
   - `TXT  asuid.job191.yeterly.ai` = the verification ID
   - `CNAME job191.yeterly.ai` = `<web-app>.<environment>.<region>.azurecontainerapps.io`
3. Bind Azure's free managed certificate to the domain.
4. Set `APP_ORIGIN=https://job191.yeterly.ai` and register the OAuth callbacks above.

## Order of work

| Step | Work | Estimate |
|---|---|---|
| 1 | Azure resources as Bicep or Terraform in this repo | 0.5–1 day |
| 2 | Plain-Postgres migrations and the data layer | 2–3 days |
| 3 | Auth.js sign-in, GitHub linking, token storage | 2 days |
| 4 | CI/CD, custom domain and certificate, staging check | 1 day |
| 5 | Replace `RAILWAY_DEPLOY.md` / `docs/CSE115A_APP.md` setup with an Azure guide; go live | 0.5 day |

Staging check: sign in with a `@stu.istinye.edu.tr` account and an admin account, join with
a course code, link GitHub, add two PRs, submit, let the worker grade, release as instructor.

## Open decisions

1. Do `@stu.istinye.edu.tr` accounts work with Google sign-in (Google Workspace), or are
   they Microsoft 365?
2. Azure subscription, region and resource group. Is `yeterly.ai` already a hosted zone in
   Route 53?
3. Auth.js with Kysely or Drizzle (recommended), or Microsoft Entra External ID for auth.
