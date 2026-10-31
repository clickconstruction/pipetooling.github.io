#!/usr/bin/env vite-node
/**
 * `npm run check:calls-ahead`: a client must not call what only a pending migration creates. The
 * client deploys to GitHub Pages on every merge (`deploy.yml`); a migration waits for a hand
 * `supabase db push` (CLAUDE.md → Deploy model). On 2026-10-30 #6473 (v2.6099) merged at 4:46 AM
 * and deployed at 4:57 AM with every clock press routed through `land_field_press`, whose migration
 * was still pending: PostgREST answered 404 (`PGRST202`), the client read it as a refusal, and every
 * clock press on prod was refused until the push. The finder is `src/lib/callsAhead.ts`.
 *
 * Two modes:
 *
 *  - On a pull request (CI's checks job, no flag): the `.rpc('name')` / `.from('name')` calls on the
 *    lines this change wrote whose name a migration this change ADDS creates and no older migration
 *    does, and every call to a function such a migration REPLACES (prod's old body answers until the
 *    push and refuses what only the new body takes: #6474). Each is a `::warning` on its line, the
 *    step summary says what to do, and the pull request gets the label *push right after the merge*
 *    when the token may label it. Never a failure: the
 *    migration cannot be pushed before it is on main, so the PR is right to carry both; the deploy
 *    is what holds. In CI, HEAD is the merge of the change into its base, so the base is HEAD's
 *    first parent; locally, the merge base with origin/main. `--base <ref> --head <ref>` compare
 *    any two commits (every read goes through git, so the working tree need not match).
 *
 *  - `--prod` (deploy.yml's build, before the build): every call in src against the migrations the
 *    prod ledger has not applied, read through the Management API with SUPABASE_ACCESS_TOKEN as
 *    `check-migration-drift.mjs` does. A call to a name only a pending migration creates FAILS the
 *    build, so the client that would 404 never reaches the site (a replaced function is a warning
 *    only: most migrations replace one); `bash scripts/db-push.sh` pushes the migration and
 *    re-runs the deploy. With no token, or the API down, it warns and passes: a blip at Supabase
 *    must not hold every deploy.
 */
import { execFileSync } from 'node:child_process'
import { appendFileSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CALLS_AHEAD_ADVICE, CALLS_AHEAD_LABEL, callsAhead, callsAheadLabelCalls, ghFailureWords, labelAlreadyExists, namesCreatedIn, schemaCallsIn, type CallAhead, type CreatedName, type SchemaCall } from '../src/lib/callsAhead'
import { changedLinesFromDiff } from '../src/lib/pronounOpeners'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MIGRATIONS_DIR = 'supabase/migrations'
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'yewfzhbofbbyvkvtaatw'
const ANNOTATIONS_SHOWN = 10
const inActions = process.env.GITHUB_ACTIONS === 'true'

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }).trim()
}

function tryGit(args: string[]): string | null {
  try {
    return git(args)
  } catch {
    return null
  }
}

function flag(name: string): string | null {
  const i = process.argv.indexOf(name)
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : null
}

/** GitHub's annotation text: one line, its special characters escaped. */
const escapeData = (s: string) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
const escapeProperty = (s: string) => escapeData(s).replace(/:/g, '%3A').replace(/,/g, '%2C')

/** A client source the deploy ships: never a test, a mock, or the generated types. */
const isClientSource = (f: string) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.startsWith('src/test/') && f !== 'src/types/database.ts'
const isMigration = (f: string) => /^supabase\/migrations\/\d{14}_[a-z0-9_]+\.sql$/.test(f)

