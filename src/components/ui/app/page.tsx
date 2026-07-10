export function AppPage({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`space-y-6 ${className || ""}`}>{children}</div>
}

export function AppSection({ title, description, actions, children }: { title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <SectionHeader title={title} description={description} actions={actions} />
      {children}
    </section>
  )
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}

export function SectionHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function DataTable({ columns, data, empty }: { columns: { key: string; label: string; className?: string }[]; data: Record<string, unknown>[]; empty?: React.ReactNode }) {
  if (data.length === 0) {
    return <div className="p-6 text-center">{empty || <p className="text-sm text-muted-foreground">No data</p>}</div>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b text-left text-xs font-medium text-muted-foreground">
          {columns.map((c) => <th key={c.key} className={`p-3 ${c.className || ""}`}>{c.label}</th>)}
        </tr></thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b hover:bg-muted/30">
              {columns.map((c) => <td key={c.key} className={`p-3 ${c.className || ""}`}>{String(row[c.key] ?? "—")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
