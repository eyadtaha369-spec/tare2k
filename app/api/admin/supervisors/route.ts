import { NextResponse } from "next/server";
import { getStaff } from "@/lib/auth";
import { sheets } from "@/lib/sheets";
import { hashPassword } from "@/lib/password";

export const dynamic = "force-dynamic";

export async function GET() {
  const staff = await getStaff();
  if (staff?.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  try {
    return NextResponse.json(await sheets("listUsers"));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const staff = await getStaff();
  if (staff?.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? "").trim();
  const username = String(b.username ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");

  if (name.length < 2) return NextResponse.json({ error: "Enter the supervisor's name." }, { status: 400 });
  if (!/^[a-z0-9._@+-]{3,60}$/.test(username)) {
    return NextResponse.json({ error: "Username/email: 3+ characters, letters, numbers, . _ @ - only." }, { status: 400 });
  }
  if (username === (process.env.ADMIN_USERNAME || "admin").toLowerCase()) {
    return NextResponse.json({ error: "That username is reserved." }, { status: 400 });
  }
  if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });

  try {
    const r = await sheets("createUser", { name, username, password_hash: await hashPassword(password), by: staff.name });
    return NextResponse.json(r);
  } catch (e) {
    const msg = (e as Error).message === "username_taken" ? "That username/email is already used." : (e as Error).message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
