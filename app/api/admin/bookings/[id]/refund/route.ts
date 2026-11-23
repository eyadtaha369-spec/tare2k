import { NextResponse } from "next/server";
import { getStaff } from "@/lib/auth";
import { sheets } from "@/lib/sheets";

export const dynamic = "force-dynamic";

const TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Admin confirms a refund transfer: amount, optional reference and optional screenshot. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaff();
  if (staff?.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { id } = await params;
  const form = await req.formData();
  const amount = Number(form.get("amount"));
  const ref = String(form.get("ref") ?? "").trim().slice(0, 200);
  const file = form.get("receipt");

  if (!Number.isFinite(amount) || amount < 0) return NextResponse.json({ error: "Enter a valid refund amount." }, { status: 400 });
  let receipt: { base64: string; mimeType: string } | undefined;
  if (file instanceof File && file.size > 0) {
    if (!TYPES.includes(file.type)) return NextResponse.json({ error: "Screenshot must be an image." }, { status: 400 });
    if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: "Screenshot is too large." }, { status: 400 });
    receipt = { base64: Buffer.from(await file.arrayBuffer()).toString("base64"), mimeType: file.type };
  }
  try {
    const { booking } = await sheets<{ booking: Record<string, string> }>("processRefund", {
      id, amount: Math.round(amount * 100) / 100, ref, receipt, by: staff.name,
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
