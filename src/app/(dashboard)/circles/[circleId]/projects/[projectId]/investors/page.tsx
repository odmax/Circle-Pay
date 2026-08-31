"use client"

import { use } from "react"
import { InvestorsIndex } from "@/components/projects/investors/investors-index"

export default function ProjectInvestorsPage({ params }: { params: Promise<{ circleId: string; projectId: string }> }) {
  const { circleId, projectId } = use(params)
  return <InvestorsIndex circleId={circleId} projectId={projectId} />
}