"use client"

import { use } from "react"
import { OwnershipTab } from "@/components/projects/ownership/ownership-tab"
import { useProjectContext } from "@/components/projects/project-context"

export default function OwnershipPage({ params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  const { circleId, projectId } = use(params)
  const { circle } = useProjectContext()
  if (!circle) return null
  return <OwnershipTab circle={circle} circleId={circleId} projectId={projectId} />
}
