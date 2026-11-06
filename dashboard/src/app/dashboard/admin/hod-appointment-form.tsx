"use client";

import { useActionState, useState } from "react";
import { appointHod } from "./actions";
import { emptyHodAppointmentState } from "./form-state";

type DepartmentOption = { id: string; code: string; name: string; hod: { authUserId: string; name: string } | null };
type TeacherOption = { id: string; authUserId: string; name: string; departmentId: string };

export function HodAppointmentForm({ departments, teachers }: { departments: DepartmentOption[]; teachers: TeacherOption[] }) {
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? "");
  const [state, action, pending] = useActionState(appointHod, emptyHodAppointmentState);
  const department = departments.find((item) => item.id === departmentId);
  const candidates = teachers.filter((item) => item.departmentId === departmentId);
  const field = "mt-1 w-full rounded-lg border border-white/20 bg-[#0a1220] px-3 py-2 text-sm text-slate-100";

  return <section className="mt-8 rounded-2xl border border-white/10 bg-[#101e30] p-6">
    <h2 className="text-lg font-semibold">HOD appointment</h2>
    <p className="mt-2 text-sm text-slate-400">Appoint an existing Teacher. Each department has one HOD. Replacing the HOD returns the previous holder to Teacher access.</p>
    <form action={action} className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
      <label className="block text-sm">Department<select name="departmentId" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} required className={field}><option value="">Choose department</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
      <label className="block text-sm">Teacher<select key={departmentId} name="teacherId" required className={field}><option value="">Choose Teacher</option>{candidates.map((item) => <option key={item.id} value={item.id}>{item.name}{item.authUserId === department?.hod?.authUserId ? " (current HOD)" : ""}</option>)}</select></label>
      <button disabled={pending || candidates.length === 0} className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#0a1220] hover:bg-cyan-300 disabled:opacity-40">{pending ? "Saving..." : "Appoint HOD"}</button>
    </form>
    <p className="mt-3 text-sm text-slate-400">Current HOD: {department?.hod?.name ?? "Not appointed"}</p>
    {state.message && <p role="status" className={`mt-3 text-sm ${state.ok ? "text-cyan-300" : "text-rose-300"}`}>{state.message}</p>}
  </section>;
}
