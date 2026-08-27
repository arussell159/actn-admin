import Image from "next/image"

import { LoginForm } from "@/components/login-form"

export function LoginPage() {
  return (
    <main className="grid min-h-dvh bg-background lg:grid-cols-2">
      <section className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="/month-end" className="flex items-center gap-2 font-medium">
            <Image
              src="/actn-admin-icon.png"
              alt=""
              width={28}
              height={28}
              className="size-7 object-contain"
              priority
            />
            ACTN Admin
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm />
          </div>
        </div>
      </section>
      <section className="relative hidden overflow-hidden bg-muted lg:block">
        <Image
          src="/login-side-image.jpg"
          alt=""
          fill
          sizes="50vw"
          className="object-cover"
          priority
        />
      </section>
    </main>
  )
}
