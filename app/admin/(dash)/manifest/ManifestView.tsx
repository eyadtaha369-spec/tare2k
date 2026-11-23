"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, FileDown, Loader2, MapPin, RefreshCw } from "lucide-react";
import TripPicker, { TripSel } from "@/components/TripPicker";
import { AREAS, AREA_CODES, AreaCode, spotLabel, timesText } from "@/lib/config";
import { DIRECTION_LABEL, formatTripDate, tripDef, tripLabel } from "@/lib/trips";
import { Booking, PAYMENT_LABEL } from "@/lib/utils";

const ROWS_PER_PAGE = 22;

type Group = { area: AreaCode; spots: { spot: string; rows: Booking[] }[]; total: number };

function groupRows(rows: Booking[]): Group[] {
  return AREA_CODES.map((area) => {
    const inArea = rows.filter((r) => r.area === area);
    const order = AREAS[area].spots.map((s) => s.en);
    const spotNames = Array.from(new Set(inArea.map((r) => r.pickup_spot))).sort(
      (a, b) => (order.indexOf(a) + 1 || 999) - (order.indexOf(b) + 1 || 999),
    );
    return {
      area,
      total: inArea.length,
      spots: spotNames.map((spot) => ({
        spot,
        rows: inArea.filter((r) => r.pickup_spot === spot).sort((a, b) => a.full_name.localeCompare(b.full_name)),
      })),
    };
  });
}

