export type AgentProfile = {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
  accountActive: boolean
  requestEligibility: boolean
}

export const agentProfiles: AgentProfile[] = [
  {
    id: "agent-eddie-lake",
    firstName: "Eddie",
    lastName: "Lake",
    email: "eddie.lake@africactn.com",
    role: "Main User",
    accountActive: true,
    requestEligibility: true,
  },
  {
    id: "agent-jamik-tashpulatov",
    firstName: "Jamik",
    lastName: "Tashpulatov",
    email: "jamik.tashpulatov@africactn.com",
    role: "Admin",
    accountActive: true,
    requestEligibility: true,
  },
  {
    id: "agent-marius-popa",
    firstName: "Marius",
    lastName: "Popa",
    email: "marius.popa@africactn.com",
    role: "Basic User",
    accountActive: true,
    requestEligibility: true,
  },
  {
    id: "agent-kristal-koski",
    firstName: "Kristal",
    lastName: "Koski",
    email: "kristal.koski@africactn.com",
    role: "Admin",
    accountActive: true,
    requestEligibility: true,
  },
]

export const agentProfileNames = agentProfiles.map((agent) =>
  [agent.firstName, agent.lastName].join(" ")
)

export function getAgentName(agent: AgentProfile) {
  return [agent.firstName, agent.lastName].filter(Boolean).join(" ")
}

export function getAgentProfileUrl(agentName: string) {
  return `/agents/${encodeURIComponent(agentName)}`
}

export function findAgentProfileByName(agentName: string) {
  return agentProfiles.find((agent) => getAgentName(agent) === agentName)
}
