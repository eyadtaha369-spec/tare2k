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
  damanhour: {
    en: "Damanhour",
    ar: "دمنهور",
    // TODO: replace with the real Damanhour pickup spots
    spots: [
      { en: "Damanhour Spot 1", ar: "نقطة دمنهور ١" },
      { en: "Damanhour Spot 2", ar: "نقطة دمنهور ٢" },
    ],
  },
  itay: {
    en: "Itay - Abu Hummus",
    ar: "ايتاي - ابو حمص",
    // TODO: replace with the real Itay - Abu Hummus pickup spots
    spots: [
      { en: "Itay Spot 1", ar: "نقطة ايتاي ١" },
      { en: "Abu Hummus Spot 1", ar: "نقطة ابو حمص ١" },
    ],
  },
  delengat: {
    en: "Delengat",
    ar: "دلنجات",
    // TODO: replace with the real Delengat pickup spots
    spots: [
      { en: "Delengat Spot 1", ar: "نقطة دلنجات ١" },
      { en: "Delengat Spot 2", ar: "نقطة دلنجات ٢" },
    ],
  },
};

export const AREA_CODES = Object.keys(AREAS) as AreaCode[];

export function spotLabel(area: AreaCode, spot: string) {
  const s = AREAS[area]?.spots.find((x) => x.en === spot);
  return s ? `${s.en} — ${s.ar}` : spot;
}

// Departure times shown on the landing page (display only)
export const DEPARTURE_TIMES = {
  outbound: "TBA", // TODO: e.g. "6:30 AM"
  return: "TBA", // TODO: e.g. "4:00 PM"
};
