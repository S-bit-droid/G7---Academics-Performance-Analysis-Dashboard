import "server-only";
import { redirect } from "next/navigation";
import { roleForAuthUser } from "@/lib/access";
import { getDb } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export async function requireHod() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");
  const role = await roleForAuthUser(data.claims.sub);
  if (role?.kind !== "HOD") redirect("/dashboard");
  const hod = await getDb().hOD.findUnique({ where: { id: role.id }, include: { department: true } });
  if (!hod) redirect("/dashboard");
  return hod;
}
