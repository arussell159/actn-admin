import "server-only"

import fs from "node:fs"
import path from "node:path"

function envPath() {
  return path.join(process.cwd(), ".env.local")
}

export function updateLocalEnvValue(name: string, value: string) {
  const filePath = envPath()
  const existing = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, "utf8").split(/\r?\n/)
    : []
  const nextLine = `${name}=${value}`
  let didUpdate = false
  const nextLines = existing.map((line) => {
    if (!line.match(new RegExp(`^\\s*${name}\\s*=`))) {
      return line
    }

    didUpdate = true
    return nextLine
  })

  if (!didUpdate) {
    if (nextLines.length && nextLines.at(-1)?.trim()) {
      nextLines.push("")
    }

    nextLines.push(nextLine)
  }

  fs.writeFileSync(filePath, nextLines.join("\n"))
}
