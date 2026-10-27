/**
 * Print the advisory parallel-session ledger (docs/SESSIONS.md): claims on
 * GitHub (every machine), local claims, open PRs by version with collisions,
 * active session cards, with staleness warnings.
 *
 *   npm run sessions
 *   npm run sessions -- --brief   # the paragraph to paste into any agent on any machine, then the board
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import {
  decodeClaimMessage,
  findVersionCollisions,
  isClaimStale,
  parseClaimRefs,
  parseNewestChangelogVersion,
  parseNewestFragmentVersion,
  parsePrTodoNumbers,
  parsePrVersions,
  parseTodoNumbersOnMain,
  type SessionClaim,
} from '../src/lib/sessionClaims'

function git(...args: string[]): string {
  // RECENT_FEATURES.md is ~20k lines — well past execFileSync's 1MB default buffer.
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()
}

export const AGENT_BRIEF = `Before you pick a version number (v2.NNNN), a migration stamp or a new punch-list card's number in this repo, run \`npm run claim\` (or \`npm run claim -- --migration <file>\`, or \`npm run claim -- --todo\`). It reserves the number on GitHub under refs/claims/, so every machine and cloud session sees it; never derive a number from the newest PR title, fragment or card. Run \`npm run sessions\` to see who holds what and which open PRs collide. Ship one change per PR, arm it with \`gh pr merge N --auto\`, and re-arm after every push. Details: docs/SESSIONS.md.`

const brief = process.argv.includes('--brief')
if (brief) console.log(`${AGENT_BRIEF}\n`)

const common = git('rev-parse', '--git-common-dir')
const mainRoot = dirname(isAbsolute(common) ? common : resolve(process.cwd(), common))
const dir = join(mainRoot, '.claude', 'sessions')
const claimsDir = join(dir, 'claims')
const activeDir = join(dir, 'active')

try {
  execFileSync('git', ['fetch', '-q', '--prune', 'origin', 'main', '+refs/claims/*:refs/claims/*'], {
    stdio: 'ignore',
    timeout: 20000,
  })
} catch {
  console.warn('warn: git fetch failed (offline?) — showing the last-fetched state')
}

let mainNewest: number | null = null
try {
  const archive = parseNewestChangelogVersion(git('show', 'origin/main:docs/RECENT_FEATURES.md'))
  const fragments = parseNewestFragmentVersion(
    git('ls-tree', '--name-only', 'origin/main', 'src/content/releaseNotes/', 'docs/recent-features/'),
  )
  mainNewest = Math.max(archive ?? 0, fragments ?? 0) || null
} catch {
  // offline / no origin — status still useful
}
let todosOnMain = new Set<number>()
try {
  todosOnMain = new Set(
    parseTodoNumbersOnMain(
      execFileSync('git', ['grep', '-h', '-E', '^number:', 'origin/main', '--', 'to-dos'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }),
    ),
  )
} catch {
  // offline / no origin — the board still reads
}
const newestTodo = Math.max(0, ...todosOnMain)
console.log(
  `origin/main newest: ${mainNewest != null ? `v2.${mainNewest}` : 'unknown'} · newest punch-list card: ${newestTodo > 0 ? `#${newestTodo}` : 'unknown'}`,
)

const now = Date.now()

console.log('\n— Claims on GitHub (refs/claims/*, every machine) —')
const remote = parseClaimRefs(git('for-each-ref', '--format=%(objectname) %(refname)', 'refs/claims/')).map((c) => {
  let meta: ReturnType<typeof decodeClaimMessage> = null
  try {
    meta = decodeClaimMessage(git('log', '-1', '--format=%B', c.sha))
  } catch {
    meta = null
  }
  return { ...c, branch: meta?.branch ?? '?', claimedAt: meta?.claimedAt ?? '', description: meta?.description }
})
if (remote.length === 0) console.log('(none)')
const order = (c: { version?: number; todo?: number }) => (c.version != null ? c.version : c.todo != null ? 1_000_000 + c.todo : 0)
for (const r of remote.sort((a, b) => order(a) - order(b))) {
  const label = r.version != null ? `v2.${r.version}` : r.todo != null ? `punch-list #${r.todo}` : `migration-${r.migration}`
  const merged = (r.version != null && mainNewest != null && r.version <= mainNewest) || (r.todo != null && todosOnMain.has(r.todo))
  const stale = r.claimedAt && isClaimStale({ version: 0, branch: '', claimedAt: r.claimedAt }, now)
  const flags = [merged ? 'MERGED — sweeps on the next claim' : null, stale ? 'STALE >24h' : null].filter(Boolean).join('; ')
  console.log(`${label} · ${r.branch} · ${r.claimedAt}${r.description ? ` · ${r.description}` : ''}${flags ? `  [${flags}]` : ''}`)
}

console.log('\n— Local claims (this machine) —')
let migrationsOnMain = ''
try {
  migrationsOnMain = git('ls-tree', '--name-only', 'origin/main', 'supabase/migrations/')
} catch {
  /* offline */
}
const claimFiles = existsSync(claimsDir) ? readdirSync(claimsDir).filter((f) => f.endsWith('.json')) : []
const local: Array<SessionClaim & { file: string }> = []
const localTodos: Array<{ version: number; branch: string }> = []
if (claimFiles.length === 0) console.log('(none)')
for (const f of claimFiles.sort()) {
  try {
    const c = JSON.parse(readFileSync(join(claimsDir, f), 'utf8')) as SessionClaim & { todo?: number }
    if (f.startsWith('v2.')) local.push({ ...c, file: f })
    if (f.startsWith('todo-') && c.todo != null) localTodos.push({ version: c.todo, branch: c.branch })
    const merged = f.startsWith('migration-')
      ? migrationsOnMain.includes(String(c.version))
      : f.startsWith('todo-')
        ? c.todo != null && todosOnMain.has(c.todo)
        : mainNewest != null && c.version <= mainNewest
    const onGitHub = f.startsWith('migration-')
      ? remote.some((r) => r.migration === String(c.version))
      : f.startsWith('todo-')
        ? remote.some((r) => r.todo === c.todo)
        : remote.some((r) => r.version === c.version)
    const flags = [
      merged ? 'MERGED — auto-releases on next claim' : null,
      isClaimStale(c, now) ? 'STALE >24h — ignore if its session is gone' : null,
      !onGitHub && !merged && !isClaimStale(c, now) ? 'NOT ON GITHUB — other machines cannot see it; run `npm run claim` once online' : null,
    ]
      .filter(Boolean)
      .join('; ')
    console.log(
      `${f.replace('.json', '')} · ${c.branch} · claimed ${c.claimedAt}${c.description ? ` · ${c.description}` : ''}${flags ? `  [${flags}]` : ''}`,
    )
  } catch {
    console.log(`${f} (unreadable)`)
  }
}

