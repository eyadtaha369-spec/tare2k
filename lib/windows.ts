import { adminDb } from "./supabase";
import { computeWindows, OverrideMode } from "./trips";

type Ov = { trip_code: string; trip_date: string; mode: OverrideMode };

export async function getWindows() {
  let overrides: Ov[] = [];
  try {
    const { data } = await adminDb()
      .from("trip_overrides")
      .select("trip_code, trip_date, mode")
      .gte("trip_date", new Date(Date.now() - 86_400_000).toISOString().slice(0, 10));
    overrides = (data ?? []) as Ov[];
  } catch {
    // Database unavailable — fall back to the automatic schedule.
  }
  return computeWindows(overrides);
}
