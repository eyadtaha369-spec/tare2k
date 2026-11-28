import Image from "next/image";
import { notFound } from "next/navigation";
import { BadgeCheck, Ban, CheckCircle2, Clock, Hourglass, MapPin } from "lucide-react";
import CancelBooking from "./CancelBooking";
import PassQR from "@/components/PassQR";
import { sheets } from "@/lib/sheets";
import { AREAS, AreaCode, spotLabel, timesFor } from "@/lib/config";
import { DIRECTION_LABEL, Direction, formatTripDate, tripLabel } from "@/lib/trips";
import { Booking, bookingAmount, egp, isCash, siteUrl } from "@/lib/utils";
import { canRequestRefund, formatCairoWall, refundDeadline } from "@/lib/refund";
import SupportContacts from "@/components/SupportContacts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Boarding Pass — TARE2K", robots: { index: false } };

export default async function PassPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) notFound();

  const { booking: b } = await sheets<{ booking: Booking | null }>("findByToken", { token }).catch(() => ({ booking: null }));
  const SHOWN = ["approved", "refund_requested", "refunded", "no_show", "cancelled"];
  if (!b || !SHOWN.includes(b.status)) notFound();
  const cancellable = canRequestRefund(b);
  const deadline = refundDeadline(b);

  const t = tripLabel(b.trip_code);
  const times = timesFor(b.trip_code, b.area as AreaCode);
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
            <div className="font-bold">{t.ar}</div>
            <div className="text-xs text-neutral-500">{t.en}</div>
            <div className="text-neutral-600">{formatTripDate(b.trip_date)}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-neutral-500">Direction | الاتجاه</div>
            <div className="font-bold">{dir.en}</div>
            <div className="text-neutral-600">{dir.ar}</div>
          </div>
          {times && !times.assembly && (
            <div className="col-span-2 rounded-xl bg-brand-50 p-2.5">
              <div className="text-xs font-semibold text-neutral-500">Departs AIU | التحرك من الجامعة</div>
              <div className="text-lg font-black text-brand-600">{times.departure}</div>
            </div>
          )}
          {times?.assembly && (
            <>
              <div className="rounded-xl bg-neutral-100 p-2.5">
                <div className="text-xs font-semibold text-neutral-500">Assembly | التجمع</div>
                <div className="text-lg font-black">{times.assembly}</div>
              </div>
              <div className="rounded-xl bg-brand-50 p-2.5">
                <div className="text-xs font-semibold text-neutral-500">Departure | التحرك</div>
                <div className="text-lg font-black text-brand-600">{times.departure}</div>
              </div>
            </>
          )}
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

        {b.status === "approved" ? (
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
            {isCash(b) && !b.checked_in_at && (
              <div className="mt-3 w-full rounded-xl bg-emerald-50 p-3 text-center text-sm font-bold text-emerald-900 ring-1 ring-emerald-200">
                💵 Pay {egp(bookingAmount(b))} cash to the supervisor when boarding
                <div className="font-semibold" dir="rtl">ادفع {bookingAmount(b)} جنيه كاش للمشرف عند الركوب</div>
              </div>
            )}
            <p className="mt-3 text-center text-xs text-neutral-500">
              Valid for one boarding only. Do not share this pass. | صالحة لمرة ركوب واحدة.
            </p>

            {cancellable ? (
              <div className="mt-6 w-full border-t border-neutral-100 pt-5">
                <CancelBooking token={token} senderAccount={b.sender_account} cash={isCash(b)} deadlineLabel={formatCairoWall(deadline)} />
              </div>
            ) : (
              !b.checked_in_at && (
                <div className="mt-5 w-full rounded-xl bg-neutral-100 p-3 text-center text-xs font-semibold text-neutral-600">
                  🔒 Booking and refund window for this trip has closed.
                  <div className="mt-0.5 font-normal" dir="rtl">انتهى وقت الحجز والإلغاء لهذه الرحلة.</div>
                </div>
              )
            )}
          </div>
        ) : (
          <div className="px-5 py-6">
            {b.status === "refund_requested" && (
              <div className="rounded-2xl bg-amber-50 p-5 text-center ring-1 ring-amber-200">
                <Hourglass className="mx-auto text-amber-600" size={36} />
                <div className="mt-2 text-lg font-black text-amber-900">⏳ Refund Requested</div>
                <div className="font-bold text-amber-800">تم طلب الاسترداد</div>
                <p className="mt-2 text-sm text-amber-900">
                  Your pass is cancelled and the admin will transfer your refund shortly.
                </p>
                <p className="mt-1 text-sm text-amber-900" dir="rtl">تم إلغاء تذكرتك، وسيتم تحويل المبلغ قريباً.</p>
                {b.refund_account && (
                  <p className="mt-3 text-xs text-amber-800">Refund to | التحويل إلى: <b dir="ltr">{b.refund_account}</b></p>
                )}
              </div>
            )}
            {b.status === "refunded" && (
              <div className="rounded-2xl bg-emerald-50 p-5 text-center ring-1 ring-emerald-200">
                <CheckCircle2 className="mx-auto text-emerald-600" size={36} />
                <div className="mt-2 text-lg font-black text-emerald-900">Refunded | تم الاسترداد</div>
                <p className="mt-2 text-sm text-emerald-900">
                  {egp(Number(b.refund_amount) || 0)} sent to <b dir="ltr">{b.refund_account || b.sender_account}</b>.
                </p>
                <p className="mt-1 text-xs text-emerald-800">This pass is cancelled. | هذه التذكرة ملغاة.</p>
              </div>
            )}
            {b.status === "cancelled" && (
              <div className="rounded-2xl bg-neutral-100 p-5 text-center">
                <Ban className="mx-auto text-neutral-500" size={36} />
                <div className="mt-2 text-lg font-black">Booking cancelled | تم إلغاء الحجز</div>
                <p className="mt-1 text-sm text-neutral-600">Your seat was released. This pass is no longer valid. | تم إلغاء المقعد والتذكرة.</p>
              </div>
            )}
            {b.status === "no_show" && (
              <div className="rounded-2xl bg-neutral-100 p-5 text-center">
                <Ban className="mx-auto text-neutral-500" size={36} />
                <div className="mt-2 text-lg font-black">No-show | لم يتم الركوب</div>
                <p className="mt-1 text-sm text-neutral-600">This pass is no longer valid. | هذه التذكرة لم تعد صالحة.</p>
              </div>
            )}
          </div>
        )}
        <div className="border-t border-neutral-100 bg-neutral-50 px-5 py-4">
          <SupportContacts compact />
        </div>
      </div>
    </main>
  );
}
