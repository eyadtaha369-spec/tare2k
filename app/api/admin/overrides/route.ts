import { NextResponse } from "next/server";
import { getStaff } from "@/lib/auth";
import { sheets } from "@/lib/sheets";
import { tripDef } from "@/lib/trips";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const staff = await getStaff();
  if (!staff || staff.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { trip_code, trip_date, mode } = await req.json();
  if (!tripDef(trip_code) || !/^\d{4}-\d{2}-\d{2}$/.test(trip_date) || !["auto", "open", "closed"].includes(mode)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  try {
    await sheets("setOverride", { trip_code, trip_date, mode, by: staff.name });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
