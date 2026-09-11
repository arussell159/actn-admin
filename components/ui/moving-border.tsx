"use client"

import * as React from "react"
import {
  motion,
  useAnimationFrame,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion"

import { cn } from "@/lib/utils"

type MovingBorderContainerProps = React.HTMLAttributes<HTMLElement> & {
  active?: boolean
  as?: React.ElementType
  borderClassName?: string
  borderRadius?: string
  containerClassName?: string
  duration?: number
}

export function Button({
  active = true,
  borderRadius = "1.75rem",
  children,
  as: Component = "button",
  containerClassName,
  borderClassName,
  duration,
  className,
  style,
  ...otherProps
}: MovingBorderContainerProps) {
  if (!active) return <>{children}</>

  return (
    <Component
      className={cn(
        "relative h-16 w-40 overflow-hidden bg-transparent p-px",
        containerClassName
      )}
      {...otherProps}
      style={{ borderRadius, ...style }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ borderRadius: `calc(${borderRadius} * 0.96)` }}
        aria-hidden="true"
      >
        <MovingBorder duration={duration} rx="30%" ry="30%">
          <div
            className={cn(
              "h-24 w-24 bg-[radial-gradient(circle,var(--color-indigo-500)_0%,var(--color-fuchsia-500)_42%,transparent_72%)] opacity-90",
              borderClassName
            )}
          />
        </MovingBorder>
      </div>

      <div
        className={cn(
          "relative flex h-full w-full items-center justify-center border border-border bg-background text-sm text-foreground antialiased",
          className
        )}
        style={{ borderRadius: `calc(${borderRadius} * 0.96)` }}
      >
        {children}
      </div>
    </Component>
  )
}

export function MovingBorder({
  children,
  duration = 2000,
  rx,
  ry,
  ...otherProps
}: React.SVGProps<SVGSVGElement> & {
  children: React.ReactNode
  duration?: number
}) {
  const pathRef = React.useRef<SVGRectElement>(null)
  const progress = useMotionValue(0)
  const reduceMotion = useReducedMotion()

  useAnimationFrame((time) => {
    if (reduceMotion) return
    const length = pathRef.current?.getTotalLength()
    if (length) {
      const pixelsPerMillisecond = length / duration
      progress.set((time * pixelsPerMillisecond) % length)
    }
  })

  const x = useTransform(
    progress,
    (value) => pathRef.current?.getPointAtLength(value).x ?? 0
  )
  const y = useTransform(
    progress,
    (value) => pathRef.current?.getPointAtLength(value).y ?? 0
  )
  const transform = useMotionTemplate`translateX(${x}px) translateY(${y}px) translateX(-50%) translateY(-50%)`

  return (
    <>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        className="absolute h-full w-full"
        width="100%"
        height="100%"
        {...otherProps}
      >
        <rect
          ref={pathRef}
          fill="none"
          width="100%"
          height="100%"
          rx={rx}
          ry={ry}
        />
      </svg>
      <motion.div
        className="absolute top-0 left-0 inline-block"
        style={{ transform }}
      >
        {children}
      </motion.div>
    </>
  )
}
