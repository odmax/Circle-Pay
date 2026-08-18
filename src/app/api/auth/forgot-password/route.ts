import { NextResponse } from "next/server"
import { forgotPasswordSchema } from "@/lib/validations/password-reset"
import { requestPasswordReset } from "@/lib/services/password-reset.service"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = forgotPasswordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 })
    }

    await requestPasswordReset(parsed.data.email)

    return NextResponse.json({ success: true, message: "If an account exists, a reset link has been sent." })
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
