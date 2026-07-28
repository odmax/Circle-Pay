"use client"

import { use } from "react"
import { StatementsTab } from "@/components/projects/statements/statements-tab"
import { useProjectContext } from "@/components/projects/project-context"

export default function StatementsPage({ params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  const { circleId, projectId } = use(params)
  const { circle } = useProjectContext()
  if (!circle) return null
  return <StatementsTab circle={circle} circleId={circleId} projectId={projectId} />
}
