import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { ChevronRight, type LucideIcon } from "lucide-react"

type CardBreadcrumbStep = {
  label: string
  type?: string
  date?: string
  icon: LucideIcon
  complete?: boolean
}

type CardBreadcrumbProps = {
  steps: CardBreadcrumbStep[]
  activeStepIndex: number
}

export default function CardBreadcrumb({
  steps,
  activeStepIndex,
}: CardBreadcrumbProps) {
  return (
    <Breadcrumb>
      <BreadcrumbList className="text-card-foreground w-full flex-nowrap justify-start gap-1 sm:gap-2">
        {steps.map((step, index) => {
          const StepIcon = step.icon
          const isActive = index === activeStepIndex
          const isComplete = step.complete ?? index < activeStepIndex
          const isPaidStep = step.type === "Paid" || step.label === "Paid"
          const isPaidComplete = isPaidStep && isComplete
          const isPaidIncomplete = isPaidStep && !isComplete
          const content = (
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className={
                  isPaidComplete
                    ? "flex size-7 shrink-0 items-center justify-center rounded-full bg-green-600 text-white"
                    : isPaidIncomplete
                    ? "flex size-7 shrink-0 items-center justify-center rounded-full bg-red-600 text-white"
                    : isActive || isComplete
                    ? "flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                    : "flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                }
              >
                <StepIcon className="size-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs sm:text-sm">
                  {step.label}
                </span>
                {step.date ? (
                  <span className="block truncate text-[10px] font-normal text-muted-foreground sm:text-xs">
                    {step.date}
                  </span>
                ) : null}
              </span>
            </span>
          )

          return (
            <div key={step.label} className="contents">
              <BreadcrumbItem className="min-w-0">
                {isActive ? (
                  <BreadcrumbPage className="cursor-pointer font-medium">
                    {content}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href="#" className="cursor-pointer">
                    {content}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {index < steps.length - 1 ? (
                <BreadcrumbSeparator>
                  <ChevronRight className="h-3.5 w-3.5" />
                </BreadcrumbSeparator>
              ) : null}
            </div>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
