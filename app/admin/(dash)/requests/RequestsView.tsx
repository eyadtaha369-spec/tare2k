"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban, Check, ExternalLink, ImageIcon, Loader2, MessageCircle, RefreshCw, RotateCcw, Undo2, Upload, Wallet, X,
} from "lucide-react";
import TripPicker, { TripSel } from "@/components/TripPicker";
import { AREAS, PAYMENT, spotLabel, timesText } from "@/lib/config";
import { formatTripDate, tripLabel, DIRECTION_LABEL } from "@/lib/trips";
import {
  Booking, BookingStatus, PAYMENT_LABEL, bookingAmount, egp, tripFinance, whatsappPassLink, whatsappRefundLink,
} from "@/lib/utils";

type Tab = BookingStatus | "all";

const TABS: { v: Tab; en: string; ar: string }[] = [
  { v: "pending", en: "Pending", ar: "قيد المراجعة" },
  { v: "approved", en: "Approved", ar: "مقبول" },
  { v: "refund_requested", en: "Refunds", ar: "طلبات الاسترداد" },
  { v: "refunded", en: "Refunded", ar: "تم الاسترداد" },
  { v: "no_show", en: "No-show", ar: "لم يحضر" },
  { v: "rejected", en: "Rejected", ar: "مرفوض" },
  { v: "all", en: "All", ar: "الكل" },
];

const STATUS_UI: Record<BookingStatus, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-amber-100 text-amber-800" },
  approved: { label: "Approved", cls: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Rejected", cls: "bg-neutral-200 text-neutral-600" },
  refund_requested: { label: "Refund requested", cls: "bg-orange-100 text-orange-800" },
  refunded: { label: "Refunded", cls: "bg-sky-100 text-sky-800" },
  no_show: { label: "No-show", cls: "bg-neutral-800 text-white" },
};

const cairo = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Africa/Cairo", dateStyle: "medium", timeStyle: "short" }) : "";

