"use client"

import { Badge } from "@/components/ui/badge"
import { AppLink } from "@/components/app-link"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getAgentProfileUrl } from "@/lib/agents"
import { TrophyIcon } from "lucide-react"

type CertificateActivity = {
  agent: string
  invoiceNumber: string
}

type CertificateLeaderboardCardProps = {
  data: CertificateActivity[]
}

export function CertificateLeaderboardCard({
  data,
}: CertificateLeaderboardCardProps) {
  const certificateLeaders = Object.entries(
    data.reduce<Record<string, number>>((agentCounts, item) => {
      if (!item.invoiceNumber || item.agent === "Assign agent") {
        return agentCounts
      }

      agentCounts[item.agent] = (agentCounts[item.agent] ?? 0) + 1
      return agentCounts
    }, {})
  )
    .sort(([, certificateCountA], [, certificateCountB]) => {
      return certificateCountB - certificateCountA
    })
    .slice(0, 4)

  return (
    <Card className="@container/card h-full">
      <CardHeader>
        <CardDescription>Certificate Leaderboard</CardDescription>
        <CardTitle className="text-2xl font-semibold @[250px]/card:text-3xl">
          Top Agents
        </CardTitle>
        <CardAction>
          <Badge variant="outline">
            <TrophyIcon />
            Today
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {certificateLeaders.map(([agent, certificateCount], index) => (
          <div key={agent} className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums">
                {index + 1}
              </span>
              <AppLink
                href={getAgentProfileUrl(agent)}
                className="truncate font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/40"
              >
                {agent}
              </AppLink>
            </div>
            <span className="text-muted-foreground shrink-0 tabular-nums">
              {certificateCount}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
