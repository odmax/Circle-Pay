import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { createMobileSession, revokeMobileSession, getMobileUserFromRequest } from "@/lib/services/mobile-auth.service"

export async function POST(req: Request) {
  const url = new URL(req.url)
  try {
    // Login
    if (url.pathname.endsWith("/login") || url.searchParams.get("_action") === "login" || (await req.clone().json().then((b) => b._action === "login").catch(() => false))) {
      const { email, password, deviceName, deviceId, platform } = await (url.pathname.endsWith("/login") ? req.clone() : req).json().then((b: any) => b._action ? req.json() : Promise.resolve(JSON.parse(JSON.stringify(b)))).catch(() => ({}))
      const body = await req.clone().json().catch(() => ({}))
      const e = body.email || email
      const p = body.password || password
      if (!e || !p) return NextResponse.json({ error: "Email and password required" }, { status: 400 })
      const user = await prisma.user.findUnique({ where: { email: e } })
      if (!user || !user.passwordHash) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
      const valid = await bcrypt.compare(p, user.passwordHash)
      if (!valid) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
      if (user.isSuspended) return NextResponse.json({ error: "Account suspended" }, { status: 403 })
      const token = await createMobileSession(user.id, { deviceName: body.deviceName || deviceName, deviceId: body.deviceId || deviceId, platform: body.platform || platform })
      return NextResponse.json({ token, user: { id: user.id, name: user.name, email: user.email, currency: user.currency, image: user.image } })
    }

    // Register
    if (url.pathname.endsWith("/register")) {
      const body = await req.json()
      const { name, email, password } = body
      if (!email || !password) return NextResponse.json({ error: "Email and password required" }, { status: 400 })
      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing) return NextResponse.json({ error: "Email already registered" }, { status: 409 })
      const hash = await bcrypt.hash(password, 12)
      const user = await prisma.user.create({ data: { name: name || null, email, passwordHash: hash } })
      const token = await createMobileSession(user.id, { deviceName: body.deviceName, platform: body.platform })
      return NextResponse.json({ token, user: { id: user.id, name: user.name, email: user.email, currency: user.currency } }, { status: 201 })
    }

    // Logout
    if (url.pathname.endsWith("/logout")) {
      const token = req.headers.get("authorization")?.replace("Bearer ", "")
      if (token) await revokeMobileSession(token)
      return NextResponse.json({ ok: true })
    }

    // Me
    if (url.pathname.endsWith("/me")) {
      try { const user = await getMobileUserFromRequest(req); return NextResponse.json(user) }
      catch (e: any) { return NextResponse.json({ error: e.message }, { status: 401 }) }
    }

    return NextResponse.json({ error: "Not found" }, { status: 404 })
  } catch (e) { return NextResponse.json({ error: "Internal error" }, { status: 500 }) }
}
