import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { devToken } from "@/lib/config";

export const proxy = auth((req) => {
  if (req.auth || devToken()) return NextResponse.next();
  const signin = new URL("/signin", req.nextUrl);
  signin.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(signin);
});

export const config = {
  matcher: ["/((?!api/auth|signin|_next/static|_next/image|favicon.ico).*)"],
};
