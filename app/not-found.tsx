import Link from "next/link";
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-3xl font-black text-brand-600">TARE2K</h1>
      <p className="font-semibold">This page or pass is not available.</p>
      <p className="text-neutral-500" dir="rtl">الصفحة أو التذكرة غير متاحة.</p>
      <Link href="/" className="btn-ghost mt-2">Home | الرئيسية</Link>
    </main>
  );
}
