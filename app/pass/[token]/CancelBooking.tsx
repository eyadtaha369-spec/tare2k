"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X, XCircle } from "lucide-react";

export default function CancelBooking({
  token, senderAccount, deadlineLabel, cash = false,
}: { token: string; senderAccount: string; deadlineLabel: string; cash?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState(senderAccount);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/pass/${token}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refund_account: account, refund_reason: reason }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(j.error || "Something went wrong. Please try again.");
      setBusy(false);
      return;
    }
    setOpen(false);
    router.refresh(); // page re-renders: QR hidden, "Refund Requested" card shown
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn w-full bg-red-600 text-white hover:bg-red-700">
        <XCircle size={16} /> {cash ? "Cancel My Seat" : "Request Cancellation & Refund"}
        <span className="text-xs opacity-90">| {cash ? "إلغاء الحجز" : "إلغاء الحجز وطلب استرداد"}</span>
      </button>
      <p className="mt-2 text-center text-[11px] text-neutral-400">
        Available until {deadlineLabel} (when booking closes) | متاح حتى قفل الحجز
      </p>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={() => !busy && setOpen(false)}>
          <form onSubmit={confirm} onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm space-y-4 rounded-t-3xl bg-white p-5 sm:rounded-3xl">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-black">Cancel booking | إلغاء الحجز</h2>
              <button type="button" onClick={() => setOpen(false)} disabled={busy} aria-label="Close"><X /></button>
            </div>

            <div className="rounded-xl border-2 border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
              ⚠️ Confirming this will immediately cancel your seat and deactivate your QR Boarding Pass.
              <div className="mt-1" dir="rtl">⚠️ التأكيد هيلغي مقعدك فوراً وهيوقف تذكرة الركوب (QR).</div>
            </div>

{!cash && (
            <div>
              <label className="label" htmlFor="refund_account">
                Refund to (Vodafone Cash / InstaPay) <span className="label-ar">رقم الاسترداد</span>
              </label>
              <input id="refund_account" className="input" dir="ltr" required minLength={5} value={account}
                onChange={(e) => setAccount(e.target.value)} />
              <p className="mt-1 text-xs text-neutral-500">Change it if you want the refund sent to another number. | غيّره لو عايز التحويل على رقم تاني.</p>
            </div>
            )}

            <div>
              <label className="label" htmlFor="refund_reason">Reason (optional) <span className="label-ar">السبب (اختياري)</span></label>
              <input id="refund_reason" className="input" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>

            {error && <div className="rounded-xl bg-red-100 p-3 text-sm font-semibold text-red-800">{error}</div>}

            <div className="flex gap-2">
              <button type="button" onClick={() => setOpen(false)} disabled={busy} className="btn-ghost flex-1">
                Keep my seat | رجوع
              </button>
              <button type="submit" disabled={busy} className="btn flex-1 bg-red-600 text-white hover:bg-red-700">
                {busy && <Loader2 size={16} className="animate-spin" />} Confirm | تأكيد الإلغاء
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
