"use client"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

// These change local content; route navigation remains links. Manual activation
// lets arrow keys explore sections without changing the user's current form.
export function SectionNavigation<T extends string>({
  items,
  value,
  onValueChange,
  label,
  panelId,
  triggerIdPrefix = panelId,
}: {
  items: { id: T; label: string }[]
  value: T | null
  onValueChange: (value: T) => void
  label: string
  panelId: string
  triggerIdPrefix?: string
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(value) => {
        const item = items.find((item) => item.id === value)
        if (item) onValueChange(item.id)
      }}
    >
      <TabsList
        variant="line"
        aria-label={label}
        activateOnFocus={false}
        className="min-h-9 min-w-0 flex-wrap justify-start gap-6 p-0"
      >
        {items.map((item) => (
          <TabsTrigger
            key={item.id}
            id={`${triggerIdPrefix}-${item.id}`}
            aria-controls={panelId}
            value={item.id}
            className="-mb-px h-9 flex-none rounded-none border-0 border-b border-transparent px-0 py-1 after:hidden data-active:border-foreground"
          >
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
