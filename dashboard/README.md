# Group 7 Academic Performance Analytics Dashboard

Application under development. Stack: Next.js, Tailwind CSS, Supabase Auth and PostgreSQL, Prisma ORM. GitHub and Vercel are connected; live account and data setup is separate from deployment.

## Current build

- Public project page, provisioned-account sign-in and protected role landing page.
- Separate Student, Teacher, HOD and Admin records tied to Supabase Auth IDs. No public sign-up.
- Student view reads released sessional marks, attendance and notices from PostgreSQL. Teacher, HOD and Admin views are scoped to their role records.
- Prisma schema covers academic structure plus the data needed for quizzes, work, feedback, calendar and notices. The conceptual ER diagram remains the ten-entity model; join and feature tables are relational implementation details.
- Calculation tests cover sum/average, the Master's 15/30 warning and attendance below 30%. The Student view labels low attendance using released sessions and shows the last source update date.
- Assigned Teachers can select an attendance source, validate an Excel marks workbook or dated-column attendance CSV, read an authorised Google Sheet on request, save a versioned draft and release it. Validation rejects unmatched students, invalid rows and duplicate identifiers before a write. Previous released versions remain available until the new draft is released.
- Admin can create one account or import a role-specific CSV (up to 25 rows), preview and validate it, assign the role's programme/department scope, send invitations and view accounts plus basic seven-day usage counts.
- The HOD assigns Teachers to a subject, term and section within their department. Admin enrols Students in a subject, term and section within their programme. Both checks run on the server.
- The Teacher workspace shows assigned classes and Student profiles, including released results across subjects and declared background, achievements and resume. Write actions check the Teacher's own class assignment.
- Teachers can publish notes and assignments, view submissions, create timed MCQ quizzes with a separate window for starting attempts, close quizzes early and see results, publish or edit class calendar items, and reply to Student feedback. Each new quiz is linked to a class attendance date and session number. Its review page compares released attendance with attempts and shows page visibility events and server contact gaps. These signals prompt review; they do not prove cheating or change scores. Students see a monitoring notice when taking a quiz. Students can submit assignments, take one quiz attempt, send feedback, maintain profile items and view class content and notices.
- A protected monthly job saves a per-Student snapshot of released marks, that month's attendance and quiz results, with missing data shown clearly. The report is visible to the Student and their assigned Teacher.

The Sheet path needs a live service-account test. Teachers can sync a linked Sheet on request, and a protected daily job checks linked Sheets automatically. Valid changes are released for Students; invalid rows leave the last released data intact. An open attendance draft pauses automatic release for that class so the Teacher can review it. HOD accounts also have a Teacher profile and may use Teacher actions only for their own assigned classes. The HOD workspace includes department profiles, teaching assignments, PDF timetables and shared calendar items. Academic guidance, wellbeing responses and university-portal integration are not implemented.

## Local setup

1. Install Node.js 24 and run `npm.cmd ci` in this folder from PowerShell. The `.cmd` form works when PowerShell script execution is disabled.
2. Create a free Supabase project. Copy `.env.example` to `.env.local` and fill in the project URL, publishable key, transaction-pooler `DATABASE_URL`, and direct or session-pooler `DIRECT_URL`. Use `pgbouncer=true` on the transaction-pooler URL, following Supabase guidance. For Sheet reading, add a Google service-account email and private key, enable the Sheets API and share only the authorised Sheet with that account. Keep all passwords and keys out of Git.
3. For four fictional demo accounts, fill in `SUPABASE_SECRET_KEY` and the eight `DEMO_*` email/password values in `.env.local`. Use unique email addresses that you control and unique passwords of at least 12 characters. Run `npm.cmd run demo:bootstrap` to check the configuration without changing Supabase. Then run `npm.cmd run demo:bootstrap -- --apply` to apply the committed migrations, create or reuse the four Auth users, link each to its role table and verify password sign-in. The script can be rerun; it never resets an existing password. If an earlier run stopped after creating some Auth users, rerunning completes their role records. Do not run this command as part of every Vercel deployment.
4. Run `npm.cmd run dev` and open the local URL printed by Next.js.

Without Supabase values, the public page and setup state still load. No academic records are fabricated by the application.

The bootstrap reads `.env.local` locally and does not send its secrets to Vercel or GitHub. In Vercel, the app needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `DATABASE_URL` for login and role views; add `DATABASE_URL` separately if the Supabase integration supplied only `POSTGRES_*` names, then redeploy. `SUPABASE_SECRET_KEY` is also needed as a **server-only Vercel variable** for Admin account invitations and private file storage. The `DEMO_*` passwords remain local and must not be Vercel variables. In Supabase Auth settings, disable public sign-up. RLS is enabled on every dashboard table with no Data API policies; all academic reads and writes use server-side Prisma.

Before using the new Teacher pages against an existing database, apply committed migrations once with `npm.cmd run db:migrate` from a configured local environment. Teacher workflow, quiz-monitoring and HOD workflow migrations are required. The HOD migration adds Teacher profiles to existing HOD accounts. Attendance date columns keep their original format for session 1; a second same-day session can use a column such as `2026-11-06#2` in a Sheet or CSV. The Teacher selects the matching date and session when publishing a quiz. The new file workflow uses a private Supabase Storage bucket called `academic-files`, created on first upload with the server-only `SUPABASE_SECRET_KEY`. Files are limited to 2 MB and served by short-lived signed links. Add a random 16+ character server-only `CRON_SECRET` in Vercel Production. The `vercel.json` schedules check linked attendance Sheets daily at 02:00 UTC and generate previous-month Student reports at 03:00 UTC on the first day of each month. Vercel calls both protected routes automatically. For local checks, send `Authorization: Bearer <CRON_SECRET>` to `/api/cron/attendance` or `/api/cron/monthly-report` after the migration. The report job skips existing reports. Vercel Hobby allows daily cron schedules, with execution sometime within the scheduled hour.

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
