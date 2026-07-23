"use client"

import { useState, useEffect, useCallback } from "react"
import type { ProjectData, CircleData, FundingOverviewData } from "./types"

interface UseProjectDataReturn {
  project: ProjectData | null
  circle: CircleData | null
  fundingOverview: FundingOverviewData | null
  loading: boolean
  error: string | null
  refresh: () => void
  refreshTab: (tab: string) => void
  tabData: Record<string, any>
}

export function useProjectData(circleId: string, projectId: string): UseProjectDataReturn {
  const [project, setProject] = useState<ProjectData | null>(null)
  const [circle, setCircle] = useState<CircleData | null>(null)
  const [fundingOverview, setFundingOverview] = useState<FundingOverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tabData, setTabData] = useState<Record<string, any>>({})

  const fetchCore = useCallback(async () => {
    try {
      setError(null)
      const [c, p, f] = await Promise.all([
        fetch(`/api/circles/${circleId}`).then((r) => r.ok ? r.json() : null),
        fetch(`/api/circles/${circleId}/projects/${projectId}`).then((r) => r.ok ? r.json() : null),
        fetch(`/api/circles/${circleId}/projects/${projectId}/funding-overview`).then((r) => r.ok ? r.json() : null).catch(() => null),
      ])
      setCircle(c)
      setProject(p)
      if (f) setFundingOverview(f)
    } catch (e) {
      setError("Failed to load project data")
    } finally {
      setLoading(false)
    }
  }, [circleId, projectId])

  useEffect(() => { fetchCore() }, [fetchCore])

  const fetchTabData = useCallback(async (tab: string) => {
    try {
      const endpoint = getTabEndpoint(tab)
      if (!endpoint) return
      const r = await fetch(`/api/circles/${circleId}/projects/${projectId}/${endpoint}`)
      if (r.ok) {
        const data = await r.json()
        setTabData((prev) => ({ ...prev, [tab]: data }))
      }
    } catch {}
  }, [circleId, projectId])

  const refresh = useCallback(() => {
    setLoading(true)
    fetchCore()
  }, [fetchCore])

  const refreshTab = useCallback((tab: string) => {
    fetchTabData(tab)
  }, [fetchTabData])

  return { project, circle, fundingOverview, loading, error, refresh, refreshTab, tabData }
}

function getTabEndpoint(tab: string): string | null {
  const endpoints: Record<string, string> = {
    funding: "funding-overview",
    contributions: "capital",
    expenses: "expenses",
    assets: "roi",
    revenue: "revenue",
    roi: "roi",
    ownership: "ownership",
    distributions: "distributions",
    shortfall: "shortfall",
    waterfall: "waterfall",
    "financial-statements": "financial-statements",
    timeline: "",
  }
  return endpoints[tab] ?? null
}
