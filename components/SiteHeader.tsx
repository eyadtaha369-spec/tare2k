import Image from "next/image";
import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-black/5 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.jpg" alt="TARE2K" width={40} height={40} className="rounded-full" />
          <div className="leading-tight">
            <div className="text-lg font-black tracking-wider text-brand-600">TARE2K</div>
            <div className="text-[10px] font-bold tracking-[0.18em] text-neutral-600">YOUR WAY TO ALAMEIN</div>
          </div>
        </Link>
        <Link href="/book" className="btn-primary !px-3.5 !py-2">
          Book a Seat <span className="hidden sm:inline">| احجز</span>
        </Link>
      </div>
    </header>
  );
}
