"use client"

import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const chartConfig = {
  newTickets: { label: "New Tickets", color: "#1f4fd8" },
  closedTickets: { label: "Closed Tickets", color: "#22a347" },
} satisfies ChartConfig

export function DashboardTicketVolumeChart({
  data,
}: {
  data: {
    hour: string
    newTickets: number
    closedTickets: number
  }[]
}) {
  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-auto h-[250px] w-full [&_.recharts-bar-rectangle]:cursor-pointer"
      initialDimension={{ width: 900, height: 250 }}
    >
      <ComposedChart data={data} margin={{ left: 4, right: 12 }} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="hour"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={32}
        />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} width={36} />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value, name, item) => (
                <>
                  <div
                    className="size-2.5 shrink-0 rounded-[2px]"
                    style={{ backgroundColor: item.color ?? "currentColor" }}
                  />
                  <span className="text-muted-foreground">
                    {chartConfig[name as keyof typeof chartConfig]?.label ?? name}
                  </span>
                  <span className="ml-auto font-mono font-medium text-foreground tabular-nums">
                    {Math.abs(Number(value)).toLocaleString()}
                  </span>
                </>
              )}
              indicator="dot"
            />
          }
        />
        <Bar
          dataKey="closedTickets"
          fill={chartConfig.closedTickets.color}
          fillOpacity={0.8}
          activeBar={{
            fill: "#2fc85a",
            fillOpacity: 0.18,
            stroke: "#16a34a",
            strokeOpacity: 1,
            strokeWidth: 2,
            filter: "drop-shadow(0 0 6px rgba(34, 163, 71, 0.45))",
          }}
          radius={[4, 4, 0, 0]}
          maxBarSize={32}
        />
        <Line
          dataKey="newTickets"
          type="natural"
          stroke={chartConfig.newTickets.color}
          strokeWidth={3}
          dot={false}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ChartContainer>
  )
}
