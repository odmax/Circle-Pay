"use client"

import { use } from "react"
import { ROITab } from "@/components/projects/roi/roi-tab"
import { useProjectContext } from "@/components/projects/project-context"

export default function ROIPage({
  params,
}: {
  params: Promise<{ circleId: string; projectId: string }>
}) {
  const { circleId, projectId } = use(params)
  const { circle } = useProjectContext()

  if (!circle) return null

  return <ROITab circle={circle} circleId={circleId} projectId={projectId} />
}
