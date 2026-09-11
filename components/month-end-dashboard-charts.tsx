"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"

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

const monthlyValueChartConfig = {
  amount: { label: "Invoice value", color: "var(--chart-1)" },
} satisfies ChartConfig

function formatCompactDollars(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}

function ChangePill({ change, label }: { change: number; label: string }) {
  return (
    <span
      className={
        change > 0
          ? "rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 tabular-nums dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          : change < 0
            ? "rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 tabular-nums dark:border-red-700 dark:bg-red-950/40 dark:text-red-300"
            : "rounded-full border bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums"
      }
    >
      {change > 0 ? "↑" : change < 0 ? "↓" : "—"} {label}
    </span>
  )
}

export function MonthEndValueByDayChart({
  data,
  invoiceCount,
  previousInvoiceCount,
  previousTotalRevenue,
}: {
  data: Array<{ day: number; amount: number }>
  invoiceCount: number
  previousInvoiceCount: number
  previousTotalRevenue: number
}) {
  const totalRevenue = data.reduce((total, item) => total + item.amount, 0)
  const averageOrderValue = invoiceCount ? totalRevenue / invoiceCount : 0
  const previousAverageOrderValue = previousInvoiceCount
    ? previousTotalRevenue / previousInvoiceCount
    : 0
  const revenueChangePercentage = previousTotalRevenue
    ? ((totalRevenue - previousTotalRevenue) / previousTotalRevenue) * 100
    : undefined
  const averageOrderValueChangePercentage = previousAverageOrderValue
    ? ((averageOrderValue - previousAverageOrderValue) /
        previousAverageOrderValue) *
      100
    : undefined
  const invoiceCountChange = invoiceCount - previousInvoiceCount

  return (
    <Card className="relative gap-0 py-0 shadow-none">
      <CardHeader className="px-4 pt-4 pr-[31rem] pb-3">
        <CardTitle>Invoice Value by Day</CardTitle>
      </CardHeader>
      <div className="absolute top-3 right-4 z-10 flex items-stretch gap-2">
        <div className="rounded-lg border bg-background/95 px-4 py-2 text-right shadow-sm backdrop-blur-sm">
          <div className="text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
            Total Revenue
          </div>
          <div className="flex items-center justify-end gap-2">
            <span className="text-xl font-semibold tabular-nums">
              {formatCompactDollars(totalRevenue)}
            </span>
            {revenueChangePercentage !== undefined ? (
              <ChangePill
                change={revenueChangePercentage}
                label={`${Math.abs(revenueChangePercentage).toFixed(1)}%`}
              />
            ) : null}
          </div>
        </div>
        <div className="rounded-lg border bg-background/95 px-4 py-2 text-right shadow-sm backdrop-blur-sm">
          <div className="text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
            Average Order Value
          </div>
          <div className="flex items-center justify-end gap-2">
            <span className="text-xl font-semibold tabular-nums">
              {formatCompactDollars(averageOrderValue)}
            </span>
            {averageOrderValueChangePercentage !== undefined ? (
              <ChangePill
                change={averageOrderValueChangePercentage}
                label={`${Math.abs(averageOrderValueChangePercentage).toFixed(
                  1
                )}%`}
              />
            ) : null}
          </div>
        </div>
        <div className="rounded-lg border bg-background/95 px-4 py-2 text-right shadow-sm backdrop-blur-sm">
          <div className="text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
            Total Invoices
          </div>
          <div className="flex items-center justify-end gap-2">
            <span className="text-xl font-semibold tabular-nums">
              {invoiceCount.toLocaleString("en-US")}
            </span>
            {previousInvoiceCount ? (
              <ChangePill
                change={invoiceCountChange}
                label={Math.abs(invoiceCountChange).toLocaleString("en-US")}
              />
            ) : null}
          </div>
        </div>
      </div>
      <CardContent className="px-2 pb-3 sm:px-4">
        <ChartContainer
          config={monthlyValueChartConfig}
          className="h-[285px] w-full"
        >
          <BarChart
            accessibilityLayer
            data={data}
            margin={{ top: 8, right: 8, bottom: 0, left: 4 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              interval={0}
              tick={{ fontSize: 10 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              tickFormatter={(value) => formatCompactDollars(Number(value))}
              width={58}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(_label, payload) =>
                    `Day ${Number(payload?.[0]?.payload?.day)}`
                  }
                  formatter={(value) => (
                    <div className="flex flex-1 items-center justify-between gap-4">
                      <span className="text-muted-foreground">
                        Invoice value
                      </span>
                      <span className="font-mono font-medium text-foreground tabular-nums">
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "USD",
                          maximumFractionDigits: 0,
                        }).format(Number(value))}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Bar
              dataKey="amount"
              fill="var(--color-amount)"
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

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
          <ChartContainer
            config={workflowChartConfig}
            className="h-[280px] w-full"
          >
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
