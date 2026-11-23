import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Service-role client — server only. Bypasses RLS. */
export function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** Cookie-bound client for reading the logged-in staff session. */
export async function sessionClient() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            /* called from a Server Component — safe to ignore */
          }
        },
      },
    },
  );
}

export type StaffRole = "admin" | "supervisor";

/** Returns the current staff member, or null if not logged in / not staff. */
export async function getStaff(): Promise<{ id: string; role: StaffRole; name: string | null } | null> {
  const supa = await sessionClient();
  const { data } = await supa.auth.getUser();
  if (!data.user) return null;
  const { data: row } = await adminDb()
    .from("staff")
    .select("role, full_name")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (!row) return null;
  return { id: data.user.id, role: row.role as StaffRole, name: row.full_name };
}
