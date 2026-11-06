"use client";

import { useActionState, useState, type ChangeEvent } from "react";
import { accountRoles, csvHeaders, MAX_CSV_BYTES, parseAccountCsv, type AccountParse, type AccountRole } from "@/lib/admin-accounts";
import { createCsvAccounts, createManualAccount } from "./actions";
import { emptyProvisionState, type ProvisionState } from "./form-state";

const inputClass = "mt-1 w-full rounded-lg border border-white/20 bg-[#0a1220] px-3 py-2 text-sm text-slate-100";
const buttonClass = "rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#0a1220] hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40";

function Result({ state }: { state: ProvisionState }) {
  if (!state.message) return null;
  return <div role="status" className="mt-4 rounded-lg border border-white/15 bg-white/5 p-4 text-sm"><p>{state.message}</p>{state.results.length > 0 && <ul className="mt-3 max-h-44 space-y-1 overflow-auto text-xs text-slate-300">{state.results.map((item) => <li key={`${item.line}-${item.email}`}>Line {item.line} · {item.email}: {item.outcome}</li>)}</ul>}</div>;
}

export function AccountForms({ departments, programmes }: {
  departments: { code: string; name: string }[];
  programmes: { code: string; name: string }[];
}) {
  const [manualRole, setManualRole] = useState<AccountRole>("STUDENT");
  const [csvRole, setCsvRole] = useState<AccountRole>("STUDENT");
  const [preview, setPreview] = useState<AccountParse | null>(null);
  const [manualState, manualAction, manualPending] = useActionState(createManualAccount, emptyProvisionState);
  const [csvState, csvAction, csvPending] = useActionState(createCsvAccounts, emptyProvisionState);

  async function inspectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) { setPreview(null); return; }
    if (file.size > MAX_CSV_BYTES) { setPreview({ rows: [], issues: ["CSV must be 64 KB or smaller."] }); return; }
    setPreview(parseAccountCsv(await file.text(), csvRole));
  }

  return <div className="grid gap-6 lg:grid-cols-2">
    <section className="rounded-2xl border border-white/10 bg-[#101e30] p-6"><h2 className="text-lg font-semibold">Add one user</h2><p className="mt-2 text-sm text-slate-400">Create the role record and email an invitation.</p><form action={manualAction} className="mt-5 space-y-3"><label className="block text-sm">Role<select name="role" value={manualRole} onChange={(event) => setManualRole(event.target.value as AccountRole)} className={inputClass}>{accountRoles.map((role) => <option key={role} value={role}>{role}</option>)}</select></label><label className="block text-sm">Name<input name="name" required maxLength={120} className={inputClass} /></label><label className="block text-sm">Email<input name="email" type="email" required className={inputClass} /></label>
      {manualRole === "STUDENT" && <><label className="block text-sm">Faculty number<input name="facultyNo" required className={inputClass} /></label><label className="block text-sm">Enrolment number<input name="enrolmentNo" required className={inputClass} /></label><label className="block text-sm">Programme<select name="programmeCode" required className={inputClass}><option value="">Choose programme</option>{programmes.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}</select></label></>}
      {manualRole === "TEACHER" && <label className="block text-sm">Department<select name="departmentCode" required className={inputClass}><option value="">Choose department</option>{departments.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}</select></label>}
      <button disabled={manualPending} className={buttonClass}>{manualPending ? "Creating…" : "Create and invite"}</button></form><Result state={manualState} /></section>

    <section className="rounded-2xl border border-white/10 bg-[#101e30] p-6"><h2 className="text-lg font-semibold">Import a role CSV</h2><p className="mt-2 text-sm text-slate-400">Up to 25 users per file. Check the preview before creating accounts.</p><form action={csvAction} className="mt-5 space-y-3"><label className="block text-sm">Role<select name="role" value={csvRole} onChange={(event) => { setCsvRole(event.target.value as AccountRole); setPreview(null); }} className={inputClass}>{accountRoles.map((role) => <option key={role} value={role}>{role}</option>)}</select></label><p className="text-xs text-slate-400">Columns: {csvHeaders[csvRole].join(", ")}</p><a href={`data:text/csv;charset=utf-8,${encodeURIComponent(csvHeaders[csvRole].join(",") + "\n")}`} download={`${csvRole.toLowerCase()}-accounts.csv`} className="inline-block text-sm text-cyan-300 underline">Download blank template</a><label className="block text-sm">CSV file<input key={csvRole} name="file" type="file" accept=".csv,text/csv" required onChange={inspectFile} className="mt-2 block w-full text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-cyan-300 file:px-3 file:py-2 file:text-[#0a1220]" /></label>
      {preview && <div className="rounded-lg border border-white/10 p-3 text-xs"><p>{preview.rows.length} account(s) in preview</p>{preview.issues.length > 0 ? <ul className="mt-2 space-y-1 text-rose-300">{preview.issues.slice(0, 8).map((issue) => <li key={issue}>{issue}</li>)}</ul> : <div className="mt-2 max-h-44 overflow-auto"><table className="w-full text-left"><thead><tr><th className="pb-1">Line</th><th className="pb-1">Name</th><th className="pb-1">Email</th><th className="pb-1">Scope</th></tr></thead><tbody>{preview.rows.map((row) => <tr key={row.line} className="border-t border-white/10"><td className="py-1">{row.line}</td><td>{row.name}</td><td>{row.email}</td><td>{row.programmeCode || row.departmentCode || "Admin"}</td></tr>)}</tbody></table></div>}</div>}
      <button disabled={csvPending || !preview || preview.issues.length > 0} className={buttonClass}>{csvPending ? "Creating…" : "Create and invite previewed users"}</button></form><Result state={csvState} /></section>
  </div>;
}