/** Shrinks screenshots before upload. */
async function compressImage(file: File): Promise<File> {
  if (file.size < 900 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.82));
    return blob ? new File([blob], "refund.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export default function RequestsView() {
  const [tab, setTab] = useState<Tab>("pending");
  const [trip, setTrip] = useState<TripSel>({ trip_code: "all", trip_date: "" });
  const [all, setAll] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Booking | null>(null);
  const [refund, setRefund] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load every status for the selected trip; tabs and the finance bar are computed from it.
  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ status: "all", trip_code: trip.trip_code });
    if (trip.trip_code !== "all" && trip.trip_date) p.set("trip_date", trip.trip_date);
    const r = await fetch(`/api/admin/bookings?${p}`, { cache: "no-store" });
    const j = await r.json();
    if (!r.ok) setError(j.error);
    setAll(j.bookings ?? []);
    setLoading(false);
  }, [trip]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => (tab === "all" ? all : all.filter((b) => b.status === tab)), [all, tab]);
  const counts = useMemo(() => all.reduce<Record<string, number>>((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {}), [all]);
  const fin = useMemo(() => tripFinance(all), [all]);

  function replace(updated: Booking) {
    setAll((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    if (receipt?.id === updated.id) setReceipt(updated);
  }

  async function act(b: Booking, action: "approve" | "reject" | "pending" | "no_show") {
    if (action === "reject" && !confirm(`Reject ${b.full_name}'s request?`)) return;
    if (action === "no_show" && !confirm(`Mark ${b.full_name} as no-show? Their pass will stop working.`)) return;
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
    replace({ ...b, ...j.booking } as Booking);
  }

  const scopeLabel =
    trip.trip_code === "all"
      ? "All trips | كل الرحلات"
      : `${tripLabel(trip.trip_code).ar} · ${trip.trip_date ? formatTripDate(trip.trip_date) : ""}`;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Booking Requests</h1>
          <p className="text-sm text-neutral-500">طلبات الحجز والمراجعة</p>
        </div>
        <button onClick={load} className="btn-ghost !py-2"><RefreshCw size={15} /> Refresh</button>
      </div>

      <div className="card mb-4 p-3">
        <TripPicker value={trip} onChange={setTrip} allowAll />
      </div>

      {/* Trip financial summary */}
      <div className="mb-1 text-xs font-semibold text-neutral-500">Financial summary — {scopeLabel}</div>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <FinCard label="Approved revenue" ar="إجمالي المحصّل" value={egp(fin.collected)} />
        <FinCard label="Total refunded" ar="إجمالي المسترد" value={egp(fin.refunded)} tone="red" />
        <FinCard label="Net trip revenue" ar="صافي الإيراد" value={egp(fin.net)} tone="dark" />
        <FinCard label="Active seats" ar="المقاعد المؤكدة" value={String(fin.activeSeats)} />
      </div>
      {!PAYMENT.fareEgp && (
        <div className="mb-4 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">
          Ticket price isn&apos;t set yet, so revenue shows 0 EGP. Set <code>fareEgp</code> in lib/config.ts.
        </div>
      )}

      {/* Status tabs */}
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((s) => {
          const n = s.v === "all" ? all.length : counts[s.v] ?? 0;
          const alert = s.v === "refund_requested" && n > 0;
          return (
            <button key={s.v} onClick={() => setTab(s.v)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === s.v ? "bg-ink text-white" : "bg-white text-neutral-700 ring-1 ring-black/10"}`}>
              {s.en} <span className="opacity-60">{s.ar}</span>
              <span className={`rounded-full px-1.5 text-xs ${alert ? "bg-orange-500 text-white" : tab === s.v ? "bg-white/20" : "bg-neutral-100"}`}>{n}</span>
            </button>
          );
        })}
      </div>

      {error && <div className="mb-3 rounded-xl bg-red-100 p-3 text-sm font-semibold text-red-800">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-neutral-400" /></div>
      ) : rows.length === 0 ? (
        <div className="card p-10 text-center text-neutral-500">Nothing here. | لا توجد طلبات.</div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {rows.map((b) => {
            const t = tripLabel(b.trip_code);
            const st = STATUS_UI[b.status] ?? STATUS_UI.pending;
            const busy = busyId === b.id;
            return (
              <div key={b.id} className={`card p-4 ${b.status === "refund_requested" ? "ring-2 ring-orange-300" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-extrabold">{b.full_name}</div>
                    <a href={`https://wa.me/${b.phone}`} target="_blank" rel="noreferrer" className="font-mono text-sm text-brand-600" dir="ltr">
                      +{b.phone}
                    </a>
                  </div>
                  <span className={`chip shrink-0 ${st.cls}`}>{st.label}</span>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div><dt className="text-xs text-neutral-500">Trip</dt>
                    <dd className="font-semibold">{t.ar} · {formatTripDate(b.trip_date)}</dd>
                    <dd className="text-xs text-neutral-500">{t.en} · {DIRECTION_LABEL[b.direction].en}</dd>
                    <dd className="text-xs font-semibold text-brand-600">{timesText(b.trip_code, b.area)}</dd></div>
                  <div><dt className="text-xs text-neutral-500">{b.direction === "return" ? "Drop-off" : "Pickup"}</dt>
                    <dd className="font-semibold">{AREAS[b.area]?.ar ?? b.area}</dd>
                    <dd className="text-xs text-neutral-500">{spotLabel(b.area, b.pickup_spot)}</dd></div>
                  <div><dt className="text-xs text-neutral-500">Payment</dt>
                    <dd className="font-semibold">{PAYMENT_LABEL[b.payment_method]} · {egp(bookingAmount(b))}</dd></div>
                  <div><dt className="text-xs text-neutral-500">Sender</dt>
                    <dd className="break-all font-mono font-semibold" dir="ltr">{b.sender_account}</dd></div>
                </dl>

                {(b.status === "refund_requested" || b.status === "refunded") && (
                  <div className={`mt-3 rounded-xl p-3 text-sm ${b.status === "refunded" ? "bg-sky-50" : "bg-orange-50"}`}>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <div><span className="text-xs text-neutral-500">Refund to | التحويل إلى</span>
                        <div className="break-all font-mono font-bold" dir="ltr">{b.refund_account}</div></div>
                      <div><span className="text-xs text-neutral-500">Requested</span>
                        <div className="font-semibold">{cairo(b.refund_requested_at)}</div></div>
                      {b.refund_reason && (
                        <div className="col-span-2"><span className="text-xs text-neutral-500">Reason | السبب</span>
                          <div>{b.refund_reason}</div></div>
                      )}
                      {b.status === "refunded" && (
                        <>
                          <div><span className="text-xs text-neutral-500">Refunded</span>
                            <div className="font-bold">{egp(Number(b.refund_amount) || 0)}</div></div>
                          <div><span className="text-xs text-neutral-500">On</span>
                            <div className="font-semibold">{cairo(b.refunded_at)}{b.refunded_by && ` · ${b.refunded_by}`}</div></div>
                          {b.refund_ref && (
                            <div className="col-span-2"><span className="text-xs text-neutral-500">Reference</span>
                              <div className="font-mono">{b.refund_ref}</div></div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-2 text-xs text-neutral-400">
                  Submitted {cairo(b.created_at)}
                  {b.checked_in_at && <span className="ml-2 font-semibold text-emerald-700">· Boarded ✓</span>}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => setReceipt(b)} className="btn-ghost !py-2"><ImageIcon size={15} /> Receipt</button>

                  {b.status === "pending" && (
                    <>
                      <button disabled={busy} onClick={() => act(b, "approve")} className="btn-primary !py-2">
                        {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Approve
                      </button>
                      <button disabled={busy} onClick={() => act(b, "reject")} className="btn-ghost !py-2 text-red-700">
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
                      {!b.checked_in_at && (
                        <button disabled={busy} onClick={() => act(b, "no_show")} className="btn-ghost !py-2 text-neutral-600">
                          <Ban size={15} /> No-show
                        </button>
                      )}
                    </>
                  )}

                  {b.status === "refund_requested" && (
                    <button onClick={() => setRefund(b)} className="btn !py-2 bg-orange-500 text-white hover:bg-orange-600">
                      <Wallet size={15} /> Process refund | تحويل المبلغ
                    </button>
                  )}

                  {b.status === "refunded" && (
                    <>
                      <a href={whatsappRefundLink(b)} target="_blank" rel="noreferrer" className="btn-wa !py-2">
                        <MessageCircle size={15} /> Send refund confirmation
                      </a>
                      {b.refund_receipt_url && (
                        <a href={b.refund_receipt_url} target="_blank" className="btn-ghost !py-2"><ImageIcon size={15} /> Refund proof</a>
                      )}
                    </>
                  )}

                  {b.status === "no_show" && (
                    <button disabled={busy} onClick={() => act(b, "approve")} className="btn-ghost !py-2" title="Restore to approved">
                      <Undo2 size={15} /> Restore
                    </button>
                  )}

                  {(b.status === "approved" || b.status === "rejected") && !b.checked_in_at && (
                    <button disabled={busy} onClick={() => act(b, "pending")} className="btn-ghost !py-2 text-neutral-500" title="Move back to pending">
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

      {refund && <RefundModal booking={refund} onClose={() => setRefund(null)} onDone={replace} />}
    </div>
  );
}

function FinCard({ label, ar, value, tone }: { label: string; ar: string; value: string; tone?: "red" | "dark" }) {
  return (
    <div className={`rounded-2xl p-4 ${tone === "dark" ? "bg-ink text-white" : "card"}`}>
      <div className={`text-xs font-semibold ${tone === "dark" ? "text-neutral-400" : "text-neutral-500"}`}>{label} · {ar}</div>
      <div className={`mt-1 text-xl font-black ${tone === "red" ? "text-red-600" : ""}`}>{value}</div>
    </div>
  );
}

function RefundModal({ booking, onClose, onDone }: { booking: Booking; onClose: () => void; onDone: (b: Booking) => void }) {
  const [amount, setAmount] = useState(String(bookingAmount(booking)));
  const [ref, setRef] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Booking | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("amount", amount);
    fd.set("ref", ref);
    if (file) fd.set("receipt", await compressImage(file));
    const r = await fetch(`/api/admin/bookings/${booking.id}/refund`, { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setError(j.error || "Refund failed.");
    const updated = { ...booking, ...j.booking } as Booking;
    onDone(updated);
    setDone(updated);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => !busy && onClose()}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-black">Process refund | تحويل المبلغ المسترد</h2>
            <p className="text-sm text-neutral-500">{booking.full_name} · {tripLabel(booking.trip_code).ar} · {formatTripDate(booking.trip_date)}</p>
          </div>
          <button onClick={onClose} disabled={busy} aria-label="Close"><X /></button>
        </div>

        {done ? (
          <div className="space-y-4 text-center">
            <div className="rounded-xl bg-emerald-50 p-4 font-semibold text-emerald-800">
              ✅ Refund of {egp(Number(done.refund_amount) || 0)} recorded.
            </div>
            <a href={whatsappRefundLink(done)} target="_blank" rel="noreferrer" className="btn-wa w-full">
              <MessageCircle size={16} /> Send refund confirmation on WhatsApp
            </a>
            <button onClick={onClose} className="btn-ghost w-full">Close</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="rounded-xl bg-orange-50 p-3 text-sm">
              <div className="text-xs text-neutral-500">Send refund to | التحويل إلى</div>
              <div className="font-mono text-lg font-black" dir="ltr">{booking.refund_account || booking.sender_account}</div>
              <div className="text-xs text-neutral-500">Paid {egp(bookingAmount(booking))} via {PAYMENT_LABEL[booking.payment_method]}</div>
            </div>

            <div>
              <label className="label" htmlFor="amount">Refunded amount (EGP) <span className="label-ar">المبلغ المسترد</span></label>
              <input id="amount" type="number" min={0} step="0.01" required className="input" value={amount}
                onChange={(e) => setAmount(e.target.value)} />
              <p className="mt-1 text-xs text-neutral-500">Lower it if a cancellation fee applies. | قلّله لو في رسوم إلغاء.</p>
            </div>

            <div>
              <label className="label" htmlFor="ref">Transaction reference (optional) <span className="label-ar">رقم العملية</span></label>
              <input id="ref" className="input" maxLength={200} value={ref} onChange={(e) => setRef(e.target.value)} dir="ltr" />
            </div>

            <div>
              <span className="label">Transfer screenshot (optional) <span className="label-ar">صورة التحويل</span></span>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 p-3 text-sm hover:border-brand-500">
                <Upload size={16} className="text-neutral-400" />
                {file ? file.name : "Tap to attach | اضغط لإرفاق صورة"}
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>

            {error && <div className="rounded-xl bg-red-100 p-3 text-sm font-semibold text-red-800">{error}</div>}

            <button disabled={busy} className="btn w-full bg-orange-500 text-white hover:bg-orange-600">
              {busy && <Loader2 size={16} className="animate-spin" />} Confirm refund | تأكيد الاسترداد
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
