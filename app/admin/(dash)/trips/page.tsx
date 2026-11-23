import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth";
import TripsView from "./TripsView";

export default async function Page() {
  const staff = await getStaff();
  if (staff?.role !== "admin") redirect("/admin/scanner");
  return <TripsView />;
}
