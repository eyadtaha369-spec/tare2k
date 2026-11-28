import { NextResponse } from "next/server";
import { sheets } from "@/lib/sheets";
import { getWindows } from "@/lib/windows";
import { AREAS, AreaCode, areasForTrip, fareFor } from "@/lib/config";
import { isValidEgyptMobile, toIntlEgypt } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MAX_BYTES = 4 * 1024 * 1024; // Vercel request limit is 4.5 MB
const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PASSENGERS = 10;

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

type PassengerIn = { full_name?: string; phone?: string; area?: string; pickup_spot?: string };

export async function POST(req: Request) {
  const form = await req.formData();
  const s = (k: string) => String(form.get(k) ?? "").trim();

  const trip_code = s("trip_code");
  const sender_account = s("sender_account");
  const payment_method = s("payment_method");
  const receipt = form.get("receipt");
  const cash = payment_method === "cash_on_bus";

  // Passengers: JSON list (group booking). Falls back to the old single-passenger fields.
  let list: PassengerIn[] = [];
  try {
    list = s("passengers") ? JSON.parse(s("passengers")) : [];
  } catch {
    return bad("Invalid passenger list.");
  }
  if (!list.length) list = [{ full_name: s("full_name"), phone: s("phone"), area: s("area"), pickup_spot: s("pickup_spot") }];
  if (list.length > MAX_PASSENGERS) return bad(`Maximum ${MAX_PASSENGERS} passengers per booking.`);

  // Server-side enforcement of the booking window
  const win = (await getWindows()).find((w) => w.code === trip_code);
  if (!win) return bad("Choose a trip.");
  if (!win.isOpen) return bad("Booking for this trip is currently closed.", 409);
  const allowed = areasForTrip(trip_code);

  const passengers = [];
  const seen = new Set<string>();
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const n = list.length > 1 ? ` (passenger ${i + 1})` : "";
    const full_name = String(p.full_name ?? "").trim().slice(0, 80);
    const phone = String(p.phone ?? "").trim();
    const area = String(p.area ?? "") as AreaCode;
    const pickup_spot = String(p.pickup_spot ?? "");
    if (full_name.length < 3) return bad(`Please enter the full name${n}.`);
    if (!isValidEgyptMobile(phone)) return bad(`Please enter a valid Egyptian WhatsApp number${n}.`);
    const intl = toIntlEgypt(phone);
    if (seen.has(intl)) return bad(`Each passenger needs their own WhatsApp number${n}.`);
    seen.add(intl);
    if (!AREAS[area]) return bad(`Choose a pickup area${n}.`);
    if (!AREAS[area].spots.some((x) => x.en === pickup_spot)) return bad(`Choose a pickup spot${n}.`);
    if (!allowed.includes(area)) return bad(`${AREAS[area].en} isn't served on the selected trip${n}.`);
    passengers.push({ full_name, phone: intl, area, pickup_spot, amount: fareFor(area) });
  }

  if (!["vodafone_cash", "instapay", "cash_on_bus"].includes(payment_method)) return bad("Choose a payment method.");
  let receiptData: { base64: string; mimeType: string } | undefined;
  if (!cash) {
    if (!sender_account) return bad("Please enter the number/account you transferred from.");
    if (!(receipt instanceof File) || receipt.size === 0) return bad("Please upload your transfer receipt.");
    if (receipt.size > MAX_BYTES) return bad("Receipt image is too large. Please upload a screenshot.");
    if (!TYPES.includes(receipt.type)) return bad("Receipt must be an image (JPG, PNG, WEBP).");
    receiptData = { base64: Buffer.from(await receipt.arrayBuffer()).toString("base64"), mimeType: receipt.type };
  }

  // Group and cash bookings need the updated Apps Script (v3+). Refuse cleanly on an older script.
  if (passengers.length > 1 || cash) {
    const v = await sheets<{ version: number }>("version").catch(() => null);
    if (!v || v.version < 3) {
      return bad("Group and cash bookings are temporarily unavailable. Please book one seat paid by transfer, or try again later.", 503);
    }
  }

  try {
    const r = await sheets<{ id: string; ids: string[] }>("createBooking", {
      // first passenger at the top level too, so an older Apps Script still saves single bookings correctly
      full_name: passengers[0].full_name,
      phone: passengers[0].phone,
      area: passengers[0].area,
      pickup_spot: passengers[0].pickup_spot,
      amount: passengers[0].amount,
      trip_code,
      trip_date: win.tripDate,
      direction: win.direction,
      sender_account: cash ? "" : sender_account,
      payment_method,
      passengers,
      receipt: receiptData,
    });
    return NextResponse.json({
      ok: true, id: r.id, ids: r.ids, tripDate: win.tripDate,
      total: passengers.reduce((a, p) => a + p.amount, 0), seats: passengers.length,
    });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.startsWith("duplicate")) {
      const phones = msg.split(":")[1]?.split(",").map((x) => "0" + x.replace(/^20/, "")).join(", ");
      return bad(`Already booked on this trip: ${phones}. Remove them and try again.`, 409);
    }
    console.error(e);
    return bad("Could not save your request. Please try again.", 500);
  }
}
