"use client"

import { use } from "react"
import { ExpensesTab } from "@/components/projects/expenses/expenses-tab"
import { useProjectContext } from "@/components/projects/project-context"

export default function ExpensesPage({
  params,
}: {
  params: Promise<{ circleId: string; projectId: string }>
}) {
  const { circleId, projectId } = use(params)
  const { circle } = useProjectContext()

  if (!circle) return null

  return <ExpensesTab circle={circle} circleId={circleId} projectId={projectId} />
}
