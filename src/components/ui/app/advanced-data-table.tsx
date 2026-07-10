"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Download, X } from "lucide-react"
import Link from "next/link"
import { NoSearchResults } from "@/components/ui/app/empty-state-presets"

export type Column<T = Record<string, unknown>> = {
  key: string
  header: string
  accessor?: (row: T) => React.ReactNode
  sortable?: boolean
  className?: string
  hideOnMobile?: boolean
}

export type AdvancedDataTableProps<T = Record<string, unknown>> = {
  columns: Column<T>[]
  data: T[]
  keyField?: string
  searchPlaceholder?: string
  emptyTitle?: string
  emptyDescription?: string
  rowHref?: (row: T) => string
  rowActions?: (row: T) => React.ReactNode
  pageSize?: number
  totalCount?: number
  onSearch?: (q: string) => void
  filters?: React.ReactNode
  bulkActions?: string[]
  onBulkAction?: (action: string, ids: string[]) => void
  exportHref?: string
}

export function AdvancedDataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyField = "id",
  searchPlaceholder = "Search...",
  emptyTitle = "No data",
  emptyDescription,
  rowHref,
  rowActions,
  pageSize = 20,
  totalCount,
  filters,
  bulkActions,
  onBulkAction,
  exportHref,
}: AdvancedDataTableProps<T>) {
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const total = totalCount ?? data.length
  const totalPages = Math.ceil(total / pageSize)

  // Apply sort
  let sorted = [...data]
  if (sort) {
    sorted.sort((a, b) => {
      const av = a[sort.key]; const bv = b[sort.key]
      if (av == null) return 1; if (bv == null) return -1
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
      return sort.dir === "asc" ? cmp : -cmp
    })
  }

  const pageData = sorted.slice((page - 1) * pageSize, page * pageSize)

  function toggleSelect(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelected(next)
  }

  function toggleAll() {
    if (selected.size === pageData.length) setSelected(new Set())
    else setSelected(new Set(pageData.map((r) => String(r[keyField]))))
  }

  return (
    <div className="space-y-3">
      {/* Search + Filters + Bulk Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder={searchPlaceholder} className="rounded-xl pl-9" />
        </div>
        {filters && <div className="flex gap-2">{filters}</div>}
        <div className="flex-1" />
        {exportHref && <Button variant="outline" size="sm" className="rounded-xl" render={<Link href={exportHref} />}><Download className="size-4 mr-1" /> Export</Button>}
      </div>

      {/* Bulk Action Bar */}
      {selected.size > 0 && bulkActions && (
        <div className="flex items-center gap-2 bg-muted/50 rounded-xl p-2">
          <span className="text-xs font-medium px-2">{selected.size} selected</span>
          {bulkActions.map((action) => (
            <Button key={action} variant="outline" size="sm" className="rounded-lg text-xs h-7" onClick={() => { onBulkAction?.(action, Array.from(selected)); setSelected(new Set()) }}>{action}</Button>
          ))}
          <Button variant="ghost" size="sm" className="rounded-lg text-xs h-7 ml-auto" onClick={() => setSelected(new Set())}><X className="size-3" /></Button>
        </div>
      )}

      {/* Table */}
      <Card className="rounded-2xl"><CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table">
            <thead>
              <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                {bulkActions && <th scope="col" className="p-3 w-10"><input type="checkbox" checked={selected.size === pageData.length && pageData.length > 0} onChange={toggleAll} aria-label="Select all rows" /></th>}
                {columns.map((col) => (
                  <th key={col.key} scope="col" className={`p-3 whitespace-nowrap ${col.hideOnMobile ? "hidden md:table-cell" : ""} ${col.className || ""}`} aria-sort={sort?.key === col.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
                    {col.sortable ? (
                      <button onClick={() => setSort((s) => s?.key === col.key ? (s.dir === "asc" ? { key: col.key, dir: "desc" } : null) : { key: col.key, dir: "asc" })} className="flex items-center gap-1 hover:text-foreground transition-colors" aria-label={`Sort by ${col.header}${sort?.key === col.key ? `, currently ${sort.dir === "asc" ? "ascending" : "descending"}` : ""}`}>
                        {col.header}
                        {sort?.key === col.key ? (sort.dir === "asc" ? <ArrowUp className="size-3" aria-hidden="true" /> : <ArrowDown className="size-3" aria-hidden="true" />) : <ArrowUpDown className="size-3 opacity-30" aria-hidden="true" />}
                      </button>
                    ) : col.header}
                  </th>
                ))}
                {rowActions && <th scope="col" className="p-3 w-10"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {pageData.length === 0 ? (
        <tr><td colSpan={columns.length + (bulkActions ? 1 : 0) + (rowActions ? 1 : 0)} className="p-10 text-center">
          <NoSearchResults />
        </td></tr>
              ) : pageData.map((row) => {
                const id = String(row[keyField])
                const href = rowHref?.(row)
                return (
                  <tr key={id} className="border-b hover:bg-muted/30">
                    {bulkActions && <td className="p-3"><input type="checkbox" checked={selected.has(id)} onChange={() => toggleSelect(id)} aria-label={`Select row ${id}`} /></td>}
                    {columns.map((col) => {
                      const cell = col.accessor ? col.accessor(row) : String(row[col.key] ?? "—")
                      return (
                        <td key={col.key} className={`p-3 ${col.hideOnMobile ? "hidden md:table-cell" : ""} ${col.className || ""}`}>
                          {href ? <Link href={href} className="hover:underline">{cell}</Link> : cell}
                        </td>
                      )
                    })}
                    {rowActions && <td className="p-3">{rowActions(row)}</td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent></Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="rounded-xl h-8" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft className="size-4" /></Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i
              if (p > totalPages) return null
              return <Button key={p} variant={p === page ? "default" : "outline"} size="sm" className="rounded-xl h-8 min-w-[32px]" onClick={() => setPage(p)}>{p}</Button>
            })}
            {totalPages > 5 && page < totalPages - 2 && <span className="px-1">...</span>}
            {totalPages > 5 && page < totalPages - 2 && <Button variant="outline" size="sm" className="rounded-xl h-8 min-w-[32px]" onClick={() => setPage(totalPages)}>{totalPages}</Button>}
            <Button variant="outline" size="sm" className="rounded-xl h-8" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><ChevronRight className="size-4" /></Button>
          </div>
        </div>
      )}
    </div>
  )
}
