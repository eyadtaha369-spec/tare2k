import { NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase";
import { getWindows } from "@/lib/windows";
import { AREAS, AreaCode } from "@/lib/config";
import { isValidEgyptMobile, toIntlEgypt } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" };

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: Request) {
  const form = await req.formData();
  const s = (k: string) => String(form.get(k) ?? "").trim();

  const trip_code = s("trip_code");
  const area = s("area") as AreaCode;
  const pickup_spot = s("pickup_spot");
  const full_name = s("full_name");
  const phone = s("phone");
  const sender_account = s("sender_account");
  const payment_method = s("payment_method");
  const receipt = form.get("receipt");

  if (!full_name || full_name.length < 3) return bad("Please enter your full name.");
  if (!isValidEgyptMobile(phone)) return bad("Please enter a valid Egyptian WhatsApp number.");
  if (!sender_account) return bad("Please enter the number/account you transferred from.");
  if (!["vodafone_cash", "instapay"].includes(payment_method)) return bad("Choose a payment method.");
  if (!AREAS[area]) return bad("Choose a pickup area.");
  if (!AREAS[area].spots.some((x) => x.en === pickup_spot)) return bad("Choose a pickup spot.");
  if (!(receipt instanceof File) || receipt.size === 0) return bad("Please upload your transfer receipt.");
  if (receipt.size > MAX_BYTES) return bad("Receipt image must be under 5 MB.");
  const ext = TYPES[receipt.type];
  if (!ext) return bad("Receipt must be an image (JPG, PNG, WEBP).");

  // Server-side enforcement of the booking window
  const win = (await getWindows()).find((w) => w.code === trip_code);
  if (!win) return bad("Choose a trip.");
  if (!win.isOpen) return bad("Booking for this trip is currently closed.", 409);

  const db = adminDb();
  const intlPhone = toIntlEgypt(phone);

  // Prevent duplicate active requests for the same trip
  const { data: dup } = await db
    .from("bookings")
    .select("id")
    .eq("trip_code", trip_code)
    .eq("trip_date", win.tripDate)
    .eq("phone", intlPhone)
    .in("status", ["pending", "approved"])
    .limit(1);
  if (dup?.length) return bad("You already have a request for this trip. We'll contact you on WhatsApp.", 409);

  const path = `${win.tripDate}/${trip_code}/${crypto.randomUUID()}.${ext}`;
  const up = await db.storage.from("receipts").upload(path, receipt, { contentType: receipt.type });
  if (up.error) return bad("Upload failed. Please try again.", 500);

  const { data, error } = await db
    .from("bookings")
    .insert({
      trip_code,
      trip_date: win.tripDate,
      direction: win.direction,
      area,
      pickup_spot,
      full_name,
      phone: intlPhone,
      sender_account,
      payment_method,
      receipt_path: path,
    })
    .select("id")
    .single();

  if (error) {
    await db.storage.from("receipts").remove([path]);
    return bad("Could not save your request. Please try again.", 500);
  }
  return NextResponse.json({ ok: true, id: data.id, tripDate: win.tripDate });
}
