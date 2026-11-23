"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import TripStatusBadge from "@/components/TripStatusBadge";
import { DIRECTION_LABEL, OverrideMode, TripWindow, formatTripDate } from "@/lib/trips";

const MODES: { v: OverrideMode; en: string; ar: string }[] = [
  { v: "auto", en: "Automatic", ar: "تلقائي" },
  { v: "open", en: "Force open", ar: "فتح يدوي" },
  { v: "closed", en: "Force closed", ar: "إغلاق يدوي" },
];

export default function TripsView() {
  const [trips, setTrips] = useState<TripWindow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const j = await fetch("/api/trips", { cache: "no-store" }).then((r) => r.json());
    setTrips(j.trips ?? []);
  }
  useEffect(() => { load(); }, []);

  async function setMode(t: TripWindow, mode: OverrideMode) {
    setBusy(t.code);
    await fetch("/api/admin/overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trip_code: t.code, trip_date: t.tripDate, mode }),
    });
    await load();
    setBusy(null);
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-black">Trip Availability</h1>
      <p className="mb-5 text-sm text-neutral-500">
        Windows run automatically on Egypt time. Override a specific upcoming trip if needed. | التحكم في فتح وغلق الحجز
      </p>
      <div className="space-y-3">
        {trips.map((t) => (
          <div key={t.code} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold">{t.en} <span className="text-neutral-400">| {t.ar}</span></span>
                <TripStatusBadge open={t.isOpen} />
              </div>
              <div className="text-sm text-neutral-600">{DIRECTION_LABEL[t.direction].en} · {formatTripDate(t.tripDate)}</div>
              <div className="text-xs text-neutral-500">
                Auto window: {t.openLabel} → {t.closeLabel} ({t.autoOpen ? "currently open" : "currently closed"})
              </div>
            </div>
            <div className="flex items-center gap-1 rounded-xl bg-neutral-100 p-1">
              {busy === t.code && <Loader2 size={16} className="mx-1 animate-spin text-neutral-400" />}
              {MODES.map((m) => (
                <button key={m.v} disabled={busy === t.code} onClick={() => setMode(t, m.v)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${t.override === m.v ? "bg-white shadow ring-1 ring-black/5" : "text-neutral-600"}`}>
                  {m.en}<span className="block text-[10px] opacity-60">{m.ar}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
