import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "relative overflow-hidden rounded-2xl bg-muted before:absolute before:inset-0 before:-translate-x-full before:animate-[skeleton-shimmer_1.45s_ease-in-out_infinite] before:bg-linear-to-r before:from-transparent before:via-background/65 before:to-transparent",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
