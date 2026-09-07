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
  /**
   * "Plans readable by robots" (v2.3080): the plan-fetch probe's answer —
   * can the Drive intake service account read the file behind plans_link?
   * null/undefined = never probed (treated as readable until proven not).
   */
  plans_robot_readable?: boolean | null
  plans_robot_probe_note?: string | null
}

export interface ShadowCoverageStat {
  /** Live shadow-eligible bids that already have a shadow run. */
  covered: number
  /** All live shadow-eligible bids. */
  live: number
  /**
   * Uncovered live bids whose plans the intake service account cannot read —
   * invisible to the shadow program until a human repairs the link. Bid
   * numbers (b-prefixed) with the probe's reason, for the board's tooltip.
   */
  unreadable: Array<{ bid: string; why: string | null }>
}

/** Probed and found unreadable by the intake service account. */
export function isPlansUnreadableByRobots(b: Pick<ShadowCoverageBid, 'plans_robot_readable'>): boolean {
  return b.plans_robot_readable === false
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
  const unreadable: ShadowCoverageStat['unreadable'] = []
  for (const b of bids) {
    if (!isShadowEligibleLiveBid(b)) continue
    live += 1
    const num = normalizeBidNumber(b.bid_number)
    if (num && shadowed.has(num)) covered += 1
    else if (isPlansUnreadableByRobots(b)) unreadable.push({ bid: num ? `b${num}` : '?', why: b.plans_robot_probe_note ?? null })
  }
  return { covered, live, unreadable }
}
