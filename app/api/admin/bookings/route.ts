import { NextResponse } from "next/server";
import { adminDb, getStaff } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const staff = await getStaff();
  if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const trip_code = url.searchParams.get("trip_code");
  const trip_date = url.searchParams.get("trip_date");
  const withReceipts = url.searchParams.get("receipts") === "1";

  let q = adminDb().from("bookings").select("*").order("created_at", { ascending: false }).limit(1000);
  if (status && status !== "all") q = q.eq("status", status);
  if (trip_code && trip_code !== "all") q = q.eq("trip_code", trip_code);
  if (trip_date) q = q.eq("trip_date", trip_date);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let rows = data ?? [];
  if (withReceipts && staff.role === "admin" && rows.length) {
    const { data: signed } = await adminDb()
      .storage.from("receipts")
      .createSignedUrls(rows.map((r) => r.receipt_path), 60 * 60);
    const map = new Map(signed?.map((s) => [s.path, s.signedUrl]));
    rows = rows.map((r) => ({ ...r, receipt_url: map.get(r.receipt_path) ?? null }));
  }
  return NextResponse.json({ bookings: rows, role: staff.role });
}
