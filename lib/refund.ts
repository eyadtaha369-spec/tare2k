import { AreaCode, timesFor } from "./config";
import { cairoNow, tripDef } from "./trips";


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

/**
 * Last moment a student can cancel = when that trip's booking window closes (6:00 PM Egypt time):
 * Saturday → Fri 6 PM · Sunday (both shifts) → Sat 6 PM · Wednesday → Tue 6 PM · Thursday → Wed 6 PM.
 */
export function refundDeadline(b: { trip_code: string; trip_date: string }) {
  const [y, mo, d] = b.trip_date.split("-").map(Number);
  const daysBefore = tripDef(b.trip_code)?.closeDaysBefore ?? 1;
  return Date.UTC(y, mo - 1, d) - daysBefore * 86_400_000 + 18 * 3_600_000;
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
