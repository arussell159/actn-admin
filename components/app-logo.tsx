import Image from "next/image"
import { cn } from "@/lib/utils"

export function AppLogo({
  className,
  priority = false,
}: {
  className?: string
  priority?: boolean
}) {
  return (
    <Image
      src="/actn-admin-icon.png"
      alt=""
      width={28}
      height={28}
      className={cn("size-7 shrink-0 bg-transparent object-contain", className)}
      priority={priority}
    />
  )
}
