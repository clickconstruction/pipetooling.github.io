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
