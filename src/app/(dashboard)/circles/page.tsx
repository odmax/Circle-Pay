import { redirect } from "next/navigation"
import Link from "next/link"
import { Plus, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { auth } from "@/lib/auth"
import { getUserCircles } from "@/lib/services/circle.service"
import { CircleCard } from "@/components/circles/circle-card"

export default async function CirclesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const circles = await getUserCircles(session.user.id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Circles</h1>
          <p className="text-muted-foreground">
            {circles.length > 0
              ? `You belong to ${circles.length} circle${circles.length !== 1 ? "s" : ""}`
              : "Create or join a circle to get started"}
          </p>
        </div>
        <Button
          render={<Link href="/circles/new" />}
          className="rounded-xl bg-brand hover:bg-brand-600"
        >
          <Plus className="mr-2 size-4" />
          New Circle
        </Button>
      </div>

      {circles.length === 0 ? (
        <Card className="rounded-2xl border-border/40">
          <CardHeader>
            <CardTitle className="text-lg">Your Circles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted">
                <Users className="size-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold">No circles yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your first circle and invite members to get started.
              </p>
              <Button
                render={<Link href="/circles/new" />}
                className="mt-4 rounded-xl bg-brand hover:bg-brand-600"
              >
                Create Circle
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {circles.map((circle) => (
            <CircleCard key={circle.id} circle={circle} />
          ))}
        </div>
      )}
    </div>
  )
}
