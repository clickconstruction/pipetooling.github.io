/**
 * Advisory version/migration claim for parallel sessions (docs/SESSIONS.md).
 *
 *   npm run claim                      # claim the next free v2.NNN, print it
 *   npm run claim -- --migration supabase/migrations/20260804120000_foo.sql
 *   npm run claim -- --release v2.NNN  # release a claim you no longer need
 *   npm run claim -- --branch <name> … # claim on behalf of another branch (the queue guide)
 *
 * GitHub is the ledger. A claim is a ref `refs/claims/v2.NNNN` (or
 * `refs/claims/migration-<stamp>`) on origin, pointing at a parentless
 * empty-tree commit whose message is the claim JSON; the push uses
 * `--force-with-lease=<ref>:` (expect absent), so two machines can never win
 * the same number. The gitignored `.claude/sessions/claims/` file in the MAIN
 * checkout (worktrees resolve there via `git rev-parse --git-common-dir`) is
 * kept as the fast local mirror, and open PR titles (`gh pr list`) count as
 * claims too, so a PR numbered by hand on another machine is still dodged.
 * Claims at or below main's newest version are auto-released on every run.
 * Advisory only — nothing enforces it.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import {
  branchSlug,
  claimRefName,
  decodeClaimMessage,
  encodeClaimMessage,
  nextClaimCandidate,
  parseClaimRefs,
  parseMigrationVersion,
  parseNewestChangelogVersion,
  parseNewestFragmentVersion,
  parseNewestReleaseNotesVersion,
  parsePrVersions,
  partitionMergedClaims,
  parseVersionNumber,
  type MigrationClaim,
  type RemoteClaim,
  type SessionClaim,
} from '../src/lib/sessionClaims'

function git(...args: string[]): string {
  // RECENT_FEATURES.md is ~20k lines — well past execFileSync's 1MB default buffer.
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()
}

function sessionsDir(): string {
  const common = git('rev-parse', '--git-common-dir')
  const mainRoot = dirname(isAbsolute(common) ? common : resolve(process.cwd(), common))
  const dir = join(mainRoot, '.claude', 'sessions')
  mkdirSync(join(dir, 'claims'), { recursive: true })
  mkdirSync(join(dir, 'active'), { recursive: true })
  return dir
}

let online = true

/** One fetch for everything the allocation reads: main and the claim refs (pruned). */
function fetchLedger(): void {
  try {
    execFileSync('git', ['fetch', '-q', '--prune', 'origin', 'main', '+refs/claims/*:refs/claims/*'], {
      stdio: 'ignore',
      timeout: 20000,
    })
  } catch {
    online = false
    console.warn('warn: git fetch failed (offline?) — using the last-fetched origin/main and claim refs')
  }
}

function mainNewestVersion(): number {
  // Tolerant of either side of the fragments cutover: the archive file only
  // exists after it, the old monolithic releaseNotes.ts only parses before it,
  // and ls-tree of a not-yet-existing fragments dir is just empty.
  const showOrEmpty = (path: string): string => {
    try {
      return git('show', `origin/main:${path}`)
    } catch {
      return ''
    }
  }
  const changelog = parseNewestChangelogVersion(showOrEmpty('docs/RECENT_FEATURES.md'))
  const notes = parseNewestReleaseNotesVersion(
    showOrEmpty('src/content/releaseNotesArchive.ts') || showOrEmpty('src/content/releaseNotes.ts'),
  )
  const fragments = parseNewestFragmentVersion(
    git('ls-tree', '--name-only', 'origin/main', 'src/content/releaseNotes/', 'docs/recent-features/'),
  )
  const newest = Math.max(changelog ?? 0, notes ?? 0, fragments ?? 0)
  if (newest === 0) throw new Error('could not parse newest version from origin/main')
  return newest
}

function readClaims(claimsDir: string): Array<SessionClaim & { file: string }> {
  const out: Array<SessionClaim & { file: string }> = []
  for (const f of readdirSync(claimsDir)) {
    if (!f.startsWith('v2.') || !f.endsWith('.json')) continue
    try {
      out.push({ ...(JSON.parse(readFileSync(join(claimsDir, f), 'utf8')) as SessionClaim), file: f })
    } catch {
      console.warn(`warn: unreadable claim file ${f} (ignored)`)
    }
  }
  return out
}

