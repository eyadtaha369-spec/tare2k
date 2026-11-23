"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, LogOut, QrCode, Settings2, Users } from "lucide-react";

const ITEMS = [
  { href: "/admin/requests", en: "Requests", ar: "الطلبات", icon: ClipboardList, admin: true },
  { href: "/admin/manifest", en: "Manifests", ar: "كشف الركاب", icon: Users, admin: false },
  { href: "/admin/scanner", en: "Scanner", ar: "الماسح", icon: QrCode, admin: false },
  { href: "/admin/trips", en: "Trips", ar: "الرحلات", icon: Settings2, admin: true },
];

export default function AdminNav({ role, name }: { role: "admin" | "supervisor"; name: string | null }) {
  const path = usePathname();
  const items = ITEMS.filter((i) => role === "admin" || !i.admin);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col bg-ink text-white md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <Image src="/logo.jpg" alt="" width={38} height={38} className="rounded-full" />
          <div>
            <div className="font-black tracking-wider">TARE2K</div>
            <div className="text-[11px] capitalize text-neutral-400">{name ?? "Staff"} · {role}</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {items.map((i) => {
            const active = path.startsWith(i.href);
            return (
              <Link key={i.href} href={i.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${active ? "bg-brand-500" : "text-neutral-300 hover:bg-white/10"}`}>
                <i.icon size={18} /> {i.en} <span className="ml-auto text-xs opacity-70">{i.ar}</span>
              </Link>
            );
          })}
        </nav>
        <button onClick={signOut} className="m-3 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-neutral-400 hover:bg-white/10">
          <LogOut size={16} /> Sign out
        </button>
      </aside>

      {/* Mobile top bar + bottom tabs */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-ink px-4 py-3 text-white md:hidden">
        <div className="flex items-center gap-2">
          <Image src="/logo.jpg" alt="" width={30} height={30} className="rounded-full" />
          <span className="font-black tracking-wider">TARE2K</span>
          <span className="text-xs capitalize text-neutral-400">· {role}</span>
        </div>
        <button onClick={signOut} aria-label="Sign out"><LogOut size={18} /></button>
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-black/10 bg-white md:hidden">
        {items.map((i) => {
          const active = path.startsWith(i.href);
          return (
            <Link key={i.href} href={i.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${active ? "text-brand-600" : "text-neutral-500"}`}>
              <i.icon size={20} /> {i.en}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
