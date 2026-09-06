/**
 * One identity line for a schedule block, whatever it anchors to (journey-map
 * Tier-2 #22, J18-F4/F5/F7 — "bid visits are second-class on the schedule").
 *
 * Before this kernel the Day tab, the three person-schedule hooks, and the
 * user-review day section each built a job title with the 2-arg helper, which
 * dropped `click_number` — a click-number-only job printed "— · name" on the
 * Day tab while the People grid printed "J983 · name" for the same block. And
 * `jobTitleById` was built from jobs only, so a scheduled bid block fell to the
 * "— · Job" placeholder while the Clocked line under it named the bid.
 *
 * Pure: no supabase import, so both the hub page and the Quickfill section can
 * share it and the tests need no client.
 */
import type { LedgerPrefixMap } from './ledgerDisplayPrefixes'
import { effectiveJobLedgerNumber, formatBidLedgerShortLine } from './ledgerDisplayPrefixes'

export const SCHEDULE_BID_VISIT_LABEL = 'Bid visit'

export type ScheduleBlockTitleInput =
  | {
      kind: 'job'
      hcpNumber?: string | null
      /** Job name (`jobs_ledger.job_name`). */
      jobTitle?: string | null
      /** Falls in for the number when `hcpNumber` is blank (the C# rollout's "shows everywhere" rule). */
      clickNumber?: string | null
    }
  | {
      kind: 'bid'
      /** Already-formatted bid identity (`B123 · Project`, or `BP375 · Project` with a per-trade prefix). */
      bidTitle?: string | null
    }

/**
 * `J<number> · <job name>` for jobs (click number when there is no HCP number;
 * `— · Job` only when both are missing), `Bid visit · <bid title>` for bids
 * (`Bid visit` alone when the bid could not be named — e.g. RLS hides it).
 */
export function scheduleBlockTitle(input: ScheduleBlockTitleInput): string {
  if (input.kind === 'bid') {
    const t = (input.bidTitle ?? '').trim()
    return t ? `${SCHEDULE_BID_VISIT_LABEL} · ${t}` : SCHEDULE_BID_VISIT_LABEL
  }
  // Plain J prefix (search-standard identity): schedule surfaces carry the
  // trade pill on picker rows, so the per-service-type letter would be
  // redundant. Typing a bare "927" still matches as a substring.
  const num = effectiveJobLedgerNumber(input.hcpNumber, input.clickNumber)
  return `${num ? `J${num}` : '—'} · ${(input.jobTitle ?? '').trim() || 'Job'}`
}

/** Must match `SCHEDULE_BID_ANCHOR_PREFIX` in `jobScheduleBlocks.ts` (kept local so this file stays client-free). */
const BID_ANCHOR_PREFIX = 'bid:'

export function scheduleBidAnchorId(bidId: string): string {
  return `${BID_ANCHOR_PREFIX}${bidId}`
}

/**
 * Every bid a day/week loader must be able to name: the bids people are
 * SCHEDULED on (block anchors) plus the bids they CLOCKED on (session rows).
 * Before this kernel only the second set was fetched, which is why a scheduled but
 * not-yet-clocked bid had no title. Unique, first-seen order, blanks dropped.
 */
export function collectScheduledBidIds(
  blocks: ReadonlyArray<{ bid_id: string | null }>,
  sessions: ReadonlyArray<{ bid_id: string | null }> = [],
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const r of [...blocks, ...sessions]) {
    const id = (r.bid_id ?? '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export type ScheduleBidTitleSourceRow = {
  id: string
  bid_number: string | null
  project_name: string | null
  service_type_id?: string | null
}

/**
 * bid uuid → bid identity line. With a prefix map the line carries the
 * per-trade prefix (`BP375 · Project`, what the Clocked line already showed);
 * without one it is the hub's plain `B375 · Project`. A bid with no number
 * falls back to its project name, then to `Bid`.
 */
export function buildBidTitleById(
  rows: ReadonlyArray<ScheduleBidTitleSourceRow>,
  prefixMap: LedgerPrefixMap | null,
): Map<string, string> {
  const m = new Map<string, string>()
  for (const b of rows) {
    const num = (b.bid_number ?? '').trim()
    const pn = (b.project_name ?? '').trim()
    let label: string
    if (num) {
      label = prefixMap
        ? formatBidLedgerShortLine(prefixMap, b.service_type_id ?? null, b.bid_number, b.project_name)
        : `B${num} · ${pn || 'Bid'}`
    } else {
      label = pn || 'Bid'
    }
    m.set(b.id, label)
  }
  return m
}

/**
 * Anchor-keyed title map for block renderers: the job entries as given, plus
 * one `bid:<uuid>` → `Bid visit · <title>` entry per named bid, so every
 * `titleById.get(scheduleBlockAnchorId(block))` lookup resolves for bids too.
 * Returns a new map; the inputs are not mutated.
 */
export function addBidAnchorTitles(
  jobTitleById: ReadonlyMap<string, string>,
  bidTitleById: ReadonlyMap<string, string>,
): Map<string, string> {
  const out = new Map(jobTitleById)
  for (const [bidId, title] of bidTitleById) {
    out.set(scheduleBidAnchorId(bidId), scheduleBlockTitle({ kind: 'bid', bidTitle: title }))
  }
  return out
}

/** One Jobs-matrix row for a bid that has at least one block this week. */
export type ScheduleDispatchHubBidMatrixRow = {
  /** Anchor id (`bid:<uuid>`) — `onOpenJob` routes it through `scheduleBlockTarget` to Edit Bid. */
  id: string
  displayTitle: string
  totalBlocks: number
  byDay: Record<string, number>
}

/**
 * Jobs commitment matrix rows for bid-anchored blocks (J18-F7). The job rows
 * come from the jobs ledger (every job, with or without blocks) and the
 * job-only `blocksToJobWeekSummaries` skip stays as it was; bids are different —
 * a bid earns a row only by having a block this week, which is exactly what the
 * "what are we committed to" matrix wants. Sorted most blocks first, then title.
 */
export function blocksToBidWeekMatrixRows(
  blocks: ReadonlyArray<{ job_id: string | null; bid_id: string | null; work_date: string }>,
  titleForAnchorId: (anchorId: string) => string,
): ScheduleDispatchHubBidMatrixRow[] {
  const byBid = new Map<string, ScheduleDispatchHubBidMatrixRow>()
  for (const b of blocks) {
    if (b.job_id != null) continue
    const bidId = (b.bid_id ?? '').trim()
    if (!bidId) continue
    const id = scheduleBidAnchorId(bidId)
    const row = byBid.get(id) ?? { id, displayTitle: titleForAnchorId(id), totalBlocks: 0, byDay: {} }
    row.totalBlocks += 1
    row.byDay[b.work_date] = (row.byDay[b.work_date] ?? 0) + 1
    byBid.set(id, row)
  }
  return [...byBid.values()].sort((a, b) => {
    if (b.totalBlocks !== a.totalBlocks) return b.totalBlocks - a.totalBlocks
    return a.displayTitle.localeCompare(b.displayTitle, undefined, { numeric: true, sensitivity: 'base' })
  })
}
