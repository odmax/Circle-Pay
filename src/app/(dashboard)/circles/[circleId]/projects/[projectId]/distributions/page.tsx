"use client"

import { use } from "react"
import { DistributionsTab } from "@/components/projects/distributions/distributions-tab"
import { useProjectContext } from "@/components/projects/project-context"

export default function DistributionsPage({ params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  const { circleId, projectId } = use(params)
  const { circle } = useProjectContext()
  if (!circle) return null
  return <DistributionsTab circle={circle} circleId={circleId} projectId={projectId} />
}
