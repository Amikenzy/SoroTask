import { auth } from "@/app/api/auth/[...nextauth]/route";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createContentSecurityPolicy, getStaticSecurityHeaders } from "@/lib/security-headers";

export default auth((req) => {
  const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = btoa(Array.from(nonceBytes, (byte) => String.fromCharCode(byte)).join(""));
  const contentSecurityPolicy = createContentSecurityPolicy(nonce, {
    development: process.env.NODE_ENV === "development",
    keeperUrl: process.env.NEXT_PUBLIC_KEEPER_URL,
  });
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const applySecurityHeaders = (response: NextResponse) => {
    for (const [name, value] of Object.entries(getStaticSecurityHeaders())) {
      response.headers.set(name, value);
    }
    response.headers.set("Content-Security-Policy", contentSecurityPolicy);
    return response;
  };

  const { pathname } = req.nextUrl;
  const isAuthenticated = !!req.auth;

  // Public routes that don't require authentication
  const publicRoutes = ["/", "/auth/signin", "/auth/error"];
  const isPublicRoute = publicRoutes.some((route) => pathname === route || pathname.startsWith(route));

  // Handle callback URL preservation
  const callbackUrl = req.nextUrl.searchParams.get("callbackUrl") || pathname;

  // If user is not authenticated and trying to access a protected route
  if (!isAuthenticated && !isPublicRoute) {
    const signInUrl = new URL("/auth/signin", req.url);
    // Preserve the intended destination for redirect after login
    signInUrl.searchParams.set("callbackUrl", callbackUrl);
    return applySecurityHeaders(NextResponse.redirect(signInUrl));
  }

  // If user is authenticated and trying to access sign-in page
  if (isAuthenticated && pathname === "/auth/signin") {
    // Check if there's a callback URL to redirect to
    const redirectTo = req.nextUrl.searchParams.get("callbackUrl") || "/";
    return applySecurityHeaders(NextResponse.redirect(new URL(redirectTo, req.url)));
  }

  // If user is authenticated and trying to access error page, redirect to home
  if (isAuthenticated && pathname === "/auth/error") {
    return applySecurityHeaders(NextResponse.redirect(new URL("/", req.url)));
  }

  return applySecurityHeaders(
    NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    }),
  );
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api/auth (NextAuth.js routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|public).*)",
  ],
};
