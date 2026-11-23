import { SUPPORT_WHATSAPP } from "@/lib/config";

export default function SiteFooter() {
  return (
    <footer className="mt-16 bg-ink text-neutral-300">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="font-black tracking-wider text-white">TARE2K</span> — YOUR WAY TO ALAMEIN
        </div>
        <a className="hover:text-white" href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noreferrer">
          WhatsApp support | تواصل معنا
        </a>
      </div>
    </footer>
  );
}