/** The base to compare against on a pull request, or null when there is nothing to compare. */
function baseRef(): { ref: string; how: string } | null {
  const given = flag('--base')
  if (given) return { ref: given, how: given }
  const event = process.env.GITHUB_EVENT_NAME
  if (event === 'push') return null
  if (event === 'pull_request' || event === 'merge_group') {
    tryGit(['fetch', '-q', '--deepen=1'])
    if (tryGit(['rev-parse', '--verify', 'HEAD^2']) !== null) return { ref: 'HEAD^1', how: "the merge's first parent" }
  }
  if (tryGit(['rev-parse', '--verify', 'origin/main']) === null) tryGit(['fetch', '-q', 'origin', 'main'])
  const base = tryGit(['merge-base', 'origin/main', 'HEAD'])
  if (base) return { ref: base, how: 'the merge base with origin/main' }
  if (tryGit(['rev-parse', '--verify', 'origin/main']) !== null) return { ref: 'origin/main', how: 'origin/main (no merge base reachable)' }
  return null
}

function describe(a: CallAhead): string {
  const what = a.call.kind === 'rpc' ? 'the function' : 'the table or view'
  return a.why === 'missing'
    ? `${a.file}:${a.call.line} calls ${what} ${a.call.name}, which only ${a.migrations.join(' and ')} creates`
    : `${a.file}:${a.call.line} calls ${what} ${a.call.name}, which ${a.migrations.join(' and ')} replaces: prod's old body answers until the push (a refusal when the client now sends what only the new body takes)`
}

const TITLES: Record<CallAhead['why'], string> = { missing: 'Push right after the merge', replaced: 'The old body answers until the push' }

function summary(lines: string[]): void {
  const path = process.env.GITHUB_STEP_SUMMARY
  if (!path) return
  appendFileSync(path, `${lines.join('\n')}\n`)
}

