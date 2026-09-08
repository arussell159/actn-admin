import assert from "node:assert/strict"
import test from "node:test"

const environmentKeys = [
  "DEPLOYMENT_VERSION",
  "VERCEL_GIT_COMMIT_SHA",
  "GITHUB_SHA",
]
let configImport = 0

async function deploymentIdFor(environment = {}) {
  const previous = Object.fromEntries(
    environmentKeys.map((key) => [key, process.env[key]])
  )
  try {
    for (const key of environmentKeys) {
      if (environment[key] === undefined) delete process.env[key]
      else process.env[key] = environment[key]
    }
    const { default: config } = await import(
      `../next.config.ts?deployment-test=${configImport++}`
    )
    return config.deploymentId
  } finally {
    for (const key of environmentKeys) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
}

test("the reported Vercel SHA produces a stable deployment ID within Next's limit", async () => {
  const environment = {
    VERCEL_GIT_COMMIT_SHA: "34d6dbe70b0a3f75282b8af0f4537b29f7ecff47",
  }
  const id = await deploymentIdFor(environment)
  assert.match(id, /^[a-f0-9]{32}$/)
  assert.equal(await deploymentIdFor(environment), id)
  assert.equal(
    await deploymentIdFor({ GITHUB_SHA: environment.VERCEL_GIT_COMMIT_SHA }),
    id
  )
})

test("long release versions that share their first 32 characters remain distinct", async () => {
  const prefix = "a".repeat(32)
  const first = await deploymentIdFor({
    DEPLOYMENT_VERSION: `${prefix}-release-1`,
  })
  const second = await deploymentIdFor({
    DEPLOYMENT_VERSION: `${prefix}-release-2`,
  })
  assert.equal(first.length, 32)
  assert.equal(second.length, 32)
  assert.notEqual(first, second)
})

test("valid explicit versions keep their value and environment precedence", async () => {
  const version = "v".repeat(32)
  assert.equal(
    await deploymentIdFor({
      DEPLOYMENT_VERSION: version,
      VERCEL_GIT_COMMIT_SHA: "a".repeat(40),
      GITHUB_SHA: "b".repeat(40),
    }),
    version
  )
  assert.equal(
    await deploymentIdFor({
      VERCEL_GIT_COMMIT_SHA: "vercel",
      GITHUB_SHA: "github",
    }),
    "vercel"
  )
  assert.equal(await deploymentIdFor(), undefined)
})
