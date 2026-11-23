import { redirect } from "next/navigation";
import AdminNav from "@/components/AdminNav";
import { getStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const staff = await getStaff();
  if (!staff) redirect("/admin/login");
  return (
    <div className="min-h-screen">
      <AdminNav role={staff.role} name={staff.name} />
      <main className="px-4 pb-24 pt-5 md:ml-60 md:px-8 md:pb-10 md:pt-8">{children}</main>
    </div>
  );
}
