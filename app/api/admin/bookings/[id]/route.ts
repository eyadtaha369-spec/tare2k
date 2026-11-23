import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { adminDb, getStaff } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaff();
  if (!staff || staff.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { id } = await params;
  const { action } = await req.json();
  const db = adminDb();

  const { data: current } = await db.from("bookings").select("*").eq("id", id).single();
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let patch: Record<string, unknown>;
  if (action === "approve") {
    patch = {
      status: "approved",
      // 32 random bytes → 43-char URL-safe token. Kept if re-approving.
      pass_token: current.pass_token ?? randomBytes(32).toString("base64url"),
      reviewed_by: staff.id,
      reviewed_at: new Date().toISOString(),
    };
  } else if (action === "reject") {
    patch = { status: "rejected", reviewed_by: staff.id, reviewed_at: new Date().toISOString() };
  } else if (action === "pending") {
    patch = { status: "pending", reviewed_by: null, reviewed_at: null };
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const { data, error } = await db.from("bookings").update(patch).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ booking: data });
}
