"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function AcceptInvitePage() {
  const router = useRouter();
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabaseRef.current = supabase;
    void supabase.auth.getSession().then(({ data, error }) => {
      setReady(Boolean(data.session) && !error);
      if (!data.session || error) setMessage("This invitation is invalid or expired. Ask the Admin for a new invitation.");
    });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = supabaseRef.current;
    if (!supabase) return setMessage("Invitation session is still loading.");
    if (password.length < 12) return setMessage("Use at least 12 characters.");
    if (password !== confirm) return setMessage("The passwords do not match.");
    setBusy(true); setMessage("");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setMessage(error.message);
    router.replace("/dashboard");
    router.refresh();
  }

  return <main className="grid min-h-screen place-items-center bg-[#0a1220] px-6 text-slate-100"><div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#101e30] p-8"><h1 className="text-2xl font-semibold">Set your password</h1><p className="mt-3 text-sm text-slate-400">Complete your dashboard invitation.</p>{message && <p role="alert" className="mt-5 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-200">{message}</p>}{ready && <form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm">Password<input type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-white/20 bg-[#0a1220] px-3 py-2" /></label><label className="block text-sm">Confirm password<input type="password" autoComplete="new-password" minLength={12} required value={confirm} onChange={(event) => setConfirm(event.target.value)} className="mt-2 w-full rounded-lg border border-white/20 bg-[#0a1220] px-3 py-2" /></label><button disabled={busy} className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#0a1220] disabled:opacity-50">{busy ? "Saving…" : "Set password"}</button></form>}</div></main>;
}
