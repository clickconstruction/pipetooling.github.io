import type { JobFollowupStage } from './jobFollowupQueue'
import { jobInCollections, type StageRow } from '../jobsStagesBoard'
import { revenueDollarsFromFixtures } from '../revenueFromJobFixtures'

/**
 * A follow-up deck card's Pipeline row (the Stages map's step 17), the parts of it that are plain reckoning: which
 * board section draws the job, which of that section's rows are the job's, and the bill detail under the row.
 * `JobsStagesTab` keeps the wiring, since the row reads the tab's own bundles.
 */

type FollowupFixture = { name: string | null; count: number | string | null; line_unit_price: number | string | null; sequence_order: number }

/** The bill detail a deck card shows under its row (v2.1744): the named Bill-tab lines in order, their total, and the bid. */
export function followupRowBillDetail(job: { fixtures?: ReadonlyArray<FollowupFixture> | null; revenue?: number | string | null }): {
  lineItems: Array<{ name: string; count: number; unitPrice: number | null }>
  jobTotalDollars: number
  bidDollars: number
} {
  const named = [...(job.fixtures ?? [])].filter((f) => (f.name ?? '').trim()).sort((a, b) => a.sequence_order - b.sequence_order)
  const lineItems = named.map((f) => ({
    name: f.name as string,
    count: Number(f.count ?? 1),
    unitPrice: f.line_unit_price != null ? Number(f.line_unit_price) : null,
  }))
  return {
    lineItems,
    // The same math as the Bill tab's Job Total.
    jobTotalDollars: revenueDollarsFromFixtures(lineItems.map((l) => ({ name: l.name, count: l.count, line_unit_price: l.unitPrice }))),
    bidDollars: Number(job.revenue ?? 0),
  }
}

/**
 * The board section that draws the job's row on a deck card. A billed job the office flagged sits in Collections.
 * Null where no deck row is drawn: Paid in Full, or a status the board does not know. A job with no status reads
 * as Working, as it does on the board.
 */
export function followupStageForJob(job: { status?: string | null; collections_at?: string | null }): JobFollowupStage | null {
  const status = (job.status ?? 'working') as string
  if (status === 'waiting') return 'waiting'
  if (status === 'working') return 'working'
  if (status === 'ready_to_bill') return 'ready_to_bill'
  if (status === 'billed') return jobInCollections(job) ? 'collections' : 'billed'
  return null
}

/** The job's own rows in a bill-row stage, out of that stage's list. An empty answer means the deck draws no row. */
export function followupRowsForJob(
  stage: 'ready_to_bill' | 'collections' | 'billed',
  lists: { readyToBillRows: StageRow[]; collectionsRows: StageRow[]; billedActiveRows: StageRow[] },
  jobId: string,
): StageRow[] {
  const all = stage === 'ready_to_bill' ? lists.readyToBillRows : stage === 'collections' ? lists.collectionsRows : lists.billedActiveRows
  return all.filter((r) => r.job.id === jobId)
}
