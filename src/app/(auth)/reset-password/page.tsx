"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/validations/password-reset"

type TokenState =
  | { status: "loading" }
  | { status: "valid" }
  | { status: "error"; message: string }

function useVerifyToken(token: string | null) {
  const [state, setState] = useState<TokenState>(
    token ? { status: "loading" } : { status: "error", message: "No reset token provided." }
  )

  const verify = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: "", confirmPassword: "" }),
      })
      if (res.status === 400) {
        const data = await res.json()
        if (data.error && data.error !== "Validation failed") {
          setState({ status: "error", message: data.error })
          return
        }
      }
      setState({ status: "valid" })
    } catch {
      setState({ status: "valid" })
    }
  }, [token])

  useEffect(() => {
    verify()
  }, [verify])

  return state
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  )
}

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const tokenState = useVerifyToken(token)

  const [success, setSuccess] = useState(false)
  const [serverError, setServerError] = useState("")

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token: token || "" },
  })

  async function onSubmit(data: ResetPasswordInput) {
    setServerError("")
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, token }),
      })
      const body = await res.json()
      if (!res.ok) {
        setServerError(body.error || "Something went wrong.")
        return
      }
      setSuccess(true)
    } catch {
      setServerError("Something went wrong. Please try again.")
    }
  }

  if (tokenState.status === "loading") {
    return (
      <div className="space-y-6">
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (tokenState.status === "error") {
    return (
      <div className="space-y-6">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <AlertCircle className="size-5" />
            </div>
            <CardTitle className="text-xl">Invalid link</CardTitle>
            <CardDescription>{tokenState.message}</CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-brand hover:underline"
            >
              Request a new reset link
            </Link>
          </CardFooter>
        </Card>
      </div>
    )
  }

  if (success) {
    return (
      <div className="space-y-6">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl bg-brand text-brand-foreground">
              <CheckCircle2 className="size-5" />
            </div>
            <CardTitle className="text-xl">Password updated</CardTitle>
            <CardDescription>
              Your password has been reset successfully.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Link
              href="/login"
              className="text-sm font-medium text-brand hover:underline"
            >
              Sign in with your new password
            </Link>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Link
          href="/login"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to sign in
        </Link>
      </div>
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl bg-brand text-brand-foreground">
            <span className="text-sm font-bold">C</span>
          </div>
          <CardTitle className="text-xl">Set new password</CardTitle>
          <CardDescription>Choose a strong password for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <PasswordInput
                id="password"
                placeholder="Min. 8 chars, upper + lower + number"
                className="rounded-xl"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <PasswordInput
                id="confirmPassword"
                placeholder="Repeat your password"
                className="rounded-xl"
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground space-y-1">
              <p className="font-medium">Password requirements:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>At least 8 characters</li>
                <li>At least one uppercase letter</li>
                <li>At least one lowercase letter</li>
                <li>At least one number</li>
                <li>Passwords must match</li>
              </ul>
            </div>

            {serverError && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {serverError}
              </p>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-brand hover:bg-brand-600"
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Reset Password"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
