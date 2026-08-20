/**
 * Advisory version/migration claim for parallel sessions (docs/SESSIONS.md).
 *
 *   npm run claim                      # claim the next free v2.NNN, print it
 *   npm run claim -- --migration supabase/migrations/20260804120000_foo.sql
 *   npm run claim -- --release v2.NNN  # release a claim you no longer need
 *
 * Claims live as one JSON file each in the MAIN checkout's gitignored
 * `.claude/sessions/claims/` (worktrees resolve there via
 * `git rev-parse --git-common-dir`), created with the `wx` flag so two
 * sessions can never win the same number. Claims at or below main's newest
 * version are auto-released on every run. Advisory only — nothing enforces it.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import {
  nextClaimCandidate,
  parseMigrationVersion,
  parseNewestChangelogVersion,
  parseNewestFragmentVersion,
  parseNewestReleaseNotesVersion,
  partitionMergedClaims,
  parseVersionNumber,
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

function mainNewestVersion(): number {
  try {
    execFileSync('git', ['fetch', 'origin', 'main', '-q'], { stdio: 'ignore', timeout: 15000 })
  } catch {
    console.warn('warn: git fetch failed (offline?) — using the last-fetched origin/main')
  }
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

function sweepMerged(claimsDir: string, claims: Array<SessionClaim & { file: string }>, mainNewest: number) {
  const { merged, outstanding } = partitionMergedClaims(claims, mainNewest)
  for (const c of merged) {
    rmSync(join(claimsDir, (c as SessionClaim & { file: string }).file), { force: true })
    console.log(
      `released v2.${c.version} — that number is now on main. NOT proof your PR merged (another PR may have taken it); verify with gh pr view.`,
    )
  }
  return outstanding as Array<SessionClaim & { file: string }>
}

const dir = sessionsDir()
const claimsDir = join(dir, 'claims')
const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
const args = process.argv.slice(2)

if (args[0] === '--release') {
  const n = parseVersionNumber(args[1] ?? '')
  if (n == null) throw new Error('usage: npm run claim -- --release v2.NNN')
  rmSync(join(claimsDir, `v2.${n}.json`), { force: true })
  console.log(`released v2.${n}`)
} else if (args[0] === '--migration') {
  const version = parseMigrationVersion(args[1] ?? '')
  if (!version) throw new Error('usage: npm run claim -- --migration <YYYYMMDDHHMMSS_slug.sql>')
  const onMain = git('ls-tree', '--name-only', 'origin/main', 'supabase/migrations/')
  if (onMain.includes(version)) throw new Error(`migration version ${version} already exists on origin/main`)
  const file = join(claimsDir, `migration-${version}.json`)
  try {
    writeFileSync(file, JSON.stringify({ version, branch, claimedAt: new Date().toISOString() }, null, 2), {
      flag: 'wx',
    })
    console.log(`claimed migration ${version} for ${branch}`)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EEXIST') {
      const holder = JSON.parse(readFileSync(file, 'utf8')) as { branch?: string }
      throw new Error(`migration ${version} already claimed by ${holder.branch ?? 'another session'} — pick a later stamp`)
    }
    throw e
  }
} else {
  const mainNewest = mainNewestVersion()
  const outstanding = sweepMerged(claimsDir, readClaims(claimsDir), mainNewest)
  let candidate = nextClaimCandidate(mainNewest, outstanding.map((c) => c.version))
  for (let tries = 0; tries < 50; tries++, candidate++) {
    const payload: SessionClaim = {
      version: candidate,
      branch,
      claimedAt: new Date().toISOString(),
      cwd: process.cwd(),
      description: args.join(' ') || undefined,
    }
    try {
      writeFileSync(join(claimsDir, `v2.${candidate}.json`), JSON.stringify(payload, null, 2), { flag: 'wx' })
      console.log(`claimed v2.${candidate} for ${branch} (main is at v2.${mainNewest})`)
      if (outstanding.length > 0) {
        console.log(
          `outstanding ahead of you: ${outstanding.map((c) => `v2.${c.version} (${c.branch})`).join(', ')}`,
        )
      }
      process.exit(0)
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e
    }
  }
  throw new Error('could not find a free version in 50 tries — inspect .claude/sessions/claims/')
}
