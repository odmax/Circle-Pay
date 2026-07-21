import type { NavItem, NavSection } from "@/lib/navigation/app-navigation"

export function isNavigationItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function filterNavigationSections(
  sections: NavSection[],
  options: { isAdmin: boolean; isPrimaryOwner: boolean }
): NavSection[] {
  const isOwner = options.isAdmin || options.isPrimaryOwner
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.ownerOnly || isOwner),
    }))
    .filter((section) => section.items.length > 0)
}
