import NextAuth from "next-auth"
import { authConfig } from "@/lib/auth.config"

export default NextAuth(authConfig).auth

export const config = {
  matcher: [
    "/((?!api/payments|api|_next/static|_next/image|favicon.ico|login|register|pricing|billing|$).*)",
  ],
}
