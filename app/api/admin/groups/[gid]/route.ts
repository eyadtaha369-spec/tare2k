import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getStaff } from "@/lib/auth";
import { sheets } from "@/lib/sheets";

export const dynamic = "force-dynamic";

/** Approve or reject every pending passenger in a group booking at once. */
export async function POST(req: Request, { params }: { params: Promise<{ gid: string }> }) {
  const staff = await getStaff();
  if (staff?.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { gid } = await params;
  const { action } = await req.json().catch(() => ({}));
  const status = action === "approve" ? "approved" : action === "reject" ? "rejected" : null;
  if (!status) return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  try {
    const r = await sheets<{ bookings: Record<string, string>[] }>("updateGroupStatus", {
      group_id: gid,
      status,
      // one unguessable pass token per passenger
      tokens: Array.from({ length: 12 }, () => randomBytes(32).toString("base64url")),
      by: staff.name,
    });
    return NextResponse.json({
      bookings: r.bookings.map((b) => ({ ...b, receipt_url: `/api/admin/receipt/${b.id}`, receipt_file_id: undefined })),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
