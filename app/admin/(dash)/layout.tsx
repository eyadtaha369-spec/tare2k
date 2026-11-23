import { redirect } from "next/navigation";
import AdminNav from "@/components/AdminNav";
import { getStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  // Supervisors are re-checked against the Users sheet on every page load
  const staff = await getStaff({ checkActive: true });
  if (!staff) redirect("/api/auth/logout?next=/admin/login");
  return (
    <div className="min-h-screen">
      <AdminNav role={staff.role} name={staff.name} />
      <main className="px-4 pb-24 pt-5 md:ml-60 md:px-8 md:pb-10 md:pt-8">{children}</main>
    </div>
  );
}
