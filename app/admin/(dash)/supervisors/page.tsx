import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth";
import SupervisorsView from "./SupervisorsView";

export default async function Page() {
  const staff = await getStaff();
  if (staff?.role !== "admin") redirect("/admin/scan");
  return <SupervisorsView />;
}
