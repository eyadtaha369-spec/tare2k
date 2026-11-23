import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, Staff, verifySession } from "./session";
import { sheets } from "./sheets";

/**
 * Returns the logged-in staff member.
 * With checkActive, supervisors are re-checked against the Users sheet so a
 * deactivated or deleted account loses access immediately.
 */
export async function getStaff(opts: { checkActive?: boolean } = {}): Promise<Staff | null> {
  const store = await cookies();
  const s = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!s) return null;
  if (opts.checkActive && s.role === "supervisor") {
    try {
      const { user } = await sheets<{ user: { is_active: boolean } | null }>("getUser", { id: s.uid });
      if (!user?.is_active) return null;
    } catch {
      return null;
    }
  }
  return s;
}
