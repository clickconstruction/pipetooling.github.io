#!/usr/bin/env node
/**
 * Edge-function drift check: every function directory in supabase/functions/ must exist as a
 * deployed function on the linked Supabase project. CI deploys only the client — edge functions
 * are deployed manually — and stale/missing functions have broken prod three times (create-user,
 * invite-user, stripe-invoice-agreed-write-down). This fails loudly before a user finds the gap.
 *
 * - Repo function missing from prod  -> FAIL (exit 1) with the deploy command to run.
 * - Deployed function not in repo    -> warning only (legacy functions, parallel branches).
 *
 * Uses `supabase functions list` for the deployed side, so auth follows the CLI: a local
 * `supabase login` session, or the SUPABASE_ACCESS_TOKEN env var in CI.
 */

import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

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
  return list.map((f) => f.slug).sort()
}

const repo = repoFunctionSlugs()
const deployed = deployedFunctionSlugs()
const deployedSet = new Set(deployed)
const repoSet = new Set(repo)

const missing = repo.filter((s) => !deployedSet.has(s))
const extras = deployed.filter((s) => !repoSet.has(s))

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
  process.exit(1)
}

console.log(
  `edge-function drift check OK: all ${repo.length} repo functions are deployed (${deployed.length} deployed total).`,
)
