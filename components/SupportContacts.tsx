import { MessageCircle, Phone } from "lucide-react";
import { CONTACTS } from "@/lib/config";

/** Official phone / WhatsApp numbers with click-to-call and WhatsApp links. */
export default function SupportContacts({ compact = false, dark = false }: { compact?: boolean; dark?: boolean }) {
  return (
    <div>
      <div className={`mb-2 text-xs font-semibold ${dark ? "text-neutral-400" : "text-neutral-500"}`}>
        Need help? Call or WhatsApp us | للاستفسار كلمنا أو واتساب
      </div>
      <div className={`grid gap-2 ${compact ? "" : "sm:grid-cols-2"}`}>
        {CONTACTS.map((c) => (
          <div key={c.intl}
            className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 ${dark ? "bg-white/10" : "bg-white ring-1 ring-black/10"}`}>
            <span className={`whitespace-nowrap font-mono text-sm font-bold ${dark ? "text-white" : "text-ink"}`} dir="ltr">{c.display}</span>
            <div className="flex gap-1.5">
              <a href={`tel:+${c.intl}`} aria-label={`Call ${c.display}`}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold ${dark ? "bg-white/15 text-white hover:bg-white/25" : "bg-neutral-100 text-ink hover:bg-neutral-200"}`}>
                <Phone size={13} /> {!compact && "Call"}
              </a>
              <a href={`https://wa.me/${c.intl}`} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${c.display}`}
                className="flex items-center gap-1 rounded-lg bg-[#25D366] px-2.5 py-1.5 text-xs font-bold text-white hover:bg-[#1ebe5a]">
                <MessageCircle size={13} /> {compact ? "Chat" : "WhatsApp"}
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
