import { NextResponse } from "next/server";
import { adminDb, getStaff } from "@/lib/supabase";

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

  const db = adminDb();
  const { data: b } = await db.from("bookings").select("*").eq("pass_token", token).maybeSingle();
  if (!b) return NextResponse.json({ result: "invalid", message: "Pass not found." });
  if (b.status !== "approved") {
    return NextResponse.json({ result: "invalid", message: `Booking is ${b.status}.`, booking: b });
  }
  if (trip_code && trip_date && (b.trip_code !== trip_code || b.trip_date !== trip_date)) {
    return NextResponse.json({ result: "wrong_trip", message: "This pass is for a different trip.", booking: b });
  }
  if (b.checked_in_at) {
    return NextResponse.json({ result: "already", message: "Already boarded.", booking: b });
  }
  if (!confirm) return NextResponse.json({ result: "valid", booking: b });

  const { data: upd, error } = await db
    .from("bookings")
    .update({ checked_in_at: new Date().toISOString(), checked_in_by: staff.id })
    .eq("id", b.id)
    .is("checked_in_at", null)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!upd) return NextResponse.json({ result: "already", message: "Already boarded.", booking: b });
  return NextResponse.json({ result: "boarded", booking: upd });
}
