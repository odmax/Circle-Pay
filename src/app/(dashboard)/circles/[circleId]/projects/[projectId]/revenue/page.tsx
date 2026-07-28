"use client"

import { use } from "react"
import { RevenueTab } from "@/components/projects/revenue/revenue-tab"
import { useProjectContext } from "@/components/projects/project-context"

export default function RevenuePage({
  params,
}: {
  params: Promise<{ circleId: string; projectId: string }>
}) {
  const { circleId, projectId } = use(params)
  const { circle } = useProjectContext()

  if (!circle) return null

  return <RevenueTab circle={circle} circleId={circleId} projectId={projectId} />
}
