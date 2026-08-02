import { NextRequest, NextResponse } from "next/server";

const staffCookieName = process.env.AUTH_SESSION_COOKIE ?? "osrs_session";
const customerCookieName =
  process.env.CUSTOMER_SESSION_COOKIE ?? "osrs_customer_session";
const customBuildTrackingPrefix = "/custom-account-build/track/";
const publicAccountPrefixes = [
  "/account/login",
  "/account/register",
  "/account/recovery",
  "/account/reset/",
];

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

  if (request.nextUrl.pathname.startsWith("/admin")) {
    const token = request.cookies.get(staffCookieName)?.value;
    if (!token) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(login);
    }
    return NextResponse.next();
  }

  if (
    request.nextUrl.pathname.startsWith("/account") &&
    publicAccountPrefixes.some((prefix) =>
      request.nextUrl.pathname.startsWith(prefix),
    )
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(customerCookieName)?.value;
  if (!token) {
    const accountLogin = new URL("/account/login", request.url);
    accountLogin.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(accountLogin);
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
