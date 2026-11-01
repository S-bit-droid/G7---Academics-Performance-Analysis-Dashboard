import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";
import { demoRoles, readDemoConfig, type DemoRole } from "./demo-config";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const localEnv = join(projectRoot, ".env.local");

function loadLocalEnvironment() {
  if (!existsSync(localEnv)) return;
  const runtime = process as typeof process & { loadEnvFile?: (path: string) => void };
  if (!runtime.loadEnvFile) throw new Error("Node.js 24 is required to read .env.local.");
  runtime.loadEnvFile(localEnv);
}

function runNpm(script: string) {
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(command, ["run", script], {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} failed; account creation stopped.`);
}

async function main() {
  loadLocalEnvironment();
  const config = readDemoConfig(process.env);
  const apply = process.argv.slice(2).includes("--apply");
  const unexpected = process.argv.slice(2).filter((arg) => arg !== "--apply");
  if (unexpected.length) throw new Error(`Unknown option: ${unexpected.join(", ")}`);

  console.log(`Supabase project: ${config.supabaseUrl}`);
  for (const role of demoRoles) console.log(`${role}: ${config.people[role].email}`);
  if (!apply) {
    console.log("Configuration is valid. No remote changes were made. Run with --apply to migrate and create the demo accounts.");
    return;
  }

  // Migrations run once per pending migration. Prisma Client is generated before loading it.
  runNpm("db:migrate");
  runNpm("db:generate");
  const { PrismaClient } = await import("../src/generated/prisma/client");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: config.databaseUrl }) });

  try {
    const adminClient = createClient(config.supabaseUrl, config.secretKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
    const existingUsers = new Map<string, { id: string; email_confirmed_at?: string | null }>();
    for (let page = 1; page <= 100; page++) {
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error(`Could not list Supabase Auth users: ${error.message}`);
      for (const user of data.users) {
        if (user.email) existingUsers.set(user.email.toLowerCase(), user);
      }
      if (data.users.length < 1000) break;
      if (page === 100) throw new Error("Too many Auth users to inspect safely.");
    }

    const authIds = {} as Record<DemoRole, string>;
    for (const role of demoRoles) {
      const person = config.people[role];
      const existing = existingUsers.get(person.email);
      if (existing && !existing.email_confirmed_at) {
        throw new Error(`${role} email is not confirmed. Confirm it in Supabase Auth before rerunning.`);
      }
      if (existing) {
        authIds[role] = existing.id;
        console.log(`${role} Auth user already exists; its password was not changed.`);
      } else {
        const { data, error } = await adminClient.auth.admin.createUser({
          email: person.email,
          password: person.password,
          email_confirm: true,
        });
        if (error || !data.user) throw new Error(`Could not create ${role} Auth user: ${error?.message ?? "no user returned"}`);
        authIds[role] = data.user.id;
        console.log(`${role} Auth user created.`);
      }

      const loginClient = createClient(config.supabaseUrl, config.publishableKey, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      });
      const { data: login, error: loginError } = await loginClient.auth.signInWithPassword({
        email: person.email,
        password: person.password,
      });
      if (loginError || login.user?.id !== authIds[role]) {
        throw new Error(`${role} credential check failed. Existing account passwords are never reset by this script.`);
      }
      await loginClient.auth.signOut();
    }

    const idSet = new Set(Object.values(authIds));
    if (idSet.size !== demoRoles.length) throw new Error("Two demo roles resolved to the same Auth user.");

    await db.$transaction(async (tx) => {
      // A Supabase identity may belong to only one dashboard role.
      for (const role of demoRoles) {
        const authUserId = authIds[role];
        const found = await Promise.all([
          tx.admin.findUnique({ where: { authUserId }, select: { id: true } }),
          tx.student.findUnique({ where: { authUserId }, select: { id: true } }),
          tx.teacher.findUnique({ where: { authUserId }, select: { id: true } }),
          tx.hOD.findUnique({ where: { authUserId }, select: { id: true } }),
        ]);
        const assignments = demoRoles.filter((_, index) => Boolean(found[index]));
        if (assignments.some((assigned) => assigned !== role)) {
          throw new Error(`${role} Auth user already has a different dashboard role.`);
        }
      }

      const department = await tx.department.upsert({
        where: { code: "G7-DEMO" },
        create: { code: "G7-DEMO", name: "Demo Department" },
        update: {},
      });
      const programme = await tx.programme.upsert({
        where: { code: "G7-DEMO-UG" },
        create: { code: "G7-DEMO-UG", name: "Demo Undergraduate Programme", level: "UG", departmentId: department.id },
        update: {},
      });
      if (programme.departmentId !== department.id || programme.level !== "UG") {
        throw new Error("G7-DEMO-UG already exists with a different department or level.");
      }
      const currentHod = await tx.hOD.findUnique({ where: { departmentId: department.id } });
      if (currentHod && currentHod.authUserId !== authIds.HOD) {
        throw new Error("The demo department already has a different HOD.");
      }

      await tx.admin.upsert({
        where: { authUserId: authIds.ADMIN },
        create: { authUserId: authIds.ADMIN, name: config.people.ADMIN.name },
        update: {},
      });
      const student = await tx.student.upsert({
        where: { authUserId: authIds.STUDENT },
        create: {
          authUserId: authIds.STUDENT,
          name: config.people.STUDENT.name,
          facultyNo: "G7-DEMO-F001",
          enrolmentNo: "G7-DEMO-E001",
          programmeId: programme.id,
        },
        update: {},
      });
      const teacher = await tx.teacher.upsert({
        where: { authUserId: authIds.TEACHER },
        create: { authUserId: authIds.TEACHER, name: config.people.TEACHER.name, departmentId: department.id },
        update: {},
      });
      const hod = await tx.hOD.upsert({
        where: { authUserId: authIds.HOD },
        create: { authUserId: authIds.HOD, name: config.people.HOD.name, departmentId: department.id },
        update: {},
      });
      if (student.programmeId !== programme.id || teacher.departmentId !== department.id || hod.departmentId !== department.id) {
        throw new Error("An existing demo account is linked to a different programme or department.");
      }
    });

    for (const role of demoRoles) {
      const authUserId = authIds[role];
      const row = role === "ADMIN" ? await db.admin.findUnique({ where: { authUserId } })
        : role === "STUDENT" ? await db.student.findUnique({ where: { authUserId } })
          : role === "TEACHER" ? await db.teacher.findUnique({ where: { authUserId } })
            : await db.hOD.findUnique({ where: { authUserId } });
      if (!row) throw new Error(`${role} role record could not be verified.`);
      console.log(`${role}: credentials and role mapping verified.`);
    }
    console.log("Four demo accounts are ready. Sign in through /login and check each role view.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Demo bootstrap failed.");
  process.exitCode = 1;
});
