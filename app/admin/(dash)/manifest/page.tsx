import { redirect } from "next/navigation";
import { getStaff } from "@/lib/auth";
import ManifestView from "./ManifestView";

export default async function Page() {
  const staff = await getStaff();
  if (staff?.role !== "admin") redirect("/admin/scan");
  return <ManifestView />;
}
