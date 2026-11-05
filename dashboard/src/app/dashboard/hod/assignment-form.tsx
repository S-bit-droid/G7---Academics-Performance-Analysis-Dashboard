"use client";

import { useActionState, useState } from "react";
import { assignTeachingGroup, type AssignmentState } from "./actions";

type Teacher = { id: string; name: string };
type Subject = { id: string; name: string; programmeId: string; programme: { code: string } };
type Term = { id: string; label: string; programmeId: string };

const initialState: AssignmentState = { message: "", ok: false };
const field = "mt-1 w-full rounded-lg border border-white/20 bg-[#0a1220] px-3 py-2 text-sm";

export function AssignmentForm({ teachers, subjects, terms }: {
  teachers: Teacher[]; subjects: Subject[]; terms: Term[];
}) {
  const [state, action, pending] = useActionState(assignTeachingGroup, initialState);
  const [subjectId, setSubjectId] = useState("");
  const selectedSubject = subjects.find((subject) => subject.id === subjectId);

  return <form action={action} className="mt-5 grid gap-4 sm:grid-cols-2">
    <label className="text-sm">Subject
      <select name="subjectId" required value={subjectId} onChange={(event) => setSubjectId(event.target.value)} className={field}>
        <option value="">Choose subject</option>
        {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.programme.code} · {subject.name}</option>)}
      </select>
    </label>
    <label className="text-sm">Teacher
      <select name="teacherId" required className={field}><option value="">Choose Teacher</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select>
    </label>
    <label className="text-sm">Term
      <select key={subjectId} name="termId" required className={field}>
        <option value="">Choose term</option>
        {terms.filter((term) => !selectedSubject || term.programmeId === selectedSubject.programmeId).map((term) => <option key={term.id} value={term.id}>{term.label}</option>)}
      </select>
    </label>
    <label className="text-sm">Section
      <input name="section" required maxLength={20} placeholder="A" className={field} />
    </label>
    <div className="sm:col-span-2">
      <button disabled={pending || !teachers.length || !subjects.length || !terms.length} className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#0a1220] hover:bg-cyan-300 disabled:opacity-40">Assign Teacher</button>
      {state.message && <p role="status" className={`mt-3 text-sm ${state.ok ? "text-cyan-200" : "text-amber-200"}`}>{state.message}</p>}
    </div>
  </form>;
}
