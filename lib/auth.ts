import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "./session";

export async function getStaff() {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}
