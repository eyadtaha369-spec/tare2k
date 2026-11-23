import { redirect } from "next/navigation";
import AdminNav from "@/components/AdminNav";
import { getStaff, sessionClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const staff = await getStaff();
  if (!staff) {
    const { data } = await (await sessionClient()).auth.getUser();
    if (!data.user) redirect("/admin/login");
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center">
        <div className="card max-w-sm p-6">
          <h1 className="text-xl font-black">Not authorized</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Your account ({data.user.email}) isn&apos;t registered as staff. Ask the admin to add you to the
            <code className="mx-1 rounded bg-neutral-100 px-1">staff</code> table.
          </p>
        </div>
      </main>
    );
  }
  return (
    <div className="min-h-screen">
      <AdminNav role={staff.role} name={staff.name} />
      <main className="px-4 pb-24 pt-5 md:ml-60 md:px-8 md:pb-10 md:pt-8">{children}</main>
    </div>
  );
}
