import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { SESSION_COOKIE, signSession, Staff } from "@/lib/session";
import { sheets } from "@/lib/sheets";
import { verifyPassword } from "@/lib/password";

export const dynamic = "force-dynamic";

function same(a: string, b?: string) {
  if (!b) return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

type UserRow = { id: string; name: string; username: string; password_hash: string; role: string; is_active: string };

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const username = String(body.username ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const fail = async (msg = "Wrong username or password.") => {
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: msg }, { status: 401 });
  };
  if (!username || !password) return fail();

  let staff: Omit<Staff, "exp"> | null = null;
  let hours = 24 * 14;

  const adminUser = (process.env.ADMIN_USERNAME || "admin").toLowerCase();
  if (username === adminUser) {
    if (!same(password, process.env.ADMIN_PASSWORD)) return fail();
    staff = { uid: "admin", role: "admin", name: process.env.ADMIN_NAME || "Admin" };
  } else {
    let user: UserRow | null = null;
    try {
      user = (await sheets<{ user: UserRow | null }>("getUserByUsername", { username })).user;
    } catch {
      return NextResponse.json({ error: "Login service unavailable. Try again." }, { status: 503 });
    }
    if (!user || !(await verifyPassword(password, user.password_hash))) return fail();
    if (user.is_active !== "TRUE") return fail("This account is deactivated. Contact the admin.");
    staff = { uid: user.id, role: "supervisor", name: user.name };
    hours = 16; // supervisors re-login each trip day
  }

  const token = await signSession({ ...staff, exp: Date.now() + hours * 3_600_000 });
  const res = NextResponse.json({ ok: true, role: staff.role, redirect: staff.role === "admin" ? "/admin/requests" : "/admin/scan" });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: hours * 3600,
  });
  return res;
}
