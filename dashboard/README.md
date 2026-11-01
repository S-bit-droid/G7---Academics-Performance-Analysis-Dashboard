# Group 7 Academic Performance Analytics Dashboard

Local application under development. Stack: Next.js, Tailwind CSS, Supabase Auth and PostgreSQL, Prisma ORM. The source code stays in the project repository. Vercel deployment will be connected after the local application and repository are ready.

## Current build

- Public project page, provisioned-account sign-in and protected role landing page.
- Separate Student, Teacher, HOD and Admin records tied to Supabase Auth IDs. No public sign-up.
- Student view reads released sessional marks, attendance and notices from PostgreSQL. Teacher, HOD and Admin views are scoped to their role records.
- Prisma schema covers academic structure plus the data needed for quizzes, work, feedback, calendar and notices. The conceptual ER diagram remains the ten-entity model; join and feature tables are relational implementation details.
- Calculation tests cover sum/average, the Master's 15/30 warning and attendance below 30%. Attendance warnings remain hidden in the UI until the source-freshness rule is agreed.
- Assigned Teachers can select an attendance source, validate an Excel marks or attendance workbook, read an authorised Google Sheet on request, save a versioned draft and release it. Validation rejects unmatched students, invalid rows and duplicate identifiers before a write. Previous released versions remain available until the new draft is released.

Scheduled or automatic Sheet refresh, quiz attempts, reports, calendar publishing, profile/work editing, feedback and academic guidance still need implementation. The Sheet path needs a live service-account test. No wellbeing responses or university-portal integration are included.

## Local setup

1. Install Node.js 24 and run `npm.cmd ci` in this folder from PowerShell. The `.cmd` form works when PowerShell script execution is disabled.
2. Create a free Supabase project. Copy `.env.example` to `.env.local` and fill in the project URL, publishable key, transaction-pooler `DATABASE_URL`, and direct or session-pooler `DIRECT_URL`. Use `pgbouncer=true` on the transaction-pooler URL, following Supabase guidance. For Sheet reading, add a Google service-account email and private key, enable the Sheets API and share only the authorised Sheet with that account. Keep all passwords and keys out of Git.
3. Run `npm.cmd run db:migrate` after checking the migration against the Supabase project. Create Supabase Auth users through an authorised admin process and add one matching Student, Teacher, HOD or Admin row per user. Do not enable public registration for this project.
4. Run `npm.cmd run dev` and open the local URL printed by Next.js.

Without Supabase values, the public page and setup state still load. No academic records are fabricated by the application.

## Checks and delivery

Run `npm.cmd run db:validate`, `npm.cmd run db:generate`, `npm.cmd run test`, `npm.cmd run lint`, `npm.cmd run typecheck` and `npm.cmd run build`. The root [GitHub Actions workflow](../.github/workflows/dashboard-ci.yml) runs these on dashboard changes in pull requests and on `main`.

After pushing the repository to GitHub, import it into Vercel with **Root Directory = `dashboard`** and **Production Branch = `main`**. Set the same environment variables in Vercel. Git integration supplies preview deployments for changes and production deployments from `main`; GitHub Actions supplies code checks. Deployments and database migrations are separate steps. Do not run migrations automatically on every preview deployment.

The project must remain zero-cost. Check the current Vercel Hobby and Supabase Free limits before connecting accounts, particularly team-authored deploys, database capacity and inactivity pauses.
