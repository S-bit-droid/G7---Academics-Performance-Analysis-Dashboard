export const demoRoles = ["ADMIN", "STUDENT", "TEACHER", "HOD"] as const;
export type DemoRole = (typeof demoRoles)[number];

export type DemoPerson = { email: string; password: string; name: string };
export type DemoConfig = {
  supabaseUrl: string;
  publishableKey: string;
  secretKey: string;
  databaseUrl: string;
  directUrl: string;
  people: Record<DemoRole, DemoPerson>;
};

function required(env: Record<string, string | undefined>, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required in dashboard/.env.local.`);
  return value;
}

export function readDemoConfig(env: Record<string, string | undefined>): DemoConfig {
  const supabaseUrl = (env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL ?? "").trim().replace(/\/$/, "");
  if (!supabaseUrl || !/^https:\/\/[^\s/]+$/.test(supabaseUrl)) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be the HTTPS project URL.");
  }
  const publishableKey = required(env, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const secretKey = (env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!secretKey) throw new Error("SUPABASE_SECRET_KEY is required in dashboard/.env.local.");
  if (secretKey === publishableKey) throw new Error("The Supabase secret key must differ from the publishable key.");

  const databaseUrl = required(env, "DATABASE_URL");
  const directUrl = required(env, "DIRECT_URL");
  for (const [name, value] of [["DATABASE_URL", databaseUrl], ["DIRECT_URL", directUrl]]) {
    if (!/^postgres(?:ql)?:\/\//.test(value)) throw new Error(`${name} must be a PostgreSQL connection URL.`);
  }

  const people = {} as Record<DemoRole, DemoPerson>;
  const seenEmails = new Set<string>();
  const seenPasswords = new Set<string>();
  for (const role of demoRoles) {
    const email = required(env, `DEMO_${role}_EMAIL`).toLowerCase();
    const password = required(env, `DEMO_${role}_PASSWORD`);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`DEMO_${role}_EMAIL is not a valid email address.`);
    if (password.length < 12) throw new Error(`DEMO_${role}_PASSWORD must contain at least 12 characters.`);
    if (seenEmails.has(email)) throw new Error("Each demo role needs a different email address.");
    if (seenPasswords.has(password)) throw new Error("Each demo role needs a different password.");
    seenEmails.add(email);
    seenPasswords.add(password);
    people[role] = {
      email,
      password,
      name: `Demo ${role === "HOD" ? "HOD" : role.charAt(0) + role.slice(1).toLowerCase()}`,
    };
  }

  return { supabaseUrl, publishableKey, secretKey, databaseUrl, directUrl, people };
}