/** Puts the label on the pull request this run checks; says why when it cannot. */
function labelPullRequest(): void {
  if (process.env.GITHUB_EVENT_NAME !== 'pull_request' || !process.env.GITHUB_EVENT_PATH) return
  let number: number | undefined
  try {
    number = (JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')) as { pull_request?: { number?: number } }).pull_request?.number
  } catch {
    number = undefined
  }
  if (!number) return
  // GITHUB_REPOSITORY in Actions; elsewhere gh fills {owner}/{repo} from the checkout.
  const calls = callsAheadLabelCalls(process.env.GITHUB_REPOSITORY || '{owner}/{repo}', number)
  const gh = (args: string[]) => execFileSync('gh', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  const part = (e: unknown, key: 'stdout' | 'stderr' | 'message') => String((e as Record<string, unknown> | null)?.[key] ?? '')
  try {
    let present = true
    try {
      gh(calls.read)
    } catch {
      present = false
    }
    if (!present) {
      try {
        gh(calls.make)
      } catch (e) {
        if (!labelAlreadyExists(part(e, 'stdout'))) throw e
      }
    }
    gh(calls.add)
    console.log(`check-calls-ahead: labelled #${number} "${CALLS_AHEAD_LABEL}".`)
  } catch (e) {
    const reason = ghFailureWords(part(e, 'stdout'), part(e, 'stderr'), part(e, 'message') || String(e))
    console.log(`::warning::check-calls-ahead: could not label #${number} "${CALLS_AHEAD_LABEL}" (${escapeData(reason)}); the warnings above and the step summary stand.`)
  }
}

/** The calls in the client sources named, read from a commit (`ref`) or the working tree (null). */
function callsIn(files: string[], ref: string | null, only?: (file: string, found: SchemaCall[]) => SchemaCall[]): { file: string; calls: SchemaCall[] }[] {
  const out: { file: string; calls: SchemaCall[] }[] = []
  for (const file of files) {
    const source = ref ? (tryGit(['show', `${ref}:${file}`]) ?? '') : readFileSync(resolve(ROOT, file), 'utf8')
    if (!/\.(rpc|from)\s*\(/.test(source)) continue
    const found = schemaCallsIn(source, file)
    const kept = only ? only(file, found) : found
    if (kept.length > 0) out.push({ file, calls: kept })
  }
  return out
}

function createdIn(files: string[], ref: string | null): Map<string, CreatedName[]> {
  const out = new Map<string, CreatedName[]>()
  for (const file of files) {
    const sql = ref ? (tryGit(['show', `${ref}:${file}`]) ?? '') : readFileSync(resolve(ROOT, file), 'utf8')
    out.set(file, namesCreatedIn(sql))
  }
  return out
}

function report(ahead: CallAhead[], level: (a: CallAhead) => 'warning' | 'error'): void {
  let annotated = 0
  for (const a of ahead) {
    console.log(`  ${describe(a)}`)
    if (inActions && annotated < ANNOTATIONS_SHOWN) {
      annotated++
      console.log(`::${level(a)} file=${escapeProperty(a.file)},line=${a.call.line},title=${escapeProperty(TITLES[a.why])}::${escapeData(`${describe(a)}. ${CALLS_AHEAD_ADVICE}`)}`)
    }
  }
}

/** On a pull request: the calls this change writes ahead of a migration it adds. Warns, labels, never fails. */
function checkChange(): number {
  const base = baseRef()
  if (!base) {
    console.log('check-calls-ahead: nothing to compare against (a push to main, or no base reachable).')
    return 0
  }
  const givenHead = flag('--head')
  const head = givenHead ?? 'HEAD'
  // Files are read from the working tree when the head is the checkout (CI), and through git when another commit is named.
  const readRef = givenHead
  const added = (tryGit(['diff', '--name-only', '--diff-filter=A', base.ref, head, '--', MIGRATIONS_DIR]) ?? '').split('\n').map((l) => l.trim()).filter(isMigration)
  if (added.length === 0) {
    console.log(`check-calls-ahead: this change adds no migration against ${base.how}, so no call can be ahead of one.`)
    return 0
  }
  const all = (tryGit(['ls-tree', '-r', '--name-only', head, '--', MIGRATIONS_DIR]) ?? '').split('\n').map((l) => l.trim()).filter(isMigration)
  const older = all.filter((f) => !added.includes(f))
  const pending = createdIn(added, readRef)
  const applied = [...createdIn(older, readRef).values()].flat()
  // A missing name counts on the lines this change wrote; a replaced function counts wherever the
  // client calls it, since the call site is usually older than the change that teaches it new input.
  const changed = (tryGit(['diff', '--name-only', '--diff-filter=AMR', base.ref, head, '--', 'src']) ?? '').split('\n').map((l) => l.trim()).filter(isClientSource)
  const written = new Map(changed.map((file) => [file, changedLinesFromDiff(tryGit(['diff', '-U0', base.ref, head, '--', file]) ?? '')]))
  const sources = (tryGit(['ls-tree', '-r', '--name-only', head, '--', 'src']) ?? '').split('\n').map((l) => l.trim()).filter(isClientSource)
  const ahead = callsAhead(callsIn(sources, readRef), pending, applied).filter((a) => a.why === 'replaced' || written.get(a.file)?.has(a.call.line))
  if (ahead.length === 0) {
    console.log(`check-calls-ahead: ${added.length} migration(s) added, ${changed.length} client file(s) changed against ${base.how}: no call on the lines this change wrote is ahead of a migration it adds, and none it adds replaces a function the client calls.`)
    return 0
  }
  console.log(`\ncheck-calls-ahead: ${ahead.length} call(s) are ahead of a migration this change adds (against ${base.how}):`)
  report(ahead, () => 'warning')
  console.log(`\n${CALLS_AHEAD_ADVICE}`)
  summary([
    `## Push right after the merge`,
    ``,
    `This change's client calls what its migration creates or replaces. ${CALLS_AHEAD_ADVICE}`,
    ``,
    ...ahead.map((a) => `- ${describe(a)}`),
  ])
  labelPullRequest()
  return 0
}

/**
 * The migration versions the prod ledger holds, through the Management API; null when it cannot say.
 * `--ledger <file>` reads them from a file instead, one version per line (a dry run from
 * `supabase migration list`, or the check's own test of a held deploy).
 */
async function appliedVersions(): Promise<Set<string> | null> {
  const ledgerFile = flag('--ledger')
  if (ledgerFile) return new Set(readFileSync(resolve(ROOT, ledgerFile), 'utf8').split('\n').map((l) => l.trim()).filter((l) => /^\d{14}$/.test(l)))
  const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_MGMT_TOKEN
  if (!token) {
    console.log('::warning::check-calls-ahead: no SUPABASE_ACCESS_TOKEN, so the prod ledger cannot be read; the deploy goes on unchecked.')
    return null
  }
  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'select version from supabase_migrations.schema_migrations' }),
    })
    if (!res.ok) {
      console.log(`::warning::check-calls-ahead: the Management API answered HTTP ${res.status} (${(await res.text()).slice(0, 200)}); the deploy goes on unchecked.`)
      return null
    }
    const rows = (await res.json()) as unknown
    if (!Array.isArray(rows) || rows.length === 0) {
      console.log('::warning::check-calls-ahead: the Management API returned no ledger rows; the deploy goes on unchecked.')
      return null
    }
    return new Set(rows.map((r) => String((r as { version: string }).version)))
  } catch (e) {
    console.log(`::warning::check-calls-ahead: the Management API could not be reached (${e instanceof Error ? e.message : String(e)}); the deploy goes on unchecked.`)
    return null
  }
}

