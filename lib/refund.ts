import { AreaCode, timesFor } from "./config";
import { cairoNow } from "./trips";

export const REFUND_CUTOFF_HOURS = 6;

/** "6:10 AM" → minutes after midnight */
function toMinutes(t: string) {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === "PM") h += 12;
  return h * 60 + Number(m[2]);
}

/**
 * Departure time of a booking as a Cairo wall-clock timestamp (same scale as cairoNow()).
 * If the time isn't set, midnight at the start of the trip day is used (the strictest choice).
 */
export function departureAt(b: { trip_code: string; trip_date: string; area: AreaCode }) {
  const [y, mo, d] = b.trip_date.split("-").map(Number);
  const mins = toMinutes(timesFor(b.trip_code, b.area)?.departure ?? "") ?? 0;
  return Date.UTC(y, mo - 1, d) + mins * 60_000;
}

/** Last moment a student can cancel (6 hours before departure). */
export function refundDeadline(b: { trip_code: string; trip_date: string; area: AreaCode }) {
  return departureAt(b) - REFUND_CUTOFF_HOURS * 3_600_000;
}

export function canRequestRefund(
  b: { status: string; checked_in_at?: string | null; trip_code: string; trip_date: string; area: AreaCode },
  now = new Date(),
) {
  return b.status === "approved" && !b.checked_in_at && cairoNow(now) < refundDeadline(b);
}

/** "Sat 28 Nov, 9:15 AM" for a Cairo wall-clock timestamp */
export function formatCairoWall(ms: number) {
  return new Date(ms).toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC",
  });
}
