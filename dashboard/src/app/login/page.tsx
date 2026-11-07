import Link from "next/link";
import { signIn } from "./actions";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  return (
    <main className="grid min-h-screen place-items-center bg-[#0a1220] px-5 py-12 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#101e30] p-8 shadow-2xl">
        <Link href="/" className="text-sm text-cyan-300 hover:underline">← Back to overview</Link>
        <h1 className="mt-8 text-3xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">Use the account provided by the dashboard administrator.</p>
        {!configured ? (
          <div className="mt-8 rounded-lg border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">Supabase is not configured yet. Add the project URL and publishable key to <code>.env.local</code> to enable sign-in.</div>
        ) : (
          <form action={signIn} className="mt-8 space-y-5">
            <div><label htmlFor="email" className="mb-2 block text-sm font-medium">Email</label><input id="email" name="email" type="email" autoComplete="email" required className="w-full rounded-lg border border-white/20 bg-[#0a1220] px-4 py-3 outline-none focus:border-cyan-300" /></div>
            <div><label htmlFor="password" className="mb-2 block text-sm font-medium">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required className="w-full rounded-lg border border-white/20 bg-[#0a1220] px-4 py-3 outline-none focus:border-cyan-300" /></div>
            {error && <p role="alert" className="text-sm text-rose-300">{error === "missing" ? "Enter both email and password." : "The sign-in details could not be verified."}</p>}
            <button type="submit" className="w-full rounded-lg bg-cyan-400 px-5 py-3 font-semibold text-[#0a1220] hover:bg-cyan-300">Sign in</button>
          </form>
        )}
        <p className="mt-8 border-t border-white/10 pt-5 text-xs leading-5 text-slate-500">There is no public registration. Academic records become visible only after an authorised release.</p>
      </div>
    </main>
  );
}
