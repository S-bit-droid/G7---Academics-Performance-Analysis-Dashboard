import { generatePreviousMonthReports } from "@/lib/monthly-report";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const result = await generatePreviousMonthReports();
  return Response.json(result);
}
