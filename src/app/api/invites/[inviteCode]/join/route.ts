import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { joinCircleByInviteCode } from "@/lib/services/invite.service"

export async function POST(req: Request, { params }: { params: Promise<{ inviteCode: string }> }) {
  const s = await auth(); if (!s?.user?.id) return NextResponse.json({ error: "Login required" }, { status: 401 })
  const { inviteCode } = await params
  const { answers } = await req.json().catch(() => ({}))
  const result = await joinCircleByInviteCode(inviteCode, s.user.id, answers)
  if (result.status === "error") return NextResponse.json({ error: result.message }, { status: 400 })
  return NextResponse.json(result, { status: result.status === "already_member" ? 200 : 201 } as any)
}