console.log('\n— Open PRs by version —')
try {
  const raw = execFileSync('gh', ['pr', 'list', '--state', 'open', '--limit', '100', '--json', 'number,title,headRefName'], {
    encoding: 'utf8',
    timeout: 20000,
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  const open = JSON.parse(raw) as Array<{ number: number; title: string; headRefName: string }>
  const prs = parsePrVersions(open)
  if (prs.length === 0) console.log('(none)')
  for (const p of prs.sort((a, b) => a.version - b.version)) console.log(`v2.${p.version} · #${p.number} · ${p.branch}`)
  // A to-do PR's title names its card; a number past main's newest card is a card being written.
  const todoPrs = parsePrTodoNumbers(open)
    .filter((p) => p.todo > newestTodo)
    .map((p) => ({ version: p.todo, number: p.number, branch: p.branch, title: p.title }))
  console.log('\n— Open PRs writing a new punch-list card —')
  if (todoPrs.length === 0) console.log('(none)')
  for (const p of todoPrs.sort((a, b) => a.version - b.version)) console.log(`#${p.version} · #${p.number} · ${p.branch}`)
  const claims = [
    ...remote.filter((r) => r.version != null).map((r) => ({ version: r.version as number, branch: r.branch })),
    ...local.map((c) => ({ version: c.version, branch: c.branch })),
  ]
  const todoClaims = [
    ...remote.filter((r) => r.todo != null).map((r) => ({ version: r.todo as number, branch: r.branch })),
    ...localTodos,
  ]
  const collisions = findVersionCollisions(prs, claims).filter((c) => c.kind !== 'unclaimed')
  const todoCollisions = findVersionCollisions(todoPrs, todoClaims).filter((c) => c.kind !== 'unclaimed')
  if (collisions.length > 0 || todoCollisions.length > 0) {
    console.log('\n— COLLISIONS — fix before these land —')
    for (const c of collisions) {
      console.log(
        c.kind === 'two-prs'
          ? `v2.${c.version} is on two open PRs: ${c.detail} — the second to land fails the release-notes test; renumber one with npm run claim`
          : `v2.${c.version} is on ${c.detail} — that branch will open a duplicate; give one of them a fresh claim`,
      )
    }
    for (const c of todoCollisions) {
      console.log(
        c.kind === 'two-prs'
          ? `punch-list #${c.version} is on two open PRs: ${c.detail} — the second to land fails check:todos; renumber one with npm run claim -- --todo`
          : `punch-list #${c.version} is on ${c.detail} — that branch will open a duplicate; give one of them a fresh claim`,
      )
    }
  }
} catch {
  console.log('(gh pr list failed — no gh, or not signed in)')
}

console.log('\n— Active session cards —')
const cards = existsSync(activeDir) ? readdirSync(activeDir).filter((f) => f.endsWith('.md')) : []
if (cards.length === 0) console.log('(none)')
for (const f of cards.sort()) {
  const p = join(activeDir, f)
  const ageDays = (now - statSync(p).mtimeMs) / (24 * 60 * 60 * 1000)
  const head = readFileSync(p, 'utf8').split('\n').slice(0, 6).join('\n  ')
  console.log(`\n${f}${ageDays > 3 ? '  [STALE >3d — probably done]' : ''}\n  ${head}`)
}
