import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set SUPABASE_SECRET_KEY on the server to manage accounts.");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export type AuthUserSummary = { id: string; email: string; lastSignInAt: string | null };

export async function listAuthUsers(): Promise<AuthUserSummary[]> {
  const client = createAdminClient();
  const users: AuthUserSummary[] = [];
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Could not read account list: ${error.message}`);
    users.push(...data.users.map((user) => ({
      id: user.id, email: (user.email ?? "").toLowerCase(), lastSignInAt: user.last_sign_in_at ?? null,
    })));
    if (data.users.length < 1000) return users;
  }
  throw new Error("Account list exceeds the current 10,000-user review limit.");
}

export function inviteRedirectUrl() {
  const base = process.env.APP_BASE_URL
    ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined)
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)
    ?? (process.env.NODE_ENV === "development" ? "http://localhost:3000" : undefined);
  if (!base) throw new Error("Set APP_BASE_URL before sending invitations.");
  const url = new URL(base);
  if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error("APP_BASE_URL must be HTTPS.");
  return new URL("/auth/confirm", url).toString();
}
