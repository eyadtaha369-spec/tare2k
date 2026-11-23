import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { SESSION_COOKIE, signSession, StaffRole } from "@/lib/session";

export const dynamic = "force-dynamic";

function same(a: string, b?: string) {
  if (!b) return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function POST(req: Request) {
  const { name, password } = await req.json().catch(() => ({}));
  const pw = String(password ?? "");
  let role: StaffRole | null = null;
  if (same(pw, process.env.ADMIN_PASSWORD)) role = "admin";
  else if (same(pw, process.env.SUPERVISOR_PASSWORD)) role = "supervisor";
  if (!role) {
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }
  const days = 14;
  const token = await signSession({
    role,
    name: String(name ?? "").trim().slice(0, 40) || (role === "admin" ? "Admin" : "Supervisor"),
    exp: Date.now() + days * 86_400_000,
  });
  const res = NextResponse.json({ ok: true, role });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: days * 86_400,
  });
  return res;
}
