import { NextRequest, NextResponse } from "next/server";

const cookieName = process.env.AUTH_SESSION_COOKIE ?? "osrs_session";
const customBuildTrackingPrefix = "/custom-account-build/track/";

function notFound() {
  return new NextResponse("Not found", {
    status: 404,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith(customBuildTrackingPrefix)) {
    const token = request.nextUrl.pathname.slice(
      customBuildTrackingPrefix.length,
    );
    if (!/^[A-Za-z0-9_-]{32,120}$/.test(token)) {
      return notFound();
    }
    return NextResponse.next();
  }

  const token = request.cookies.get(cookieName)?.value;
  if (!token) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/account/:path*",
    "/admin/:path*",
    "/custom-account-build/track/:path*",
  ],
};
