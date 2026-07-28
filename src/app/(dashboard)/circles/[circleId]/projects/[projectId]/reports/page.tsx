"use client"

import { use } from "react"
import { ReportsTab } from "@/components/projects/reports/reports-tab"
import { useProjectContext } from "@/components/projects/project-context"

export default function ReportsPage({ params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  const { circleId, projectId } = use(params)
  const { circle } = useProjectContext()
  if (!circle) return null
  return <ReportsTab circle={circle} circleId={circleId} projectId={projectId} />
}
