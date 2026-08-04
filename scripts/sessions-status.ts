/**
 * Print the advisory parallel-session ledger (docs/SESSIONS.md): outstanding
 * version/migration claims and active session cards, with staleness warnings.
 *
 *   npm run sessions
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import {
  isClaimStale,
  parseNewestChangelogVersion,
  type SessionClaim,
} from '../src/lib/sessionClaims'

function git(...args: string[]): string {
  // RECENT_FEATURES.md is ~20k lines — well past execFileSync's 1MB default buffer.
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()
}

const common = git('rev-parse', '--git-common-dir')
const mainRoot = dirname(isAbsolute(common) ? common : resolve(process.cwd(), common))
const dir = join(mainRoot, '.claude', 'sessions')
const claimsDir = join(dir, 'claims')
const activeDir = join(dir, 'active')

let mainNewest: number | null = null
try {
  mainNewest = parseNewestChangelogVersion(git('show', 'origin/main:docs/RECENT_FEATURES.md'))
} catch {
  // offline / no origin — status still useful
}
console.log(`origin/main newest: ${mainNewest != null ? `v2.${mainNewest}` : 'unknown'}`)

const now = Date.now()

console.log('\n— Version & migration claims —')
const claimFiles = existsSync(claimsDir) ? readdirSync(claimsDir).filter((f) => f.endsWith('.json')) : []
if (claimFiles.length === 0) console.log('(none)')
for (const f of claimFiles.sort()) {
  try {
    const c = JSON.parse(readFileSync(join(claimsDir, f), 'utf8')) as SessionClaim
    const merged = mainNewest != null && !f.startsWith('migration-') && c.version <= mainNewest
    const flags = [
      merged ? 'MERGED — auto-releases on next claim' : null,
      isClaimStale(c, now) ? 'STALE >24h — ignore if its session is gone' : null,
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

console.log('\n— Active session cards —')
const cards = existsSync(activeDir) ? readdirSync(activeDir).filter((f) => f.endsWith('.md')) : []
if (cards.length === 0) console.log('(none)')
for (const f of cards.sort()) {
  const p = join(activeDir, f)
  const ageDays = (now - statSync(p).mtimeMs) / (24 * 60 * 60 * 1000)
  const head = readFileSync(p, 'utf8').split('\n').slice(0, 6).join('\n  ')
  console.log(`\n${f}${ageDays > 3 ? '  [STALE >3d — probably done]' : ''}\n  ${head}`)
}
