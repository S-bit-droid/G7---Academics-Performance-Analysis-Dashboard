"use client";

import { useActionState, useState } from "react";
import { emptyProvisionState, enrolStudentInSubject } from "./actions";

const field = "mt-1 w-full rounded-lg border border-white/20 bg-[#0a1220] px-3 py-2 text-sm";
const button = "rounded-lg border border-cyan-300 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-300/10 disabled:opacity-40";

type Student = { id: string; name: string; programmeId: string };
type Subject = { id: string; name: string; programmeId: string };
type Term = { id: string; label: string; programmeId: string };

export function ScopeForms({ students, subjects, terms }: {
  students: Student[]; subjects: Subject[]; terms: Term[];
}) {
  const [state, action, pending] = useActionState(enrolStudentInSubject, emptyProvisionState);
  const [subjectId, setSubjectId] = useState("");
  const subject = subjects.find((item) => item.id === subjectId);

  return <section className="mt-8 rounded-2xl border border-white/10 bg-[#101e30] p-6"><h2 className="text-lg font-semibold">Student enrolment</h2><p className="mt-2 text-sm text-slate-400">Place a Student in a subject, term and section. The HOD assigns Teachers to teaching groups.</p>
    <form action={action} className="mt-5 grid gap-3 sm:grid-cols-2"><label className="block text-sm">Subject<select name="subjectId" required value={subjectId} onChange={(event) => setSubjectId(event.target.value)} className={field}><option value="">Choose subject</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="block text-sm">Student<select key={subjectId} name="studentId" required className={field}><option value="">Choose Student</option>{students.filter((item) => !subject || item.programmeId === subject.programmeId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="block text-sm">Term<select key={subjectId} name="termId" required className={field}><option value="">Choose term</option>{terms.filter((item) => !subject || item.programmeId === subject.programmeId).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="block text-sm">Section<input name="section" required maxLength={20} placeholder="A" className={field} /></label><div className="sm:col-span-2"><button disabled={pending} className={button}>Enrol Student</button>{state.message && <p role="status" className="mt-3 text-sm text-cyan-200">{state.message}</p>}</div></form>
  </section>;
}
