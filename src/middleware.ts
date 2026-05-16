import { NextResponse, type NextRequest } from "next/server";

// Edge middleware: blocca solo le path private senza cookie sessione.
// La validazione vera (DB) avviene server-side nelle route protette.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPrivate =
    pathname.startsWith("/infra") ||
    pathname.startsWith("/database") ||
    pathname.startsWith("/releases") ||
    pathname.startsWith("/backups") ||
    pathname.startsWith("/project") ||
    pathname.startsWith("/work") ||
    pathname === "/";
  const cookie = req.cookies.get("ops_session");
  if (isPrivate && !cookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/infra/:path*", "/database/:path*", "/releases/:path*", "/backups/:path*", "/project/:path*", "/work/:path*"],
};
