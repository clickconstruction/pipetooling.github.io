#!/usr/bin/env node
/**
 * Asserts ci.yml (the PR gate) and deploy.yml (the main-push gate) run the
 * SAME check commands, so a check added to one can never be missed by the
 * other. That exact split shipped a raw-tz literal green through PRs and then
 * failed every deploy from v2.965 to v2.985 (fixed in v2.986).
 *
 * Rule: the multiset of `run:` commands in ci.yml's `checks` job must equal
 * deploy.yml's `checks` job. Build/deploy jobs are ignored.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Extract `run:` command lines from the `checks:` job of a workflow file. */
function checksJobRuns(file) {
  const text = fs.readFileSync(path.join(ROOT, '.github', 'workflows', file), 'utf8')
  const lines = text.split('\n')
  const jobsIdx = lines.findIndex((l) => /^jobs:\s*$/.test(l))
  if (jobsIdx === -1) throw new Error(`${file}: no jobs: block`)
  const runs = []
  let inChecks = false
  for (let i = jobsIdx + 1; i < lines.length; i++) {
    const l = lines[i]
    const jobHeader = /^  (\w[\w-]*):\s*$/.exec(l)
    if (jobHeader) {
      inChecks = jobHeader[1] === 'checks'
      continue
    }
    if (!inChecks) continue
    const m = /^\s+run:\s+(.+?)\s*$/.exec(l)
    if (m) runs.push(m[1])
  }
  if (runs.length === 0) throw new Error(`${file}: no run: lines found in checks job`)
  return runs
}

const ci = checksJobRuns('ci.yml')
const deploy = checksJobRuns('deploy.yml')

const count = (arr) => {
  const m = new Map()
  for (const x of arr) m.set(x, (m.get(x) ?? 0) + 1)
  return m
}
const a = count(ci)
const b = count(deploy)
const missingInCi = [...b.keys()].filter((k) => (a.get(k) ?? 0) < b.get(k))
const missingInDeploy = [...a.keys()].filter((k) => (b.get(k) ?? 0) < a.get(k))

if (missingInCi.length || missingInDeploy.length) {
  console.error('Workflow check parity FAILED — ci.yml and deploy.yml must run identical checks.')
  for (const k of missingInCi) console.error(`  deploy.yml runs but ci.yml does NOT: ${k}`)
  for (const k of missingInDeploy) console.error(`  ci.yml runs but deploy.yml does NOT: ${k}`)
  console.error('Add the missing step to the other workflow (see v2.965–v2.985 deploy outage).')
  process.exit(1)
}
console.log(`workflow check parity OK: ${ci.length} check commands identical in ci.yml and deploy.yml.`)
