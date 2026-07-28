"use client"

import { use } from "react"
import { AssetsTab } from "@/components/projects/assets/assets-tab"
import { useProjectContext } from "@/components/projects/project-context"

export default function AssetsPage({
  params,
}: {
  params: Promise<{ circleId: string; projectId: string }>
}) {
  const { circleId, projectId } = use(params)
  const { circle } = useProjectContext()

  if (!circle) return null

  return <AssetsTab circle={circle} circleId={circleId} projectId={projectId} />
}
