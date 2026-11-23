import { NextResponse } from "next/server";
import { getStaff } from "@/lib/auth";
import { sheets } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaff();
  if (staff?.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { id } = await params;
  const { active } = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await sheets("setUserActive", { id, active: !!active }));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaff();
  if (staff?.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { id } = await params;
  try {
    return NextResponse.json(await sheets("deleteUser", { id }));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
