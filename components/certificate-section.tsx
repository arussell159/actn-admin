import type { ReactNode } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function CertificateSection({
  title,
  action,
  children,
  sectionId,
  contentClassName,
}: {
  title: ReactNode
  action?: ReactNode
  children: ReactNode
  sectionId?: string
  contentClassName?: string
}) {
  return (
    <Card
      data-layout-section={sectionId}
      className="gap-0 overflow-hidden rounded-lg border bg-background py-0 shadow-xs ring-0"
    >
      <CardHeader className="flex min-h-10 flex-row items-center justify-between gap-4 rounded-none border-b bg-muted/40 px-4 py-2.5 [.border-b]:pb-2.5">
        <h2 className="text-base leading-6 font-semibold text-foreground">
          {title}
        </h2>
        {action}
      </CardHeader>
      <CardContent
        className={cn(
          "grid min-w-0 gap-x-8 gap-y-6 p-4 sm:p-5",
          contentClassName
        )}
      >
        {children}
      </CardContent>
    </Card>
  )
}
