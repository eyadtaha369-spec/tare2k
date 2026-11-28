"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Banknote, CheckCircle2, Clock, Copy, Loader2, Lock, Plus, Trash2, Upload, UserRound } from "lucide-react";
import { AREAS, AreaCode, PAYMENT, Times, areasForTrip, fareFor, timesFor, timesText } from "@/lib/config";
import { DIRECTION_LABEL, TripWindow, formatTripDate, groupByDay, shiftLabel } from "@/lib/trips";

const MAX_PASSENGERS = 10;

type Method = "vodafone_cash" | "instapay" | "cash_on_bus";
type Passenger = { name: string; phone: string; area: AreaCode | ""; spot: string };
const emptyPassenger = (): Passenger => ({ name: "", phone: "", area: "", spot: "" });

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

/** Assembly / departure box for a trip + area. */
function TimesBox({ times, spotAr, compact }: { times: Times | null; spotAr?: string; compact?: boolean }) {
  if (!times) {
    return (
      <div className="rounded-xl bg-neutral-100 p-3 text-sm font-semibold text-neutral-600">
        Times will be confirmed on WhatsApp. | سيتم تأكيد الميعاد على واتساب.
      </div>
    );
  }
  if (compact) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-600">
        <Clock size={12} />
        {times.assembly ? `Assembly ${times.assembly} · Departure ${times.departure}` : `Departs AIU ${times.departure}`}
      </div>
    );
  }
  return times.assembly ? (
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
        Please be at {spotAr} by the assembly time. | برجاء التواجد قبل ميعاد التجمع.
      </div>
    </div>
  ) : (
    <div className="rounded-xl bg-ink p-4 text-white">
      <div className="flex items-center gap-1 text-xs text-neutral-400"><Clock size={12} /> Departs AIU | التحرك من الجامعة</div>
      <div className="text-2xl font-black text-red-400">{times.departure}</div>
      <div className="mt-1 text-xs text-neutral-300">مكان النزول: {spotAr}</div>
    </div>
  );
}

