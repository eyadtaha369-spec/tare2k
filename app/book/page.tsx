import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import BookingForm from "./BookingForm";
import { getWindows } from "@/lib/windows";

export const dynamic = "force-dynamic";
export const metadata = { title: "Book a Seat | احجز — TARE2K" };

export default async function BookPage() {
  const trips = await getWindows().catch(() => []);
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-3xl font-black">Book a Seat</h1>
        <p className="mb-6 text-lg font-bold text-neutral-500" dir="rtl">احجز مقعدك</p>
        <BookingForm initialTrips={trips} />
      </main>
      <SiteFooter />
    </>
  );
}
