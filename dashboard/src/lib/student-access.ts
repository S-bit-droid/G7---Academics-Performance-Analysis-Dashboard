import "server-only";
import { redirect } from "next/navigation";
import { roleForAuthUser } from "@/lib/access";
import { getDb } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export async function requireStudent() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");
  const role = await roleForAuthUser(data.claims.sub);
  if (role?.kind !== "STUDENT") redirect("/dashboard");
  const student = await getDb().student.findUnique({ where: { id: role.id }, include: { programme: true } });
  if (!student) redirect("/dashboard");
  return student;
}
