"use client"

import { Label, Switch as HeroSwitch, SwitchGroup } from "@heroui/react"

import { cn } from "@/lib/tiptap-utils"

function Switch({
  className,
  size = "default",
  checked,
  onCheckedChange,
  disabled,
  "aria-label": ariaLabel,
  ...props
}: Omit<
  React.ComponentProps<typeof HeroSwitch>,
  "isSelected" | "onChange" | "size"
> & {
  size?: "sm" | "default"
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <SwitchGroup>
      <HeroSwitch
        {...props}
        isSelected={checked}
        onChange={onCheckedChange}
        isDisabled={disabled}
        size={size === "default" ? "md" : "sm"}
        className={cn(className)}
      >
        <HeroSwitch.Content>
          <HeroSwitch.Control>
            <HeroSwitch.Thumb />
          </HeroSwitch.Control>
          {ariaLabel ? <Label className="sr-only">{ariaLabel}</Label> : null}
        </HeroSwitch.Content>
      </HeroSwitch>
    </SwitchGroup>
  )
}

export { Switch }
