"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { LoaderCircleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/client"
import { cn } from "@/lib/utils"

function getLoginErrorMessage(error: { message?: string; code?: string }) {
  const message = error.message || "Login failed."
  const code = error.code || ""

  if (
    code === "invalid_credentials" ||
    /invalid login credentials/i.test(message)
  ) {
    return "The email or password is incorrect. Check the password saved for this user in Supabase."
  }

  if (/email not confirmed/i.test(message)) {
    return "This email is not confirmed in Supabase yet. Open the user in Supabase Auth and confirm the email."
  }

  if (/email provider is disabled/i.test(message)) {
    return "Email/password login is disabled in Supabase. Enable the Email provider in Authentication settings."
  }

  if (/fetch|failed to fetch|network/i.test(message)) {
    return "Could not reach Supabase from this device. Check the deployed Supabase URL/key and try again."
  }

  return message
}

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const searchParams = useSearchParams()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState("")
  const nextPath = searchParams.get("next") || "/month-end"

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError("")

    try {
      if (
        !process.env.NEXT_PUBLIC_SUPABASE_URL ||
        !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      ) {
        setError("Supabase is not configured for this app.")
        return
      }

      const supabase = createClient()
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInError) {
        setError(getLoginErrorMessage(signInError))
        return
      }

      if (!data.session) {
        setError("Sign in succeeded, but no session was returned.")
        return
      }

      window.location.assign(
        nextPath.startsWith("/") && !nextPath.startsWith("//")
          ? nextPath
          : "/month-end"
      )
    } catch (signInError) {
      setError(
        signInError instanceof Error
          ? getLoginErrorMessage(signInError)
          : "Something went wrong while signing in."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={signIn}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Login to your account</h1>
          <p className="text-sm text-balance text-muted-foreground">
            Enter your email below to login to your account
          </p>
        </div>
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder="m@example.com"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </Field>
        {error ? <FieldError>{error}</FieldError> : null}
        <Field>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <LoaderCircleIcon className="animate-spin" />
            ) : null}
            Sign In
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
