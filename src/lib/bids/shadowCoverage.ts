/**
 * Shadow-coverage math (v2.2943, LEARNING_PLAN item 8): of the LIVE bids a
 * shadow run could still lock blind against — unsent, plans on file, not a
 * ZZ-prefixed robot sandbox bid — how many already have a shadow run?
 *
 * The Scoreboard pill renders this as "2/40 shadow coverage": every uncovered
 * live bid is a free future grade-A reference (a shadow costs the estimator
 * zero minutes, locks blind before her number exists, and auto-scores when
 * she sends).
 *
 * Matching is by bid NUMBER because staff read shadow runs through the
 * `list_shadow_runs()` RPC, which names bids by number (the direct
 * twin_shadow_runs select is RLS-closed since v2.2544).
 *
 * Pure module — no React, no Supabase.
 */

export interface ShadowCoverageBid {
  bid_number: string | null
  bid_date_sent: string | null
  plans_link: string | null
  project_name: string | null
}

export interface ShadowCoverageStat {
  /** Live shadow-eligible bids that already have a shadow run. */
  covered: number
  /** All live shadow-eligible bids. */
  live: number
}

/** Live and worth shadowing: unsent, plans on file, not a 'ZZ ' sandbox bid. */
export function isShadowEligibleLiveBid(b: ShadowCoverageBid): boolean {
  if (b.bid_date_sent != null) return false
  if (!b.plans_link?.trim()) return false
  if (/^zz /i.test((b.project_name ?? '').trimStart())) return false
  return true
}

const normalizeBidNumber = (n: string | null | undefined): string | null => {
  const s = (n ?? '').trim()
  return s ? s : null
}

export function shadowCoverage(
  bids: readonly ShadowCoverageBid[],
  shadowReferenceBidNumbers: ReadonlyArray<string | null | undefined>,
): ShadowCoverageStat {
  const shadowed = new Set<string>()
  for (const n of shadowReferenceBidNumbers) {
    const norm = normalizeBidNumber(n)
    if (norm) shadowed.add(norm)
  }
  let live = 0
  let covered = 0
  for (const b of bids) {
    if (!isShadowEligibleLiveBid(b)) continue
    live += 1
    const num = normalizeBidNumber(b.bid_number)
    if (num && shadowed.has(num)) covered += 1
  }
  return { covered, live }
}
