import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth";
import ArchiveView from "./ArchiveView";

export default async function Page() {
  const staff = await getStaff();
  if (staff?.role !== "admin") redirect("/admin/scan");
  return <ArchiveView />;
}
