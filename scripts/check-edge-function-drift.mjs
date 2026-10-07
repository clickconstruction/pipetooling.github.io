#!/usr/bin/env node
/**
 * Edge-function drift check: every function directory in supabase/functions/ must exist as a
 * deployed function on the linked Supabase project, running this checkout's code. CI deploys only
 * the client — edge functions are deployed manually — and stale/missing functions have broken prod
 * three times (create-user, invite-user, stripe-invoice-agreed-write-down). This fails loudly before
 * a user finds the gap.
 *
 * - Repo function missing from prod  -> FAIL (exit 1) with the deploy command to run.
 * - Repo function running OLDER code than this checkout -> FAIL (exit 1), naming the files that
 *   differ and the commits since its deploy. A function's code is its bundle — index.ts plus every
 *   relative import, transitively — so a `_shared/` edit names each importer still on the old copy
 *   (v2.4738). A function whose bundle has commits newer than its deployed `updated_at` is checked
 *   by downloading the deployed source (`supabase functions download --use-api`), so a deploy made
 *   from the branch before its squash-merge passes as byte-identical and no grace window hides a
 *   real one. If the download fails, commit dates decide, with a grace (default 72h,
 *   EDGE_DRIFT_GRACE_HOURS) for that deploy-before-merge.
 * - `--full` downloads every function, not just those changed since their deploy, to catch a deploy
 *   made from an old tree after the change merged. The daily run uses it.
 * - Deployed source this checkout's history never had -> warning only (a branch deployed before
 *   it merged; redeploy once it does).
 * - verify_jwt in prod differs from what a plain deploy would set (config.toml) -> warning only.
 *   The printed redeploy command keeps prod's setting.
 * - Deployed function not in repo    -> warning only (legacy functions, parallel branches).
 *
 * Uses the supabase CLI for the deployed side, so auth follows the CLI: a local `supabase login`
 * session, or the SUPABASE_ACCESS_TOKEN env var in CI.
 */

import { readdirSync, existsSync, readFileSync, statSync, mkdtempSync, rmSync } from 'node:fs'
import { join, relative } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import {
  commitsByFile,
  commitsSince,
  compareBundles,
  configVerifyJwt,
  historyBlobIds,
  walkBundle,
} from './lib/edgeBundle.mjs'

const GRACE_MS = Number(process.env.EDGE_DRIFT_GRACE_HOURS || 72) * 3600 * 1000
const FULL = process.argv.includes('--full')
const DOWNLOAD_JOBS = 4

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'yewfzhbofbbyvkvtaatw'
const FUNCTIONS_DIR = 'supabase/functions'

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
}

function repoFunctionSlugs() {
  return readdirSync(FUNCTIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.'))
    .filter((e) => existsSync(join(FUNCTIONS_DIR, e.name, 'index.ts')))
    .map((e) => e.name)
    .sort()
}

function deployedFunctionList() {
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

function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? listFiles(path) : [path]
  })
}

