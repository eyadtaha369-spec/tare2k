import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SUPERVISOR_APIS, SUPERVISOR_PAGES, verifySession } from "@/lib/session";

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isApi = path.startsWith("/api/");
  if (path === "/admin/login") return NextResponse.next();

  const staff = await verifySession(req.cookies.get(SESSION_COOKIE)?.value).catch(() => null);
  if (!staff) {
    return isApi
      ? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      : NextResponse.redirect(new URL("/admin/login", req.url));
  }

  // Supervisors: scanner only. Any other admin page or API is blocked.
  if (staff.role === "supervisor") {
    const allowed = isApi
      ? SUPERVISOR_APIS.some((p) => path.startsWith(p))
      : SUPERVISOR_PAGES.some((p) => path === p || path.startsWith(p + "/"));
    if (!allowed) {
      return isApi
        ? NextResponse.json({ error: "Forbidden" }, { status: 403 })
        : NextResponse.redirect(new URL("/admin/scan", req.url));
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
