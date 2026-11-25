"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, FileDown, Loader2, RefreshCw } from "lucide-react";
import { AREAS } from "@/lib/config";
import { formatTripDate, tripLabel } from "@/lib/trips";
import { Booking, PAYMENT_LABEL, bookingAmount, egp, tripFinance } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending", approved: "Approved", rejected: "Rejected",
  refund_requested: "Refund requested", refunded: "Refunded", no_show: "No-show",
};

type Week = { batch: string; rows: Booking[]; from: string; to: string };

function toCsv(rows: Booking[]) {
  const head = [
    "Trip date", "Trip", "Direction", "Area", "Stop", "Name", "Phone", "Status", "Payment method", "Sender",
    "Amount paid (EGP)", "Refund amount (EGP)", "Refund to", "Refunded at", "Boarded at", "Submitted at",
  ];
  const cairo = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Africa/Cairo" }) : "");
  const lines = rows.map((b) => [
    b.trip_date, tripLabel(b.trip_code).en, b.direction, AREAS[b.area]?.en ?? b.area, b.pickup_spot, b.full_name,
    "0" + b.phone.replace(/^20/, ""), STATUS_LABEL[b.status] ?? b.status, PAYMENT_LABEL[b.payment_method] ?? b.payment_method,
    b.sender_account, ["approved", "refund_requested", "refunded", "no_show"].includes(b.status) ? bookingAmount(b) : "",
    b.refund_amount ?? "", b.refund_account ?? "", cairo(b.refunded_at), cairo(b.checked_in_at), cairo(b.created_at),
  ]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return "﻿" + [head, ...lines].map((r) => r.map(esc).join(",")).join("\r\n"); // BOM so Excel shows Arabic
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ArchiveView() {
  const [rows, setRows] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/bookings?status=all&trip_code=all&archived=archived", { cache: "no-store" });
    const j = await r.json();
    if (!r.ok) setError(j.error);
    setRows(j.bookings ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const weeks: Week[] = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of rows) {
      const k = b.archive_batch || "Unlabelled";
      map.set(k, [...(map.get(k) ?? []), b]);
    }
    return [...map.entries()]
      .map(([batch, list]) => {
        const dates = list.map((b) => b.trip_date).sort();
        return {
          batch,
          rows: list.sort((a, b) => (a.trip_date + a.trip_code + a.area).localeCompare(b.trip_date + b.trip_code + b.area)),
          from: dates[0],
          to: dates[dates.length - 1],
        };
      })
      .sort((a, b) => b.batch.localeCompare(a.batch));
  }, [rows]);

  const total = useMemo(() => tripFinance(rows), [rows]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Archive</h1>
          <p className="text-sm text-neutral-500">الأرشيف — past weeks&apos; bookings and money</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-ghost !py-2"><RefreshCw size={15} /></button>
          <button disabled={!rows.length} onClick={() => download("TARE2K-archive-all.csv", toCsv(rows))} className="btn-dark !py-2">
            <FileDown size={15} /> Export all (CSV)
          </button>
        </div>
      </div>

      {error && <div className="mb-3 rounded-xl bg-red-100 p-3 text-sm font-semibold text-red-800">{error}</div>}

      {!loading && rows.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card label="All-time collected" ar="إجمالي المحصّل" value={egp(total.collected)} />
          <Card label="All-time refunded" ar="إجمالي المسترد" value={egp(total.refunded)} red />
          <Card label="All-time net" ar="الصافي" value={egp(total.net)} dark />
          <Card label="Archived weeks" ar="عدد الأسابيع" value={String(weeks.length)} />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-neutral-400" /></div>
      ) : weeks.length === 0 ? (
        <div className="card p-10 text-center text-neutral-500">
          No archived weeks yet. Use &quot;Start New Week&quot; on the Requests page. | لا يوجد أرشيف بعد.
        </div>
      ) : (
        <div className="space-y-3">
          {weeks.map((w) => {
            const f = tripFinance(w.rows);
            const boarded = w.rows.filter((b) => b.checked_in_at).length;
            const isOpen = open === w.batch;
            return (
              <div key={w.batch} className="card overflow-hidden">
                <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="font-extrabold">
                      Trips {formatTripDate(w.from)}{w.from !== w.to && ` → ${formatTripDate(w.to)}`}
                    </div>
                    <div className="text-xs text-neutral-500">Archived {w.batch} · {w.rows.length} bookings · {boarded} boarded</div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-sm sm:grid-cols-4">
                    <Mini label="Collected" v={egp(f.collected)} />
                    <Mini label="Refunded" v={egp(f.refunded)} />
                    <Mini label="Net" v={egp(f.net)} bold />
                    <Mini label="Seats (approved)" v={String(f.activeSeats)} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setOpen(isOpen ? null : w.batch)} className="btn-ghost !py-2">
                      {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />} View
                    </button>
                    <button onClick={() => download(`TARE2K-week-${w.from}.csv`, toCsv(w.rows))} className="btn-ghost !py-2">
                      <FileDown size={15} /> CSV
                    </button>
                  </div>
                </div>
                {isOpen && (
                  <div className="overflow-x-auto border-t border-neutral-100">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
                        <tr>
                          {["Trip", "Name", "Phone", "Area / Stop", "Status", "Paid", "Refund"].map((h) => (
                            <th key={h} className="px-3 py-2 font-semibold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {w.rows.map((b) => (
                          <tr key={b.id}>
                            <td className="px-3 py-2">{tripLabel(b.trip_code).ar}<div className="text-xs text-neutral-500">{formatTripDate(b.trip_date)}</div></td>
                            <td className="px-3 py-2 font-semibold">{b.full_name}</td>
                            <td className="px-3 py-2 font-mono text-xs" dir="ltr">+{b.phone}</td>
                            <td className="px-3 py-2">{AREAS[b.area]?.ar ?? b.area}<div className="text-xs text-neutral-500">{b.pickup_spot}</div></td>
                            <td className="px-3 py-2">{STATUS_LABEL[b.status] ?? b.status}{b.checked_in_at && " ✓"}</td>
                            <td className="px-3 py-2">{["approved", "refund_requested", "refunded", "no_show"].includes(b.status) ? egp(bookingAmount(b)) : "—"}</td>
                            <td className="px-3 py-2">{b.refund_amount ? egp(Number(b.refund_amount)) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Card({ label, ar, value, red, dark }: { label: string; ar: string; value: string; red?: boolean; dark?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 ${dark ? "bg-ink text-white" : "card"}`}>
      <div className={`text-xs font-semibold ${dark ? "text-neutral-400" : "text-neutral-500"}`}>{label} · {ar}</div>
      <div className={`mt-1 text-xl font-black ${red ? "text-red-600" : ""}`}>{value}</div>
    </div>
  );
}

function Mini({ label, v, bold }: { label: string; v: string; bold?: boolean }) {
  return (
    <div>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className={bold ? "font-black" : "font-semibold"}>{v}</div>
    </div>
  );
}