export default function BookingForm({ initialTrips }: { initialTrips: TripWindow[] }) {
  const [trips, setTrips] = useState(initialTrips);
  const [trip, setTrip] = useState("");
  const [area, setArea] = useState<AreaCode | "">("");
  const [spot, setSpot] = useState("");
  const [customPickup, setCustomPickup] = useState(false);
  const [passengers, setPassengers] = useState<Passenger[]>([emptyPassenger()]);
  const [method, setMethod] = useState<Method | "">("");
  const [sender, setSender] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ trip: TripWindow; names: string[]; area: AreaCode; total: number; cash: boolean } | null>(null);
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
  const selectedTrip = trips.find((t) => t.code === trip);
  const isReturn = selectedTrip?.direction === "return";
  const allowedAreas = useMemo(() => areasForTrip(trip), [trip]);
  const group = passengers.length > 1;
  const perPassenger = group && customPickup;
  const cash = method === "cash_on_bus";

  // Clear areas the chosen trip doesn't serve (e.g. Delengat on Sunday morning)
  useEffect(() => {
    if (area && !allowedAreas.includes(area)) { setArea(""); setSpot(""); }
    setPassengers((ps) => ps.map((p) => (p.area && !allowedAreas.includes(p.area) ? { ...p, area: "", spot: "" } : p)));
  }, [allowedAreas, area]);

  /** Pickup used for passenger i (shared, or their own when "different pickup" is on). */
  const pickupOf = (p: Passenger) => (perPassenger ? { area: p.area, spot: p.spot } : { area, spot });
  const total = passengers.reduce((a, p) => {
    const ar = pickupOf(p).area;
    return a + (ar ? fareFor(ar) : 0);
  }, 0);
  const priced = passengers.every((p) => pickupOf(p).area);

  function update(i: number, patch: Partial<Passenger>) {
    setPassengers((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  }
  function addPassenger() {
    if (passengers.length >= MAX_PASSENGERS) return;
    setPassengers((ps) => [...ps, { ...emptyPassenger(), area: customPickup ? area : "", spot: customPickup ? spot : "" }]);
  }
  function removePassenger(i: number) {
    setPassengers((ps) => ps.filter((_, j) => j !== i));
  }

  async function copy(text: string) {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      // Fallback for older phones / in-app browsers (e.g. opened from WhatsApp or Facebook)
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      ok = document.execCommand("copy");
      document.body.removeChild(ta);
    }
    if (ok) {
      setCopied(text);
      setTimeout(() => setCopied(""), 2000);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!trip) return setError("Please choose an open trip. | اختار رحلة متاحة.");
    if (!method) return setError("Choose a payment method. | اختار طريقة الدفع.");
    if (!cash && !file) return setError("Please upload your transfer receipt. | ارفع صورة إيصال التحويل.");

    const list = passengers.map((p) => {
      const pk = pickupOf(p);
      return { full_name: p.name.trim(), phone: p.phone.trim(), area: pk.area, pickup_spot: pk.spot };
    });
    const fd = new FormData();
    fd.set("trip_code", trip);
    fd.set("payment_method", method);
    fd.set("passengers", JSON.stringify(list));
    if (!cash) fd.set("sender_account", sender);
    setBusy(true);
    try {
      if (!cash && file) fd.set("receipt", await compressImage(file));
      const res = await fetch("/api/bookings", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong.");
      setDone({
        trip: selectedTrip!, names: list.map((p) => p.full_name), area: list[0].area as AreaCode,
        total: json.total ?? total, cash,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const n = done.names.length;
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
          {n > 1 ? <>{n} seats requested on the </> : <>Thanks {done.names[0].split(" ")[0]}. Your seat is requested on the </>}
          <b>{done.trip.en} ({formatTripDate(done.trip.tripDate)})</b> trip.{" "}
          {done.cash ? "Once the admin confirms, " : "Once we verify your transfer, "}
          {n > 1 ? <>each passenger gets <b>their own QR boarding pass on their WhatsApp</b>.</> : <>you&apos;ll receive your <b>QR boarding pass on WhatsApp</b>.</>}
        </p>
        {n > 1 && <p className="mt-2 text-sm text-neutral-600">{done.names.join(" · ")}</p>}
        {timesFor(done.trip.code, done.area) && <p className="mt-3 text-sm font-bold">{timesText(done.trip.code, done.area)}</p>}
        {done.cash && (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">
            💵 Pay {done.total} EGP cash to the supervisor when boarding. | ادفع {done.total} جنيه كاش للمشرف عند الركوب.
          </p>
        )}
        <p className="mt-2 text-neutral-600" dir="rtl">
          {done.cash ? "أول ما الأدمن يأكد الحجز" : "بنراجع التحويل دلوقتي، وأول ما يتم التأكيد"}{" "}
          {n > 1 ? "كل راكب هتوصله تذكرة الركوب (QR) بتاعته على واتساب." : "هتوصلك تذكرة الركوب (QR) على واتساب."}
        </p>
        <Link href="/" className="btn-ghost mt-6">Back to home | الرئيسية</Link>
      </div>
    );
  }

  const spotAr = (a: AreaCode | "", s: string) => (a ? AREAS[a].spots.find((x) => x.en === s)?.ar : "");

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* 1. Trip */}
      <section className="card p-5">
        <h2 className="mb-1 text-lg font-extrabold">1. Trip | الرحلة</h2>
        <p className="mb-4 text-xs text-neutral-500">Only trips with an open booking window can be selected.</p>
        {!anyOpen && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-neutral-100 p-3 text-sm font-semibold text-neutral-700">
            <Lock size={16} /> Booking for all trips is currently closed. | الحجز مغلق حالياً.
          </div>
        )}

        {/* Going: every trip (Sunday morning / Sunday afternoon too) is its own card */}
        <div className="mb-5">
          <div className="mb-2 text-sm font-extrabold text-neutral-700">
            {DIRECTION_LABEL.outbound.en} <span className="text-neutral-400">| {DIRECTION_LABEL.outbound.ar}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {trips.filter((t) => t.direction === "outbound").map((t) => {
              const sel = trip === t.code;
              const sh = shiftLabel(t);
              return (
                <button type="button" key={t.code} disabled={!t.isOpen} onClick={() => setTrip(t.code)}
                  className={`relative rounded-xl p-4 text-left ring-2 transition ${sel ? "bg-brand-50 ring-brand-500" : t.isOpen ? "bg-white ring-neutral-200 hover:ring-brand-500" : "cursor-not-allowed bg-neutral-50 opacity-70 ring-neutral-200"}`}>
                  {sel && <CheckCircle2 size={18} className="absolute right-3 top-3 text-brand-500" />}
                  <div className="font-extrabold">{t.dayEn} {sh.en}</div>
                  <div className="font-bold text-neutral-600">{t.dayAr} {sh.ar}</div>
                  <div className="text-xs text-neutral-500">{formatTripDate(t.tripDate)}</div>
                  {t.isOpen ? (
                    <div className="mt-2 text-xs font-semibold text-emerald-700">● Open until {t.closeLabel} | متاح</div>
                  ) : (
                    <div className="mt-2 flex items-start gap-1 text-xs font-semibold text-neutral-500">
                      <Lock size={12} className="mt-0.5 shrink-0" />
                      <span>Booking for this trip is currently closed.<span className="block font-normal">Opens {t.openLabel}</span></span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Return: one card per day with its two departure times */}
        <div>
          <div className="mb-2 text-sm font-extrabold text-neutral-700">
            {DIRECTION_LABEL.return.en} <span className="text-neutral-400">| {DIRECTION_LABEL.return.ar}</span>
          </div>
          <div className="space-y-3">
            {groupByDay(trips.filter((t) => t.direction === "return")).map((d) => (
              <div key={d.key}
                className={`rounded-xl p-4 ring-2 transition ${d.trips.some((t) => t.code === trip) ? "bg-brand-50 ring-brand-500" : d.isOpen ? "bg-white ring-neutral-200" : "bg-neutral-50 ring-neutral-200 opacity-70"}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="font-extrabold">
                    {d.dayEn} <span className="font-semibold text-neutral-500">| {d.dayAr}</span>
                    <span className="ml-2 text-xs font-medium text-neutral-500">{formatTripDate(d.tripDate)}</span>
                  </div>
                  {!d.isOpen && <Lock size={14} className="shrink-0 text-neutral-400" />}
                </div>
                {d.isOpen ? (
                  <>
                    <div className="mb-2 mt-0.5 text-xs font-semibold text-emerald-700">
                      Open until {d.closeLabel} · Choose a time | اختار الميعاد
                    </div>
                    <div className={`grid gap-2 ${d.trips.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                      {d.trips.map((t) => {
                        const sel = trip === t.code;
                        const sh = shiftLabel(t);
                        return (
                          <button type="button" key={t.code} disabled={!t.isOpen} onClick={() => setTrip(t.code)}
                            className={`relative flex flex-col items-center justify-center rounded-lg px-3 py-2 ring-2 transition disabled:opacity-50 ${sel ? "bg-brand-500 text-white ring-brand-500" : "bg-white text-ink ring-neutral-200 hover:ring-brand-500"}`}>
                            {sel && <CheckCircle2 size={14} className="absolute right-2 top-2" />}
                            <span dir="ltr" className="whitespace-nowrap text-base font-black">{sh.en}</span>
                            <span className={`text-xs font-semibold ${sel ? "text-white/80" : "text-neutral-500"}`}>{sh.ar}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="mt-1 text-xs font-semibold text-neutral-500">
                    Booking for this trip is currently closed. | الحجز مغلق
                    <span className="block font-normal">Opens {d.openLabel}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 2. Pickup */}
      <section className="card space-y-4 p-5">
        <h2 className="text-lg font-extrabold">
          {isReturn ? "2. Drop-off | مكان النزول" : "2. Pickup | نقطة الركوب"}
          {group && !customPickup && <span className="ml-2 text-sm font-semibold text-neutral-500">(all passengers | لكل الركاب)</span>}
        </h2>
        {perPassenger ? (
          <p className="rounded-xl bg-neutral-50 p-3 text-sm text-neutral-600">
            Each passenger chooses their own {isReturn ? "drop-off" : "pickup"} below. | كل راكب يختار مكانه تحت.
          </p>
        ) : (
          <>
            <div>
              <label className="label" htmlFor="area">{isReturn ? "Area" : "Pickup Area"} <span className="label-ar">المنطقة</span></label>
              <select id="area" required className="input" value={area}
                onChange={(e) => { setArea(e.target.value as AreaCode); setSpot(""); }}>
                <option value="" disabled>Select area — اختار المنطقة</option>
                {allowedAreas.map((c) => <option key={c} value={c}>{AREAS[c].ar} — {AREAS[c].en}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="pickup_spot">{isReturn ? "Drop-off Spot" : "Pickup Spot"} <span className="label-ar">{isReturn ? "مكان النزول" : "مكان الركوب"}</span></label>
              <select id="pickup_spot" required className="input" value={spot} disabled={!area} onChange={(e) => setSpot(e.target.value)}>
                <option value="" disabled>{area ? "Select spot — اختار النقطة" : "Choose an area first"}</option>
                {(area ? AREAS[area].spots : []).map((s) => <option key={s.en} value={s.en}>{s.ar} — {s.en}</option>)}
              </select>
            </div>
            {trip && !allowedAreas.includes("delengat") && (
              <p className="text-xs font-semibold text-neutral-500">Delengat isn&apos;t served on this trip. | دلنجات غير متاحة في هذا الميعاد.</p>
            )}
            {trip && area && spot && <TimesBox times={timesFor(trip, area)} spotAr={spotAr(area, spot)} />}
          </>
        )}
      </section>

      {/* 3. Passengers */}
      <section className="card space-y-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-extrabold">3. Passengers | الركاب</h2>
          <span className="chip bg-ink text-white">{passengers.length} {passengers.length === 1 ? "seat" : "seats"} | مقعد</span>
        </div>

        {passengers.map((p, i) => (
          <div key={i} className="rounded-xl bg-neutral-50 p-4 ring-1 ring-black/5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-xs text-white">{i + 1}</span>
                {i === 0 ? <>You | أنت</> : <>Passenger {i + 1} | الراكب {i + 1}</>}
              </div>
              {i > 0 && (
                <button type="button" onClick={() => removePassenger(i)} className="flex items-center gap-1 text-xs font-semibold text-red-600">
                  <Trash2 size={13} /> Remove | حذف
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor={`name-${i}`}>Full Name <span className="label-ar">اسم الراكب</span></label>
                <input id={`name-${i}`} required minLength={3} className="input" autoComplete={i === 0 ? "name" : "off"}
                  value={p.name} onChange={(e) => update(i, { name: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor={`phone-${i}`}>WhatsApp Number <span className="label-ar">رقم واتساب الراكب</span></label>
                <input id={`phone-${i}`} required type="tel" inputMode="tel" placeholder="01XXXXXXXXX" className="input" dir="ltr"
                  value={p.phone} onChange={(e) => update(i, { phone: e.target.value })} />
              </div>
              {perPassenger && (
                <>
                  <div>
                    <label className="label" htmlFor={`area-${i}`}>Area <span className="label-ar">المنطقة</span></label>
                    <select id={`area-${i}`} required className="input" value={p.area}
                      onChange={(e) => update(i, { area: e.target.value as AreaCode, spot: "" })}>
                      <option value="" disabled>Select area — اختار المنطقة</option>
                      {allowedAreas.map((c) => <option key={c} value={c}>{AREAS[c].ar} — {AREAS[c].en}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor={`spot-${i}`}>{isReturn ? "Drop-off" : "Pickup"} <span className="label-ar">{isReturn ? "مكان النزول" : "مكان الركوب"}</span></label>
                    <select id={`spot-${i}`} required className="input" value={p.spot} disabled={!p.area}
                      onChange={(e) => update(i, { spot: e.target.value })}>
                      <option value="" disabled>{p.area ? "Select spot — اختار النقطة" : "Choose an area first"}</option>
                      {(p.area ? AREAS[p.area].spots : []).map((s) => <option key={s.en} value={s.en}>{s.ar} — {s.en}</option>)}
                    </select>
                  </div>
                  {trip && p.area && p.spot && (
                    <div className="sm:col-span-2"><TimesBox compact times={timesFor(trip, p.area)} /></div>
                  )}
                </>
              )}
            </div>
            {i === 0 && group && <p className="mt-2 text-xs text-neutral-500">You&apos;re the contact person for this group. | إنت المسؤول عن الحجز.</p>}
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={addPassenger} disabled={passengers.length >= MAX_PASSENGERS}
            className="btn-ghost !py-2.5">
            <Plus size={16} /> Add Another Passenger | إضافة راكب آخر
          </button>
          {group && (
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={customPickup}
                onChange={(e) => {
                  const on = e.target.checked;
                  setCustomPickup(on);
                  if (on) setPassengers((ps) => ps.map((p) => ({ ...p, area: p.area || area, spot: p.spot || spot })));
                }} />
              Different {isReturn ? "drop-off" : "pickup"} per passenger | مكان مختلف لكل راكب
            </label>
          )}
        </div>
        <p className="text-xs text-neutral-500">
          <UserRound size={12} className="mr-1 inline" />
          Each passenger gets their own QR boarding pass on their WhatsApp. | كل راكب بياخد تذكرة QR خاصة بيه على واتساب.
        </p>
      </section>

      {/* 4. Payment */}
      <section className="card space-y-4 p-5">
        <h2 className="text-lg font-extrabold">4. Payment | الدفع</h2>

        <div className="flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3 ring-1 ring-brand-100">
          <div>
            <div className="text-sm font-bold">{group ? "Total | الإجمالي" : "Ticket price | سعر التذكرة"}</div>
            <div className="text-xs text-neutral-500">
              {!priced
                ? "Choose the area to see the price | اختار المنطقة"
                : group
                  ? passengers.map((p) => fareFor(pickupOf(p).area as AreaCode)).join(" + ") + " EGP"
                  : `${AREAS[pickupOf(passengers[0]).area as AreaCode].en} — ${AREAS[pickupOf(passengers[0]).area as AreaCode].ar}`}
            </div>
          </div>
          <div className="text-2xl font-black text-brand-600">
            {priced ? <>{total} <span className="text-sm">EGP</span></> : <span className="text-sm font-semibold text-neutral-500">180 – 190 EGP / seat</span>}
          </div>
        </div>

        <div>
          <span className="label">Payment Method <span className="label-ar">طريقة الدفع</span></span>
          <div className="grid gap-3 sm:grid-cols-3">
            {([
              { v: "vodafone_cash", name: "Vodafone Cash", ar: "محفظة إلكترونية", color: "bg-red-600" },
              { v: "instapay", name: "InstaPay", ar: "إنستاباي", color: "bg-purple-700" },
              { v: "cash_on_bus", name: "Cash on Bus", ar: "الدفع كاش في الباص", color: "bg-emerald-600" },
            ] as const).map((m) => (
              <label key={m.v}
                className={`flex cursor-pointer items-center gap-2 rounded-xl p-4 ring-2 transition ${method === m.v ? "bg-brand-50 ring-brand-500" : "ring-neutral-200 hover:ring-neutral-300"}`}>
                <input type="radio" name="payment_method" value={m.v} required checked={method === m.v}
                  onChange={() => setMethod(m.v)} className="accent-brand-500" />
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${m.color}`} />
                <span>
                  <span className="block font-bold leading-tight">{m.name}</span>
                  <span className="text-xs text-neutral-500">{m.ar}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {cash && (
          <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
            <div className="flex items-center gap-2 font-extrabold"><Banknote size={18} /> Pay cash to the supervisor when boarding</div>
            <div className="mt-1" dir="rtl">ادفع {priced ? `${total} جنيه` : "ثمن التذكرة"} كاش للمشرف وقت الركوب.</div>
            <div className="mt-2 text-xs font-normal">
              Your seat still needs admin confirmation — you&apos;ll get the QR pass on WhatsApp once confirmed.
              <span className="block" dir="rtl">الحجز محتاج تأكيد من الأدمن، وهتوصلك التذكرة على واتساب بعد التأكيد.</span>
            </div>
          </div>
        )}

        {method && !cash && (
          <>
            <div className="rounded-xl border-2 border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
              ⚠️ Your booking is approved only after we verify a valid transfer receipt.
              <div className="mt-1" dir="rtl">⚠️ الحجز بيتأكد بعد مراجعة إيصال التحويل.</div>
            </div>

            <div className="rounded-2xl bg-ink p-4 text-white">
              <div className="text-sm font-extrabold">
                {method === "instapay" ? "Send via InstaPay" : "Send from your wallet"}{priced ? ` ${total} EGP` : ""} to either number
              </div>
              <div className="text-sm text-neutral-300" dir="rtl">
                {method === "instapay" ? "حوّل بإنستاباي على أي رقم من دول" : "حوّل من محفظتك (فودافون كاش أو أي محفظة) على أي رقم من دول"}
                {priced ? ` — المبلغ ${total} جنيه` : ""}
                {group ? " (تحويل واحد لكل الركاب)" : ""}
              </div>
              <div className="mt-3 space-y-2">
                {PAYMENT.receivingNumbers.map((n) => (
                  <div key={n} className="flex items-center justify-between gap-2 rounded-xl bg-white/10 px-3 py-2.5">
                    <span className="font-mono text-lg font-black tracking-wide sm:text-xl" dir="ltr">{n}</span>
                    <button type="button" onClick={() => copy(n)}
                      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-bold transition ${copied === n ? "bg-emerald-500 text-white" : "bg-white text-ink hover:bg-neutral-200"}`}>
                      {copied === n ? <><CheckCircle2 size={15} /> تم النسخ</> : <><Copy size={15} /> Copy | نسخ</>}
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs text-neutral-400">
                ✔ Both numbers accept wallet transfers and InstaPay. | الرقمين بيستقبلوا تحويل المحفظة وإنستاباي.
                <span className="block">Then upload the transfer screenshot below. | وبعدها ارفع صورة التحويل تحت.</span>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="sender_account">
                Sender Number / Account <span className="label-ar">الرقم أو الحساب اللي حولت منه</span>
              </label>
              <input id="sender_account" required className="input" dir="ltr" value={sender} onChange={(e) => setSender(e.target.value)}
                placeholder={method === "instapay" ? "name@instapay or 01XXXXXXXXX" : "01XXXXXXXXX"} />
            </div>

            <div>
              <span className="label">
                Transfer Receipt Screenshot{group ? " (one for all)" : ""} <span className="label-ar">صورة إيصال التحويل</span>
              </span>
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
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
              {file && <p className="mt-1 text-xs text-neutral-500">{file.name} — tap the box to change</p>}
            </div>
          </>
        )}
      </section>

      {error && <div className="rounded-xl bg-red-100 p-3 text-sm font-semibold text-red-800">{error}</div>}

      <button type="submit" disabled={busy || !anyOpen} className="btn-primary w-full !py-3.5 text-base">
        {busy ? <><Loader2 className="animate-spin" size={18} /> Submitting…</>
          : group ? `Submit ${passengers.length} Seats | إرسال طلب ${passengers.length} مقاعد` : "Submit Booking Request | إرسال طلب الحجز"}
      </button>
    </form>
  );
}
