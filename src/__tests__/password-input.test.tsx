import { describe, it, expect } from "vitest"

describe("PasswordInput component", () => {
  it("PasswordInput file exists and exports correctly", async () => {
    const mod = await import("@/components/ui/password-input")
    expect(mod.PasswordInput).toBeDefined()
    expect(typeof mod.PasswordInput).toBe("function")
  })
})

describe("login page includes forgot password link", () => {
  it("login page file contains forgot-password link", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const content = fs.readFileSync(
      path.resolve("src/app/(auth)/login/page.tsx"),
      "utf-8"
    )
    expect(content).toContain("/forgot-password")
    expect(content).toContain("Forgot password?")
  })
})

describe("forgot-password page exists", () => {
  it("exports a default component", async () => {
    const mod = await import("@/app/(auth)/forgot-password/page")
    expect(mod.default).toBeDefined()
    expect(typeof mod.default).toBe("function")
  })
})

describe("reset-password page exists", () => {
  it("exports a default component", async () => {
    const mod = await import("@/app/(auth)/reset-password/page")
    expect(mod.default).toBeDefined()
    expect(typeof mod.default).toBe("function")
  })
})

describe("forgot-password API route exists", () => {
  it("exports POST handler", async () => {
    const mod = await import("@/app/api/auth/forgot-password/route")
    expect(mod.POST).toBeDefined()
    expect(typeof mod.POST).toBe("function")
  })
})

describe("reset-password API route exists", () => {
  it("exports POST handler", async () => {
    const mod = await import("@/app/api/auth/reset-password/route")
    expect(mod.POST).toBeDefined()
    expect(typeof mod.POST).toBe("function")
  })
})

describe("auth config allows public auth routes", () => {
  it("allows unauthenticated access to /forgot-password", async () => {
    const { authConfig } = await import("@/lib/auth.config")
    const result = authConfig.callbacks!.authorized!({
      auth: null,
      request: { nextUrl: new URL("http://localhost/forgot-password"), params: {} },
    } as any)
    expect(result).toBe(true)
  })

  it("allows unauthenticated access to /reset-password", async () => {
    const { authConfig } = await import("@/lib/auth.config")
    const result = authConfig.callbacks!.authorized!({
      auth: null,
      request: { nextUrl: new URL("http://localhost/reset-password?token=abc"), params: {} },
    } as any)
    expect(result).toBe(true)
  })
})

describe("validation schemas export correctly", () => {
  it("forgotPasswordSchema is exported", async () => {
    const mod = await import("@/lib/validations/password-reset")
    expect(mod.forgotPasswordSchema).toBeDefined()
    expect(mod.resetPasswordSchema).toBeDefined()
    expect(typeof mod.forgotPasswordSchema.safeParse).toBe("function")
    expect(typeof mod.resetPasswordSchema.safeParse).toBe("function")
  })
})

describe("all password forms use PasswordInput", () => {
  it("register page uses PasswordInput", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const content = fs.readFileSync(
      path.resolve("src/app/(auth)/register/page.tsx"),
      "utf-8"
    )
    expect(content).toContain("PasswordInput")
    expect(content).not.toMatch(/<Input[^>]*type="password"/)
  })

  it("change-password-form uses PasswordInput", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const content = fs.readFileSync(
      path.resolve("src/components/settings/change-password-form.tsx"),
      "utf-8"
    )
    expect(content).toContain("PasswordInput")
    expect(content).not.toMatch(/<Input[^>]*type="password"/)
  })

  it("login page uses PasswordInput", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const content = fs.readFileSync(
      path.resolve("src/app/(auth)/login/page.tsx"),
      "utf-8"
    )
    expect(content).toContain("PasswordInput")
    expect(content).not.toMatch(/<Input[^>]*type="password"/)
  })

  it("reset-password page uses PasswordInput", async () => {
    const fs = await import("fs")
    const path = await import("path")
    const content = fs.readFileSync(
      path.resolve("src/app/(auth)/reset-password/page.tsx"),
      "utf-8"
    )
    expect(content).toContain("PasswordInput")
  })
})
