import { NextResponse } from "next/server";
import { getStaff } from "@/lib/auth";
import { sheets } from "@/lib/sheets";
import { Booking } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const staff = await getStaff();
  if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  try {
    const { bookings } = await sheets<{ bookings: Booking[] }>("listBookings", {
      status: url.searchParams.get("status") ?? "all",
      trip_code: url.searchParams.get("trip_code") ?? "all",
      trip_date: url.searchParams.get("trip_date") ?? "",
    });
    const rows = bookings.map((b) => ({
      ...b,
      receipt_url: staff.role === "admin" ? `/api/admin/receipt/${b.id}` : null,
      receipt_file_id: undefined,
    }));
    return NextResponse.json({ bookings: rows, role: staff.role });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
