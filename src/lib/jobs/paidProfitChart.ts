import type { JobWithDetails } from '../../types/jobWithDetails'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'

/**
 * Paid in Full profit chart (v2.1879) — pure kernel.
 *
 * One bubble per PAID job: x = approved clock-session hours on the job,
 * y = profit (revenue − the six-stream lifetime cost, negatives included —
 * linear axis with a bold $0 line), bubble area = revenue. The angle from the
 * origin is the job's profit per clocked hour; the modal draws $/hr guide
 * lines to make that reading explicit. Costs + hours come from
 * get_paid_profit_stats() (wage-derived ⇒ dev/controller gate). Jobs missing
 * from the stats map are NOT plotted (a zero-cost guess would fake pure
 * profit) — they're counted instead.
 */

export type PaidProfitStatsRow = { cost: number; hours: number }

export type PaidProfitPoint = {
  jobId: string
  /** "957 PLUM · Creekside repipe" */
  label: string
  customerName: string | null
  hours: number
  revenue: number
  cost: number
  profit: number
  /** Profit per clocked hour; null when hours are ~0 (sub-only jobs). */
  perHour: number | null
}

export type PaidProfitStats = {
  plottedCount: number
  profitTotal: number
  hoursTotal: number
  /** Median $/hr across jobs with clocked time. */
  medianPerHour: number | null
  loserCount: number
  loserTotal: number
  /** Paid jobs with no stats row (RPC gap) — counted, never faked as profit. */
  skippedNoStats: number
}

export type PaidProfitChartData = { points: PaidProfitPoint[]; stats: PaidProfitStats }

export type PaidProfitWindow = 90 | 180 | 365 | null

/** Latest payment date on the job (paid_on), for the time-window filter. Null = no dated payments. */
export function jobLatestPaidOn(job: JobWithDetails): string | null {
  let latest: string | null = null
  for (const p of job.payments ?? []) {
    const d = (p.paid_on ?? '').trim().slice(0, 10)
    if (d && (latest == null || d > latest)) latest = d
  }
  return latest
}

export function buildPaidProfitChart(
  paidJobs: JobWithDetails[],
  statsByJobId: Record<string, PaidProfitStatsRow> | null,
  options: {
    /** Only jobs whose latest payment is within N days (null = all time). Undated jobs pass only on All. */
    windowDays?: PaidProfitWindow
    /** The configured overhead "office job" — an expense bucket, never a job. */
    excludeJobId?: string | null
    now?: Date
  } = {},
): PaidProfitChartData {
  const { windowDays = null, excludeJobId = null, now = new Date() } = options
  const cutoffYmd =
    windowDays == null
      ? null
      : new Date(now.getTime() - windowDays * 86_400_000).toISOString().slice(0, 10)
  const points: PaidProfitPoint[] = []
  let skippedNoStats = 0
  for (const job of paidJobs) {
    if (excludeJobId != null && job.id === excludeJobId) continue
    if (cutoffYmd != null) {
      const paidOn = jobLatestPaidOn(job)
      if (paidOn == null || paidOn < cutoffYmd) continue
    }
    const row = statsByJobId?.[job.id]
    if (!row || typeof row.cost !== 'number' || typeof row.hours !== 'number') {
      skippedNoStats++
      continue
    }
    // Nothing tracked at all (no cost, no clocked time) ⇒ "profit" would just
    // echo revenue — a pass-through, not a job we can grade. Count, don't plot.
    if (row.cost <= 0 && row.hours < 0.5) {
      skippedNoStats++
      continue
    }
    const revenue = Number(job.revenue ?? 0)
    const profit = revenue - row.cost
    const number = effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—'
    const name = (job.job_name ?? '').trim()
    points.push({
      jobId: job.id,
      label: name ? `${number} · ${name}` : number,
      customerName: (job.customer_name ?? '').trim() || null,
      hours: Math.max(0, row.hours),
      revenue,
      cost: row.cost,
      profit,
      perHour: row.hours >= 0.5 ? profit / row.hours : null,
    })
  }

  const rates = points
    .map((p) => p.perHour)
    .filter((r): r is number => r != null)
    .sort((a, b) => a - b)
  const medianPerHour =
    rates.length === 0
      ? null
      : rates.length % 2 === 1
        ? rates[(rates.length - 1) / 2]!
        : (rates[rates.length / 2 - 1]! + rates[rates.length / 2]!) / 2

  const losers = points.filter((p) => p.profit < 0)
  return {
    points,
    stats: {
      plottedCount: points.length,
      profitTotal: points.reduce((s, p) => s + p.profit, 0),
      hoursTotal: points.reduce((s, p) => s + p.hours, 0),
      medianPerHour,
      loserCount: losers.length,
      loserTotal: losers.reduce((s, p) => s + p.profit, 0),
      skippedNoStats,
    },
  }
}

