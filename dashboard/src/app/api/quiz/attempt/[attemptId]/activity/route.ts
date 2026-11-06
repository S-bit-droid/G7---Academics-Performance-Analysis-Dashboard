import { getDb } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const EVENTS = new Set(["HIDDEN", "VISIBLE", "EXIT", "HEARTBEAT"]);

export async function POST(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return new Response("Forbidden", { status: 403 });
  const body = await request.text();
  if (body.length > 100) return new Response("Invalid event", { status: 400 });
  let type: string;
  try {
    const parsed: unknown = JSON.parse(body);
    type = parsed && typeof parsed === "object" && "type" in parsed ? String(parsed.type) : "";
  } catch {
    return new Response("Invalid event", { status: 400 });
  }
  if (!EVENTS.has(type)) return new Response("Invalid event", { status: 400 });

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return new Response("Unauthorized", { status: 401 });
  const db = getDb();
  const student = await db.student.findUnique({ where: { authUserId: data.claims.sub }, select: { id: true } });
  if (!student) return new Response("Forbidden", { status: 403 });
  const { attemptId } = await params;
  const now = new Date();
  await db.$transaction(async (tx) => {
    const attempt = await tx.quizAttempt.findFirst({
      where: { id: attemptId, studentId: student.id, submittedAt: null },
      include: { quiz: { select: { timerSeconds: true } } },
    });
    if (!attempt || now.getTime() > attempt.startedAt.getTime() + attempt.quiz.timerSeconds * 1000 + 60_000) return;
    const changed = await tx.quizAttempt.updateMany({
      where: { id: attemptId, studentId: student.id, submittedAt: null },
      data: { lastSeenAt: now },
    });
    if (!changed.count) return;
    const gapSeconds = attempt.lastSeenAt ? Math.floor((now.getTime() - attempt.lastSeenAt.getTime()) / 1000) : 0;
    if (gapSeconds >= 45) await tx.quizActivityEvent.create({ data: {
      attemptId, type: "CONTACT_GAP", durationSeconds: gapSeconds, receivedAt: now,
    } });
    if (type === "HEARTBEAT") return;
    const previous = await tx.quizActivityEvent.findFirst({
      where: { attemptId, type }, orderBy: { receivedAt: "desc" },
    });
    if (previous && now.getTime() - previous.receivedAt.getTime() < 2000) return;
    await tx.quizActivityEvent.create({ data: { attemptId, type, receivedAt: now } });
  });
  return new Response(null, { status: 204 });
}
