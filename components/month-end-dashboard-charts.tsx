"use client"

import { Bar, BarChart, Pie, PieChart, XAxis, YAxis } from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const workflowChartConfig = {
  progress: { label: "Progress", color: "var(--chart-1)" },
} satisfies ChartConfig

const countryStatusChartConfig = {
  complete: { label: "Complete", color: "var(--primary)" },
  inProgress: {
    label: "In Progress",
    color: "color-mix(in oklch, var(--primary) 55%, var(--background))",
  },
  notStarted: {
    label: "Not Started",
    color: "color-mix(in oklch, var(--primary) 25%, var(--background))",
  },
} satisfies ChartConfig

export function MonthEndDashboardCharts({
  workflowData,
  countryStatusData,
}: {
  workflowData: {
    stage: string
    progress: number
    completed: number
    total: number
  }[]
  countryStatusData: {
    status: string
    value: number
    label: string
    fill: string
  }[]
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(19rem,0.75fr)]">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Workflow Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={workflowChartConfig} className="h-[280px] w-full">
            <BarChart
              accessibilityLayer
              data={workflowData}
              layout="vertical"
              margin={{ left: 12, right: 8 }}
            >
              <XAxis type="number" dataKey="progress" domain={[0, 100]} hide />
              <YAxis
                dataKey="stage"
                type="category"
                axisLine={false}
                tickLine={false}
                tickMargin={10}
                width={112}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(_value, _name, item) => (
                      <div className="flex flex-1 items-center justify-between gap-4">
                        <span className="text-muted-foreground">Completed</span>
                        <span className="font-mono font-medium text-foreground tabular-nums">
                          {item.payload.completed}/{item.payload.total}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Bar dataKey="progress" fill="var(--color-progress)" radius={5} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Country Status</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ChartContainer
            config={countryStatusChartConfig}
            className="mx-auto h-[190px] w-full max-w-[260px]"
          >
            <PieChart accessibilityLayer>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Pie data={countryStatusData} dataKey="value" nameKey="status" />
            </PieChart>
          </ChartContainer>
          <div className="grid gap-2 text-sm">
            {countryStatusData.map((item) => (
              <div
                key={item.status}
                className="flex items-center justify-between gap-3"
              >
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: item.fill }}
                  />
                  {item.label}
                </span>
                <span className="font-medium tabular-nums">{item.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
