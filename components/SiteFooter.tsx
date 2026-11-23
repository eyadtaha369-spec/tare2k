import SupportContacts from "./SupportContacts";

export default function SiteFooter() {
  return (
    <footer className="mt-16 bg-ink text-neutral-300">
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 text-sm md:grid-cols-2 md:items-center">
        <div>
          <span className="text-lg font-black tracking-wider text-white">TARE2K</span>
          <div className="text-xs font-bold tracking-[0.18em]">YOUR WAY TO ALAMEIN</div>
        </div>
        <SupportContacts dark />
      </div>
    </footer>
  );
}
