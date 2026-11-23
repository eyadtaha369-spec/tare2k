import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Bus, CalendarClock, MapPin, ShieldCheck, Smartphone, Wallet } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import TripStatusBadge from "@/components/TripStatusBadge";
import SupportContacts from "@/components/SupportContacts";
import { AREAS, AREA_CODES, BRAND, areasForTrip, fareFor, timesFor } from "@/lib/config";
import { DIRECTION_LABEL, formatTripDate, groupByDay, shiftLabel } from "@/lib/trips";
import { getWindows } from "@/lib/windows";

export const dynamic = "force-dynamic";

export default async function Home() {
  const windows = await getWindows().catch(() => []);

  return (
    <>
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white to-brand-50">
        <div className="mx-auto grid max-w-5xl items-center gap-8 px-4 py-12 md:grid-cols-2 md:py-20">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 text-xs font-bold text-brand-700">
              <Bus size={14} /> AIU Student Transport | مواصلات طلاب جامعة العلمين
            </p>
            <h1 className="text-5xl font-black tracking-wider text-brand-600 md:text-6xl">TARE2K</h1>
            <p className="mt-1 text-lg font-extrabold tracking-[0.2em] text-ink">{BRAND.slogan}</p>
            <p className="mt-1 text-lg font-bold text-neutral-600" dir="rtl">{BRAND.sloganAr}</p>
            <p className="mt-5 max-w-md text-neutral-700">
              Safe, on-time weekly buses from Delengat, Itay El Barud, Damanhour, Abu Hummus and Kafr El Dawar to{" "}
              {BRAND.destination} and back.
            </p>
            <p className="mt-2 max-w-md text-neutral-600" dir="rtl">
              رحلات أسبوعية آمنة ومنتظمة من الدلنجات وإيتاي البارود ودمنهور وأبو حمص وكفر الدوار إلى {BRAND.destinationAr} والعودة.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/book" className="btn-primary !px-6 !py-3 text-base">
                Book your seat | احجز مقعدك <ArrowRight size={18} />
              </Link>
              <a href="#schedule" className="btn-ghost !px-6 !py-3 text-base">Schedule | المواعيد</a>
            </div>
          </div>
          <div className="mx-auto w-64 md:w-80">
            <Image src="/logo.jpg" alt="TARE2K bus" width={500} height={500} priority className="rounded-full shadow-xl ring-8 ring-white" />
          </div>
        </div>
      </section>

      {/* Live trips */}
      <section id="schedule" className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="text-2xl font-black">Weekly Trips <span className="text-neutral-400">| الرحلات الأسبوعية</span></h2>
        <p className="mt-1 text-sm text-neutral-600">Booking windows follow Egypt time. مواعيد الحجز بتوقيت مصر.</p>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {(["outbound", "return"] as const).map((dir) => (
            <div key={dir} className="card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-extrabold">
                  {DIRECTION_LABEL[dir].en}
                  <span className="block text-sm font-semibold text-neutral-500">{DIRECTION_LABEL[dir].ar}</span>
                </h3>
              </div>
              {dir === "return" ? (
                <ul className="space-y-3">
                  {groupByDay(windows.filter((w) => w.direction === "return")).map((d) => (
                    <li key={d.key} className="rounded-xl bg-neutral-50 p-3.5 ring-1 ring-black/5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold">
                          {d.dayEn} <span className="text-neutral-500">| {d.dayAr}</span>
                          <span className="ml-2 text-xs font-medium text-neutral-500">{formatTripDate(d.tripDate)}</span>
                        </div>
                        <TripStatusBadge open={d.isOpen} />
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-neutral-600">
                        <CalendarClock size={13} /> Booking: {d.openLabel} → {d.closeLabel}
                      </div>
                      <div className="mt-3 text-xs font-semibold text-neutral-500">
                        Bus leaves AIU at | مواعيد التحرك من الجامعة
                      </div>
                      <div className="mt-1.5 grid grid-cols-2 gap-2">
                        {d.trips.map((t) => (
                          <div key={t.code} className="rounded-lg bg-white py-2 text-center ring-1 ring-black/10">
                            <div className="text-lg font-black text-brand-600" dir="ltr">{shiftLabel(t).en}</div>
                            <div className="text-xs text-neutral-500">{shiftLabel(t).ar}</div>
                          </div>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
              <ul className="space-y-3">
                {windows.filter((w) => w.direction === "outbound").map((w) => (
                  <li key={w.code} className="rounded-xl bg-neutral-50 p-3.5 ring-1 ring-black/5">
                    <div className="flex items-center justify-between">
                      <div className="font-bold">
                        {w.en} <span className="text-neutral-500">| {w.ar}</span>
                        <span className="ml-2 text-xs font-medium text-neutral-500">{formatTripDate(w.tripDate)}</span>
                      </div>
                      <TripStatusBadge open={w.isOpen} />
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-neutral-600">
                      <CalendarClock size={13} /> Booking: {w.openLabel} → {w.closeLabel}
                    </div>
                    {w.direction === "return" && timesFor(w.code, areasForTrip(w.code)[0]) ? (
                      <div className="mt-2 rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-black/5">
                        Departs AIU | التحرك من الجامعة:{" "}
                        <b className="text-brand-600">{timesFor(w.code, areasForTrip(w.code)[0])!.departure}</b>
                      </div>
                    ) : areasForTrip(w.code).some((a) => timesFor(w.code, a)) ? (
                      <table className="mt-2.5 w-full text-xs">
                        <thead>
                          <tr className="text-neutral-500">
                            <th className="text-left font-semibold">Area | المنطقة</th>
                            <th className="text-left font-semibold">Assembly | التجمع</th>
                            <th className="text-left font-semibold">Departure | التحرك</th>
                          </tr>
                        </thead>
                        <tbody>
                          {areasForTrip(w.code).map((a) => {
                            const t = timesFor(w.code, a);
                            return (
                              <tr key={a} className="border-t border-black/5">
                                <td className="py-1 font-semibold">{AREAS[a].ar}</td>
                                <td className="py-1">{t?.assembly ?? "TBA"}</td>
                                <td className="py-1 font-bold text-brand-600">{t?.departure ?? "TBA"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <div className="mt-1 text-xs text-neutral-500">Times TBA | المواعيد قريباً</div>
                    )}
                  </li>
                ))}
              </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Routes & stops */}
      <section className="bg-white py-12">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-2xl font-black">Routes & Pickup Stops <span className="text-neutral-400">| الخطوط ونقاط الركوب</span></h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {AREA_CODES.map((code) => (
              <div key={code} className="card overflow-hidden">
                <div className="bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-3 text-white">
                  <div className="font-extrabold">{AREAS[code].en}</div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="opacity-90">{AREAS[code].ar} ⇄ العلمين</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-black text-brand-600">{fareFor(code)} EGP</span>
                  </div>
                </div>
                <ul className="divide-y divide-neutral-100 px-4 py-2">
                  {AREAS[code].spots.map((s) => (
                    <li key={s.en} className="flex items-start gap-2 py-2 text-sm">
                      <MapPin size={15} className="mt-0.5 shrink-0 text-brand-500" />
                      <span>{s.en} <span className="text-neutral-500">— {s.ar}</span></span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="text-2xl font-black">How it works <span className="text-neutral-400">| طريقة الحجز</span></h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: CalendarClock, en: "Pick an open trip", ar: "اختار رحلة متاحة" },
            { icon: Wallet, en: "Transfer via Vodafone Cash or InstaPay", ar: "حوّل فودافون كاش أو إنستاباي" },
            { icon: ShieldCheck, en: "Upload receipt — we verify it", ar: "ارفع الإيصال ونراجعه" },
            { icon: Smartphone, en: "Get your QR pass on WhatsApp", ar: "استلم تذكرة QR على واتساب" },
          ].map((s, i) => (
            <div key={i} className="card p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
                <s.icon size={20} />
              </div>
              <div className="text-xs font-bold text-brand-600">STEP {i + 1}</div>
              <div className="font-bold">{s.en}</div>
              <div className="text-sm text-neutral-500" dir="rtl">{s.ar}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          ⚠️ Cash payment on the bus is not accepted. | لا يتم قبول الدفع كاش في الأتوبيس.
        </div>
      </section>

      {/* Contact / Help */}
      <section id="contact" className="bg-white py-12">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-2xl font-black">Contact & Help <span className="text-neutral-400">| تواصل معنا</span></h2>
          <p className="mt-1 text-sm text-neutral-600">
            Questions about booking, payment or your pass? Call or WhatsApp us.
            <span className="block" dir="rtl">عندك سؤال عن الحجز أو الدفع أو التذكرة؟ كلمنا أو ابعتلنا واتساب.</span>
          </p>
          <div className="mt-5 max-w-2xl">
            <SupportContacts />
          </div>
          <div className="mt-6 rounded-2xl bg-neutral-50 p-4 text-sm ring-1 ring-black/5">
            <div className="font-bold">Cancellation & refunds | الإلغاء والاسترداد</div>
            <p className="mt-1 text-neutral-600">
              You can cancel from your boarding pass link while that trip&apos;s booking window is open
              (Saturday → Fri 6 PM · Sunday → Sat 6 PM · Wednesday → Tue 6 PM · Thursday → Wed 6 PM).
            </p>
            <p className="mt-1 text-neutral-600" dir="rtl">
              تقدر تلغي من لينك التذكرة طالما الحجز للرحلة لسه مفتوح (السبت حتى الجمعة ٦م · الأحد حتى السبت ٦م · الأربعاء حتى الثلاثاء ٦م · الخميس حتى الأربعاء ٦م).
            </p>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
