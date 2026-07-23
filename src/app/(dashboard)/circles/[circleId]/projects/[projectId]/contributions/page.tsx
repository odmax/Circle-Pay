"use client"

import { use } from "react"
import { ContributionsTab } from "@/components/projects/contributions/contributions-tab"
import { useProjectContext } from "@/components/projects/project-context"

export default function ContributionsPage({
  params,
}: {
  params: Promise<{ circleId: string; projectId: string }>
}) {
  const { circleId, projectId } = use(params)
  const { circle } = useProjectContext()

  if (!circle) return null

  return <ContributionsTab circle={circle} circleId={circleId} projectId={projectId} />
}
