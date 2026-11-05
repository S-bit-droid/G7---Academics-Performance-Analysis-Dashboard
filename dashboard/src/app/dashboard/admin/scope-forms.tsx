"use client";

import { useActionState, useState } from "react";
import { assignTeachingGroup, emptyProvisionState, enrolStudentInSubject } from "./actions";

const field = "mt-1 w-full rounded-lg border border-white/20 bg-[#0a1220] px-3 py-2 text-sm";
const button = "rounded-lg border border-cyan-300 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-300/10 disabled:opacity-40";

type Person = { id: string; name: string; scopeId: string };
type Subject = { id: string; name: string; programmeId: string; departmentId: string };
type Term = { id: string; label: string; programmeId: string };

export function ScopeForms({ teachers, students, subjects, terms }: {
  teachers: Person[]; students: Person[]; subjects: Subject[]; terms: Term[];
}) {
  const [teacherState, teacherAction, teacherPending] = useActionState(assignTeachingGroup, emptyProvisionState);
  const [studentState, studentAction, studentPending] = useActionState(enrolStudentInSubject, emptyProvisionState);
  const [teacherSubjectId, setTeacherSubjectId] = useState("");
  const [studentSubjectId, setStudentSubjectId] = useState("");
  const teacherSubject = subjects.find((item) => item.id === teacherSubjectId);
  const studentSubject = subjects.find((item) => item.id === studentSubjectId);

  return <section className="mt-8 rounded-2xl border border-white/10 bg-[#101e30] p-6"><h2 className="text-lg font-semibold">Teaching group access</h2><p className="mt-2 text-sm text-slate-400">Link a Teacher and enrol a Student in the appropriate subject, term and section. Accounts can be created before these links are ready.</p><div className="mt-5 grid gap-6 lg:grid-cols-2">
    <form action={teacherAction} className="space-y-3 rounded-xl border border-white/10 p-4"><h3 className="font-semibold">Assign Teacher</h3><label className="block text-sm">Subject<select name="subjectId" required value={teacherSubjectId} onChange={(event) => setTeacherSubjectId(event.target.value)} className={field}><option value="">Choose subject</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="block text-sm">Teacher<select name="teacherId" required className={field}><option value="">Choose Teacher</option>{teachers.filter((item) => !teacherSubject || item.scopeId === teacherSubject.departmentId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="block text-sm">Term<select name="termId" required className={field}><option value="">Choose term</option>{terms.filter((item) => !teacherSubject || item.programmeId === teacherSubject.programmeId).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="block text-sm">Section<input name="section" required maxLength={20} placeholder="A" className={field} /></label><button disabled={teacherPending} className={button}>Assign group</button>{teacherState.message && <p role="status" className="text-sm text-cyan-200">{teacherState.message}</p>}</form>
    <form action={studentAction} className="space-y-3 rounded-xl border border-white/10 p-4"><h3 className="font-semibold">Enrol Student</h3><label className="block text-sm">Subject<select name="subjectId" required value={studentSubjectId} onChange={(event) => setStudentSubjectId(event.target.value)} className={field}><option value="">Choose subject</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="block text-sm">Student<select name="studentId" required className={field}><option value="">Choose Student</option>{students.filter((item) => !studentSubject || item.scopeId === studentSubject.programmeId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="block text-sm">Term<select name="termId" required className={field}><option value="">Choose term</option>{terms.filter((item) => !studentSubject || item.programmeId === studentSubject.programmeId).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="block text-sm">Section<input name="section" required maxLength={20} placeholder="A" className={field} /></label><button disabled={studentPending} className={button}>Enrol Student</button>{studentState.message && <p role="status" className="text-sm text-cyan-200">{studentState.message}</p>}</form>
  </div></section>;
}
