import { NextResponse } from "next/server";
import { sheets } from "@/lib/sheets";

export const dynamic = "force-dynamic";

/** Quick check that the Google Sheets backend is reachable. */
export async function GET() {
  try {
    await sheets("getOverrides");
    return NextResponse.json({ sheets: "connected" });
  } catch (e) {
    return NextResponse.json({ sheets: "error", message: (e as Error).message }, { status: 503 });
  }
}
