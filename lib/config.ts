import { canonicalCode } from "./trips";
// ─────────────────────────────────────────────────────────────
//  TARE2K — business configuration (edit this file to update the app)
// ─────────────────────────────────────────────────────────────

export const BRAND = {
  name: "TARE2K",
  slogan: "YOUR WAY TO ALAMEIN",
  sloganAr: "طريقك إلى العلمين",
  destination: "Alamein International University (AIU)",
  destinationAr: "جامعة العلمين الدولية",
};

// Payment details shown on the booking form
export const PAYMENT = {
  // Company numbers that receive payments — valid for BOTH wallet transfers and InstaPay
  receivingNumbers: ["01021848881", "01015977695"],
  fareEgp: null as number | null, // TODO: set a fare (e.g. 150) to show it on the form, or keep null
};

// Supervisor / support WhatsApp shown on the site (international format, no +)
// Official contact numbers (international digits, no +)
export const CONTACTS = [
  { display: "01021848881", intl: "201021848881" },
  { display: "+20 101 597 7695", intl: "201015977695" },
];

export type AreaCode = "delengat" | "itay" | "damanhour" | "abu_hummus" | "kafr_eldawar";

export const AREAS: Record<
  AreaCode,
  { en: string; ar: string; spots: { en: string; ar: string }[] }
> = {
  delengat: {
    en: "Delengat",
    ar: "دلنجات",
    spots: [{ en: "Itay Bridge", ar: "كوبرى ايتاي" }],
  },
  itay: {
    en: "Itay El Barud",
    ar: "ايتاي",
    spots: [
      { en: "Agricultural Administration", ar: "الادارة الزراعية" },
      { en: "Itay Entrance", ar: "مدخل ايتاي" },
    ],
  },
  damanhour: {
    en: "Damanhour",
    ar: "دمنهور",
    spots: [{ en: "Governorate Entrance", ar: "مدخل المحافظة" }],
  },
  abu_hummus: {
    en: "Abu Hummus",
    ar: "ابو حمص",
    spots: [{ en: "Abu Hummus Bridge Exit", ar: "نزلة كوبري ابو حمص" }],
  },
  kafr_eldawar: {
    en: "Kafr El Dawar",
    ar: "كفر الدوار",
    spots: [{ en: "Al-Omda Entrance", ar: "مدخل العمدة" }],
  },
};

export const AREA_CODES = Object.keys(AREAS) as AreaCode[];

export function spotLabel(area: AreaCode, spot: string) {
  const s = AREAS[area]?.spots.find((x) => x.en === spot);
  return s ? `${s.en} — ${s.ar}` : spot;
}

// ─── Bus schedules per trip/shift and area ───
// • { assembly, departure } → exact times
// • "tba"                   → area is served, times not set yet
// • area missing            → area is NOT served on that trip (e.g. Delengat on Sunday morning)
export type Times = { assembly?: string; departure: string };
type Slot = Times | "tba";

const PM_SHIFT: Partial<Record<AreaCode, Slot>> = {
  delengat: { assembly: "3:00 PM", departure: "3:15 PM" },
  itay: { assembly: "3:00 PM", departure: "3:15 PM" },
  damanhour: { assembly: "4:00 PM", departure: "4:15 PM" },
  abu_hummus: { assembly: "4:00 PM", departure: "4:15 PM" },
  kafr_eldawar: { assembly: "4:00 PM", departure: "4:15 PM" },
};

/** Return trips leave the university at one time for every area. */
const fromUniversity = (departure: string): Partial<Record<AreaCode, Slot>> =>
  Object.fromEntries(AREA_CODES.map((a) => [a, { departure }]));

export const SCHEDULE: Record<string, Partial<Record<AreaCode, Slot>>> = {
  sat_out: PM_SHIFT,
  sun_am: {
    itay: { assembly: "5:30 AM", departure: "5:40 AM" },
    damanhour: { assembly: "6:00 AM", departure: "6:10 AM" },
    abu_hummus: { assembly: "6:00 AM", departure: "6:10 AM" },
    kafr_eldawar: { assembly: "6:00 AM", departure: "6:10 AM" },
  },
  sun_pm: PM_SHIFT,
  wed_130: fromUniversity("1:30 PM"),
  wed_330: fromUniversity("3:30 PM"),
  thu_130: fromUniversity("1:30 PM"),
  thu_330: fromUniversity("3:30 PM"),
};

const sched = (code: string) => SCHEDULE[canonicalCode(code)];

/** Areas that can be booked on a given trip (in route order). */
export function areasForTrip(tripCode: string): AreaCode[] {
  const s = sched(tripCode);
  return s ? AREA_CODES.filter((a) => a in s) : AREA_CODES;
}

/** Times for a trip + area, or null if not set yet. */
export function timesFor(tripCode: string, area: AreaCode): Times | null {
  const t = sched(tripCode)?.[area];
  return t && t !== "tba" ? t : null;
}

export function timesText(tripCode: string, area: AreaCode) {
  const t = timesFor(tripCode, area);
  if (!t) return "Times TBA";
  return t.assembly ? `Assembly ${t.assembly} · Departure ${t.departure}` : `Departs AIU ${t.departure}`;
}
