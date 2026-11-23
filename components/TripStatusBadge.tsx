export default function TripStatusBadge({ open }: { open: boolean }) {
  return open ? (
    <span className="chip bg-emerald-100 text-emerald-800">● Open | متاح</span>
  ) : (
    <span className="chip bg-neutral-200 text-neutral-600">Closed | مغلق</span>
  );
}
