"use client"

import { use } from "react"
import { FundingTab } from "@/components/projects/funding/funding-tab"
import { useProjectContext } from "@/components/projects/project-context"

export default function FundingPage({
  params,
}: {
  params: Promise<{ circleId: string; projectId: string }>
}) {
  const { circleId, projectId } = use(params)
  const { circle } = useProjectContext()

  if (!circle) return null

  return <FundingTab circle={circle} circleId={circleId} projectId={projectId} />
}
