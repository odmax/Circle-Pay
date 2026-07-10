import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Home } from "lucide-react"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <div className="mb-6 flex size-20 items-center justify-center rounded-2xl bg-muted">
        <span className="text-4xl font-bold text-muted-foreground/40">404</span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">The page you're looking for doesn't exist or has been moved.</p>
      <div className="mt-6 flex gap-3">
        <Button render={<Link href="/" />} className="rounded-xl bg-brand hover:bg-brand-600"><Home className="size-4 mr-1" /> Home</Button>
        <Button render={<Link href="/dashboard" />} variant="outline" className="rounded-xl">Dashboard</Button>
      </div>
    </div>
  )
}