export default function ManifestView() {
  const [trip, setTrip] = useState<TripSel>({ trip_code: "sat_out", trip_date: "" });
  const [rows, setRows] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [areaFilter, setAreaFilter] = useState<AreaCode | "all">("all");
  const [exporting, setExporting] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);

  async function load() {
    if (!trip.trip_date) return;
    setLoading(true);
    const p = new URLSearchParams({ status: "approved", ...trip });
    const j = await fetch(`/api/admin/bookings?${p}`, { cache: "no-store" }).then((r) => r.json());
    setRows(j.bookings ?? []);
    setLoading(false);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [trip.trip_code, trip.trip_date]);

  const groups = useMemo(() => groupRows(rows), [rows]);
  const visible = groups.filter((g) => areaFilter === "all" || g.area === areaFilter);
  const boarded = rows.filter((r) => r.checked_in_at).length;
  const t = tripDef(trip.trip_code);
  const tl = tripLabel(trip.trip_code);

  // Flatten into printable pages: area/spot header rows + passenger rows
  const pages = useMemo(() => {
    type Line = { kind: "area"; area: AreaCode; count: number } | { kind: "spot"; area: AreaCode; spot: string; count: number } | { kind: "row"; b: Booking; n: number };
    const lines: Line[] = [];
    let n = 0;
    for (const g of visible) {
      if (!g.total) continue;
      lines.push({ kind: "area", area: g.area, count: g.total });
      for (const s of g.spots) {
        lines.push({ kind: "spot", area: g.area, spot: s.spot, count: s.rows.length });
        for (const b of s.rows) lines.push({ kind: "row", b, n: ++n });
      }
    }
    const out: Line[][] = [];
    for (let i = 0; i < lines.length; i += ROWS_PER_PAGE) out.push(lines.slice(i, i + ROWS_PER_PAGE));
    return out.length ? out : [[]];
  }, [visible]);

  async function exportPdf() {
    if (!pdfRef.current) return;
    setExporting(true);
    try {
      const [{ jsPDF }, html2canvas] = await Promise.all([import("jspdf"), import("html2canvas").then((m) => m.default)]);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageEls = Array.from(pdfRef.current.querySelectorAll<HTMLElement>("[data-pdf-page]"));
      for (let i = 0; i < pageEls.length; i++) {
        const canvas = await html2canvas(pageEls[i], { scale: 2, backgroundColor: "#ffffff" });
        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 210, 297);
      }
      const areaPart = areaFilter === "all" ? "all-areas" : areaFilter;
      pdf.save(`TARE2K-manifest-${trip.trip_date}-${trip.trip_code}-${areaPart}.pdf`);
    } finally {
      setExporting(false);
    }
  }

  const totalVisible = visible.reduce((a, g) => a + g.total, 0);
  const title = `${tl.ar} | ${tl.en} — ${t ? DIRECTION_LABEL[t.direction].en : ""} — ${trip.trip_date ? formatTripDate(trip.trip_date) : ""}`;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Route Manifests</h1>
          <p className="text-sm text-neutral-500">كشوف الركاب حسب المنطقة ونقطة الركوب</p>
          {trip.trip_date && <p className="mt-1 text-sm font-bold text-brand-600">{title}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-ghost !py-2"><RefreshCw size={15} /></button>
          <button onClick={exportPdf} disabled={exporting || !totalVisible} className="btn-dark !py-2">
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />} Export PDF | كشف ركاب
          </button>
        </div>
      </div>

      <div className="card mb-4 flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
        <TripPicker value={trip} onChange={setTrip} />
        <div className="flex flex-wrap gap-1.5">
          {(["all", ...AREA_CODES] as const).map((a) => (
            <button key={a} onClick={() => setAreaFilter(a)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${areaFilter === a ? "bg-ink text-white" : "bg-neutral-100 text-neutral-700"}`}>
              {a === "all" ? "All areas" : AREAS[a].en}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Total seats" ar="إجمالي" value={rows.length} dark />
        <Stat label="Boarded" ar="ركبوا" value={`${boarded}/${rows.length}`} />
        {groups.map((g) => <Stat key={g.area} label={AREAS[g.area].en} ar={AREAS[g.area].ar} value={g.total} />)}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-neutral-400" /></div>
      ) : totalVisible === 0 ? (
        <div className="card p-10 text-center text-neutral-500">No approved passengers for this trip yet.</div>
      ) : (
        <div className="space-y-5">
          {visible.filter((g) => g.total).map((g) => (
            <section key={g.area} className="card overflow-hidden">
              <div className="flex items-center justify-between bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-3 text-white">
                <div>
                  <div className="font-extrabold">{AREAS[g.area].en} <span className="font-semibold opacity-80">| {AREAS[g.area].ar}</span></div>
                  <div className="text-xs opacity-90">{timesText(trip.trip_code, g.area)}</div>
                </div>
                <span className="chip bg-white/20 text-white">{g.total} seats</span>
              </div>
              {g.spots.map((s) => (
                <div key={s.spot} className="border-b border-neutral-100 last:border-0">
                  <div className="flex items-center justify-between bg-neutral-50 px-4 py-2 text-sm font-bold">
                    <span className="flex items-center gap-1.5"><MapPin size={14} className="text-brand-500" />{spotLabel(g.area, s.spot)}</span>
                    <span className="text-neutral-500">{s.rows.length}</span>
                  </div>
                  <ul className="divide-y divide-neutral-100">
                    {s.rows.map((b) => (
                      <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                        <div>
                          <div className="font-semibold">{b.full_name}</div>
                          <a href={`tel:+${b.phone}`} className="font-mono text-xs text-neutral-500" dir="ltr">+{b.phone}</a>
                        </div>
                        {b.checked_in_at ? (
                          <span className="chip bg-emerald-100 text-emerald-800"><CheckCircle2 size={12} className="mr-1" /> Boarded</span>
                        ) : (
                          <span className="chip bg-neutral-100 text-neutral-500">Waiting</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      {/* Off-screen printable pages used for the PDF export */}
      <div ref={pdfRef} style={{ position: "fixed", left: -10000, top: 0 }} aria-hidden>
        {pages.map((lines, pi) => (
          <div key={pi} data-pdf-page style={{ width: 794, height: 1123, padding: 40, background: "#fff", color: "#111", fontFamily: "Cairo, sans-serif", boxSizing: "border-box", position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "3px solid #a31515", paddingBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.jpg" alt="" width={46} height={46} style={{ borderRadius: 999 }} />
                <div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#a31515", letterSpacing: 2 }}>TARE2K</div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2 }}>YOUR WAY TO ALAMEIN</div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 18, fontWeight: 800 }}>Passenger Manifest — كشف ركاب</div>
                <div style={{ fontSize: 11 }}>{title}</div>
                <div style={{ fontSize: 11 }}>
                  {areaFilter === "all" ? "All areas | كل المناطق" : `${AREAS[areaFilter].en} | ${AREAS[areaFilter].ar}`} · {totalVisible} passengers
                </div>
              </div>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 14, fontSize: 11 }}>
              <thead>
                <tr style={{ background: "#111", color: "#fff" }}>
                  {["#", "Name | الاسم", "Phone | الهاتف", "Area | المنطقة", "Pickup Spot | نقطة الركوب", "Payment | الدفع", "Check-in | توقيع"].map((h) => (
                    <th key={h} style={{ padding: "7px 6px", textAlign: "left", fontWeight: 700, fontSize: 10 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) =>
                  l.kind === "area" ? (
                    <tr key={i}><td colSpan={7} style={{ background: "#a31515", color: "#fff", padding: "6px 8px", fontWeight: 800 }}>
                      {AREAS[l.area].en} | {AREAS[l.area].ar} — {l.count} seats
                      <span style={{ float: "right", fontWeight: 700 }}>{timesText(trip.trip_code, l.area)}</span>
                    </td></tr>
                  ) : l.kind === "spot" ? (
                    <tr key={i}><td colSpan={7} style={{ background: "#fde3e3", padding: "5px 8px", fontWeight: 700 }}>
                      📍 {spotLabel(l.area, l.spot)} — {l.count}
                    </td></tr>
                  ) : (
                    <tr key={i} style={{ borderBottom: "1px solid #ddd", height: 34 }}>
                      <td style={{ padding: "4px 6px" }}>{l.n}</td>
                      <td style={{ padding: "4px 6px", fontWeight: 600 }}>{l.b.full_name}</td>
                      <td style={{ padding: "4px 6px", direction: "ltr" }}>0{l.b.phone.replace(/^20/, "")}</td>
                      <td style={{ padding: "4px 6px" }}>{AREAS[l.b.area].en}</td>
                      <td style={{ padding: "4px 6px" }}>{l.b.pickup_spot}</td>
                      <td style={{ padding: "4px 6px" }}>Paid · {PAYMENT_LABEL[l.b.payment_method]}</td>
                      <td style={{ padding: "4px 6px" }}>
                        <div style={{ width: 70, height: 22, border: "1.5px solid #555", borderRadius: 3, fontSize: 9, color: "#0a7a3a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {l.b.checked_in_at ? "✓ QR" : ""}
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
            <div style={{ position: "absolute", bottom: 24, left: 40, right: 40, display: "flex", justifyContent: "space-between", fontSize: 10, color: "#666" }}>
              <span>Supervisor signature | توقيع المشرف: ____________________</span>
              <span>Page {pi + 1} / {pages.length} · Generated {new Date().toLocaleString("en-GB", { timeZone: "Africa/Cairo" })}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, ar, value, dark }: { label: string; ar: string; value: number | string; dark?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 ${dark ? "bg-ink text-white" : "card"}`}>
      <div className={`text-xs font-semibold ${dark ? "text-neutral-400" : "text-neutral-500"}`}>{label} · {ar}</div>
      <div className="mt-1 text-2xl font-black">{value}</div>
    </div>
  );
}
