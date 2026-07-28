"use client"

import { use } from "react"
import { TimelineTab } from "@/components/projects/timeline/timeline-tab"
import { useProjectContext } from "@/components/projects/project-context"

export default function TimelinePage({ params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  const { circleId, projectId } = use(params)
  const { circle } = useProjectContext()
  if (!circle) return null
  return <TimelineTab circle={circle} circleId={circleId} projectId={projectId} />
}
