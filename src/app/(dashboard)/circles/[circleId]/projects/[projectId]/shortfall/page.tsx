"use client"

import { use } from "react"
import { ShortfallTab } from "@/components/projects/shortfall/shortfall-tab"
import { useProjectContext } from "@/components/projects/project-context"

export default function ShortfallPage({
  params,
}: {
  params: Promise<{ circleId: string; projectId: string }>
}) {
  const { circleId, projectId } = use(params)
  const { circle } = useProjectContext()

  if (!circle) return null

  return <ShortfallTab circle={circle} circleId={circleId} projectId={projectId} />
}
