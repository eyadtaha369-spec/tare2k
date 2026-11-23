import Image from "next/image";
import { notFound } from "next/navigation";
import { BadgeCheck, Clock, MapPin } from "lucide-react";
import PassQR from "@/components/PassQR";
import { sheets } from "@/lib/sheets";
import { AREAS, AreaCode, spotLabel } from "@/lib/config";
import { DIRECTION_LABEL, Direction, formatTripDate, tripDef } from "@/lib/trips";
import { Booking, siteUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Boarding Pass — TARE2K", robots: { index: false } };

export default async function PassPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) notFound();

  const { booking: b } = await sheets<{ booking: Booking | null }>("findByToken", { token }).catch(() => ({ booking: null }));
  if (!b || b.status !== "approved") notFound();

  const t = tripDef(b.trip_code);
  const dir = DIRECTION_LABEL[b.direction as Direction];
  const area = AREAS[b.area as AreaCode];

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-600 to-brand-900 p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 bg-ink px-5 py-4 text-white">
          <Image src="/logo.jpg" alt="" width={44} height={44} className="rounded-full" />
          <div>
            <div className="text-xl font-black tracking-wider">TARE2K</div>
            <div className="text-[10px] font-bold tracking-[0.2em] text-neutral-300">BOARDING PASS · تذكرة ركوب</div>
          </div>
        </div>

        <div className="px-5 pt-5">
          <div className="text-xs font-semibold uppercase text-neutral-500">Passenger | الراكب</div>
          <div className="text-xl font-extrabold">{b.full_name}</div>
        </div>

        <div className="grid grid-cols-2 gap-4 px-5 py-4 text-sm">
          <div>
            <div className="text-xs font-semibold text-neutral-500">Trip | الرحلة</div>
            <div className="font-bold">{t?.en} · {t?.ar}</div>
            <div className="text-neutral-600">{formatTripDate(b.trip_date)}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-neutral-500">Direction | الاتجاه</div>
            <div className="font-bold">{dir.en}</div>
            <div className="text-neutral-600">{dir.ar}</div>
          </div>
          <div className="col-span-2">
            <div className="text-xs font-semibold text-neutral-500">Pickup | نقطة الركوب</div>
            <div className="flex items-start gap-1.5 font-bold">
              <MapPin size={15} className="mt-0.5 text-brand-500" />
              <span>{area.en} ({area.ar}) — {spotLabel(b.area as AreaCode, b.pickup_spot)}</span>
            </div>
          </div>
        </div>

        <div className="relative border-t-2 border-dashed border-neutral-200">
          <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-brand-700" />
          <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-brand-700" />
        </div>

        <div className="flex flex-col items-center px-5 py-6">
          <div className="rounded-2xl bg-white p-2 ring-1 ring-black/10">
            <PassQR value={`${siteUrl()}/pass/${token}`} />
          </div>
          {b.checked_in_at ? (
            <div className="mt-4 flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-800">
              <BadgeCheck size={16} /> Boarded | تم الركوب
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-sm font-bold text-brand-700">
              <Clock size={16} /> Show this to the supervisor | اعرضه على المشرف
            </div>
          )}
          <p className="mt-3 text-center text-xs text-neutral-500">
            Valid for one boarding only. Do not share this pass. | صالحة لمرة ركوب واحدة.
          </p>
        </div>
      </div>
    </main>
  );
}
