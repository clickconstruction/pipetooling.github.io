/**
 * Pay-speeds breakdown view-model: the customers behind the Payment
 * forecast's pay-speeds strip, grouped from the same board rows the
 * forecast reads — zero extra fetches.
 *
 * Two tiers, split by the expected-pay kernel's own rule
 * (PAY_SPEED_MIN_SAMPLES): customers with a real median of their own rank
 * slowest-first (the top of that list is the follow-up list); customers
 * with thin history sit apart, because their forecasts run on the company
 * median and pretending otherwise would lie. Only customers with open
 * billed money appear — this is a chase surface, not an archive.
 */
import type { StageRow } from '../jobsStagesBoard'
import { stageRowBilledRemainingAmount } from './invoiceBilling'
import { PAY_SPEED_MIN_SAMPLES, type CustomerSegment, type PaySpeedData } from './billedExpectedPay'

export type PaySpeedCustomerRow = {
  customerId: string
  name: string
  segment: CustomerSegment | null
  /** Null = thin history (fewer than PAY_SPEED_MIN_SAMPLES payments) — forecast uses the company median. */
  medianDays: number | null
  samples: number
  /** Open billed dollars on the board right now (the header chips' sum rule). */
  open: number
}

export type PaySpeedsBreakdown = {
  /** Customers with their own median, slowest first (ties: biggest open $ first). */
  ranked: PaySpeedCustomerRow[]
  /** Thin-history customers (company median applies), biggest open $ first. */
  thin: PaySpeedCustomerRow[]
  /** Largest ranked median, for bar scaling (0 when ranked is empty). */
  maxDays: number
}

export function buildPaySpeedsBreakdown(rows: StageRow[], paySpeeds: PaySpeedData | null): PaySpeedsBreakdown {
  const byCustomer = new Map<string, PaySpeedCustomerRow>()
  for (const r of rows) {
    if (r.kind === 'job') continue
    const open = stageRowBilledRemainingAmount(r)
    if (open <= 0) continue
    const customerId = r.job.customer_id
    if (!customerId) continue
    const existing = byCustomer.get(customerId)
    if (existing) {
      existing.open += open
      continue
    }
    const own = paySpeeds?.customers[customerId]
    const hasOwnMedian = own != null && own.samples >= PAY_SPEED_MIN_SAMPLES
    byCustomer.set(customerId, {
      customerId,
      name: (r.job.customer_name ?? '').trim() || '—',
      segment: paySpeeds?.customerTypes[customerId] ?? null,
      medianDays: hasOwnMedian ? own.medianDays : null,
      samples: own?.samples ?? 0,
      open,
    })
  }
  const all = [...byCustomer.values()]
  const ranked = all
    .filter((c) => c.medianDays != null)
    .sort((a, b) => (b.medianDays ?? 0) - (a.medianDays ?? 0) || b.open - a.open)
  const thin = all.filter((c) => c.medianDays == null).sort((a, b) => b.open - a.open)
  return { ranked, thin, maxDays: ranked.reduce((m, c) => Math.max(m, c.medianDays ?? 0), 0) }
}

export type PaySpeedBucket = {
  label: string
  min: number
  max: number
  res: PaySpeedCustomerRow[]
  comm: PaySpeedCustomerRow[]
}

/** Histogram buckets for the "count by speed" chart variant; unclassified customers count as commercial-lane-less — they land in `res` only if tagged. */
export function bucketPaySpeeds(ranked: PaySpeedCustomerRow[]): PaySpeedBucket[] {
  const defs = [
    { label: '0–7d', min: 0, max: 7 },
    { label: '8–14d', min: 8, max: 14 },
    { label: '15–21d', min: 15, max: 21 },
    { label: '22–30d', min: 22, max: 30 },
    { label: '31–45d', min: 31, max: 45 },
    { label: '45d+', min: 46, max: Number.POSITIVE_INFINITY },
  ]
  return defs.map((d) => ({
    ...d,
    max: d.max,
    res: ranked.filter((c) => c.segment === 'residential' && (c.medianDays ?? 0) >= d.min && (c.medianDays ?? 0) <= d.max),
    comm: ranked.filter((c) => c.segment !== 'residential' && (c.medianDays ?? 0) >= d.min && (c.medianDays ?? 0) <= d.max),
  }))
}
