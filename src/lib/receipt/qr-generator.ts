import { APP_URL } from "@/lib/constants"

export function generateReceiptVerificationUrl(token: string): string {
  return `${APP_URL}/verify/receipt/${token}`
}
