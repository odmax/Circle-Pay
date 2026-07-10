import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CreateCircleForm } from "@/components/circles/create-circle-form"
import { auth } from "@/lib/auth"

export default async function NewCirclePage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          render={<Link href="/circles" />}
          variant="outline"
          size="icon"
          className="rounded-xl"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Circle</h1>
          <p className="text-muted-foreground">
            Set up a new group for shared finances
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-lg">
        <CreateCircleForm />
      </div>
    </div>
  )
}