/** The deployed source of `slug` as repo-relative path -> bytes (one temp dir per function: `_shared` differs per deploy). */
async function deployedBundle(slug) {
  const dir = mkdtempSync(join(tmpdir(), 'edge-drift-'))
  try {
    await promisify(execFile)(
      'npx',
      ['--yes', 'supabase', 'functions', 'download', slug, '--project-ref', PROJECT_REF, '--use-api', '--workdir', dir],
      { cwd: dir, maxBuffer: 64 * 1024 * 1024 },
    )
    const base = join(dir, FUNCTIONS_DIR)
    if (!existsSync(base)) throw new Error('the download wrote no files')
    return new Map(listFiles(base).map((p) => [join(FUNCTIONS_DIR, relative(base, p)), readFileSync(p)]))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const day = (ms) => new Date(ms).toISOString().slice(0, 10)
const short = (path) => path.replace(`${FUNCTIONS_DIR}/`, '')

const repo = repoFunctionSlugs()
const deployedList = deployedFunctionList()
const deployed = deployedList.map((f) => f.slug).sort()
const deployedBySlug = new Map(deployedList.map((f) => [f.slug, f]))
const deployedSet = new Set(deployed)
const repoSet = new Set(repo)

const missing = repo.filter((s) => !deployedSet.has(s))
const extras = deployed.filter((s) => !repoSet.has(s))

// Each function's bundle, and the commits since its deploy that touch any file in it.
const fsio = { readFile: (p) => readFileSync(p, 'utf8'), exists: (p) => existsSync(p) && statSync(p).isFile() }
const byFile = commitsByFile(git('log', '--format=@%ct%x09%h%x09%s', '--name-only', '--', FUNCTIONS_DIR))
const checks = []
for (const slug of repo) {
  const fn = deployedBySlug.get(slug)
  if (!fn) continue // missing entirely -> reported by the presence check
  const bundle = walkBundle(process.cwd(), join(FUNCTIONS_DIR, slug, 'index.ts'), fsio)
  for (const u of bundle.unresolved) console.warn(`warning: ${slug} imports a file that is not in the repo: ${u}`)
  const deployedMs = Number(fn.updated_at ?? fn.created_at ?? 0)
  const since = commitsSince(bundle.files, byFile, deployedMs)
  if (FULL || since.length > 0) checks.push({ slug, fn, deployedMs, files: bundle.files, since })
}

// Read what is deployed for each one, a few at a time.
const historyBlobs = historyBlobIds(git('log', '--format=', '--raw', '--no-abbrev', '--', FUNCTIONS_DIR))
let nextCheck = 0
async function downloadWorker() {
  while (nextCheck < checks.length) {
    const check = checks[nextCheck++]
    try {
      const repoBytes = new Map(check.files.map((p) => [p, readFileSync(p)]))
      check.result = compareBundles(repoBytes, await deployedBundle(check.slug), historyBlobs)
    } catch (e) {
      check.error = String(e.stderr || e.message || e).trim().split('\n').pop().slice(0, 200)
    }
  }
}
await Promise.all(Array.from({ length: DOWNLOAD_JOBS }, downloadWorker))

const stale = checks.filter(
  (c) => c.result?.state === 'behind' || (c.error && c.since.length > 0 && c.since[0].ms - c.deployedMs > GRACE_MS),
)
const elsewhere = checks.filter((c) => c.result?.state === 'elsewhere')
const unverified = checks.filter((c) => c.error && !stale.includes(c))

// What a plain `supabase functions deploy` would set vs what prod has.
const configJwt = configVerifyJwt(readFileSync('supabase/config.toml', 'utf8'), repo)
const jwtDrift = repo
  .filter((s) => deployedBySlug.has(s) && Boolean(deployedBySlug.get(s).verify_jwt) !== configJwt.get(s))
  .map((s) => ({ slug: s, prod: Boolean(deployedBySlug.get(s).verify_jwt), config: configJwt.get(s) }))
const keepsProdJwt = (slug) => (jwtDrift.some((d) => d.slug === slug && !d.prod) ? ' --no-verify-jwt' : '')

if (extras.length > 0) {
  console.warn(
    `warning: deployed but not in this repo checkout (legacy or another branch): ${extras.join(', ')}`,
  )
}

if (jwtDrift.length > 0) {
  console.warn(
    'warning: verify_jwt in prod differs from config.toml, so a plain `supabase functions deploy` would change ' +
      'the gateway check for:\n' +
      jwtDrift.map((d) => `  - ${d.slug}  (prod ${d.prod}, config.toml ${d.config})`).join('\n'),
  )
}

if (elsewhere.length > 0) {
  console.warn(
    "warning: deployed code this checkout's history never had (a branch deployed before it merged?) — " +
      'redeploy once it merges, or from main if it was dropped:\n' +
      elsewhere.map((c) => `  - ${c.slug}  (deployed ${day(c.deployedMs)} v${c.fn.version}): ${c.result.foreign.map(short).join(', ')}`).join('\n'),
  )
}

if (unverified.length > 0) {
  console.warn(
    'warning: could not read the deployed source, so commit dates decided (grace ' +
      `${GRACE_MS / 3600000}h):\n` +
      unverified.map((c) => `  - ${c.slug}: ${c.error}`).join('\n'),
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
  const describe = (c) => {
    const r = c.result
    const files = r
      ? [...r.changed.map(short), ...r.added.map((p) => `+${short(p)}`), ...r.dropped.map((p) => `-${short(p)}`)]
      : [...new Set(c.since.flatMap((s) => c.files.filter((f) => byFile.get(f)?.includes(s))).map(short))]
    const why =
      c.since.length > 0
        ? c.since.map((s) => `      ${s.hash} ${day(s.ms)} ${s.subject}`).join('\n')
        : '      (no commit since the deploy: it was made from an older tree)'
    return `  - ${c.slug}  (deployed ${day(c.deployedMs)} v${c.fn.version}${r ? '' : ', judged by commit dates'}): ${files.join(', ')}\n${why}`
  }
  console.error(
    `\nEDGE FUNCTION DRIFT: ${stale.length} function(s) run older code than this checkout ` +
      '(their bundle is index.ts and every file it imports, _shared included):\n' +
      stale.map(describe).join('\n') +
      '\n\nRedeploy with:\n' +
      stale.map((c) => `  npx supabase functions deploy ${c.slug}${keepsProdJwt(c.slug)}`).join('\n') +
      '\n',
  )
}

if (missing.length > 0 || stale.length > 0) process.exit(1)

console.log(
  `edge-function drift check OK: all ${repo.length} repo functions are deployed and current ` +
    `(${checks.length - unverified.length} checked against the deployed source${FULL ? ', --full' : ''}; ${deployed.length} deployed total).`,
)
