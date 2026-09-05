import type { JobDayLedger } from './jobDayLedger'
import { ymdToDayNumber } from './jobRunningTimeline'
import { jobCycleRow, jobNumberLabel } from './jobSummaryCycle'
import { jobSummaryCutKey, type JobSummaryCutBy, type JobSummaryCutContext, type JobSummaryEnrichedRow } from './jobSummaryLedgerView'

/**
 * The Rework kernel (v2.2831): did we have to go back? A return visit is a
 * second job at the same address that started within N days after the first
 * was billed (paid, or last worked, when there's no bill). No new table — the
 * address key is on every job (customer_address_id, else the street text).
 * Rate by lead tech / service type / GC = returns whose FIRST job was theirs
 * ÷ their finished jobs. A return billed for nothing is a "callback" (the
 * warranty-shaped one); a return with its own revenue is "repeat" work — the
 * view counts callbacks by default. Pure.
 */
export type ReworkCount = 'callbacks' | 'all'
export const REWORK_COUNT_OPTIONS: ReadonlyArray<{ key: ReworkCount; label: string; title: string }> = [
  { key: 'callbacks', label: 'unbilled returns', title: 'Returns with no revenue of their own — the warranty-shaped ones' },
  { key: 'all', label: 'all returns', title: 'Every second job at the same address inside the window, billed or not' },
]
export const REWORK_WINDOW_OPTIONS: ReadonlyArray<{ key: number; label: string; title: string }> = [
  { key: 30, label: '30 d', title: 'A second job at the same address within 30 days of the first being billed' },
  { key: 90, label: '90 d', title: 'Within 90 days' },
  { key: 180, label: '180 d', title: 'Within 180 days' },
]
export type ReworkRateBy = Extract<JobSummaryCutBy, 'tech' | 'trade' | 'gc'>
export const REWORK_RATE_BY_OPTIONS: ReadonlyArray<{ key: ReworkRateBy; label: string; title: string }> = [
  { key: 'tech', label: 'lead tech', title: 'Returns after each master technician’s jobs' },
  { key: 'trade', label: 'service type', title: 'Returns by the first job’s service type' },
  { key: 'gc', label: 'GC', title: 'Returns by the first job’s General Contractor' },
]

