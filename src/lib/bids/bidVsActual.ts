/**
 * Bid vs actual — the third lens on Bids → Bid Costs. For every job linked to
 * its bid (`jobs_ledger.bid_id`, the Burn-against-the-bid train): what it cost
 * to bid, what we bid, what the bid predicted in hours and direct cost
 * (`job_budgets`, the ◆ snapshot taken at link time), and what the job has
 * actually burned (recorded field hours). Pure; the hook feeds it.
 *
 * The read on each row is the honest one for today's data: most linked bids
 * were never costed, so the lens says so and offers the door ("Cost it →")
 * instead of pretending a comparison.
 */

export type BidVsActualJobInput = {
  id: string
  hcp_number: string | null
  job_name: string | null
  revenue: number | string | null
  status: string | null
  pct_complete: number | string | null
  bid_id: string | null
}

export type BidVsActualBudgetInput = {
  job_id: string
  bid_id: string | null
  labor_hours: number | string | null
  labor_usd: number | string | null
  materials_usd: number | string | null
  subs_usd: number | string | null
  total_direct_usd: number | string | null
  completeness: unknown
}

export type BidVsActualBidInput = {
  id: string
  bid_number: string | null
  project_name: string | null
  estimatorName: string | null
}

export type BidVsActualRead = 'not-costed' | 'hours-missing' | 'outlier' | 'under' | 'near' | 'over'

export type BidVsActualRow = {
  jobId: string
  jobLabel: string
  jobStatus: string | null
  /** 0–100; finished jobs (billed / paid) read 100. */
  pctDone: number | null
  bidId: string
  bidLabel: string
  estimatorName: string | null
  revenue: number
  pursuitUsd: number
  pursuitHours: number
  /** The bid's predicted field hours; null when the bid was never costed. */
  predictedHours: number | null
  recordedHours: number
  /** Predicted direct cost from the snapshot; null when nothing was predicted. */
  predictedDirectUsd: number | null
  /** Materials predicted, hours not — a takeoff without a count sheet. */
  materialsOnly: boolean
  /** The snapshot's own completeness verdict (rate set + 90 % of rows with hours). */
  usable: boolean
  /** recorded ÷ predicted; null without a prediction. */
  hoursShare: number | null
  read: BidVsActualRead
  words: string
  /** Second line under the read; empty when nothing to add. */
  detail: string
}

/** A count sheet predicting more field hours than this per $1,000 of price cannot be right (603 h on $11.9k read 50.6). */
export const HOURS_PER_THOUSAND_OUTLIER = 15

