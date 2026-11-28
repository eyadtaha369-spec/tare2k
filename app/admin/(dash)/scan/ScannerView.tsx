"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, CameraOff, CheckCircle2, Keyboard, Loader2, XCircle } from "lucide-react";
import TripPicker, { TripSel } from "@/components/TripPicker";
import { AREAS, spotLabel, timesText } from "@/lib/config";
import { formatTripDate, tripLabel } from "@/lib/trips";
import { Booking, bookingAmount } from "@/lib/utils";

type Result = {
  result: "boarded" | "already" | "invalid" | "wrong_trip" | "valid" | "cancelled";
  message?: string;
  booking?: Booking;
};

const STYLE = {
  boarded: { bg: "bg-emerald-600", icon: CheckCircle2, en: "BOARDED", ar: "تم الركوب" },
  valid: { bg: "bg-emerald-600", icon: CheckCircle2, en: "VALID", ar: "صالحة" },
  already: { bg: "bg-amber-500", icon: AlertTriangle, en: "ALREADY USED", ar: "مستخدمة من قبل" },
  wrong_trip: { bg: "bg-amber-500", icon: AlertTriangle, en: "WRONG TRIP", ar: "رحلة مختلفة" },
  invalid: { bg: "bg-red-600", icon: XCircle, en: "INVALID", ar: "غير صالحة" },
  cancelled: { bg: "bg-red-700", icon: XCircle, en: "DO NOT BOARD", ar: "تذكرة ملغاة — ممنوع الركوب" },
};

const READER_ID = "tare2k-reader";

export default function ScannerView() {
  const [trip, setTrip] = useState<TripSel>({ trip_code: "sat_out", trip_date: "" });
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [count, setCount] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scanner = useRef<any>(null);
  const tripRef = useRef(trip);
  tripRef.current = trip;
  const lock = useRef(false);

  const check = useCallback(async (code: string) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, ...tripRef.current, confirm: true }),
      });
      if (r.status === 401 || r.status === 403) { window.location.href = "/api/auth/logout"; return; }
      const j: Result & { revoked?: boolean } = await r.json();
      if (j.revoked) { window.location.href = "/api/auth/logout"; return; }
      setResult(j);
      if (j.result === "boarded") setCount((c) => c + 1);
      navigator.vibrate?.(j.result === "boarded" ? 120 : [80, 60, 80]);
    } catch {
      setResult({ result: "invalid", message: "Network error — try again." });
    } finally {
      setBusy(false);
    }
  }, []);

  async function stop() {
    try { await scanner.current?.stop(); } catch { /* already stopped */ }
    setRunning(false);
  }

  async function start() {
    setCamError(null);
    setResult(null);
    lock.current = false;
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (!scanner.current) scanner.current = new Html5Qrcode(READER_ID, { verbose: false });
      await scanner.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (text: string) => { scanner.current?.pause(true); check(text); },
        () => {},
      );
      setRunning(true);
    } catch (e) {
      setCamError((e as Error)?.message ?? "Camera not available. Allow camera access and use HTTPS.");
    }
  }

  function next() {
    setResult(null);
    lock.current = false;
    try { scanner.current?.resume(); } catch { /* not paused */ }
  }

  useEffect(() => () => { scanner.current?.stop().catch(() => {}); }, []);

  const b = result?.booking;
  const s = result ? STYLE[result.result] : null;

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4">
        <h1 className="text-2xl font-black">Boarding Scanner</h1>
        <p className="text-sm text-neutral-500">ماسح تذاكر الركوب — choose the trip, then scan.</p>
      </div>

      <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-3">
        <TripPicker value={trip} onChange={setTrip} />
        <span className="chip bg-ink text-white">This session: {count} boarded</span>
      </div>

      <div className="card overflow-hidden">
        <div className="relative aspect-square w-full bg-black">
          <div id={READER_ID} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
          {!running && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
              <Camera size={40} className="opacity-70" />
              <button onClick={start} disabled={!trip.trip_date} className="btn-primary !px-6 !py-3 text-base">
                Start camera | تشغيل الكاميرا
              </button>
              {camError && <p className="text-sm text-red-300">{camError}</p>}
            </div>
          )}

          {(result || busy) && (
            <div className={`absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white ${s?.bg ?? "bg-black/70"}`}>
              {busy ? (
                <Loader2 size={48} className="animate-spin" />
              ) : s && (
                <>
                  <s.icon size={64} />
                  <div className="mt-2 text-3xl font-black">{s.en}</div>
                  <div className="text-xl font-bold">{s.ar}</div>
                  {result?.message && <div className="mt-1 text-sm opacity-90">{result.message}</div>}
                  {b && (
                    <div className="mt-4 w-full rounded-2xl bg-white/15 p-4 text-left">
                      <div className="text-xl font-extrabold">{b.full_name}</div>
                      {b.payment_method === "cash_on_bus" && result?.result === "boarded" && (
                        <div className="my-2 rounded-xl bg-yellow-300 px-3 py-2 text-center text-lg font-black text-ink">
                          💵 COLLECT {bookingAmount(b)} EGP CASH · حصّل {bookingAmount(b)} جنيه كاش
                        </div>
                      )}
                      <div className="text-sm opacity-90">{AREAS[b.area]?.en} — {spotLabel(b.area, b.pickup_spot)}</div>
                      <div className="text-sm opacity-90">{tripLabel(b.trip_code).ar} · {formatTripDate(b.trip_date)}</div>
                      <div className="text-xs opacity-90">{timesText(b.trip_code, b.area)}</div>
                      {b.checked_in_at && result?.result === "already" && (
                        <div className="mt-1 text-xs opacity-90">
                          Scanned at {new Date(b.checked_in_at).toLocaleTimeString("en-GB", { timeZone: "Africa/Cairo", timeStyle: "short" })}
                        </div>
                      )}
                    </div>
                  )}
                  <button onClick={next} className="btn mt-5 bg-white !px-8 !py-3 text-base text-ink">Scan next | التالي</button>
                </>
              )}
            </div>
          )}
        </div>
        {running && (
          <div className="flex justify-end p-2">
            <button onClick={stop} className="btn-ghost !py-1.5 text-xs"><CameraOff size={14} /> Stop camera</button>
          </div>
        )}
      </div>

      <form
        className="card mt-4 flex gap-2 p-3"
        onSubmit={(e) => { e.preventDefault(); if (manual.trim()) { lock.current = false; check(manual.trim()); setManual(""); } }}
      >
        <Keyboard size={18} className="mt-2.5 shrink-0 text-neutral-400" />
        <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Paste pass link or code manually"
          className="input !py-2 text-sm" dir="ltr" />
        <button className="btn-dark !py-2">Check</button>
      </form>
    </div>
  );
}
