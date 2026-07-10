"use client"

import Link from "next/link"
import { PlusCircle, Users, Compass, FolderKanban } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function DashboardQuickActions({ hasCircles }: { hasCircles: boolean }) {
  return (
    <Card className="rounded-2xl border-border/40">
      <CardHeader><CardTitle className="text-lg">Quick Actions</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <Button render={<Link href="/circles/new" />} variant="outline" className="w-full justify-start gap-2 rounded-xl">
          <PlusCircle className="size-4" /> Create a Circle
        </Button>
        {hasCircles && (
          <>
            <Button render={<Link href="/circles" />} variant="outline" className="w-full justify-start gap-2 rounded-xl">
              <Users className="size-4" /> View My Circles
            </Button>
            <Button render={<Link href="/discover" />} variant="outline" className="w-full justify-start gap-2 rounded-xl">
              <Compass className="size-4" /> Discover Circles
            </Button>
          </>
        )}
        <Button render={<Link href="/portfolio" />} variant="outline" className="w-full justify-start gap-2 rounded-xl">
          <FolderKanban className="size-4" /> My Portfolio
        </Button>
      </CardContent>
    </Card>
  )
}
