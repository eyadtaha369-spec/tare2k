import { redirect } from "next/navigation";
import { getStaff } from "@/lib/supabase";

export default async function AdminHome() {
  const staff = await getStaff();
  redirect(staff?.role === "admin" ? "/admin/requests" : "/admin/scanner");
}
