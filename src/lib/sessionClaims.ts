/**
 * Pure kernel for the advisory parallel-session coordination ledger
 * (docs/SESSIONS.md). The ledger itself is a gitignored directory of claim
 * files in the MAIN checkout's `.claude/sessions/`; scripts/claim-version.ts
 * and scripts/sessions-status.ts do the IO. Everything here is pure so it can
 * be unit-tested: version parsing, next-free allocation, staleness.
 */

/** First `## Latest Updates (v2.NNNN)` heading in RECENT_FEATURES.md content, or null. */
export function parseNewestChangelogVersion(recentFeaturesContent: string): number | null {
  const m = recentFeaturesContent.match(/^## Latest Updates \(v2\.(\d+)\)/m)
  return m?.[1] ? Number(m[1]) : null
}

/** First `version: 'v2.NNNN'` in releaseNotes.ts content, or null. */
export function parseNewestReleaseNotesVersion(releaseNotesContent: string): number | null {
  const m = releaseNotesContent.match(/version: 'v2\.(\d+)'/)
  return m?.[1] ? Number(m[1]) : null
}

/**
 * Newest version among per-version fragment filenames (v2.NNNN.ts release-note
 * fragments and v2.NNNN.md recent-features fragments). Input is any text that
 * contains the filenames — typically `git ls-tree --name-only` output over
 * src/content/releaseNotes/ and docs/recent-features/. Null when none found.
 */
export function parseNewestFragmentVersion(listing: string): number | null {
  let newest: number | null = null
  for (const m of listing.matchAll(/v2\.(\d+)\.(?:ts|md)\b/g)) {
    const num = Number(m[1])
    if (newest == null || num > newest) newest = num
  }
  return newest
}

/** `v2.1344` → 1344; tolerant of a bare `1344`. Null when unparseable. */
export function parseVersionNumber(label: string): number | null {
  const m = label.trim().match(/^(?:v2\.)?(\d+)$/)
  return m?.[1] ? Number(m[1]) : null
}

export type SessionClaim = {
  version: number
  branch: string
  claimedAt: string
  cwd?: string
  description?: string
}

/**
 * Next version to TRY claiming: one past everything known (main's newest and
 * every outstanding claim). The claimer must still create the claim file
 * atomically (`wx`) and bump-and-retry on EEXIST — this function only picks
 * the starting candidate.
 */
export function nextClaimCandidate(mainNewest: number, claimedVersions: number[]): number {
  return Math.max(mainNewest, ...claimedVersions.map((v) => (Number.isFinite(v) ? v : 0)), 0) + 1
}

/** Claims at or below main's newest version have merged — safe to auto-release. */
export function partitionMergedClaims(
  claims: SessionClaim[],
  mainNewest: number,
): { merged: SessionClaim[]; outstanding: SessionClaim[] } {
  const merged: SessionClaim[] = []
  const outstanding: SessionClaim[] = []
  for (const c of claims) (c.version <= mainNewest ? merged : outstanding).push(c)
  return { merged, outstanding }
}

export const CLAIM_STALE_AFTER_MS = 24 * 60 * 60 * 1000

/** Advisory staleness: outstanding for >24h — probably an abandoned session. */
export function isClaimStale(claim: SessionClaim, nowMs: number): boolean {
  const t = Date.parse(claim.claimedAt)
  return Number.isFinite(t) ? nowMs - t > CLAIM_STALE_AFTER_MS : true
}

/** Migration filename → its version prefix (`20260803184515_bid_aware_pins.sql` → "20260803184515"). */
export function parseMigrationVersion(filename: string): string | null {
  const m = filename
    .trim()
    .replace(/^.*\//, '')
    .match(/^(\d{14})_[a-z0-9_]+\.sql$/)
  return m?.[1] ?? null
}

/** Branch name → safe claim/card filename slug. */
export function branchSlug(branch: string): string {
  return branch.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'unnamed'
}

// ---------------------------------------------------------------------------
// GitHub as the ledger (v2.4844): every claim is also a ref under
// `refs/claims/` on origin, so sessions on other machines and in the cloud see
// it. The ref points at a parentless empty-tree commit whose message is the
// claim JSON; `git push --force-with-lease=<ref>:` (expect absent) makes the
// create atomic on the server, exactly like the local `wx` file.
// ---------------------------------------------------------------------------

export const CLAIM_REF_PREFIX = 'refs/claims/'

/** The origin ref a claim lives under: `v2.NNNN`, `migration-<stamp>`, or `todo-<N>` for a punch-list number. */
export function claimRefName(kind: 'version' | 'migration' | 'todo', id: number | string): string {
  if (kind === 'version') return `${CLAIM_REF_PREFIX}v2.${id}`
  if (kind === 'todo') return `${CLAIM_REF_PREFIX}todo-${id}`
  return `${CLAIM_REF_PREFIX}migration-${id}`
}

export type RemoteClaim = {
  ref: string
  sha: string
  version?: number
  migration?: string
  /** A punch-list number held for a card a branch is writing (`refs/claims/todo-208`). */
  todo?: number
}

/**
 * Parse `git ls-remote origin 'refs/claims/*'` or
 * `git for-each-ref --format='%(objectname) %(refname)' refs/claims/` output.
 * Lines that are not claim refs are ignored.
 */
export function parseClaimRefs(listing: string): RemoteClaim[] {
  const out: RemoteClaim[] = []
  for (const line of listing.split('\n')) {
    const m = line.trim().match(/^([0-9a-f]{40})\s+(refs\/claims\/(\S+))$/)
    const sha = m?.[1]
    const ref = m?.[2]
    const leaf = m?.[3]
    if (sha == null || ref == null || leaf == null) continue
    const v = leaf.match(/^v2\.(\d+)$/)
    const mig = leaf.match(/^migration-(\d{14})$/)
    const todo = leaf.match(/^todo-(\d{1,3})$/)
    if (v?.[1] != null) out.push({ ref, sha, version: Number(v[1]) })
    else if (mig?.[1] != null) out.push({ ref, sha, migration: mig[1] })
    else if (todo?.[1] != null) out.push({ ref, sha, todo: Number(todo[1]) })
  }
  return out
}

export type MigrationClaim = { version: string; branch: string; claimedAt: string; cwd?: string }

/**
 * A punch-list number held for the card a branch is writing (`refs/claims/todo-<N>`, local
 * `todo-<N>.json`; v2.5998). It sweeps once a card with that number is on main.
 */
export type TodoClaim = { todo: number; branch: string; claimedAt: string; cwd?: string; description?: string }

/** The claim as the ref commit's message. */
export function encodeClaimMessage(claim: SessionClaim | MigrationClaim | TodoClaim): string {
  return JSON.stringify(claim, null, 2) + '\n'
}

/** The ref commit's message back to a claim; null when it is not ours. */
export function decodeClaimMessage(message: string): Partial<SessionClaim & MigrationClaim & TodoClaim> | null {
  try {
    const parsed: unknown = JSON.parse(message)
    return parsed && typeof parsed === 'object' ? (parsed as Partial<SessionClaim & MigrationClaim & TodoClaim>) : null
  } catch {
    return null
  }
}

export type PrVersion = { version: number; number: number; branch: string; title: string }

/** Open PRs whose title starts with `v2.NNNN` — a number a PR carries is a claim whether or not anyone ran the script. */
export function parsePrVersions(prs: Array<{ number: number; title: string; headRefName: string }>): PrVersion[] {
  const out: PrVersion[] = []
  for (const pr of prs) {
    const m = pr.title.trim().match(/^v2\.(\d+)\b/)
    if (m) out.push({ version: Number(m[1]), number: pr.number, branch: pr.headRefName, title: pr.title })
  }
  return out
}

export type PrTodo = { todo: number; number: number; branch: string; title: string }

/**
 * The punch-list numbers an open PR's title carries — a card someone is writing is a claim whether
 * or not anyone ran `npm run claim -- --todo`. A to-do PR (`docs(to-dos): #205 …`, `to-dos: …`)
 * yields every `#N` in its title, a range (`#161 to #165`, `#166–#175`) expanded; any other title
 * only the `punch list #N` / `to-do #N` phrasings, so a PR number or a journey-map item never counts.
 */
export function parsePrTodoNumbers(prs: Array<{ number: number; title: string; headRefName: string }>): PrTodo[] {
  const out: PrTodo[] = []
  for (const pr of prs) {
    const title = pr.title.trim()
    const numbers = new Set<number>()
    if (/^(?:docs\()?to-dos\)?:/i.test(title)) {
      for (const m of title.matchAll(/#(\d{1,3})\b(?:\s*(?:to|–|—|-)\s*#(\d{1,3})\b)?/g)) {
        const from = Number(m[1])
        const to = m[2] != null ? Math.min(Number(m[2]), from + 49) : from
        for (let n = from; n <= to; n++) numbers.add(n)
      }
    } else {
      for (const m of title.matchAll(/\b(?:punch[ -]list|to-do)\s+\**#(\d{1,3})\b/gi)) numbers.add(Number(m[1]))
    }
    for (const todo of [...numbers].sort((a, b) => a - b)) out.push({ todo, number: pr.number, branch: pr.headRefName, title })
  }
  return out
}

/**
 * The `number:` of every card on a ref — `git grep -h -E '^number:' origin/main -- to-dos` output,
 * one line per card. A to-do claim sweeps once its number is here: the card landed.
 */
export function parseTodoNumbersOnMain(listing: string): number[] {
  const out: number[] = []
  for (const m of listing.matchAll(/^number:\s*(\d{1,3})\s*(?:#.*)?$/gm)) out.push(Number(m[1]))
  return out
}

export type VersionCollision = {
  version: number
  kind: 'two-prs' | 'claimed-by-another-branch' | 'unclaimed'
  detail: string
}

/**
 * Where the open PRs and the claims disagree: two PRs on one number (the
 * second to land fails the release-notes test), a PR on a number another
 * branch holds (that branch will open a duplicate), or a PR on a number no one
 * claimed (fine today, but the next claimer cannot see it unless PR titles are
 * read — which `npm run claim` now does).
 */
export function findVersionCollisions(
  prs: PrVersion[],
  claims: Array<{ version: number; branch: string }>,
): VersionCollision[] {
  const out: VersionCollision[] = []
  const byVersion = new Map<number, PrVersion[]>()
  for (const pr of prs) byVersion.set(pr.version, [...(byVersion.get(pr.version) ?? []), pr])
  const claimFor = new Map<number, string>()
  for (const c of claims) claimFor.set(c.version, c.branch)
  for (const [version, list] of [...byVersion.entries()].sort((a, b) => a[0] - b[0])) {
    if (list.length > 1) {
      out.push({ version, kind: 'two-prs', detail: list.map((p) => `#${p.number} (${p.branch})`).join(' and ') })
      continue
    }
    const pr = list[0]
    if (pr == null) continue
    const holder = claimFor.get(version)
    if (holder == null) out.push({ version, kind: 'unclaimed', detail: `#${pr.number} (${pr.branch})` })
    else if (holder !== pr.branch)
      out.push({ version, kind: 'claimed-by-another-branch', detail: `#${pr.number} (${pr.branch}) but claimed by ${holder}` })
  }
  return out
}
