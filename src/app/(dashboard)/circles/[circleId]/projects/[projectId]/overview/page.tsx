"use client"

import { use } from "react"
import { OverviewTab } from "@/components/projects/overview/overview-tab"
import { useProjectContext } from "@/components/projects/project-context"

export default function OverviewPage({
  params,
}: {
  params: Promise<{ circleId: string; projectId: string }>
}) {
  const { circleId, projectId } = use(params)
  const { project, circle } = useProjectContext()

  if (!project || !circle) return null

  return <OverviewTab project={project} circle={circle} circleId={circleId} projectId={projectId} />
}
