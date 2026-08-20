import type { StageRow } from '../jobsStagesBoard'
import { stageRowBilledAgeDays, stageRowBilledRemainingAmount } from './invoiceBilling'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'

/**
 * Billed Awaiting Payment aging chart (v2.1871) — pure kernel.
 *
 * One bubble per billed board row that has an aging date and money still open:
 * x = days in Billed (the SAME clock as the header's 30+/90+ chips —
 * stageRowBilledAgeDays), y = open dollars on the row (same as the chips'
 * sums — stageRowBilledRemainingAmount) on a log scale, bubble area = the
 * JOB's lifetime cost (six streams, from get_billed_aging_costs — wage-derived,
 * so the whole chart is dev/controller-gated). A job whose cost exceeds its
 * revenue is flagged "underwater". Rows the chips don't age (no invoice date,
 * nothing left to pay) are skipped and counted so the chart never silently
 * hides money.
 */

export type BilledAgingPoint = {
  /** Stable row key: the invoice id (only invoice-bearing rows plot). */
  invoiceId: string
  jobId: string
  /** "964 PLUM · Pondhill demo" */
  label: string
  customerName: string | null
  days: number
  open: number
  /** Job lifetime cost; null when the costs map has no row (treated as 0-size dot). */
  cost: number | null
  /** cost > job revenue (revenue > 0) — waiting on this one hurts twice. */
  underwater: boolean
}

export type BilledAgingStats = {
  plottedCount: number
  openTotal: number
  medianDays: number | null
  count90: number
  sum90: number
  underwaterCount: number
  underwaterTotal: number
  /** Rows with open money but no aging date — listed so nothing hides. */
  skippedNoDate: number
}

export type BilledAgingChartData = { points: BilledAgingPoint[]; stats: BilledAgingStats }

export function buildBilledAgingChart(
  rows: StageRow[],
  costsByJobId: Record<string, number> | null,
  now = new Date(),
): BilledAgingChartData {
  const points: BilledAgingPoint[] = []
  let skippedNoDate = 0
  for (const r of rows) {
    const open = stageRowBilledRemainingAmount(r)
    if (open <= 0) continue
    const days = stageRowBilledAgeDays(r, now)
    if (r.kind === 'job' || days == null) {
      skippedNoDate++
      continue
    }
    const job = r.job
    const cost = costsByJobId ? (typeof costsByJobId[job.id] === 'number' ? costsByJobId[job.id]! : null) : null
    const revenue = Number(job.revenue ?? 0)
    const number = effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—'
    const name = (job.job_name ?? '').trim()
    points.push({
      invoiceId: r.inv.id,
      jobId: job.id,
      label: name ? `${number} · ${name}` : number,
      customerName: (job.customer_name ?? '').trim() || null,
      days,
      open,
      cost,
      underwater: cost != null && revenue > 0 && cost > revenue,
    })
  }

  const sortedDays = points.map((p) => p.days).sort((a, b) => a - b)
  const medianDays =
    sortedDays.length === 0
      ? null
      : sortedDays.length % 2 === 1
        ? sortedDays[(sortedDays.length - 1) / 2]!
        : Math.round((sortedDays[sortedDays.length / 2 - 1]! + sortedDays[sortedDays.length / 2]!) / 2)

  const over90 = points.filter((p) => p.days >= 90)
  const underwater = points.filter((p) => p.underwater)
  return {
    points,
    stats: {
      plottedCount: points.length,
      openTotal: points.reduce((s, p) => s + p.open, 0),
      medianDays,
      count90: over90.length,
      sum90: over90.reduce((s, p) => s + p.open, 0),
      underwaterCount: underwater.length,
      underwaterTotal: underwater.reduce((s, p) => s + p.open, 0),
      skippedNoDate,
    },
  }
}

/* ── Scales (pure, pixel-space; the modal feeds plot bounds) ──────────────── */

/** X: linear days → px; domain 0..max(120, maxDays rounded up to 30). */
export function billedAgingXDomainMax(points: BilledAgingPoint[]): number {
  const maxDays = points.reduce((m, p) => Math.max(m, p.days), 0)
  return Math.max(120, Math.ceil(maxDays / 30) * 30)
}

export function billedAgingX(days: number, domainMax: number, x0: number, x1: number): number {
  const clamped = Math.max(0, Math.min(days, domainMax))
  return x0 + (clamped / domainMax) * (x1 - x0)
}

/**
 * Y: log10 dollars → px. Domain floor $100 (anything smaller pins to the
 * floor), ceiling = next 1/3/10 step above the max point.
 */
export const BILLED_AGING_Y_FLOOR = 100

export function billedAgingYDomainMax(points: BilledAgingPoint[]): number {
  const maxOpen = points.reduce((m, p) => Math.max(m, p.open), 0)
  let step = 1000
  while (step < maxOpen) {
    if (step * 3 >= maxOpen) return step * 3
    if (step * 10 >= maxOpen) return step * 10
    step *= 10
  }
  return Math.max(step, 1000)
}

export function billedAgingY(open: number, domainMax: number, yTop: number, yBottom: number): number {
  const v = Math.max(BILLED_AGING_Y_FLOOR, Math.min(open, domainMax))
  const t = (Math.log10(v) - Math.log10(BILLED_AGING_Y_FLOOR)) / (Math.log10(domainMax) - Math.log10(BILLED_AGING_Y_FLOOR))
  return yBottom - t * (yBottom - yTop)
}

/** Labeled log ticks between the floor and the domain max (1/3 pattern). */
export function billedAgingYTicks(domainMax: number): number[] {
  const ticks: number[] = []
  let v = BILLED_AGING_Y_FLOOR
  while (v <= domainMax) {
    ticks.push(v)
    if (ticks.length > 20) break
    const next3 = v * 3
    ticks.push(Math.min(next3, domainMax))
    if (next3 >= domainMax) break
    v *= 10
    if (v > domainMax) break
  }
  return [...new Set(ticks.filter((t) => t <= domainMax))]
}

/** Bubble radius: area ∝ cost. $500→~4.5px, $5k→~14px, $20k→~28px; null/tiny cost = 3px dot. */
export function billedAgingRadius(cost: number | null): number {
  if (cost == null || cost <= 0) return 3
  return Math.max(3.5, Math.sqrt(cost) / 5)
}

/** Compact money label for stats/ticks: 100→"$100", 3000→"$3k", 18200→"$18.2k". */
export function billedAgingMoneyLabel(v: number): string {
  if (v >= 1000) {
    const k = v / 1000
    const s = k >= 100 ? Math.round(k).toString() : (Math.round(k * 10) / 10).toString()
    return `$${s.replace(/\.0$/, '')}k`
  }
  return `$${Math.round(v).toLocaleString('en-US')}`
}