/** The claim refs as fetched, each with the branch its commit message names. */
export function readRemoteClaims(): Array<RemoteClaim & { branch?: string; claimedAt?: string }> {
  let listing = ''
  try {
    listing = git('for-each-ref', '--format=%(objectname) %(refname)', 'refs/claims/')
  } catch {
    return []
  }
  return parseClaimRefs(listing).map((c) => {
    let meta: ReturnType<typeof decodeClaimMessage> = null
    try {
      meta = decodeClaimMessage(git('log', '-1', '--format=%B', c.sha))
    } catch {
      meta = null
    }
    return { ...c, branch: meta?.branch, claimedAt: meta?.claimedAt }
  })
}

/** Open PRs, or [] with a warning when `gh` is not there or not signed in. */
function openPrs(): Array<{ number: number; title: string; headRefName: string }> {
  try {
    const raw = execFileSync('gh', ['pr', 'list', '--state', 'open', '--limit', '100', '--json', 'number,title,headRefName'], {
      encoding: 'utf8',
      timeout: 20000,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return JSON.parse(raw) as Array<{ number: number; title: string; headRefName: string }>
  } catch {
    console.warn('warn: `gh pr list` failed (no gh, or not signed in) — open PR titles not counted as claims this run')
    return []
  }
}

/**
 * Create the ref on origin, atomically: the push expects the ref to be absent.
 * Returns 'created', 'taken' (someone else holds it) or 'offline'.
 */
function pushClaimRef(ref: string, message: string): 'created' | 'taken' | 'offline' {
  if (!online) return 'offline'
  const emptyTree = git('hash-object', '-t', 'tree', '/dev/null')
  const sha = execFileSync('git', ['commit-tree', emptyTree, '-m', message], { encoding: 'utf8' }).trim()
  try {
    execFileSync('git', ['push', '-q', 'origin', `${sha}:${ref}`, `--force-with-lease=${ref}:`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30000,
    })
    git('update-ref', ref, sha)
    return 'created'
  } catch (e) {
    const text = String((e as { stderr?: string }).stderr ?? e)
    if (/rejected|stale info|already exists/.test(text)) return 'taken'
    online = false
    console.warn(`warn: could not push ${ref} (${text.split('\n')[0]}) — claimed locally only; run the command again when online`)
    return 'offline'
  }
}

function deleteClaimRef(ref: string): void {
  try {
    git('update-ref', '-d', ref)
  } catch {
    /* not fetched locally — fine */
  }
  if (!online) return
  try {
    execFileSync('git', ['push', '-q', 'origin', `:${ref}`], { stdio: 'ignore', timeout: 30000 })
  } catch {
    console.warn(`warn: could not delete ${ref} on origin — it will sweep on the next run`)
  }
}

function sweepMerged(
  claimsDir: string,
  claims: Array<SessionClaim & { file: string }>,
  remote: Array<RemoteClaim & { branch?: string }>,
  mainNewest: number,
) {
  const { merged, outstanding } = partitionMergedClaims(claims, mainNewest)
  for (const c of merged) {
    rmSync(join(claimsDir, (c as SessionClaim & { file: string }).file), { force: true })
    console.log(
      `released v2.${c.version} — that number is now on main. NOT proof your PR merged (another PR may have taken it); verify with gh pr view.`,
    )
  }
  const migrationsOnMain = git('ls-tree', '--name-only', 'origin/main', 'supabase/migrations/')
  for (const f of readdirSync(claimsDir)) {
    const m = f.match(/^migration-(\d{14})\.json$/)
    if (m && migrationsOnMain.includes(m[1])) rmSync(join(claimsDir, f), { force: true })
  }
  for (const r of remote) {
    if ((r.version != null && r.version <= mainNewest) || (r.migration != null && migrationsOnMain.includes(r.migration))) {
      deleteClaimRef(r.ref)
      console.log(`released ${r.ref.replace('refs/claims/', '')} on GitHub — it is on main now`)
    }
  }
  return outstanding as Array<SessionClaim & { file: string }>
}

const dir = sessionsDir()
const claimsDir = join(dir, 'claims')
const rawArgs = process.argv.slice(2)
let branch = git('rev-parse', '--abbrev-ref', 'HEAD')
const args: string[] = []
for (let i = 0; i < rawArgs.length; i++) {
  if (rawArgs[i] === '--branch' && rawArgs[i + 1]) branch = rawArgs[++i]
  else args.push(rawArgs[i])
}
if (branch === 'HEAD') {
  console.warn('warn: detached HEAD — pass `--branch <name>` so the claim names the branch that will carry it')
}

if (args[0] === '--release') {
  const n = parseVersionNumber(args[1] ?? '')
  if (n == null) throw new Error('usage: npm run claim -- --release v2.NNN')
  fetchLedger()
  rmSync(join(claimsDir, `v2.${n}.json`), { force: true })
  deleteClaimRef(claimRefName('version', n))
  console.log(`released v2.${n}`)
} else if (args[0] === '--migration') {
  const version = parseMigrationVersion(args[1] ?? '')
  if (!version) throw new Error('usage: npm run claim -- --migration <YYYYMMDDHHMMSS_slug.sql>')
  fetchLedger()
  const onMain = git('ls-tree', '--name-only', 'origin/main', 'supabase/migrations/')
  if (onMain.includes(version)) throw new Error(`migration version ${version} already exists on origin/main`)
  const file = join(claimsDir, `migration-${version}.json`)
  const payload: MigrationClaim = { version, branch, claimedAt: new Date().toISOString(), cwd: process.cwd() }
  try {
    writeFileSync(file, JSON.stringify(payload, null, 2), { flag: 'wx' })
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EEXIST') {
      const holder = JSON.parse(readFileSync(file, 'utf8')) as { branch?: string }
      if (holder.branch !== branch)
        throw new Error(`migration ${version} already claimed by ${holder.branch ?? 'another session'} — pick a later stamp`)
    } else throw e
  }
  const result = pushClaimRef(claimRefName('migration', version), encodeClaimMessage(payload))
  if (result === 'taken') {
    const holder = readRemoteClaims().find((r) => r.migration === version)
    if (holder?.branch !== branch) {
      rmSync(file, { force: true })
      throw new Error(`migration ${version} already claimed on GitHub by ${holder?.branch ?? 'another machine'} — pick a later stamp`)
    }
  }
  console.log(`claimed migration ${version} for ${branch}${result === 'offline' ? ' (locally only)' : ' (on GitHub)'}`)
} else {
  fetchLedger()
  const mainNewest = mainNewestVersion()
  const remote = readRemoteClaims()
  const outstanding = sweepMerged(claimsDir, readClaims(claimsDir), remote, mainNewest)
  const prs = parsePrVersions(openPrs())
  const remoteOutstanding = remote.filter((r) => r.version != null && r.version > mainNewest)
  let candidate = nextClaimCandidate(mainNewest, [
    ...outstanding.map((c) => c.version),
    ...remoteOutstanding.map((r) => r.version as number),
    ...prs.map((p) => p.version),
  ])
  for (let tries = 0; tries < 50; tries++, candidate++) {
    const payload: SessionClaim = {
      version: candidate,
      branch,
      claimedAt: new Date().toISOString(),
      cwd: process.cwd(),
      description: args.join(' ') || undefined,
    }
    const file = join(claimsDir, `v2.${candidate}.json`)
    try {
      writeFileSync(file, JSON.stringify(payload, null, 2), { flag: 'wx' })
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e
      continue
    }
    const result = pushClaimRef(claimRefName('version', candidate), encodeClaimMessage(payload))
    if (result === 'taken') {
      rmSync(file, { force: true })
      continue
    }
    console.log(
      `claimed v2.${candidate} for ${branch} (main is at v2.${mainNewest})${result === 'offline' ? ' — LOCALLY ONLY, GitHub unreachable' : ''}`,
    )
    // Version claims prevent number races; only session cards prevent two
    // sessions reworking the same surface. Nag (advisory) when one is missing.
    const cardPath = join(dir, 'active', `${branchSlug(branch)}.md`)
    if (!existsSync(cardPath)) {
      console.warn(
        `note: no session card for this branch — drop .claude/sessions/active/${branchSlug(branch)}.md ` +
          `(template in docs/SESSIONS.md) listing the surfaces you're touching, so parallel sessions can dodge you`,
      )
    }
    const ahead = new Map<number, string>()
    for (const p of prs) ahead.set(p.version, `PR #${p.number}`)
    for (const r of remoteOutstanding) ahead.set(r.version as number, r.branch ?? 'another machine')
    for (const c of outstanding) ahead.set(c.version, c.branch)
    if (ahead.size > 0) {
      console.log(
        `outstanding ahead of you: ${[...ahead.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([v, who]) => `v2.${v} (${who})`)
          .join(', ')}`,
      )
    }
    process.exit(0)
  }
  throw new Error('could not find a free version in 50 tries — inspect `git ls-remote origin refs/claims/*` and .claude/sessions/claims/')
}
