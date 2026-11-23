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
  vodafoneCash: "010XXXXXXXX", // TODO: company Vodafone Cash number
  instapay: "tare2k@instapay", // TODO: company InstaPay address
  fareEgp: null as number | null, // TODO: set a fare (e.g. 150) to show it on the form, or keep null
};

// Supervisor / support WhatsApp shown on the site (international format, no +)
export const SUPPORT_WHATSAPP = "2010XXXXXXXX"; // TODO

export type AreaCode = "damanhour" | "itay" | "delengat";

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
    en: "Itay - Abu Hummus",
    ar: "ايتاي - ابو حمص",
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
};

export const AREA_CODES = Object.keys(AREAS) as AreaCode[];

export function spotLabel(area: AreaCode, spot: string) {
  const s = AREAS[area]?.spots.find((x) => x.en === spot);
  return s ? `${s.en} — ${s.ar}` : spot;
}

// ─── Bus schedules: assembly & departure time per trip/shift and area ───
// An area missing from a trip means that area is NOT served on that trip.
// Trips with no entry at all (return trips) show "Times TBA".
export type Times = { assembly: string; departure: string };

const PM_SHIFT: Partial<Record<AreaCode, Times>> = {
  delengat: { assembly: "3:00 PM", departure: "3:15 PM" },
  itay: { assembly: "3:00 PM", departure: "3:15 PM" },
  damanhour: { assembly: "4:00 PM", departure: "4:15 PM" },
};

export const SCHEDULE: Record<string, Partial<Record<AreaCode, Times>> | null> = {
  sat_out: PM_SHIFT,
  sun_am: {
    itay: { assembly: "5:30 AM", departure: "5:40 AM" },
    damanhour: { assembly: "6:00 AM", departure: "6:10 AM" },
  },
  sun_pm: PM_SHIFT,
  wed_ret: null, // TODO: return times
  thu_ret: null, // TODO: return times
};

/** Areas that can be booked on a given trip. */
export function areasForTrip(tripCode: string): AreaCode[] {
  const s = SCHEDULE[tripCode === "sun_out" ? "sun_pm" : tripCode];
  return s ? AREA_CODES.filter((a) => s[a]) : AREA_CODES;
}

/** Assembly/departure times for a trip + area, or null if not set. */
export function timesFor(tripCode: string, area: AreaCode): Times | null {
  return SCHEDULE[tripCode === "sun_out" ? "sun_pm" : tripCode]?.[area] ?? null;
}

export function timesText(tripCode: string, area: AreaCode) {
  const t = timesFor(tripCode, area);
  return t ? `Assembly ${t.assembly} · Departure ${t.departure}` : "Times TBA";
}
