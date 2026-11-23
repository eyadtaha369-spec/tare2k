// Booking-window engine. All rules are evaluated on Egypt wall-clock time
// (Africa/Cairo, DST-aware) so they behave the same on any server.

export type TripCode = "sat_out" | "sun_am" | "sun_pm" | "wed_130" | "wed_330" | "thu_130" | "thu_330";
export type Shift = "morning" | "afternoon" | "r130" | "r330";
export type Direction = "outbound" | "return";
export type OverrideMode = "auto" | "open" | "closed";

type TripDef = {
  code: TripCode;
  weekday: number; // 0 = Sunday … 6 = Saturday
  direction: Direction;
  en: string;
  ar: string;
  shift?: Shift;
  openDaysBefore: number; // window opens N days before trip at 18:00
  closeDaysBefore: number; // window closes N days before trip at 18:00
  openLabel: string;
  closeLabel: string;
};

export const TRIPS: TripDef[] = [
  { code: "sat_out", weekday: 6, direction: "outbound", en: "Saturday", ar: "السبت", shift: "afternoon", openDaysBefore: 3, closeDaysBefore: 1, openLabel: "Wed 6:00 PM", closeLabel: "Fri 6:00 PM" },
  { code: "sun_am", weekday: 0, direction: "outbound", en: "Sunday", ar: "الأحد", shift: "morning", openDaysBefore: 4, closeDaysBefore: 1, openLabel: "Wed 6:00 PM", closeLabel: "Sat 6:00 PM" },
  { code: "sun_pm", weekday: 0, direction: "outbound", en: "Sunday", ar: "الأحد", shift: "afternoon", openDaysBefore: 4, closeDaysBefore: 1, openLabel: "Wed 6:00 PM", closeLabel: "Sat 6:00 PM" },
  { code: "wed_130", weekday: 3, direction: "return", en: "Wednesday", ar: "الأربعاء", shift: "r130", openDaysBefore: 3, closeDaysBefore: 1, openLabel: "Sun 6:00 PM", closeLabel: "Tue 6:00 PM" },
  { code: "wed_330", weekday: 3, direction: "return", en: "Wednesday", ar: "الأربعاء", shift: "r330", openDaysBefore: 3, closeDaysBefore: 1, openLabel: "Sun 6:00 PM", closeLabel: "Tue 6:00 PM" },
  { code: "thu_130", weekday: 4, direction: "return", en: "Thursday", ar: "الخميس", shift: "r130", openDaysBefore: 4, closeDaysBefore: 1, openLabel: "Sun 6:00 PM", closeLabel: "Wed 6:00 PM" },
  { code: "thu_330", weekday: 4, direction: "return", en: "Thursday", ar: "الخميس", shift: "r330", openDaysBefore: 4, closeDaysBefore: 1, openLabel: "Sun 6:00 PM", closeLabel: "Wed 6:00 PM" },
];

export const DIRECTION_LABEL: Record<Direction, { en: string; ar: string }> = {
  outbound: { en: "Going to Alamein", ar: "ذهاب إلى العلمين" },
  return: { en: "Return from Alamein", ar: "عودة من العلمين" },
};

export const SHIFT_LABEL: Record<Shift, { en: string; ar: string }> = {
  morning: { en: "Morning", ar: "صباحاً" },
  afternoon: { en: "Afternoon", ar: "عصراً" },
  r130: { en: "1:30 PM", ar: "١:٣٠ م" },
  r330: { en: "3:30 PM", ar: "٣:٣٠ م" },
};

/** Old trip codes from earlier versions → current codes. */
export const LEGACY_CODES: Record<string, string> = { sun_out: "sun_pm", wed_ret: "wed_130", thu_ret: "thu_130" };
export const canonicalCode = (code: string) => LEGACY_CODES[code] ?? code;

export function tripDef(code: string) {
  return TRIPS.find((t) => t.code === canonicalCode(code));
}

/** "Sunday · Morning" / "الأحد (صباحاً)" */
export function tripLabel(code: string) {
  const t = tripDef(code);
  if (!t) return { en: code, ar: code };
  const sh = t.shift ? SHIFT_LABEL[t.shift] : null;
  return { en: sh ? `${t.en} · ${sh.en}` : t.en, ar: sh ? `${t.ar} (${sh.ar})` : t.ar };
}

const DAY = 86_400_000;
const OPEN_CLOSE_MINUTES = 18 * 60;

/** Current Cairo wall-clock as a fake-UTC timestamp (so date math is simple). */
export function cairoNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
}

function isoDate(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

export type TripWindow = {
  code: TripCode;
  direction: Direction;
  en: string;
  ar: string;
  shift?: Shift;
  tripDate: string; // YYYY-MM-DD (Cairo)
  opensAt: string; // Cairo wall-clock ISO without zone
  closesAt: string;
  autoOpen: boolean;
  override: OverrideMode;
  isOpen: boolean;
  openLabel: string;
  closeLabel: string;
};

/** Computes the upcoming instance of each trip and whether booking is open. */
export function computeWindows(
  overrides: { trip_code: string; trip_date: string; mode: OverrideMode }[] = [],
  now = new Date(),
): TripWindow[] {
  const nowMs = cairoNow(now);
  const today = Math.floor(nowMs / DAY) * DAY;
  const todayDow = new Date(today).getUTCDay();

  return TRIPS.map((t) => {
    // Next occurrence strictly after today (windows always close the day before).
    let diff = (t.weekday - todayDow + 7) % 7;
    if (diff === 0) diff = 7;
    const trip = today + diff * DAY;
    const opens = trip - t.openDaysBefore * DAY + OPEN_CLOSE_MINUTES * 60_000;
    const closes = trip - t.closeDaysBefore * DAY + OPEN_CLOSE_MINUTES * 60_000;
    const autoOpen = nowMs >= opens && nowMs < closes;
    const tripDate = isoDate(trip);
    const ov = overrides.find((o) => o.trip_code === t.code && o.trip_date === tripDate)?.mode ?? "auto";
    return {
      code: t.code,
      direction: t.direction,
      en: tripLabel(t.code).en,
      ar: tripLabel(t.code).ar,
      shift: t.shift,
      tripDate,
      opensAt: new Date(opens).toISOString().slice(0, 16),
      closesAt: new Date(closes).toISOString().slice(0, 16),
      autoOpen,
      override: ov,
      isOpen: ov === "open" ? true : ov === "closed" ? false : autoOpen,
      openLabel: t.openLabel,
      closeLabel: t.closeLabel,
    };
  });
}

export function formatTripDate(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
  });
}

export function tripTitle(code: string, date?: string) {
  const t = tripDef(code);
  if (!t) return code;
  const dir = DIRECTION_LABEL[t.direction];
  return `${tripLabel(code).en} · ${dir.en}${date ? ` (${formatTripDate(date)})` : ""}`;
}
