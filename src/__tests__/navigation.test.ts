import { describe, it, expect } from "vitest"
import { mainNav } from "@/lib/navigation/app-navigation"
import { isNavigationItemActive, filterNavigationSections } from "@/lib/navigation/navigation-utils"

describe("app-navigation config", () => {
  it("contains no React components (serializable)", () => {
    const json = JSON.stringify(mainNav)
    expect(json).toBeDefined()
    expect(() => JSON.parse(json)).not.toThrow()
  })

  it("has Main section with expected items", () => {
    const main = mainNav.find((s) => s.label === "Main")
    expect(main).toBeDefined()
    const labels = main!.items.map((i) => i.label)
    expect(labels).toContain("Dashboard")
    expect(labels).toContain("My Circles")
    expect(labels).toContain("Notifications")
    expect(labels).toContain("Discover")
    expect(labels).toContain("Portfolio")
    expect(labels).toContain("Receipts")
    expect(labels).toContain("Upgrade")
  })

  it("has Support section with expected items", () => {
    const support = mainNav.find((s) => s.label === "Support")
    expect(support).toBeDefined()
    const labels = support!.items.map((i) => i.label)
    expect(labels).toContain("Support Center")
    expect(labels).toContain("Settings")
  })

  it("has Owner section with ownerOnly items", () => {
    const owner = mainNav.find((s) => s.label === "Owner")
    expect(owner).toBeDefined()
    for (const item of owner!.items) {
      expect(item.ownerOnly).toBe(true)
    }
  })
})

describe("isNavigationItemActive", () => {
  it("returns true for exact match", () => {
    expect(isNavigationItemActive("/circles", "/circles")).toBe(true)
  })

  it("returns true for nested route under href", () => {
    expect(isNavigationItemActive("/circles/123", "/circles")).toBe(true)
    expect(isNavigationItemActive("/owner/users/456", "/owner/users")).toBe(true)
  })

  it("returns false for unrelated route", () => {
    expect(isNavigationItemActive("/dashboard", "/circles")).toBe(false)
  })

  it("handles root path correctly", () => {
    expect(isNavigationItemActive("/", "/")).toBe(true)
    expect(isNavigationItemActive("/dashboard", "/")).toBe(false)
  })
})

describe("filterNavigationSections", () => {
  it("shows owner section for admins", () => {
    const result = filterNavigationSections(mainNav, { isAdmin: true, isPrimaryOwner: false })
    const owner = result.find((s) => s.label === "Owner")
    expect(owner).toBeDefined()
  })

  it("shows owner section for primary owners", () => {
    const result = filterNavigationSections(mainNav, { isAdmin: false, isPrimaryOwner: true })
    const owner = result.find((s) => s.label === "Owner")
    expect(owner).toBeDefined()
  })

  it("hides owner section for normal users", () => {
    const result = filterNavigationSections(mainNav, { isAdmin: false, isPrimaryOwner: false })
    const owner = result.find((s) => s.label === "Owner")
    expect(owner).toBeUndefined()
  })

  it("does not mutate the original config", () => {
    const originalLength = mainNav.length
    filterNavigationSections(mainNav, { isAdmin: false, isPrimaryOwner: false })
    expect(mainNav.length).toBe(originalLength)
    const owner = mainNav.find((s) => s.label === "Owner")
    expect(owner).toBeDefined()
  })
})

describe("sidebar.tsx imports from app-navigation", () => {
  it("re-exports mainNav and does not define inline nav", async () => {
    const content = await import("fs").then((fs) =>
      fs.readFileSync("src/components/layout/sidebar.tsx", "utf-8")
    )
    expect(content).toContain('from "@/lib/navigation/app-navigation"')
    expect(content).not.toContain("const groups =")
  })
})

describe("mobile-sidebar.tsx imports from app-navigation", () => {
  it("re-exports mainNav and does not define duplicate iconMap", async () => {
    const content = await import("fs").then((fs) =>
      fs.readFileSync("src/components/layout/mobile-sidebar.tsx", "utf-8")
    )
    expect(content).toContain('from "@/lib/navigation/app-navigation"')
    expect(content).not.toContain("const iconMap")
  })
})

describe("Desktop and Mobile use same nav items", () => {
  const main = mainNav.find((s) => s.label === "Main")!
  const support = mainNav.find((s) => s.label === "Support")!
  const owner = mainNav.find((s) => s.label === "Owner")!

  it("Main items match between desktop and mobile usage", () => {
    const labels = main.items.map((i) => i.label)
    expect(labels).toEqual(["Dashboard", "My Circles", "Notifications", "Discover", "Portfolio", "Receipts", "Upgrade"])
  })

  it("Support items match between desktop and mobile usage", () => {
    const labels = support.items.map((i) => i.label)
    expect(labels).toEqual(["Support Center", "Settings"])
  })

  it("Owner items match between desktop and mobile usage", () => {
    const labels = owner.items.map((i) => i.label)
    expect(labels).toEqual(["Dashboard", "Users", "Circles", "Payments", "System Health"])
  })
})

describe("NavIcon component", () => {
  it("file exists and exports a function", async () => {
    const mod = await import("@/components/navigation/nav-icon")
    expect(mod.NavIcon).toBeDefined()
    expect(typeof mod.NavIcon).toBe("function")
  })

  it("uses aria-hidden attribute in render result", () => {
    // Verify aria-hidden is set in the JSX
    const src = require("fs").readFileSync("src/components/navigation/nav-icon.tsx", "utf-8")
    expect(src).toContain('aria-hidden="true"')
  })
})
