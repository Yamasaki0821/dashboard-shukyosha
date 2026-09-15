import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "./lib/session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 認証不要のパス
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // 2026-09-04：cookieの「有無」ではなく「署名」を検証する。
  // 以前は auth_user=任意 で誰でも突破できた（本人が本番で実証）。
  const secret = process.env.AUTH_SECRET;
  const token = request.cookies.get("auth_session")?.value;
  const name = secret ? await verifySession(token, secret) : null;

  if (!name) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // 2026-09-15：public/ のロゴ画像（svg/png等）はログイン画面でも読めるよう認証の外に置く
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.svg$|.*\\.ico$|.*\\.webp$).*)"],
};
