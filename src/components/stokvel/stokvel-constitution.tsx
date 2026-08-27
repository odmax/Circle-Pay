"use client"

import Link from "next/link"
import { ScrollText, CheckCircle2, AlertTriangle, FileText } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface ConstitutionCardProps {
  circleId: string
  constitution: {
    exists: boolean
    activeVersion: number | null
    status: string | null
    accepted: boolean
    acceptancePercent: number
    conflictCount: number
  }
}

export function StokvelConstitution({ circleId, constitution }: ConstitutionCardProps) {
  if (!constitution.exists) {
    return (
      <Card className="rounded-2xl border-border/40">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ScrollText className="size-4 text-muted-foreground" /> Constitution
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            No constitution yet. Owners can draft and activate a governing constitution.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            render={<Link href={`/circles/${circleId}/constitution`} />}
          >
            <FileText className="size-3.5 mr-1" /> View
          </Button>
        </CardContent>
      </Card>
    )
  }

  const statusColor =
    constitution.status === "ACTIVE"
      ? "text-emerald-600"
      : constitution.status === "PUBLISHED" || constitution.status === "DRAFT"
        ? "text-amber-600"
        : "text-muted-foreground"

  return (
    <Card className="rounded-2xl border-border/40">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ScrollText className="size-4 text-muted-foreground" /> Constitution
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Version {constitution.activeVersion}</span>
          <span className={`text-sm font-medium capitalize ${statusColor}`}>{constitution.status?.toLowerCase()}</span>
        </div>

        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">Acceptance</span>
            <span className={constitution.accepted ? "flex items-center gap-1 text-emerald-600" : "text-muted-foreground"}>
              {constitution.accepted && <CheckCircle2 className="size-3.5" />}
              {constitution.acceptancePercent}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.min(constitution.acceptancePercent, 100)}%` }}
            />
          </div>
        </div>

        {constitution.conflictCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
            <AlertTriangle className="size-3.5 shrink-0" />
            {constitution.conflictCount} rule conflict{constitution.conflictCount > 1 ? "s" : ""} need review
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="rounded-xl w-full"
          render={<Link href={`/circles/${circleId}/constitution`} />}
        >
          <FileText className="size-3.5 mr-1" /> {constitution.accepted ? "View" : "Review & Accept"}
        </Button>
      </CardContent>
    </Card>
  )
}
