import { NextResponse } from "next/server";
import { getStaff } from "@/lib/auth";
import { sheets } from "@/lib/sheets";

export const dynamic = "force-dynamic";

/** "Start new week": archives all active bookings under one batch label (Cairo date & time). */
export async function POST() {
  const staff = await getStaff();
  if (staff?.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const batch = `${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")}`;
  try {
    return NextResponse.json(await sheets("archiveAll", { batch, by: staff.name }));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