export function reworkAddressKey(job: { customer_address_id?: string | null; job_address?: string | null }): string | null {
  if (job.customer_address_id) return `addr:${job.customer_address_id}`
  const text = (job.job_address ?? '')
    .toLowerCase()
    .replace(/[.,#]/g, ' ')
    .replace(/\b(suite|ste|unit|apt|lot)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length >= 6 ? `text:${text}` : null
}

export type ReworkJobRef = { jobId: string; number: string; name: string; startYmd: string | null; doneYmd: string | null }
export type ReworkPair = {
  first: ReworkJobRef
  second: ReworkJobRef
  daysAfter: number
  /** callback = the return billed nothing; repeat = it has its own revenue. */
  kind: 'callback' | 'repeat'
  addressLabel: string
  /** Labor + subs + parts + overhead share of the return job. */
  returnCostUsd: number
  returnRevenueUsd: number
}

type Placed = { row: JobSummaryEnrichedRow; ref: ReworkJobRef; key: string }

function place(rows: readonly JobSummaryEnrichedRow[], ledger: JobDayLedger | null): Placed[] {
  const out: Placed[] = []
  for (const r of rows) {
    const job = r.row.job
    const key = reworkAddressKey(job)
    if (!key) continue
    const c = jobCycleRow(r, ledger)
    const startYmd = ledger?.jobs.get(job.id)?.firstYmd ?? job.created_at?.slice(0, 10) ?? null
    const doneYmd = c.billYmd ?? c.paidYmd ?? c.lastWorkYmd
    out.push({ row: r, key, ref: { jobId: job.id, number: jobNumberLabel(job), name: (job.job_name ?? '').trim(), startYmd, doneYmd } })
  }
  return out
}

/** Every return visit inside the window; a job returns to at most the nearest earlier job at its address. */
export function filterReworkPairs(pairs: readonly ReworkPair[], count: ReworkCount): ReworkPair[] {
  return count === 'all' ? [...pairs] : pairs.filter((p) => p.kind === 'callback')
}

export function findReworkPairs(rows: readonly JobSummaryEnrichedRow[], ledger: JobDayLedger | null, windowDays: number): ReworkPair[] {
  const byKey = new Map<string, Placed[]>()
  for (const p of place(rows, ledger)) (byKey.get(p.key) ?? byKey.set(p.key, []).get(p.key)!).push(p)
  const pairs: ReworkPair[] = []
  for (const group of byKey.values()) {
    if (group.length < 2) continue
    const sorted = [...group].sort((a, b) => (a.ref.startYmd ?? '9999').localeCompare(b.ref.startYmd ?? '9999'))
    for (let i = 1; i < sorted.length; i++) {
      const second = sorted[i]!
      if (!second.ref.startYmd) continue
      let best: { first: Placed; days: number } | null = null
      for (let k = i - 1; k >= 0; k--) {
        const first = sorted[k]!
        if (!first.ref.doneYmd || first.ref.doneYmd >= second.ref.startYmd) continue
        const days = ymdToDayNumber(second.ref.startYmd) - ymdToDayNumber(first.ref.doneYmd)
        if (days > windowDays) continue
        if (!best || days < best.days) best = { first, days }
      }
      if (!best) continue
      const r = second.row
      pairs.push({
        first: best.first.ref,
        second: second.ref,
        daysAfter: best.days,
        kind: r.revenueUsd > 0 ? 'repeat' : 'callback',
        addressLabel: (r.row.job.job_address ?? '').trim() || best.first.ref.name,
        returnCostUsd: r.laborUsd + r.subsUsd + r.partsUsd + (r.overheadUsd ?? 0),
        returnRevenueUsd: r.revenueUsd,
      })
    }
  }
  return pairs.sort((a, b) => (b.second.startYmd ?? '').localeCompare(a.second.startYmd ?? ''))
}

export type ReworkGroup = { key: string; label: string; jobs: number; returns: number; ratePct: number | null }

/** Rate per group of the FIRST job: returns ÷ finished jobs in the group. */
export function reworkRateBy(pairs: readonly ReworkPair[], rows: readonly JobSummaryEnrichedRow[], by: ReworkRateBy, ctx: JobSummaryCutContext = {}): ReworkGroup[] {
  const groups = new Map<string, ReworkGroup>()
  const keyOfJob = new Map<string, string>()
  for (const r of rows) {
    if (!r.finished) continue
    const { key, label } = jobSummaryCutKey(r.row.job, by, ctx)
    keyOfJob.set(r.row.job.id, key)
    const g = groups.get(key) ?? groups.set(key, { key, label, jobs: 0, returns: 0, ratePct: null }).get(key)!
    g.jobs += 1
  }
  for (const p of pairs) {
    const key = keyOfJob.get(p.first.jobId)
    if (!key) continue
    groups.get(key)!.returns += 1
  }
  const out = [...groups.values()].map((g) => ({ ...g, ratePct: g.jobs > 0 ? (g.returns / g.jobs) * 100 : null }))
  return out.sort((a, b) => (b.ratePct ?? -1) - (a.ratePct ?? -1) || b.jobs - a.jobs)
}

export type ReworkSummary = { finishedJobs: number; returns: number; ratePct: number | null; returnCostUsd: number; returnRevenueUsd: number; unplaced: number }

export function summarizeRework(pairs: readonly ReworkPair[], rows: readonly JobSummaryEnrichedRow[]): ReworkSummary {
  const finished = rows.filter((r) => r.finished)
  const unplaced = rows.filter((r) => reworkAddressKey(r.row.job) == null).length
  return {
    finishedJobs: finished.length,
    returns: pairs.length,
    ratePct: finished.length > 0 ? (pairs.length / finished.length) * 100 : null,
    returnCostUsd: pairs.reduce((a, p) => a + p.returnCostUsd, 0),
    returnRevenueUsd: pairs.reduce((a, p) => a + p.returnRevenueUsd, 0),
    unplaced,
  }
}
