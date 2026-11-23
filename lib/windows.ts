import { adminDb } from "./supabase";
import { computeWindows, OverrideMode } from "./trips";

export async function getWindows() {
  const { data } = await adminDb()
    .from("trip_overrides")
    .select("trip_code, trip_date, mode")
    .gte("trip_date", new Date(Date.now() - 86_400_000).toISOString().slice(0, 10));
  return computeWindows((data ?? []) as { trip_code: string; trip_date: string; mode: OverrideMode }[]);
}
