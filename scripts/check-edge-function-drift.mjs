#!/usr/bin/env node
/**
 * Edge-function drift check: every function directory in supabase/functions/ must exist as a
 * deployed function on the linked Supabase project. CI deploys only the client — edge functions
 * are deployed manually — and stale/missing functions have broken prod three times (create-user,
 * invite-user, stripe-invoice-agreed-write-down). This fails loudly before a user finds the gap.
 *
 * - Repo function missing from prod  -> FAIL (exit 1) with the deploy command to run.
 * - Repo function EDITED after its last deploy (v2.1974) -> FAIL (exit 1). Presence alone let
 *   three functions run 4-month-stale code (notify-dispatch-request / notify-estimator-request /
 *   send-report-notification, edited Apr 22–30, caught Aug 21): merged changes that nobody
 *   redeployed. Compares each function dir's last commit date against the deployed `updated_at`,
 *   with a grace window (default 72h, EDGE_DRIFT_GRACE_HOURS) because the normal workflow deploys
 *   from the branch and the squash-merge commit lands days later with a newer date.
 * - `_shared/` edited after the oldest function deploy -> warning only (bundled into importers,
 *   but flagging every function on any shared edit would be too noisy to be believed).
 * - Deployed function not in repo    -> warning only (legacy functions, parallel branches).
 *
 * Uses `supabase functions list` for the deployed side, so auth follows the CLI: a local
 * `supabase login` session, or the SUPABASE_ACCESS_TOKEN env var in CI.
 */

import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const GRACE_MS = Number(process.env.EDGE_DRIFT_GRACE_HOURS || 72) * 3600 * 1000

/** Epoch ms of the last commit touching `path`, or null when untracked/no history. */
function lastCommitMs(path) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%ct', '--', path], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
    return out ? Number(out) * 1000 : null
  } catch {
    return null
  }
}

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'yewfzhbofbbyvkvtaatw'
const FUNCTIONS_DIR = 'supabase/functions'

function repoFunctionSlugs() {
  return readdirSync(FUNCTIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.'))
    .filter((e) => existsSync(join(FUNCTIONS_DIR, e.name, 'index.ts')))
    .map((e) => e.name)
    .sort()
}

function deployedFunctionSlugs() {
  let raw
  try {
    raw = execFileSync(
      'npx',
      ['--yes', 'supabase', 'functions', 'list', '--project-ref', PROJECT_REF, '--output', 'json'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    )
  } catch (e) {
    const stderr = (e.stderr ?? '').toString().slice(0, 500)
    console.error(
      'check-edge-function-drift: `supabase functions list` failed.\n' +
        (stderr ? `${stderr}\n` : '') +
        'Auth: run `npx supabase login` locally, or set the SUPABASE_ACCESS_TOKEN env var ' +
        '(CI: repo secret; create a token at https://supabase.com/dashboard/account/tokens).',
    )
    process.exit(1)
  }
  const list = JSON.parse(raw)
  if (!Array.isArray(list)) throw new Error('Unexpected `supabase functions list` output shape')
  return list
}

const repo = repoFunctionSlugs()
const deployedList = deployedFunctionSlugs()
const deployed = deployedList.map((f) => f.slug).sort()
/** slug -> deployed updated_at (epoch ms; created_at fallback). */
const deployedAtMs = new Map(
  deployedList.map((f) => [f.slug, Number(f.updated_at ?? f.created_at ?? 0)]),
)
const deployedSet = new Set(deployed)
const repoSet = new Set(repo)

const missing = repo.filter((s) => !deployedSet.has(s))
const extras = deployed.filter((s) => !repoSet.has(s))

// Content staleness: repo dir edited after the deployed bundle (plus grace).
const stale = []
for (const slug of repo) {
  const depMs = deployedAtMs.get(slug)
  if (!depMs) continue // missing entirely -> reported by the presence check
  const editMs = lastCommitMs(join(FUNCTIONS_DIR, slug))
  if (editMs != null && editMs - depMs > GRACE_MS) {
    stale.push({
      slug,
      edited: new Date(editMs).toISOString().slice(0, 10),
      deployedOn: new Date(depMs).toISOString().slice(0, 10),
    })
  }
}

const sharedEditMs = lastCommitMs(join(FUNCTIONS_DIR, '_shared'))
if (sharedEditMs != null && deployedAtMs.size > 0) {
  const oldestDeployMs = Math.min(...repo.filter((s) => deployedAtMs.get(s)).map((s) => deployedAtMs.get(s)))
  if (sharedEditMs - oldestDeployMs > GRACE_MS) {
    console.warn(
      `warning: ${FUNCTIONS_DIR}/_shared/ was edited ${new Date(sharedEditMs).toISOString().slice(0, 10)} ` +
        'after some functions last deployed — shared code is bundled at deploy time, so importers may be stale.',
    )
  }
}

if (extras.length > 0) {
  console.warn(
    `warning: deployed but not in this repo checkout (legacy or another branch): ${extras.join(', ')}`,
  )
}

if (missing.length > 0) {
  console.error(
    `\nEDGE FUNCTION DRIFT: ${missing.length} function(s) exist in ${FUNCTIONS_DIR}/ but are NOT deployed to project ${PROJECT_REF}:\n` +
      missing.map((s) => `  - ${s}`).join('\n') +
      '\n\nDeploy with:\n' +
      missing.map((s) => `  npx supabase functions deploy ${s}`).join('\n') +
      '\n',
  )
}

if (stale.length > 0) {
  console.error(
    `\nEDGE FUNCTION DRIFT: ${stale.length} function(s) were edited in the repo AFTER their last deploy ` +
      `(grace ${GRACE_MS / 3600000}h — prod runs older code):\n` +
      stale.map((s) => `  - ${s.slug}  (repo edit ${s.edited}, deployed ${s.deployedOn})`).join('\n') +
      '\n\nRedeploy with:\n' +
      stale.map((s) => `  npx supabase functions deploy ${s.slug}`).join('\n') +
      '\n',
  )
}

if (missing.length > 0 || stale.length > 0) process.exit(1)

console.log(
  `edge-function drift check OK: all ${repo.length} repo functions are deployed and current (${deployed.length} deployed total).`,
)
