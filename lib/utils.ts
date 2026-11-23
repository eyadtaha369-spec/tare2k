import { AREAS, AreaCode, spotLabel } from "./config";
import { DIRECTION_LABEL, Direction, formatTripDate, tripDef } from "./trips";

/** Normalises Egyptian mobile numbers to international digits (20XXXXXXXXXX). */
export function toIntlEgypt(phone: string) {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("0020")) d = d.slice(2);
  if (d.startsWith("20") && d.length === 12) return d;
  if (d.startsWith("0") && d.length === 11) return "20" + d.slice(1);
  if (d.length === 10 && d.startsWith("1")) return "20" + d;
  return d;
}

export function isValidEgyptMobile(phone: string) {
  return /^201[0125]\d{8}$/.test(toIntlEgypt(phone));
}

export type Booking = {
  id: string;
  pass_token: string | null;
  trip_code: string;
  trip_date: string;
  direction: Direction;
  area: AreaCode;
  pickup_spot: string;
  full_name: string;
  phone: string;
  sender_account: string;
  payment_method: "vodafone_cash" | "instapay";
  receipt_file_id: string;
  status: "pending" | "approved" | "rejected";
  reviewed_at: string | null;
  checked_in_at: string | null;
  created_at: string;
  receipt_url?: string | null;
};

export const PAYMENT_LABEL = { vodafone_cash: "Vodafone Cash", instapay: "InstaPay" } as const;

export function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function whatsappPassLink(b: Booking) {
  const t = tripDef(b.trip_code);
  const dir = DIRECTION_LABEL[b.direction];
  const area = AREAS[b.area];
  const passUrl = `${siteUrl()}/pass/${b.pass_token}`;
  const msg = [
    `✅ *TARE2K — Booking Confirmed | تم تأكيد الحجز*`,
    ``,
    `👤 Name | الاسم: ${b.full_name}`,
    `🗓️ Trip | الرحلة: ${t?.en ?? ""} ${t?.ar ?? ""} — ${formatTripDate(b.trip_date)}`,
    `🧭 Direction | الاتجاه: ${dir.en} — ${dir.ar}`,
    `📍 Area | المنطقة: ${area.en} — ${area.ar}`,
    `🚏 Pickup Spot | نقطة الركوب: ${spotLabel(b.area, b.pickup_spot)}`,
    ``,
    `🎫 Your Boarding Pass | تذكرة الركوب:`,
    passUrl,
    ``,
    `Please show the QR code to the supervisor when boarding.`,
    `برجاء إظهار كود الـ QR للمشرف عند الركوب.`,
    ``,
    `TARE2K — YOUR WAY TO ALAMEIN 🚌`,
  ].join("\n");
  return `https://wa.me/${toIntlEgypt(b.phone)}?text=${encodeURIComponent(msg)}`;
}
