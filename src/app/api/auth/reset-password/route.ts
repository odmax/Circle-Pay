import { NextResponse } from "next/server"
import { resetPasswordSchema } from "@/lib/validations/password-reset"
import { resetPassword } from "@/lib/services/password-reset.service"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = resetPasswordSchema.safeParse(body)
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors
      return NextResponse.json({ error: "Validation failed", details: fieldErrors }, { status: 400 })
    }

    const { token, password } = parsed.data
    const result = await resetPassword(token, password)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: "Password reset successfully. Redirecting to login." })
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
