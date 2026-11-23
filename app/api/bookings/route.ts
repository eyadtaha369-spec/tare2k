import { NextResponse } from "next/server";
import { sheets } from "@/lib/sheets";
import { getWindows } from "@/lib/windows";
import { AREAS, AreaCode, PAYMENT, areasForTrip } from "@/lib/config";
import { isValidEgyptMobile, toIntlEgypt } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MAX_BYTES = 4 * 1024 * 1024; // Vercel request limit is 4.5 MB
const TYPES = ["image/jpeg", "image/png", "image/webp"];

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
  if (receipt.size > MAX_BYTES) return bad("Receipt image is too large. Please upload a screenshot.");
  if (!TYPES.includes(receipt.type)) return bad("Receipt must be an image (JPG, PNG, WEBP).");

  // Server-side enforcement of the booking window
  const win = (await getWindows()).find((w) => w.code === trip_code);
  if (!win) return bad("Choose a trip.");
  if (!win.isOpen) return bad("Booking for this trip is currently closed.", 409);
  if (!areasForTrip(trip_code).includes(area)) return bad("This area isn't served on the selected shift.");

  try {
    const r = await sheets<{ id: string }>("createBooking", {
      trip_code,
      trip_date: win.tripDate,
      direction: win.direction,
      area,
      pickup_spot,
      full_name,
      phone: toIntlEgypt(phone),
      sender_account,
      payment_method,
      amount: PAYMENT.fareEgp ?? "",
      receipt: { base64: Buffer.from(await receipt.arrayBuffer()).toString("base64"), mimeType: receipt.type },
    });
    return NextResponse.json({ ok: true, id: r.id, tripDate: win.tripDate });
  } catch (e) {
    if ((e as Error).message === "duplicate") {
      return bad("You already have a request for this trip. We'll contact you on WhatsApp.", 409);
    }
    console.error(e);
    return bad("Could not save your request. Please try again.", 500);
  }
}