/* ── Scales (pure, pixel-space) ───────────────────────────────────────────── */

/** Next "nice" 1/2/5×10ⁿ at or above v (min 1). */
export function niceCeil(v: number): number {
  if (v <= 1) return 1
  const mag = Math.pow(10, Math.floor(Math.log10(v)))
  for (const m of [1, 2, 5, 10]) {
    if (mag * m >= v) return mag * m
  }
  return mag * 10
}

/** X domain: clocked hours, 0..niceCeil(max) (min 40 so tiny boards don't zoom silly). */
export function paidProfitXDomainMax(points: PaidProfitPoint[]): number {
  const maxH = points.reduce((m, p) => Math.max(m, p.hours), 0)
  return Math.max(40, niceCeil(maxH))
}

/** Y domain: [min(0, niceFloor(minProfit)), niceCeil(maxProfit)] — always spans $0. */
export function paidProfitYDomain(points: PaidProfitPoint[]): { min: number; max: number } {
  const maxP = points.reduce((m, p) => Math.max(m, p.profit), 0)
  const minP = points.reduce((m, p) => Math.min(m, p.profit), 0)
  return {
    min: minP >= 0 ? 0 : -niceCeil(-minP),
    max: Math.max(1000, niceCeil(maxP)),
  }
}

/**
 * X: square-root scale (v2.1889) — job hours are heavily right-skewed (many
 * 2–20h jobs, a few 300h+), and a linear axis mashes the mass into the left
 * edge. sqrt spreads the cluster while keeping order; ticks stay labeled in
 * real hours.
 */
export function paidProfitX(hours: number, domainMax: number, x0: number, x1: number): number {
  const clamped = Math.max(0, Math.min(hours, domainMax))
  return x0 + (Math.sqrt(clamped) / Math.sqrt(domainMax)) * (x1 - x0)
}

/** Signed sqrt: the Y transform (keeps the $0 line exact, spreads small profits). */
function signedSqrt(v: number): number {
  return Math.sign(v) * Math.sqrt(Math.abs(v))
}

export function paidProfitY(
  profit: number,
  domain: { min: number; max: number },
  yTop: number,
  yBottom: number,
): number {
  const v = Math.max(domain.min, Math.min(profit, domain.max))
  const t0 = signedSqrt(domain.min)
  const t1 = signedSqrt(domain.max)
  return yBottom - ((signedSqrt(v) - t0) / (t1 - t0)) * (yBottom - yTop)
}

/** Nearest 1/2/5×10ⁿ to v (for tick rounding). */
function niceRound(v: number): number {
  if (v <= 0) return 0
  const mag = Math.pow(10, Math.floor(Math.log10(v)))
  let best = mag
  for (const m of [1, 2, 5, 10]) {
    if (Math.abs(mag * m - v) < Math.abs(best - v)) best = mag * m
  }
  return best
}

/** Ticks evenly spaced in sqrt space, rounded to nice values (0 + max always present). */
export function sqrtSpacedTicks(max: number, count = 4): number[] {
  const out = new Set<number>([0, max])
  for (let i = 1; i < count; i++) {
    const nice = niceRound(max * Math.pow(i / count, 2))
    if (nice > 0 && nice < max) out.add(nice)
  }
  return [...out].sort((a, b) => a - b)
}

/** Y ticks under the signed-sqrt scale: sqrt-spaced positives + mirrored negatives + 0. */
export function paidProfitYTicks(domain: { min: number; max: number }): number[] {
  const ticks = new Set<number>(sqrtSpacedTicks(domain.max, 4))
  if (domain.min < 0) {
    for (const t of sqrtSpacedTicks(-domain.min, 2)) ticks.add(-t)
  }
  ticks.add(0)
  return [...ticks].sort((a, b) => a - b)
}

/** Bubble radius: area ∝ revenue, sized for a 600-job board. $1k→3px, $25k→~13px, capped 22px. */
export function paidProfitRadius(revenue: number): number {
  if (revenue <= 0) return 3
  return Math.min(22, Math.max(3, Math.sqrt(revenue) / 12))
}

/** Signed compact money: -6800 → "−$6.8k". */
export function paidProfitMoneyLabel(v: number): string {
  const abs = Math.abs(v)
  const core =
    abs >= 1000
      ? `$${(abs / 1000 >= 100 ? Math.round(abs / 1000).toString() : (Math.round(abs / 100) / 10).toString()).replace(/\.0$/, '')}k`
      : `$${Math.round(abs).toLocaleString('en-US')}`
  return v < 0 ? `−${core}` : core
}