/** Before a deploy: every call in src against the migrations prod has not applied. Fails on a call ahead. */
async function checkProd(): Promise<number> {
  const applied = await appliedVersions()
  if (!applied) return 0
  const files = readdirSync(resolve(ROOT, MIGRATIONS_DIR))
    .filter((f) => /^\d{14}_[a-z0-9_]+\.sql$/.test(f))
    .sort()
    .map((f) => `${MIGRATIONS_DIR}/${f}`)
  const version = (f: string) => /(\d{14})_/.exec(f)?.[1] ?? ''
  const pendingFiles = files.filter((f) => !applied.has(version(f)))
  if (pendingFiles.length === 0) {
    console.log(`check-calls-ahead: every migration is on prod (${files.length} files), so no call can be ahead of one.`)
    return 0
  }
  const pending = createdIn(pendingFiles, null)
  const before = [...createdIn(files.filter((f) => applied.has(version(f))), null).values()].flat()
  const sources = (tryGit(['ls-files', 'src']) ?? '').split('\n').map((l) => l.trim()).filter(isClientSource)
  const all = callsAhead(callsIn(sources, null), pending, before)
  // A replaced function is a warning, never a hold: most migrations replace a function the client
  // calls, and the old body usually still answers; the PR's label and its migration doc carry it.
  const replaced = all.filter((a) => a.why === 'replaced')
  if (replaced.length > 0) {
    console.log(`\ncheck-calls-ahead: ${replaced.length} call(s) in src reach a function a pending migration replaces; prod's old body answers until the push:`)
    report(replaced, () => 'warning')
  }
  const ahead = all.filter((a) => a.why === 'missing')
  if (ahead.length === 0) {
    console.log(`check-calls-ahead: ${pendingFiles.length} migration(s) pending on prod (${pendingFiles.map((f) => f.slice(MIGRATIONS_DIR.length + 1)).join(', ')}); no call in src is ahead of them.`)
    return 0
  }
  console.log(`\ncheck-calls-ahead: ${ahead.length} call(s) in src are ahead of a migration prod has not applied. This client would be refused on prod, so the deploy holds:`)
  report(ahead, () => 'error')
  const migrations = [...new Set(ahead.flatMap((a) => a.migrations))].sort()
  console.log(`\nPush ${migrations.join(' and ')} with \`bash scripts/db-push.sh\` from the main checkout; it re-runs this deploy once the push lands (or: gh workflow run deploy.yml --ref main).`)
  summary([
    `## The deploy holds until the push`,
    ``,
    `The client calls what only a pending migration creates, so it would be refused on prod. Push ${migrations.join(' and ')} with \`bash scripts/db-push.sh\` from the main checkout, which re-runs this deploy.`,
    ``,
    ...ahead.map((a) => `- ${describe(a)}`),
  ])
  return 1
}

try {
  process.exit(process.argv.includes('--prod') ? await checkProd() : checkChange())
} catch (e) {
  console.log(`check-calls-ahead: could not run (${e instanceof Error ? e.message : String(e)}).`)
  process.exit(1)
}
