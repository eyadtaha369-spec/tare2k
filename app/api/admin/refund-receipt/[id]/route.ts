import { getStaff } from "@/lib/auth";
import { sheets } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaff();
  if (staff?.role !== "admin") return new Response("Forbidden", { status: 403 });
  const { id } = await params;
  try {
    const r = await sheets<{ mimeType: string; base64: string }>("getRefundReceipt", { id });
    return new Response(Buffer.from(r.base64, "base64"), {
      headers: { "Content-Type": r.mimeType, "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
