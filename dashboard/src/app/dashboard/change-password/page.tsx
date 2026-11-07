"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) router.replace("/login");
      else setReady(true);
    });
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 12) return setMessage("Use at least 12 characters.");
    if (password !== confirm) return setMessage("The passwords do not match.");
    setBusy(true);
    setMessage("");
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (error) return setMessage(error.message);
    setPassword("");
    setConfirm("");
    setMessage("Password changed. Your previous password no longer works.");
  }

  return <main className="grid min-h-screen place-items-center bg-[#0a1220] px-6 text-slate-100"><div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#101e30] p-8"><Link href="/dashboard" className="text-sm text-cyan-300 hover:underline">← Dashboard</Link><h1 className="mt-6 text-2xl font-semibold">Change password</h1><p className="mt-3 text-sm text-slate-400">Choose a private password after signing in with the initial one.</p>{message && <p role="status" className="mt-5 rounded-lg border border-white/10 bg-white/5 p-3 text-sm">{message}</p>}{ready && <form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm">New password<input type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-white/20 bg-[#0a1220] px-3 py-2" /></label><label className="block text-sm">Confirm password<input type="password" autoComplete="new-password" minLength={12} required value={confirm} onChange={(event) => setConfirm(event.target.value)} className="mt-2 w-full rounded-lg border border-white/20 bg-[#0a1220] px-3 py-2" /></label><button disabled={busy} className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#0a1220] disabled:opacity-50">{busy ? "Saving…" : "Change password"}</button></form>}</div></main>;
}
