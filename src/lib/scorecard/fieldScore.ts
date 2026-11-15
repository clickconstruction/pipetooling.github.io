/**
 * The field score (team scorecard, design spike 2026-11-15): gross profit on every paid field hour
 * over a window, against the hurdle. Gross profit is what the hours earned of their jobs' contracts
 * (`earnedRevenueInWindow`) less the hours' wages at the burden factor, the materials and the subs
 * dated in the window. The denominator is every paid field hour on a job, callbacks and waiting
 * included: an overrun hurts twice, in the labor and in the hours, and that is the point. One row
 * per job carries the same arithmetic, so the headline is the rows' sum and nothing else. Pure.
 */
import { clearsHurdle, usdPerHour, type Hurdle } from './hurdle'

export type FieldScoreJobInput = {
  jobId: string
  label: string
  status: string | null
  /** Paid field hours on the job in the window. */
  paidHours: number
  /** Those hours at raw wages; the kernel applies the burden. */
  laborUsdRaw: number
  /** What the window's hours earned of the contract; null when the job has no contract or no hours on record. */
  earnedUsd: number | null
  materialsUsd: number
  subUsd: number
  /** The job's total bill, for the no-bill flag. */
  totalBillUsd: number | null
}

export type FieldScoreJobRow = FieldScoreJobInput & {
  laborUsd: number
  grossProfitUsd: number
  perHourUsd: number | null
  clears: boolean | null
  flags: { noBill: boolean; noEarned: boolean }
}

export type FieldScore = {
  paidHours: number
  earnedUsd: number
  laborUsd: number
  materialsUsd: number
  subUsd: number
  grossProfitUsd: number
  perHourUsd: number | null
  clears: boolean | null
  burden: number
  hurdle: Hurdle
  rows: FieldScoreJobRow[]
  /** Jobs with paid hours and no bill on record: hours that cannot earn until someone bills them. */
  noBillCount: number
  verdict: string
}

const usd0 = (n: number): string => `${n < 0 ? '−' : ''}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`

export function buildFieldScore(args: { jobs: readonly FieldScoreJobInput[]; burden: number; hurdle: Hurdle }): FieldScore {
  const burden = Math.min(3, Math.max(1, args.burden || 1))
  const rows: FieldScoreJobRow[] = args.jobs
    .filter((j) => j.paidHours > 0 || j.materialsUsd !== 0 || j.subUsd !== 0)
    .map((j) => {
      const laborUsd = j.laborUsdRaw * burden
      const earned = j.earnedUsd ?? 0
      const gp = earned - laborUsd - j.materialsUsd - j.subUsd
      const perHour = j.paidHours > 0 ? gp / j.paidHours : null
      return {
        ...j,
        laborUsd,
        grossProfitUsd: gp,
        perHourUsd: perHour,
        clears: clearsHurdle(perHour, args.hurdle),
        flags: { noBill: j.paidHours > 0 && !(j.totalBillUsd != null && j.totalBillUsd > 0), noEarned: j.paidHours > 0 && j.earnedUsd == null },
      }
    })
    .sort((a, b) => b.paidHours - a.paidHours || a.label.localeCompare(b.label))
  const sum = (f: (r: FieldScoreJobRow) => number) => rows.reduce((acc, r) => acc + f(r), 0)
  const paidHours = sum((r) => r.paidHours)
  const earnedUsd = sum((r) => r.earnedUsd ?? 0)
  const laborUsd = sum((r) => r.laborUsd)
  const materialsUsd = sum((r) => r.materialsUsd)
  const subUsd = sum((r) => r.subUsd)
  const grossProfitUsd = earnedUsd - laborUsd - materialsUsd - subUsd
  const perHourUsd = paidHours > 0 ? grossProfitUsd / paidHours : null
  const clears = clearsHurdle(perHourUsd, args.hurdle)
  const noBillCount = rows.filter((r) => r.flags.noBill).length
  return {
    paidHours,
    earnedUsd,
    laborUsd,
    materialsUsd,
    subUsd,
    grossProfitUsd,
    perHourUsd,
    clears,
    burden,
    hurdle: args.hurdle,
    rows,
    noBillCount,
    verdict: fieldVerdictWords({ perHourUsd, paidHours, grossProfitUsd, clears, hurdle: args.hurdle }),
  }
}

