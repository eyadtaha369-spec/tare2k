import { NextResponse } from "next/server";
import { getStaff } from "@/lib/auth";
import { sheets } from "@/lib/sheets";

export const dynamic = "force-dynamic";

/** Extracts the pass token from either a raw token or a full /pass/<token> URL. */
function parseToken(raw: string) {
  const m = raw.match(/\/pass\/([A-Za-z0-9_-]+)/);
  return (m ? m[1] : raw).trim();
}

export async function POST(req: Request) {
  const staff = await getStaff();
  if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { code, trip_code, trip_date, confirm } = await req.json();
  const token = parseToken(String(code ?? ""));
  if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) {
    return NextResponse.json({ result: "invalid", message: "Not a TARE2K boarding pass." });
  }
  try {
    const r = await sheets("checkin", { token, trip_code, trip_date, confirm: !!confirm, by: staff.name });
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ result: "invalid", message: (e as Error).message });
  }
}
