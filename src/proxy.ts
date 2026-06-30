import { NextRequest, NextResponse } from "next/server";

const cookieName = process.env.AUTH_SESSION_COOKIE ?? "osrs_session";

export function proxy(request: NextRequest) {
  const token = request.cookies.get(cookieName)?.value;
  if (!token) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*", "/admin/:path*"],
};
