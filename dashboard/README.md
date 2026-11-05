# Group 7 Academic Performance Analytics Dashboard

Application under development. Stack: Next.js, Tailwind CSS, Supabase Auth and PostgreSQL, Prisma ORM. GitHub and Vercel are connected; live account and data setup is separate from deployment.

## Current build

- Public project page, provisioned-account sign-in and protected role landing page.
- Separate Student, Teacher, HOD and Admin records tied to Supabase Auth IDs. No public sign-up.
- Student view reads released sessional marks, attendance and notices from PostgreSQL. Teacher, HOD and Admin views are scoped to their role records.
- Prisma schema covers academic structure plus the data needed for quizzes, work, feedback, calendar and notices. The conceptual ER diagram remains the ten-entity model; join and feature tables are relational implementation details.
- Calculation tests cover sum/average, the Master's 15/30 warning and attendance below 30%. Attendance warnings remain hidden in the UI until the source-freshness rule is agreed.
- Assigned Teachers can select an attendance source, validate an Excel marks or attendance workbook, read an authorised Google Sheet on request, save a versioned draft and release it. Validation rejects unmatched students, invalid rows and duplicate identifiers before a write. Previous released versions remain available until the new draft is released.
- Admin can create one account or import a role-specific CSV (up to 25 rows), preview and validate it, assign the role's programme/department scope, send invitations and view accounts plus basic seven-day usage counts.
- Admin can then link Teachers and Students to an existing subject, term and section; the server checks that these links stay within their department or programme.

Scheduled or automatic Sheet refresh, quiz attempts, reports, calendar publishing, profile/work editing, feedback and academic guidance still need implementation. The Sheet path needs a live service-account test. No wellbeing responses or university-portal integration are included.

## Local setup

1. Install Node.js 24 and run `npm.cmd ci` in this folder from PowerShell. The `.cmd` form works when PowerShell script execution is disabled.
2. Create a free Supabase project. Copy `.env.example` to `.env.local` and fill in the project URL, publishable key, transaction-pooler `DATABASE_URL`, and direct or session-pooler `DIRECT_URL`. Use `pgbouncer=true` on the transaction-pooler URL, following Supabase guidance. For Sheet reading, add a Google service-account email and private key, enable the Sheets API and share only the authorised Sheet with that account. Keep all passwords and keys out of Git.
3. For four fictional demo accounts, fill in `SUPABASE_SECRET_KEY` and the eight `DEMO_*` email/password values in `.env.local`. Use unique email addresses that you control and unique passwords of at least 12 characters. Run `npm.cmd run demo:bootstrap` to check the configuration without changing Supabase. Then run `npm.cmd run demo:bootstrap -- --apply` to apply the committed migrations, create or reuse the four Auth users, link each to its role table and verify password sign-in. The script can be rerun; it never resets an existing password. If an earlier run stopped after creating some Auth users, rerunning completes their role records. Do not run this command as part of every Vercel deployment.
4. Run `npm.cmd run dev` and open the local URL printed by Next.js.

Without Supabase values, the public page and setup state still load. No academic records are fabricated by the application.

The bootstrap reads `.env.local` locally and does not send its secrets to Vercel or GitHub. In Vercel, the app needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `DATABASE_URL` for login and role views; add `DATABASE_URL` separately if the Supabase integration supplied only `POSTGRES_*` names, then redeploy. `SUPABASE_SECRET_KEY` is also needed as a **server-only Vercel variable** for Admin account invitations. The `DEMO_*` passwords remain local and must not be Vercel variables. In Supabase Auth settings, disable public sign-up. The second migration enables RLS on every dashboard table with no Data API policies; all academic reads and writes use server-side Prisma. Keep RLS enabled for new tables too.

### Admin invitations

1. Set `APP_BASE_URL` to the deployed HTTPS origin (or `http://localhost:3000` for local testing). In Supabase **Authentication > URL Configuration**, allow `<APP_BASE_URL>/auth/confirm` as a redirect URL.
2. In Supabase **Authentication > Email Templates > Invite user**, make the invite link point to the app's confirmation endpoint: `<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&amp;type=invite">Accept invitation</a>`. The endpoint verifies the token, then sends the user to `/accept-invite` to set a password. Test one invitation before importing a CSV.
3. Set `AUTH_INVITE_TEMPLATE_READY=true` only after step 2. Keep this flag false to prevent emails with unusable links. Set these Admin variables in Vercel Production as well as `.env.local` when testing locally.

CSV templates are downloadable from `/dashboard/admin`: Student uses `name,email,faculty_no,enrolment_no,programme_code`; Teacher and HOD use `name,email,department_code`; Admin uses `name,email`. Referenced programmes and departments must already exist. A failed row is reported without hiding successful rows. Supabase's built-in Auth sender currently permits only two emails per hour, so a larger CSV requires an appropriately configured SMTP sender; the UI reports rate-limited rows for retry. Do not email passwords.

If a Vercel runtime log reports Prisma `P1011` and `self-signed certificate in certificate chain`, download the certificate from **Supabase > Database Settings > SSL Configuration > Download Certificate**. Add its full PEM text as the server-only Vercel Production variable `SUPABASE_DB_CA_CERT`, then deploy the current code. The Prisma adapter verifies that CA and the pooler hostname. Keep the original pooled `DATABASE_URL`; the adapter handles URL SSL options when a CA is supplied. Never disable TLS verification to work around this error.

## Checks and delivery

Run `npm.cmd run db:validate`, `npm.cmd run db:generate`, `npm.cmd run test`, `npm.cmd run lint`, `npm.cmd run typecheck` and `npm.cmd run build`. The root [GitHub Actions workflow](../.github/workflows/dashboard-ci.yml) runs these on pull requests and pushes to `main`.

The Vercel project uses **Root Directory = `dashboard`** and **Production Branch = `main`**. Git integration supplies preview deployments for changes and production deployments from `main`; GitHub Actions supplies code checks. Deployments and database migrations are separate steps. Do not run migrations automatically on every preview deployment.

The project must remain zero-cost. Check the current Vercel Hobby and Supabase Free limits before connecting accounts, particularly team-authored deploys, database capacity and inactivity pauses.
