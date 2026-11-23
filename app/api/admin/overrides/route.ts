import { NextResponse } from "next/server";
import { adminDb, getStaff } from "@/lib/supabase";
import { tripDef } from "@/lib/trips";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const staff = await getStaff();
  if (!staff || staff.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { trip_code, trip_date, mode } = await req.json();
  if (!tripDef(trip_code) || !/^\d{4}-\d{2}-\d{2}$/.test(trip_date)) {
    return NextResponse.json({ error: "Bad trip" }, { status: 400 });
  }
  const db = adminDb();
  if (mode === "auto") {
    await db.from("trip_overrides").delete().eq("trip_code", trip_code).eq("trip_date", trip_date);
  } else if (mode === "open" || mode === "closed") {
    const { error } = await db
      .from("trip_overrides")
      .upsert({ trip_code, trip_date, mode, updated_by: staff.id, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    return NextResponse.json({ error: "Bad mode" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
