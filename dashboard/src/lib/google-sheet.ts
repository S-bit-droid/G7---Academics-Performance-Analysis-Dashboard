import { GoogleAuth } from "google-auth-library";
import type { Row } from "./imports";

export async function readAttendanceSheet(sheetId: string, tab: string): Promise<Row[]> {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) throw new Error("Google Sheet access is not configured.");
  const auth = new GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const token = await auth.getAccessToken();
  if (!token) throw new Error("Google Sheet access token was unavailable.");
  const range = encodeURIComponent(`'${tab.replace(/'/g, "''")}'!A:AZ`);
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${range}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Google Sheets returned ${response.status}.`);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || !("values" in payload) || !Array.isArray(payload.values)) throw new Error("The Sheet did not return rows.");
  return payload.values as Row[];
}
