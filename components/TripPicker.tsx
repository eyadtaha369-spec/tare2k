"use client";
import { useEffect, useState } from "react";
import { TRIPS, TripWindow, DIRECTION_LABEL } from "@/lib/trips";

export type TripSel = { trip_code: string; trip_date: string };

/** Trip + date selector, defaulting each trip to its upcoming date. */
export default function TripPicker({
  value, onChange, allowAll = false,
}: { value: TripSel; onChange: (v: TripSel) => void; allowAll?: boolean }) {
  const [upcoming, setUpcoming] = useState<TripWindow[]>([]);
  useEffect(() => {
    fetch("/api/trips", { cache: "no-store" }).then((r) => r.json()).then((j) => {
      setUpcoming(j.trips ?? []);
      if (!allowAll && !value.trip_date && j.trips?.length) {
        const first = j.trips.find((t: TripWindow) => t.code === value.trip_code) ?? j.trips[0];
        onChange({ trip_code: first.code, trip_date: first.tripDate });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-wrap gap-2">
      <select className="input !w-auto !py-2 text-sm" value={value.trip_code}
        onChange={(e) => {
          const code = e.target.value;
          const u = upcoming.find((t) => t.code === code);
          onChange({ trip_code: code, trip_date: code === "all" ? "" : u?.tripDate ?? value.trip_date });
        }}>
        {allowAll && <option value="all">All trips | كل الرحلات</option>}
        {TRIPS.map((t) => (
          <option key={t.code} value={t.code}>{t.en} · {DIRECTION_LABEL[t.direction].en}</option>
        ))}
      </select>
      {value.trip_code !== "all" && (
        <input type="date" className="input !w-auto !py-2 text-sm" value={value.trip_date}
          onChange={(e) => onChange({ ...value, trip_date: e.target.value })} />
      )}
    </div>
  );
}
