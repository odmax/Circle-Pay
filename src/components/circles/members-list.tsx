"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Loader2,
  UserMinus,
  Shield,
  ShieldOff,
  Copy,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { RoleBadge } from "./role-badge"
import { addMemberSchema, type AddMemberInput } from "@/lib/validations/circles"
import type { CircleMemberWithUser } from "@/types"
import type { MemberRole } from "@/generated/prisma"
import { toast } from "sonner"

export function MembersList({
  members,
  circleId,
  userRole,
}: {
  members: CircleMemberWithUser[]
  circleId: string
  userRole: MemberRole | null
}) {
  const router = useRouter()
  const [removingId, setRemovingId] = useState<string | null>(null)

  async function handleRemove(memberId: string, memberName: string) {
    if (!confirm(`Remove ${memberName} from this circle?`)) return
    setRemovingId(memberId)

    try {
      const res = await fetch(
        `/api/circles/${circleId}/members/${memberId}`,
        { method: "DELETE" }
      )
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Failed to remove member")
        return
      }
      toast.success(`${memberName} removed`)
      router.refresh()
    } catch {
      toast.error("Something went wrong")
    } finally {
      setRemovingId(null)
    }
  }

  async function handleRoleChange(memberId: string, newRole: string, memberName: string) {
    try {
      const res = await fetch(
        `/api/circles/${circleId}/members/${memberId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        }
      )
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Failed to update role")
        return
      }
      toast.success(`${memberName} is now ${newRole === "ADMIN" ? "an Admin" : "a Member"}`)
      router.refresh()
    } catch {
      toast.error("Something went wrong")
    }
  }

  const canManage = userRole === "OWNER" || userRole === "ADMIN"
  const isOwner = userRole === "OWNER"

  return (
    <div className="space-y-2">
      {members.map((member) => {
        const initials = member.user.name
          ? member.user.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)
          : "??"

        return (
          <div
            key={member.id}
            className="flex items-center gap-3 rounded-xl border border-border/40 bg-card p-3"
          >
            <Avatar className="size-10">
              <AvatarImage src={member.user.image || ""} />
              <AvatarFallback className="bg-brand-50 text-brand-700 text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {member.user.name || member.user.email}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {member.user.email}
              </p>
            </div>
            <RoleBadge role={member.role} />
            {canManage && member.role !== "OWNER" && (
              <div className="flex items-center gap-1">
                <Select
                  value={member.role}
                  onValueChange={(v) => {
                    if (!v) return
                    handleRoleChange(
                      member.id,
                      v,
                      member.user.name || member.user.email
                    )
                  }}
                >
                  <SelectTrigger className="h-7 w-7 rounded-lg p-0 [&>svg]:hidden">
                    <span className="sr-only">Change role</span>
                    {member.role === "ADMIN" ? (
                      <ShieldOff className="size-3.5" />
                    ) : (
                      <Shield className="size-3.5" />
                    )}
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="MEMBER">Member</SelectItem>
                  </SelectContent>
                </Select>
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded-lg text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      handleRemove(
                        member.id,
                        member.user.name || member.user.email
                      )
                    }
                    disabled={removingId === member.id}
                  >
                    {removingId === member.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <UserMinus className="size-3.5" />
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function InviteSection({
  inviteCode,
  circleId,
  canInvite,
}: {
  inviteCode: string
  circleId: string
  canInvite: boolean
}) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)

  const inviteLink = `${
    process.env.NEXT_PUBLIC_APP_URL || window.location.origin
  }/circles/join/${inviteCode}`

  function handleCopy() {
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddMemberInput>({
    resolver: zodResolver(addMemberSchema),
    defaultValues: { role: "MEMBER" },
  })

  async function onSubmit(data: AddMemberInput) {
    try {
      const res = await fetch(`/api/circles/${circleId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "Failed to add member")
        return
      }
      toast.success("Member added!")
      reset()
      router.refresh()
    } catch {
      toast.error("Something went wrong")
    }
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Invite Code</CardTitle>
          <CardDescription>
            Share this code to let people join your circle
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 select-all rounded-lg bg-muted px-4 py-2.5 text-center text-lg font-mono font-bold tracking-widest text-brand">
              {inviteCode}
            </code>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 rounded-xl"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="size-4 text-brand" />
              ) : (
                <Copy className="size-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {canInvite && (
        <Card className="rounded-2xl border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Invite by Email</CardTitle>
            <CardDescription>
              Add members directly by their registered email
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="friend@example.com"
                  className="rounded-xl"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Select
                  defaultValue="MEMBER"
                  onValueChange={(v) =>
                    register("role").onChange({
                      target: { value: v, name: "role" },
                    })
                  }
                >
                  <SelectTrigger className="w-32 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MEMBER">Member</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 rounded-xl bg-brand hover:bg-brand-600"
                >
                  {isSubmitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Add Member"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
