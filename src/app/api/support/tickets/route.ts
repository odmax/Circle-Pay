import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function generateTicketNumber() {
  return `CP-${String(Date.now() % 1000000).padStart(6, "0")}`
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const url = new URL(req.url)
  if (url.searchParams.get("mine") === "true") {
    const tickets = await prisma.supportTicket.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" }, take: 50 })
    return NextResponse.json(tickets)
  }
  return NextResponse.json([])
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const { subject, message, category, circleId } = await req.json()
    if (!subject || !message) return NextResponse.json({ error: "Subject and message required" }, { status: 400 })
    let ticketNumber = generateTicketNumber()
    while (await prisma.supportTicket.findUnique({ where: { ticketNumber } })) { ticketNumber = generateTicketNumber() }
    const ticket = await prisma.supportTicket.create({
      data: { ticketNumber, userId: session.user.id, circleId, subject, message, category: (category || "OTHER") as any },
    })
    return NextResponse.json(ticket, { status: 201 })
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
}
