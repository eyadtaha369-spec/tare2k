import { NextResponse } from "next/server";
import { getWindows } from "@/lib/windows";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ trips: await getWindows() });
}
