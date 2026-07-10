import Link from "next/link"
import { Fragment } from "react"

export type Crumb = { label: string; href?: string }

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null
  return (
    <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4" aria-label="Breadcrumb">
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <Fragment key={i}>
            {i > 0 && <span className="text-muted-foreground/40">/</span>}
            {isLast || !item.href ? (
              <span className={isLast ? "text-foreground font-medium" : ""}>{item.label}</span>
            ) : (
              <Link href={item.href} className="hover:text-foreground transition-colors">{item.label}</Link>
            )}
          </Fragment>
        )
      })}
    </nav>
  )
}