const num = (v: number | string | null | undefined): number => {
  if (v == null) return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

const isFinished = (status: string | null): boolean => status === 'billed' || status === 'paid'

const jobLabelOf = (j: BidVsActualJobInput): string => {
  const n = (j.hcp_number ?? '').trim().replace(/^[jJ]\s*/, '')
  return `${n ? `J${n} ` : ''}${(j.job_name ?? '').trim()}`.trim() || 'Job'
}
const bidLabelOf = (b: BidVsActualBidInput | undefined): string => {
  if (!b) return 'Bid'
  const n = (b.bid_number ?? '').trim()
  return `${n ? `B${n} ` : ''}${(b.project_name ?? '').trim()}`.trim() || 'Bid'
}

const fmtUsd = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`

export function readBidVsActual(r: Pick<BidVsActualRow, 'predictedHours' | 'predictedDirectUsd' | 'recordedHours' | 'revenue' | 'pctDone' | 'materialsOnly'>): { read: BidVsActualRead; words: string; detail: string; hoursShare: number | null } {
  const predicted = r.predictedHours ?? 0
  if (predicted <= 0) {
    if (r.materialsOnly) return { read: 'hours-missing', words: 'hours missing', detail: 'materials predicted, no count sheet', hoursShare: null }
    return { read: 'not-costed', words: 'not costed', detail: r.recordedHours > 0 ? `${Math.round(r.recordedHours)} h recorded, nothing to hold it against` : '', hoursShare: null }
  }
  const share = r.recordedHours / predicted
  if (r.revenue > 0 && predicted / (r.revenue / 1000) > HOURS_PER_THOUSAND_OUTLIER) {
    return { read: 'outlier', words: `${Math.round(predicted)} h on ${fmtUsd(r.revenue)}`, detail: 'check the count sheet', hoursShare: share }
  }
  const pctWords = r.pctDone == null ? '% done unknown' : `at ${Math.round(r.pctDone)}% done`
  const words = `${Math.round(share * 100)}% of hours`
  // Against the work done when we know it; against the whole prediction when we don't.
  const expected = r.pctDone == null ? 1 : Math.max(r.pctDone, 1) / 100
  const read: BidVsActualRead = share > expected * 1.1 ? 'over' : share >= expected * 0.8 ? 'near' : 'under'
  const detail = read === 'over' ? `${pctWords} · over the book` : read === 'under' && r.pctDone != null && r.pctDone >= 100 ? `${pctWords} · under the book` : pctWords
  return { read, words, detail, hoursShare: share }
}

export function buildBidVsActualRows(args: {
  jobs: ReadonlyArray<BidVsActualJobInput>
  budgets: ReadonlyArray<BidVsActualBudgetInput>
  bids: ReadonlyMap<string, BidVsActualBidInput>
  hoursByJob: ReadonlyMap<string, number>
  pursuitByBid: ReadonlyMap<string, { usd: number; hours: number }>
}): BidVsActualRow[] {
  const budgetByJob = new Map(args.budgets.map((b) => [b.job_id, b]))
  const rows: BidVsActualRow[] = []
  for (const j of args.jobs) {
    if (!j.bid_id) continue
    const b = budgetByJob.get(j.id)
    const bid = args.bids.get(j.bid_id)
    const revenue = num(j.revenue)
    const predictedHours = b ? num(b.labor_hours) : 0
    const predictedDirect = b ? num(b.total_direct_usd) : 0
    const materialsOnly = predictedHours <= 0 && b != null && num(b.materials_usd) > 0
    const completeness = (b?.completeness ?? null) as { usable?: unknown } | null
    const usable = completeness != null && typeof completeness === 'object' && completeness.usable === true
    const pctDone = isFinished(j.status) ? 100 : j.pct_complete != null ? num(j.pct_complete) : null
    const pursuit = args.pursuitByBid.get(j.bid_id)
    const base = {
      predictedHours: predictedHours > 0 ? predictedHours : null,
      predictedDirectUsd: predictedDirect > 0 ? predictedDirect : null,
      recordedHours: args.hoursByJob.get(j.id) ?? 0,
      revenue,
      pctDone,
      materialsOnly,
    }
    const read = readBidVsActual(base)
    rows.push({
      jobId: j.id,
      jobLabel: jobLabelOf(j),
      jobStatus: j.status,
      bidId: j.bid_id,
      bidLabel: bidLabelOf(bid),
      estimatorName: bid?.estimatorName ?? null,
      pursuitUsd: pursuit?.usd ?? 0,
      pursuitHours: pursuit?.hours ?? 0,
      usable,
      ...base,
      ...read,
    })
  }
  return rows.sort((a, b) => b.revenue - a.revenue || a.jobLabel.localeCompare(b.jobLabel))
}

export type BidVsActualTiles = {
  linked: number
  withPredictedHours: number
  rateSet: number
  recordedHours: number
  /** Over the rows that carry a prediction, so the pair compares like with like. */
  predictedHoursWhereAny: number
  recordedHoursWhereAny: number
  notCosted: number
  over: number
  outliers: number
}

export function bidVsActualTiles(rows: ReadonlyArray<BidVsActualRow>): BidVsActualTiles {
  const t: BidVsActualTiles = { linked: rows.length, withPredictedHours: 0, rateSet: 0, recordedHours: 0, predictedHoursWhereAny: 0, recordedHoursWhereAny: 0, notCosted: 0, over: 0, outliers: 0 }
  for (const r of rows) {
    t.recordedHours += r.recordedHours
    if (r.predictedHours != null) {
      t.withPredictedHours++
      t.predictedHoursWhereAny += r.predictedHours
      t.recordedHoursWhereAny += r.recordedHours
    }
    if (r.usable) t.rateSet++
    if (r.read === 'not-costed' || r.read === 'hours-missing') t.notCosted++
    if (r.read === 'over') t.over++
    if (r.read === 'outlier') t.outliers++
  }
  return t
}

export const BID_VS_ACTUAL_READ_LABELS: Record<BidVsActualRead, string> = {
  'not-costed': 'not costed',
  'hours-missing': 'hours missing',
  outlier: 'check the count sheet',
  under: 'under',
  near: 'on the book',
  over: 'over',
}
