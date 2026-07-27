"use client"

import { createContext, useContext, useState, useEffect, useCallback } from "react"
import type { ProjectData, CircleData } from "./types"

interface ProjectContextValue {
  project: ProjectData | null
  circle: CircleData | null
  currency: string
  loading: boolean
  error: string | null
  refresh: () => void
  refreshProject: () => void
  tabData: Record<string, unknown>
  setTabData: (key: string, data: unknown) => void
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

export function useProjectContext(): ProjectContextValue {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error("useProjectContext must be used within ProjectProvider")
  return ctx
}

export function ProjectProvider({
  circleId,
  projectId,
  children,
}: {
  circleId: string
  projectId: string
  children: React.ReactNode
}) {
  const [project, setProject] = useState<ProjectData | null>(null)
  const [circle, setCircle] = useState<CircleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tabData, setTabDataState] = useState<Record<string, unknown>>({})

  const fetchCore = useCallback(async () => {
    try {
      setError(null)
      const [c, p] = await Promise.all([
        fetch(`/api/circles/${circleId}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch(`/api/circles/${circleId}/projects/${projectId}`).then((r) =>
          r.ok ? r.json() : null,
        ).catch(() => null),
      ])
      setCircle(c)
      setProject(p)
    } catch {
      setError("Failed to load project data")
    } finally {
      setLoading(false)
    }
  }, [circleId, projectId])

  useEffect(() => {
    fetchCore()
  }, [fetchCore])

  const refresh = useCallback(() => {
    setLoading(true)
    fetchCore()
  }, [fetchCore])

  const refreshProject = useCallback(() => {
    fetchCore()
  }, [fetchCore])

  const setTabData = useCallback((key: string, data: unknown) => {
    setTabDataState((prev) => ({ ...prev, [key]: data }))
  }, [])

  const currency = circle?.currency || "ZAR"

  return (
    <ProjectContext.Provider
      value={{ project, circle, currency, loading, error, refresh, refreshProject, tabData, setTabData }}
    >
      {children}
    </ProjectContext.Provider>
  )
}
