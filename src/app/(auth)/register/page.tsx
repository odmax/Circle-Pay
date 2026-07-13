"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { registerSchema, type RegisterInput } from "@/lib/validations/auth"
import { registerUser } from "@/lib/actions/auth"
import { toast } from "sonner"

export default function RegisterPage() {
  const router = useRouter()
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof RegisterInput, string[]>>
  >({})

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  })

  async function onSubmit(data: RegisterInput) {
    setFieldErrors({})

    const formData = new FormData()
    formData.append("name", data.name)
    formData.append("email", data.email)
    formData.append("phone", data.phone || "")
    formData.append("password", data.password)
    formData.append("confirmPassword", data.confirmPassword)

    const result = await registerUser(formData)

    if (!result.success) {
      setFieldErrors(result.error as Record<string, string[]>)
      toast.error("Please fix the errors below")
      return
    }

    toast.success("Account created! Please sign in.")
    router.push("/login")
  }

  const getFieldError = (field: keyof RegisterInput) => {
    const zodErr = errors[field]?.message
    const serverErr = fieldErrors[field]?.[0]
    return zodErr || serverErr
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">← Back to Home</Link>
      </div>
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="text-center">
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl bg-brand text-brand-foreground">
          <span className="text-sm font-bold">C</span>
        </div>
        <CardTitle className="text-xl">Create your account</CardTitle>
        <CardDescription>
          Start managing money with your circles
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="John Doe"
              className="rounded-xl"
              {...register("name")}
            />
            {getFieldError("name") && (
              <p className="text-xs text-destructive">
                {getFieldError("name")}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              className="rounded-xl"
              {...register("email")}
            />
            {getFieldError("email") && (
              <p className="text-xs text-destructive">
                {getFieldError("email")}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">
              Phone{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+2348012345678"
              className="rounded-xl"
              {...register("phone")}
            />
            {getFieldError("phone") && (
              <p className="text-xs text-destructive">
                {getFieldError("phone")}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Min. 8 chars, upper + lower + number"
              className="rounded-xl"
              {...register("password")}
            />
            {getFieldError("password") && (
              <p className="text-xs text-destructive">
                {getFieldError("password")}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Repeat your password"
              className="rounded-xl"
              {...register("confirmPassword")}
            />
            {getFieldError("confirmPassword") && (
              <p className="text-xs text-destructive">
                {getFieldError("confirmPassword")}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-brand hover:bg-brand-600"
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Create Account"
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-brand hover:underline"
          >
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
    </div>
  )
}
