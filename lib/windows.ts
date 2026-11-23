import "server-only";
import { sheets } from "./sheets";
import { computeWindows, OverrideMode } from "./trips";

type Ov = { trip_code: string; trip_date: string; mode: OverrideMode };

export async function getWindows() {
  let overrides: Ov[] = [];
  try {
    overrides = (await sheets<{ overrides: Ov[] }>("getOverrides")).overrides ?? [];
  } catch {
    // Backend unavailable — fall back to the automatic schedule.
  }
  return computeWindows(overrides);
}
