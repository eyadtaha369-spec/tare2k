import { AREAS, AreaCode, fareFor, spotLabel, timesFor } from "./config";
import { DIRECTION_LABEL, Direction, formatTripDate, tripLabel } from "./trips";

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
  payment_method: PaymentMethod;
  receipt_file_id: string;
  status: BookingStatus;
  reviewed_at: string | null;
  checked_in_at: string | null;
  created_at: string;
  receipt_url?: string | null;
  // Payments & refunds
  amount?: string;
  refund_account?: string;
  refund_reason?: string;
  refund_requested_at?: string;
  refund_amount?: string;
  refund_ref?: string;
  refund_receipt_file_id?: string;
  refund_receipt_url?: string | null;
  refunded_at?: string;
  refunded_by?: string;
  // Weekly archive
  is_archived?: string; // "TRUE" when archived
  archived_at?: string;
  archive_batch?: string;
  // Group bookings
  group_id?: string;
  group_size?: string;
  booked_by_name?: string;
  booked_by_phone?: string;
};

export type BookingStatus = "pending" | "approved" | "rejected" | "refund_requested" | "refunded" | "no_show" | "cancelled";

/** Money actually collected for a booking (stored at booking time, falls back to the current fare). */
export function bookingAmount(b: Pick<Booking, "amount" | "area">) {
  const n = Number(b.amount);
  return Number.isFinite(n) && b.amount !== "" && b.amount !== undefined ? n : fareFor(b.area);
}

/** Statuses where a transfer was received. */
export const PAID_STATUSES: BookingStatus[] = ["approved", "refund_requested", "refunded", "no_show"];

/** Was money actually received for this booking? Transfers: once approved. Cash on bus: once boarded. */
export function isCollected(b: Booking) {
  return isCash(b) ? !!b.checked_in_at && b.status === "approved" : PAID_STATUSES.includes(b.status);
}

export function tripFinance(rows: Booking[]) {
  const collected = rows.filter(isCollected).reduce((a, b) => a + bookingAmount(b), 0);
  const refunded = rows.filter((b) => b.status === "refunded").reduce((a, b) => a + (Number(b.refund_amount) || 0), 0);
  const cashDue = rows.filter((b) => isCash(b) && b.status === "approved" && !b.checked_in_at);
  return {
    collected,
    refunded,
    net: collected - refunded,
    activeSeats: rows.filter((b) => b.status === "approved").length,
    pendingRefunds: rows.filter((b) => b.status === "refund_requested").length,
    cashToCollect: cashDue.reduce((a, b) => a + bookingAmount(b), 0),
    cashSeats: cashDue.length,
  };
}

export const egp = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} EGP`;

/** Apology message sent when the admin rejects a booking (bus full). */
export function whatsappRejectLink(b: Booking) {
  const t = tripLabel(b.trip_code);
  const area = AREAS[b.area]?.ar ?? b.area;
  const [, m, d] = b.trip_date.split("-").map(Number);
  const msg = [
    `أهلاً بك يا *${b.full_name}*،`,
    `نأسف لعدم قبول طلب حجزك في رحلة *${t.ar} ${d}/${m}* (منطقة *${area}*) وذلك *بسبب اكتمال العدد* في الباص.`,
    `في حال قمت بتحويل مبلغ الحجز مسبقاً، يرجى التواصل معنا لاسترداده فوراً.`,
    `نتمنى رؤيتك في الرحلات القادمة — *TARE2K | YOUR WAY TO ALAMEIN*`,
  ].join("\n");
  return `https://wa.me/${toIntlEgypt(b.phone)}?text=${encodeURIComponent(msg)}`;
}

export function whatsappRefundLink(b: Booking) {
  const t = tripLabel(b.trip_code);
  const msg = [
    `💸 *TARE2K — Refund Sent | تم تحويل المبلغ المسترد*`,
    ``,
    `👤 Name | الاسم: ${b.full_name}`,
    `🗓️ Cancelled trip | الرحلة الملغاة: ${t.en} — ${t.ar} — ${formatTripDate(b.trip_date)}`,
    `💰 Amount | المبلغ: ${egp(Number(b.refund_amount) || 0)}`,
    `📲 Sent to | تم التحويل إلى: ${b.refund_account || b.sender_account}`,
    ...(b.refund_ref ? [`🧾 Reference | رقم العملية: ${b.refund_ref}`] : []),
    ``,
    `Your boarding pass for this trip is cancelled. Thank you for using TARE2K.`,
    `تم إلغاء تذكرة هذه الرحلة. شكراً لاستخدامك طريقك 🚌`,
  ].join("\n");
  return `https://wa.me/${toIntlEgypt(b.phone)}?text=${encodeURIComponent(msg)}`;
}

export const PAYMENT_LABEL = {
  vodafone_cash: "Vodafone Cash / Wallet",
  instapay: "InstaPay",
  cash_on_bus: "دفع في الباص (Cash)",
} as const;
export type PaymentMethod = keyof typeof PAYMENT_LABEL;
export const isCash = (b: { payment_method: string }) => b.payment_method === "cash_on_bus";

export function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function whatsappPassLink(b: Booking) {
  const t = tripLabel(b.trip_code);
  const times = timesFor(b.trip_code, b.area);
  const dir = DIRECTION_LABEL[b.direction];
  const area = AREAS[b.area];
  const passUrl = `${siteUrl()}/pass/${b.pass_token}`;
  const msg = [
    `✅ *TARE2K — Booking Confirmed | تم تأكيد الحجز*`,
    ``,
    `👤 Name | الاسم: ${b.full_name}`,
    `🗓️ Trip | الرحلة: ${t.en} — ${t.ar} — ${formatTripDate(b.trip_date)}`,
    `🧭 Direction | الاتجاه: ${dir.en} — ${dir.ar}`,
    `📍 Area | المنطقة: ${area.en} — ${area.ar}`,
    `🚏 ${b.direction === "return" ? "Drop-off | مكان النزول" : "Pickup Spot | نقطة الركوب"}: ${spotLabel(b.area, b.pickup_spot)}`,
    ...(times?.assembly
      ? [`⏰ Assembly | التجمع: ${times.assembly}`, `🚌 Departure | التحرك: ${times.departure}`]
      : times
        ? [`🚌 Departs AIU | التحرك من الجامعة: ${times.departure}`]
        : []),
    ``,
    ...(b.payment_method === "cash_on_bus"
      ? [`💵 Pay ${bookingAmount(b)} EGP cash to the supervisor when boarding | ادفع ${bookingAmount(b)} جنيه كاش للمشرف عند الركوب`, ``]
      : []),
    `🎫 Your Boarding Pass | تذكرة الركوب:`,
    passUrl,
    ``,
    `Please be on time and show the QR code to the supervisor when boarding.`,
    `برجاء الالتزام بالميعاد وإظهار كود الـ QR للمشرف عند الركوب.`,
    ``,
    `TARE2K — YOUR WAY TO ALAMEIN 🚌`,
  ].join("\n");
  return `https://wa.me/${toIntlEgypt(b.phone)}?text=${encodeURIComponent(msg)}`;
}