export function fieldVerdictWords(s: Pick<FieldScore, 'perHourUsd' | 'paidHours' | 'grossProfitUsd' | 'clears' | 'hurdle'>): string {
  if (s.perHourUsd == null) return `No paid field hours in the last ${s.hurdle.windowDays} days.`
  const made = `The field made ${usd0(s.grossProfitUsd)} on ${Math.round(s.paidHours).toLocaleString('en-US')} paid hours, ${usdPerHour(s.perHourUsd)}.`
  if (s.clears == null || s.hurdle.hurdlePerHourUsd == null) return `${made} There is no hurdle to hold it to yet.`
  const gap = s.perHourUsd - s.hurdle.hurdlePerHourUsd
  return s.clears ? `${made} That clears the ${usdPerHour(s.hurdle.hurdlePerHourUsd)} hurdle by ${usdPerHour(gap)}.` : `${made} That is ${usdPerHour(-gap)} under the ${usdPerHour(s.hurdle.hurdlePerHourUsd)} hurdle.`
}

export type FieldOwner = { id: string; name: string }

export type FieldOwnerLine = {
  /** The superintendent, or null for the jobs no superintendent runs. */
  owner: FieldOwner | null
  jobs: number
  paidHours: number
  grossProfitUsd: number
  perHourUsd: number | null
  clears: boolean | null
  noBill: number
}

/**
 * The field score cut by who runs the job (the scoreboard's own mapping: the project's superintendents, else the
 * GC project's one). A job two superintendents share is split evenly between them, so the lines sum to the whole.
 * Jobs with no superintendent fold into one last line. Sorted by paid hours, the unowned line last.
 */
export function fieldByOwner(rows: readonly FieldScoreJobRow[], ownersByJob: ReadonlyMap<string, readonly FieldOwner[]>, hurdle: Pick<Hurdle, 'hurdlePerHourUsd'>): FieldOwnerLine[] {
  const lines = new Map<string | null, FieldOwnerLine>()
  const add = (owner: FieldOwner | null, r: FieldScoreJobRow, share: number) => {
    const key = owner?.id ?? null
    const line = lines.get(key) ?? { owner, jobs: 0, paidHours: 0, grossProfitUsd: 0, perHourUsd: null, clears: null, noBill: 0 }
    line.jobs += 1
    line.paidHours += r.paidHours * share
    line.grossProfitUsd += r.grossProfitUsd * share
    if (r.flags.noBill) line.noBill += 1
    lines.set(key, line)
  }
  for (const r of rows) {
    const owners = ownersByJob.get(r.jobId) ?? []
    if (owners.length === 0) add(null, r, 1)
    else for (const o of owners) add(o, r, 1 / owners.length)
  }
  return [...lines.values()]
    .map((l) => {
      const perHourUsd = l.paidHours > 0 ? l.grossProfitUsd / l.paidHours : null
      return { ...l, perHourUsd, clears: clearsHurdle(perHourUsd, hurdle) }
    })
    .sort((a, b) => (a.owner == null ? 1 : 0) - (b.owner == null ? 1 : 0) || b.paidHours - a.paidHours || (a.owner?.name ?? '').localeCompare(b.owner?.name ?? ''))
}

/** The reason a row reads as it does, for the drill-down. */
export function fieldRowNote(r: FieldScoreJobRow): string | null {
  if (r.flags.noBill) return 'Hours and no bill: nothing earned until someone bills it.'
  if (r.flags.noEarned) return 'No contract or no hours on record, so nothing earned.'
  if (r.perHourUsd == null) return 'Costs dated in the window with no hours.'
  return null
}
