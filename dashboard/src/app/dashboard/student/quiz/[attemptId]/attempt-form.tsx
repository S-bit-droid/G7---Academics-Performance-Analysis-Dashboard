"use client";

import { useEffect, useRef, useState } from "react";
import { submitQuiz } from "../../actions";

type VisibleQuestion = { prompt: string; options: string[] };

export function AttemptForm({ attemptId, deadline, questions }: {
  attemptId: string; deadline: number; questions: VisibleQuestion[];
}) {
  const form = useRef<HTMLFormElement>(null);
  const sent = useRef(false);
  const [seconds, setSeconds] = useState<number | null>(null);
  useEffect(() => {
    const endpoint = `/api/quiz/attempt/${encodeURIComponent(attemptId)}/activity`;
    const send = (type: "VISIBLE" | "HIDDEN" | "EXIT" | "HEARTBEAT") => {
      const body = JSON.stringify({ type });
      if ((type === "HIDDEN" || type === "EXIT") && navigator.sendBeacon?.(endpoint, new Blob([body], { type: "application/json" }))) return;
      void fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body, credentials: "same-origin", keepalive: true }).catch(() => {});
    };
    let hidden = document.visibilityState === "hidden";
    if (!hidden) send("VISIBLE");
    const onVisibility = () => {
      const nextHidden = document.visibilityState === "hidden";
      if (nextHidden === hidden) return;
      hidden = nextHidden;
      if (!sent.current) send(nextHidden ? "HIDDEN" : "VISIBLE");
    };
    const onPageHide = () => { if (!sent.current) send("EXIT"); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    const heartbeat = window.setInterval(() => {
      if (!sent.current && document.visibilityState === "visible") send("HEARTBEAT");
    }, 15_000);
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSeconds(remaining);
      if (remaining === 0 && !sent.current) { sent.current = true; form.current?.requestSubmit(); }
    };
    tick();
    const timer = window.setInterval(() => {
      tick();
    }, 500);
    return () => { window.clearInterval(timer); window.clearInterval(heartbeat); document.removeEventListener("visibilitychange", onVisibility); window.removeEventListener("pagehide", onPageHide); };
  }, [attemptId, deadline]);
  return <form ref={form} action={submitQuiz} onSubmit={() => { sent.current = true; }} className="mt-6 space-y-6"><input type="hidden" name="attemptId" value={attemptId} />
    <p className="rounded-lg border border-cyan-300/30 p-3 text-sm text-cyan-200" role="timer">Time remaining: {seconds === null ? "--:--" : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}</p>
    {questions.map((question, index) => <fieldset key={index} className="rounded-xl border border-white/10 p-4"><legend className="font-semibold">{index + 1}. {question.prompt}</legend><div className="mt-3 space-y-2">{question.options.map((option, answer) => <label key={answer} className="flex gap-3 text-sm"><input type="radio" name={`q${index}`} value={answer} />{option}</label>)}</div></fieldset>)}
    <button disabled={seconds === 0} className="rounded-lg bg-cyan-400 px-5 py-2 font-semibold text-[#0a1220] disabled:opacity-50">Submit quiz</button>
  </form>;
}
