import { redirect } from "next/navigation";
import { getStaff } from "@/lib/supabase";
import RequestsView from "./RequestsView";

export default async function RequestsPage() {
  const staff = await getStaff();
  if (staff?.role !== "admin") redirect("/admin/manifest");
  return <RequestsView />;
}
