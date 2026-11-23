"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ExternalLink, ImageIcon, Loader2, MessageCircle, RefreshCw, RotateCcw, X } from "lucide-react";
import TripPicker, { TripSel } from "@/components/TripPicker";
import { AREAS, spotLabel } from "@/lib/config";
import { formatTripDate, tripDef, DIRECTION_LABEL } from "@/lib/trips";
import { Booking, PAYMENT_LABEL, whatsappPassLink } from "@/lib/utils";

const STATUSES = [
  { v: "pending", en: "Pending", ar: "قيد المراجعة" },
  { v: "approved", en: "Approved", ar: "مقبول" },
  { v: "rejected", en: "Rejected", ar: "مرفوض" },
  { v: "all", en: "All", ar: "الكل" },
];

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-neutral-200 text-neutral-600",
};

export default function RequestsView() {
  const [status, setStatus] = useState("pending");
  const [trip, setTrip] = useState<TripSel>({ trip_code: "all", trip_date: "" });
  const [rows, setRows] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ status, trip_code: trip.trip_code, receipts: "1" });
    if (trip.trip_code !== "all" && trip.trip_date) p.set("trip_date", trip.trip_date);
    const r = await fetch(`/api/admin/bookings?${p}`, { cache: "no-store" });
    const j = await r.json();
    if (!r.ok) setError(j.error);
    setRows(j.bookings ?? []);
    setLoading(false);
  }, [status, trip]);

  useEffect(() => { load(); }, [load]);

  async function act(b: Booking, action: "approve" | "reject" | "pending") {
    if (action === "reject" && !confirm(`Reject ${b.full_name}'s request?`)) return;
    setBusyId(b.id);
    setError(null);
    const r = await fetch(`/api/admin/bookings/${b.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const j = await r.json();
    setBusyId(null);
    if (!r.ok) return setError(j.error);
    const updated = { ...b, ...j.booking } as Booking;
    setRows((prev) => prev.map((x) => (x.id === b.id ? updated : x)));
    if (receipt?.id === b.id) setReceipt(updated);
  }

  const counts = rows.reduce<Record<string, number>>((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {});

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Booking Requests</h1>
          <p className="text-sm text-neutral-500">طلبات الحجز والمراجعة</p>
        </div>
        <button onClick={load} className="btn-ghost !py-2"><RefreshCw size={15} /> Refresh</button>
      </div>

      <div className="card mb-4 flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
            <button key={s.v} onClick={() => setStatus(s.v)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${status === s.v ? "bg-ink text-white" : "bg-neutral-100 text-neutral-700"}`}>
              {s.en} <span className="opacity-60">{s.ar}</span>
            </button>
          ))}
        </div>
        <TripPicker value={trip} onChange={setTrip} allowAll />
      </div>

      {error && <div className="mb-3 rounded-xl bg-red-100 p-3 text-sm font-semibold text-red-800">{error}</div>}

      <div className="mb-3 text-sm text-neutral-500">
        {loading ? "Loading…" : `${rows.length} request${rows.length === 1 ? "" : "s"}`}
        {status === "all" && !loading && ` · ${counts.pending ?? 0} pending · ${counts.approved ?? 0} approved · ${counts.rejected ?? 0} rejected`}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-neutral-400" /></div>
      ) : rows.length === 0 ? (
        <div className="card p-10 text-center text-neutral-500">No requests here. | لا توجد طلبات.</div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {rows.map((b) => {
            const t = tripDef(b.trip_code);
            return (
              <div key={b.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-extrabold">{b.full_name}</div>
                    <a href={`https://wa.me/${b.phone}`} target="_blank" rel="noreferrer" className="font-mono text-sm text-brand-600" dir="ltr">
                      +{b.phone}
                    </a>
                  </div>
                  <span className={`chip capitalize ${STATUS_STYLE[b.status]}`}>{b.status}</span>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div><dt className="text-xs text-neutral-500">Trip</dt>
                    <dd className="font-semibold">{t?.en} · {formatTripDate(b.trip_date)}</dd>
                    <dd className="text-xs text-neutral-500">{DIRECTION_LABEL[b.direction].en}</dd></div>
                  <div><dt className="text-xs text-neutral-500">Pickup</dt>
                    <dd className="font-semibold">{AREAS[b.area]?.en}</dd>
                    <dd className="text-xs text-neutral-500">{spotLabel(b.area, b.pickup_spot)}</dd></div>
                  <div><dt className="text-xs text-neutral-500">Payment</dt>
                    <dd className="font-semibold">{PAYMENT_LABEL[b.payment_method]}</dd></div>
                  <div><dt className="text-xs text-neutral-500">Sender</dt>
                    <dd className="break-all font-mono font-semibold" dir="ltr">{b.sender_account}</dd></div>
                </dl>
                <div className="mt-2 text-xs text-neutral-400">
                  Submitted {new Date(b.created_at).toLocaleString("en-GB", { timeZone: "Africa/Cairo", dateStyle: "medium", timeStyle: "short" })}
                  {b.checked_in_at && <span className="ml-2 font-semibold text-emerald-700">· Boarded ✓</span>}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => setReceipt(b)} className="btn-ghost !py-2"><ImageIcon size={15} /> Receipt</button>
                  {b.status === "pending" && (
                    <>
                      <button disabled={busyId === b.id} onClick={() => act(b, "approve")} className="btn-primary !py-2">
                        {busyId === b.id ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Approve
                      </button>
                      <button disabled={busyId === b.id} onClick={() => act(b, "reject")} className="btn-ghost !py-2 text-red-700">
                        <X size={15} /> Reject
                      </button>
                    </>
                  )}
                  {b.status === "approved" && b.pass_token && (
                    <>
                      <a href={whatsappPassLink(b)} target="_blank" rel="noreferrer" className="btn-wa !py-2">
                        <MessageCircle size={15} /> Send via WhatsApp
                      </a>
                      <a href={`/pass/${b.pass_token}`} target="_blank" className="btn-ghost !py-2"><ExternalLink size={15} /> Pass</a>
                    </>
                  )}
                  {b.status !== "pending" && !b.checked_in_at && (
                    <button disabled={busyId === b.id} onClick={() => act(b, "pending")} className="btn-ghost !py-2 text-neutral-500" title="Move back to pending">
                      <RotateCcw size={15} /> Undo
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setReceipt(null)}>
          <div className="relative flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <div className="font-bold">{receipt.full_name}</div>
                <div className="text-xs text-neutral-500">
                  {PAYMENT_LABEL[receipt.payment_method]} · from <span dir="ltr">{receipt.sender_account}</span>
                </div>
              </div>
              <button onClick={() => setReceipt(null)} aria-label="Close"><X /></button>
            </div>
            <div className="flex-1 overflow-auto bg-neutral-100 p-3">
              {receipt.receipt_url ? (
                <a href={receipt.receipt_url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={receipt.receipt_url} alt="Transfer receipt" className="mx-auto max-h-[65vh] rounded-lg object-contain" />
                </a>
              ) : (
                <p className="p-8 text-center text-sm text-neutral-500">Receipt unavailable.</p>
              )}
            </div>
            {receipt.status === "approved" && receipt.pass_token && (
              <div className="border-t p-3">
                <a href={whatsappPassLink(receipt)} target="_blank" rel="noreferrer" className="btn-wa w-full">
                  <MessageCircle size={15} /> Send Pass via WhatsApp
                </a>
              </div>
            )}
            {receipt.status === "pending" && (
              <div className="flex gap-2 border-t p-3">
                <button disabled={busyId === receipt.id} onClick={() => act(receipt, "approve")} className="btn-primary flex-1">
                  <Check size={15} /> Approve
                </button>
                <button disabled={busyId === receipt.id} onClick={() => act(receipt, "reject")} className="btn-ghost flex-1 text-red-700">
                  <X size={15} /> Reject
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
