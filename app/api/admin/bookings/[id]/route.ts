import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getStaff } from "@/lib/auth";
import { sheets } from "@/lib/sheets";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { approve: "approved", reject: "rejected", pending: "pending", no_show: "no_show" };

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaff();
  if (!staff || staff.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { id } = await params;
  const { action } = await req.json();
  if (!STATUS[action]) return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  try {
    const { booking } = await sheets<{ booking: Record<string, unknown> }>("updateStatus", {
      id,
      status: STATUS[action],
      // 32 random bytes → 43-char URL-safe token (kept if already set)
      pass_token: randomBytes(32).toString("base64url"),
      by: staff.name,
    });
    return NextResponse.json({
      booking: {
        ...booking,
        receipt_url: `/api/admin/receipt/${id}`,
        refund_receipt_url: booking.refund_receipt_file_id ? `/api/admin/refund-receipt/${id}` : null,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

/** Permanently deletes a booking (and trashes its receipt images in Drive). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaff();
  if (!staff || staff.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { id } = await params;
  try {
    await sheets("deleteBooking", { id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
