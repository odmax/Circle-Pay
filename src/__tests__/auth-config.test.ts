import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// We test the auth config logic directly by extracting and calling the authorized callback
// since auth.config.ts is a plain config object

describe("auth.config authorized callback", () => {
  const originalEnv = process.env.OWNER_EMAIL

  // Import the config fresh each time
  async function getAuthorized() {
    vi.resetModules()
    const mod = await import("@/lib/auth.config")
    return mod.authConfig.callbacks!.authorized!
  }

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.OWNER_EMAIL = originalEnv
    } else {
      delete process.env.OWNER_EMAIL
    }
  })

  function makeRequest(pathname: string) {
    return { nextUrl: new URL(`http://localhost${pathname}`), params: {} } as any
  }

  function makeAuth(user: any) {
    return { user } as any
  }

  // ─── Public routes ──────────────────────────────────────
  it("allows unauthenticated access to /", async () => {
    const authorized = await getAuthorized()
    const result = authorized({ auth: null, request: makeRequest("/") })
    expect(result).toBe(true)
  })

  it("allows unauthenticated access to /login", async () => {
    const authorized = await getAuthorized()
    const result = authorized({ auth: null, request: makeRequest("/login") })
    expect(result).toBe(true)
  })

  it("allows unauthenticated access to /register", async () => {
    const authorized = await getAuthorized()
    const result = authorized({ auth: null, request: makeRequest("/register") })
    expect(result).toBe(true)
  })

  it("allows unauthenticated access to /pricing", async () => {
    const authorized = await getAuthorized()
    const result = authorized({ auth: null, request: makeRequest("/pricing") })
    expect(result).toBe(true)
  })

  it("allows unauthenticated access to /verify/receipt/sometoken", async () => {
    const authorized = await getAuthorized()
    const result = authorized({ auth: null, request: makeRequest("/verify/receipt/abc123") })
    expect(result).toBe(true)
  })

  it("allows unauthenticated access to /join", async () => {
    const authorized = await getAuthorized()
    const result = authorized({ auth: null, request: makeRequest("/join") })
    expect(result).toBe(true)
  })

  // ─── Protected routes redirect to login ─────────────────
  it("redirects unauthenticated user from /dashboard to /login", async () => {
    const authorized = await getAuthorized()
    const result = authorized({ auth: null, request: makeRequest("/dashboard") })
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).headers.get("Location")).toContain("/login")
  })

  it("redirects unauthenticated user from /notifications to /login", async () => {
    const authorized = await getAuthorized()
    const result = authorized({ auth: null, request: makeRequest("/notifications") })
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).headers.get("Location")).toContain("/login")
  })

  it("redirects unauthenticated user from /discover to /login", async () => {
    const authorized = await getAuthorized()
    const result = authorized({ auth: null, request: makeRequest("/discover") })
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).headers.get("Location")).toContain("/login")
  })

  it("redirects unauthenticated user from /support to /login", async () => {
    const authorized = await getAuthorized()
    const result = authorized({ auth: null, request: makeRequest("/support") })
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).headers.get("Location")).toContain("/login")
  })

  it("redirects unauthenticated user from /upgrade to /login", async () => {
    const authorized = await getAuthorized()
    const result = authorized({ auth: null, request: makeRequest("/upgrade") })
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).headers.get("Location")).toContain("/login")
  })

  it("redirects unauthenticated user from /portfolio to /login", async () => {
    const authorized = await getAuthorized()
    const result = authorized({ auth: null, request: makeRequest("/portfolio") })
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).headers.get("Location")).toContain("/login")
  })

  it("redirects unauthenticated user from /receipts to /login", async () => {
    const authorized = await getAuthorized()
    const result = authorized({ auth: null, request: makeRequest("/receipts") })
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).headers.get("Location")).toContain("/login")
  })

  it("redirects unauthenticated user from /owner to /login", async () => {
    const authorized = await getAuthorized()
    const result = authorized({ auth: null, request: makeRequest("/owner") })
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).headers.get("Location")).toContain("/login")
  })

  it("redirects unauthenticated user from /circles to /login", async () => {
    const authorized = await getAuthorized()
    const result = authorized({ auth: null, request: makeRequest("/circles") })
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).headers.get("Location")).toContain("/login")
  })

  it("redirects unauthenticated user from /settings to /login", async () => {
    const authorized = await getAuthorized()
    const result = authorized({ auth: null, request: makeRequest("/settings") })
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).headers.get("Location")).toContain("/login")
  })

  // ─── Authenticated access ──────────────────────────────
  it("allows authenticated user to access /dashboard", async () => {
    const authorized = await getAuthorized()
    const result = authorized({
      auth: makeAuth({ id: "1", email: "user@test.com", isAdmin: false }),
      request: makeRequest("/dashboard"),
    })
    expect(result).toBe(true)
  })

  it("allows authenticated user to access nested /circles/abc123", async () => {
    const authorized = await getAuthorized()
    const result = authorized({
      auth: makeAuth({ id: "1", email: "user@test.com", isAdmin: false }),
      request: makeRequest("/circles/abc123"),
    })
    expect(result).toBe(true)
  })

  it("allows authenticated user to access nested /settings/security", async () => {
    const authorized = await getAuthorized()
    const result = authorized({
      auth: makeAuth({ id: "1", email: "user@test.com", isAdmin: false }),
      request: makeRequest("/settings/security"),
    })
    expect(result).toBe(true)
  })

  // ─── Owner routes require admin ────────────────────────
  it("redirects non-admin user from /owner to /dashboard", async () => {
    process.env.OWNER_EMAIL = "owner@test.com"
    const authorized = await getAuthorized()
    const result = authorized({
      auth: makeAuth({ id: "1", email: "user@test.com", isAdmin: false }),
      request: makeRequest("/owner"),
    })
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).headers.get("Location")).toContain("/dashboard")
  })

  it("redirects non-admin user from /owner/users to /dashboard", async () => {
    process.env.OWNER_EMAIL = "owner@test.com"
    const authorized = await getAuthorized()
    const result = authorized({
      auth: makeAuth({ id: "1", email: "user@test.com", isAdmin: false }),
      request: makeRequest("/owner/users"),
    })
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).headers.get("Location")).toContain("/dashboard")
  })

  it("allows admin user to access /owner", async () => {
    process.env.OWNER_EMAIL = "owner@test.com"
    const authorized = await getAuthorized()
    const result = authorized({
      auth: makeAuth({ id: "1", email: "user@test.com", isAdmin: true }),
      request: makeRequest("/owner"),
    })
    expect(result).toBe(true)
  })

  it("allows primary owner to access /owner", async () => {
    process.env.OWNER_EMAIL = "owner@test.com"
    const authorized = await getAuthorized()
    const result = authorized({
      auth: makeAuth({ id: "1", email: "Owner@Test.com", isAdmin: false }),
      request: makeRequest("/owner"),
    })
    expect(result).toBe(true)
  })

  // ─── Login page never treated as protected ─────────────
  it("allows unauthenticated access to /login even when visiting from protected route", async () => {
    const authorized = await getAuthorized()
    const result = authorized({ auth: null, request: makeRequest("/login") })
    expect(result).toBe(true)
  })
})
