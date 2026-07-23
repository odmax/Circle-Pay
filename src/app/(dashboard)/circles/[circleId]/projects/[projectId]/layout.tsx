"use client"

import { use } from "react"
import { ProjectProvider } from "@/components/projects/project-context"
import { ProjectLayout } from "@/components/projects/project-layout"

export default function ProjectDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ circleId: string; projectId: string }>
}) {
  const { circleId, projectId } = use(params)

  return (
    <ProjectProvider circleId={circleId} projectId={projectId}>
      <ProjectLayout circleId={circleId} projectId={projectId}>
        {children}
      </ProjectLayout>
    </ProjectProvider>
  )
}
