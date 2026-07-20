import { NextRequest, NextResponse } from "next/server"

const COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "__Host-authjs.csrf-token",
  "authjs.csrf-token",
  "authjs.callback-url",
  "__Secure-authjs.callback-url",
]

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 0,
}

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url))
  for (const name of COOKIE_NAMES) {
    response.cookies.set(name, "", { ...COOKIE_OPTIONS, secure: name.startsWith("__Secure") || name.startsWith("__Host") })
  }
  return response
}

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url))
  for (const name of COOKIE_NAMES) {
    response.cookies.set(name, "", { ...COOKIE_OPTIONS, secure: name.startsWith("__Secure") || name.startsWith("__Host") })
  }
  return response
}
