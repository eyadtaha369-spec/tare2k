import { NextResponse } from "next/server";
import { sheets } from "@/lib/sheets";
import { canRequestRefund } from "@/lib/refund";
import { Booking } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Student cancels their own seat from the private pass link. The token is the credential. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) return NextResponse.json({ error: "Invalid pass." }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const refund_account = String(body.refund_account ?? "").trim().slice(0, 80);
  const refund_reason = String(body.refund_reason ?? "").trim().slice(0, 300);
  const { booking } = await sheets<{ booking: Booking | null }>("findByToken", { token }).catch(() => ({ booking: null }));
  if (!booking) return NextResponse.json({ error: "Pass not found." }, { status: 404 });
  // Cash-on-bus seats were never paid, so no refund number is needed
  if (booking.payment_method !== "cash_on_bus" && refund_account.length < 5) {
    return NextResponse.json({ error: "Enter the Vodafone Cash / InstaPay number for the refund." }, { status: 400 });
  }
  if (!canRequestRefund(booking)) {
    return NextResponse.json(
      { error: "Booking and refund window for this trip has closed." },
      { status: 409 },
    );
  }
  try {
    await sheets("requestRefund", { token, refund_account, refund_reason });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
