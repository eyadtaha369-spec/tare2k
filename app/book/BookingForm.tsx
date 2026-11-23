"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Copy, Loader2, Lock, Upload } from "lucide-react";
import { AREAS, AreaCode, PAYMENT, areasForTrip, timesFor, timesText } from "@/lib/config";
import { DIRECTION_LABEL, TripWindow, formatTripDate } from "@/lib/trips";

/** Shrinks large photos in the browser so uploads stay small and fast. */
async function compressImage(file: File): Promise<File> {
  if (file.size < 900 * 1024 && /jpe?g|png|webp/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    return blob ? new File([blob], "receipt.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export default function BookingForm({ initialTrips }: { initialTrips: TripWindow[] }) {
  const [trips, setTrips] = useState(initialTrips);
  const [trip, setTrip] = useState("");
  const [area, setArea] = useState<AreaCode | "">("");
  const [spot, setSpot] = useState("");
  const [method, setMethod] = useState<"vodafone_cash" | "instapay" | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ trip: TripWindow; name: string; area: AreaCode } | null>(null);
  const [copied, setCopied] = useState("");

  // Re-check windows every minute so a trip locks the moment it closes
  useEffect(() => {
    const id = setInterval(async () => {
      const r = await fetch("/api/trips", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
      if (r?.trips) setTrips(r.trips);
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const t = trips.find((x) => x.code === trip);
    if (t && !t.isOpen) setTrip("");
  }, [trips, trip]);

  useEffect(() => {
    if (!file) return setPreview(null);
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const anyOpen = trips.some((t) => t.isOpen);
  const spots = useMemo(() => (area ? AREAS[area].spots : []), [area]);
  const allowedAreas = useMemo(() => areasForTrip(trip), [trip]);
  const times = trip && area ? timesFor(trip, area) : null;
  const isReturn = trips.find((t) => t.code === trip)?.direction === "return";

  // If the chosen trip doesn't serve the selected area (e.g. Delengat on Sunday morning), clear it
  useEffect(() => {
    if (area && !allowedAreas.includes(area)) { setArea(""); setSpot(""); }
  }, [allowedAreas, area]);

  async function copy(text: string) {
    await navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(text);
    setTimeout(() => setCopied(""), 1500);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!trip) return setError("Please choose an open trip. | اختار رحلة متاحة.");
    if (!file) return setError("Please upload your transfer receipt. | ارفع صورة إيصال التحويل.");
    const fd = new FormData(e.currentTarget);
    fd.set("trip_code", trip);
    setBusy(true);
    try {
      fd.set("receipt", await compressImage(file));
      const res = await fetch("/api/bookings", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong.");
      setDone({ trip: trips.find((t) => t.code === trip)!, name: String(fd.get("full_name")), area: area as AreaCode });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <Loader2 size={30} className="animate-spin [animation-duration:3s]" />
        </div>
        <h2 className="text-2xl font-black">Request received!</h2>
        <p className="text-lg font-bold text-neutral-500" dir="rtl">تم استلام طلبك!</p>
        <div className="mt-5 inline-flex rounded-full bg-amber-100 px-4 py-1.5 text-sm font-bold text-amber-800">
          Status: Pending Admin Review | قيد المراجعة
        </div>
        <p className="mt-5 text-neutral-700">
          Thanks {done.name.split(" ")[0]}. We&apos;re verifying your transfer for the{" "}
          <b>{done.trip.en} ({formatTripDate(done.trip.tripDate)})</b> trip. Once approved, you&apos;ll receive your{" "}
          <b>Boarding Pass QR link via WhatsApp</b>.
        </p>
        {timesFor(done.trip.code, done.area) && (
          <p className="mt-3 text-sm font-bold">
            {timesText(done.trip.code, done.area)}
          </p>
        )}
        <p className="mt-2 text-neutral-600" dir="rtl">
          بنراجع التحويل دلوقتي، وأول ما يتم التأكيد هتوصلك تذكرة الركوب (QR) على واتساب.
        </p>
        <Link href="/" className="btn-ghost mt-6">Back to home | الرئيسية</Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Trip */}
      <section className="card p-5">
        <h2 className="mb-1 text-lg font-extrabold">1. Trip & Shift | الرحلة والميعاد</h2>
        <p className="mb-4 text-xs text-neutral-500">Only trips with an open booking window can be selected.</p>
        {!anyOpen && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-neutral-100 p-3 text-sm font-semibold text-neutral-700">
            <Lock size={16} /> Booking for all trips is currently closed. | الحجز مغلق حالياً.
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {trips.map((t) => {
            const selected = trip === t.code;
            return (
              <button
                type="button"
                key={t.code}
                disabled={!t.isOpen}
                onClick={() => setTrip(t.code)}
                className={`rounded-xl p-4 text-left ring-2 transition ${
                  selected ? "bg-brand-50 ring-brand-500" : "bg-white ring-neutral-200 hover:ring-neutral-300"
                } disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:opacity-70`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold">{t.en} <span className="font-semibold text-neutral-500">| {t.ar}</span></span>
                  {selected && <CheckCircle2 size={18} className="text-brand-500" />}
                </div>
                <div className="text-sm text-neutral-600">
                  {DIRECTION_LABEL[t.direction].en} · {formatTripDate(t.tripDate)}
                </div>
                {t.isOpen ? (
                  <div className="mt-2 text-xs font-semibold text-emerald-700">Open until {t.closeLabel}</div>
                ) : (
                  <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-neutral-500">
                    <Lock size={12} /> Booking for this trip is currently closed.
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Pickup */}
      <section className="card space-y-4 p-5">
        <h2 className="text-lg font-extrabold">
          {isReturn ? "2. Drop-off | مكان النزول" : "2. Pickup | نقطة الركوب"}
        </h2>
        <div>
          <label className="label" htmlFor="area">{isReturn ? "Area" : "Pickup Area"} <span className="label-ar">المنطقة</span></label>
          <select
            id="area" name="area" required className="input" value={area}
            onChange={(e) => { setArea(e.target.value as AreaCode); setSpot(""); }}
          >
            <option value="" disabled>Select area — اختار المنطقة</option>
            {allowedAreas.map((c) => (
              <option key={c} value={c}>{AREAS[c].ar} — {AREAS[c].en}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="pickup_spot">{isReturn ? "Drop-off Spot" : "Pickup Spot"} <span className="label-ar">{isReturn ? "مكان النزول" : "مكان الركوب"}</span></label>
          <select
            id="pickup_spot" name="pickup_spot" required className="input" value={spot}
            disabled={!area} onChange={(e) => setSpot(e.target.value)}
          >
            <option value="" disabled>{area ? "Select spot — اختار النقطة" : "Choose an area first"}</option>
            {spots.map((s) => (
              <option key={s.en} value={s.en}>{s.ar} — {s.en}</option>
            ))}
          </select>
        </div>
        {trip && !allowedAreas.includes("delengat") && (
          <p className="text-xs font-semibold text-neutral-500">
            Delengat isn&apos;t served on this shift. | دلنجات غير متاحة في هذا الميعاد.
          </p>
        )}
        {trip && area && spot && (
          times ? (
            times.assembly ? (
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-ink p-4 text-white">
                <div>
                  <div className="flex items-center gap-1 text-xs text-neutral-400"><Clock size={12} /> Assembly | التجمع</div>
                  <div className="text-2xl font-black">{times.assembly}</div>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-xs text-neutral-400"><Clock size={12} /> Departure | التحرك</div>
                  <div className="text-2xl font-black text-red-400">{times.departure}</div>
                </div>
                <div className="col-span-2 text-xs text-neutral-300">
                  Please be at {AREAS[area].spots.find((x) => x.en === spot)?.ar} by the assembly time. | برجاء التواجد قبل ميعاد التجمع.
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-ink p-4 text-white">
                <div className="flex items-center gap-1 text-xs text-neutral-400"><Clock size={12} /> Departs AIU | التحرك من الجامعة</div>
                <div className="text-2xl font-black text-red-400">{times.departure}</div>
                <div className="mt-1 text-xs text-neutral-300">
                  مكان النزول: {AREAS[area].spots.find((x) => x.en === spot)?.ar}
                </div>
              </div>
            )
          ) : (
            <div className="rounded-xl bg-neutral-100 p-3 text-sm font-semibold text-neutral-600">
              Pickup times will be confirmed on WhatsApp. | سيتم تأكيد الميعاد على واتساب.
            </div>
          )
        )}
      </section>

      {/* Student details */}
      <section className="card space-y-4 p-5">
        <h2 className="text-lg font-extrabold">3. Your details | بياناتك</h2>
        <div>
          <label className="label" htmlFor="full_name">Full Name <span className="label-ar">الاسم بالكامل</span></label>
          <input id="full_name" name="full_name" required minLength={3} className="input" autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="phone">WhatsApp Number <span className="label-ar">رقم الواتساب</span></label>
          <input id="phone" name="phone" required type="tel" inputMode="tel" placeholder="01XXXXXXXXX" className="input" dir="ltr" />
        </div>
      </section>

      {/* Payment */}
      <section className="card space-y-4 p-5">
        <h2 className="text-lg font-extrabold">4. Payment | الدفع</h2>

        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 text-sm font-semibold leading-relaxed text-red-800">
          ⚠️ Note: Cash payment on the bus is strictly not accepted. Your booking request will not be approved without a
          valid advance transfer receipt.
          <div className="mt-1.5 font-bold" dir="rtl">
            ⚠️ ملحوظة: ممنوع الدفع كاش في الأتوبيس نهائياً. لن يتم قبول الحجز بدون إيصال تحويل مسبق.
          </div>
        </div>

        {PAYMENT.fareEgp && (
          <div className="text-sm font-bold">Fare | سعر التذكرة: {PAYMENT.fareEgp} EGP</div>
        )}

        <div>
          <span className="label">Payment Method <span className="label-ar">طريقة الدفع</span></span>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              { v: "vodafone_cash", name: "Vodafone Cash", ar: "فودافون كاش", acct: PAYMENT.vodafoneCash, color: "bg-red-600" },
              { v: "instapay", name: "InstaPay", ar: "إنستاباي", acct: PAYMENT.instapay, color: "bg-purple-700" },
            ] as const).map((m) => (
              <label
                key={m.v}
                className={`cursor-pointer rounded-xl p-4 ring-2 transition ${method === m.v ? "bg-brand-50 ring-brand-500" : "ring-neutral-200"}`}
              >
                <div className="flex items-center gap-2">
                  <input type="radio" name="payment_method" value={m.v} required checked={method === m.v}
                    onChange={() => setMethod(m.v)} className="accent-brand-500" />
                  <span className={`h-2.5 w-2.5 rounded-full ${m.color}`} />
                  <span className="font-bold">{m.name}</span>
                  <span className="text-sm text-neutral-500">| {m.ar}</span>
                </div>
                <div className="mt-2 flex items-center justify-between rounded-lg bg-neutral-100 px-3 py-2">
                  <span className="font-mono text-base font-bold" dir="ltr">{m.acct}</span>
                  <button type="button" onClick={(e) => { e.preventDefault(); copy(m.acct); }}
                    className="flex items-center gap-1 text-xs font-semibold text-brand-600">
                    <Copy size={13} /> {copied === m.acct ? "Copied" : "Copy"}
                  </button>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="sender_account">
            Sender Number / Account <span className="label-ar">الرقم أو الحساب اللي حولت منه</span>
          </label>
          <input id="sender_account" name="sender_account" required className="input" dir="ltr"
            placeholder={method === "instapay" ? "name@instapay or 01XXXXXXXXX" : "01XXXXXXXXX"} />
        </div>

        <div>
          <span className="label">Transfer Receipt Screenshot <span className="label-ar">صورة إيصال التحويل</span></span>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-5 text-center hover:border-brand-500">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Receipt preview" className="max-h-64 rounded-lg object-contain" />
            ) : (
              <>
                <Upload className="text-neutral-400" />
                <span className="text-sm font-semibold">Tap to upload image | اضغط لرفع الصورة</span>
                <span className="text-xs text-neutral-500">Screenshot or photo</span>
              </>
            )}
            <input type="file" accept="image/*" className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          {file && <p className="mt-1 text-xs text-neutral-500">{file.name} — tap the box to change</p>}
        </div>
      </section>

      {error && <div className="rounded-xl bg-red-100 p-3 text-sm font-semibold text-red-800">{error}</div>}

      <button type="submit" disabled={busy || !anyOpen} className="btn-primary w-full !py-3.5 text-base">
        {busy ? <><Loader2 className="animate-spin" size={18} /> Submitting…</> : "Submit Booking Request | إرسال طلب الحجز"}
      </button>
    </form>
  );
}
