import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

function cleared(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

export async function POST() {
  return cleared(NextResponse.json({ ok: true }));
}

/** Used to sign out deactivated accounts: clears the cookie and goes to login. */
export async function GET(req: Request) {
  return cleared(NextResponse.redirect(new URL("/admin/login", req.url)));
}
