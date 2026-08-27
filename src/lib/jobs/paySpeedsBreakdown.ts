/**
 * Pay-speeds breakdown view-model: the customers behind the Payment
 * forecast's pay-speeds strip, grouped from the same board rows the
 * forecast reads — zero extra fetches.
 *
 * Two tiers, split by the expected-pay kernel's own rule
 * (PAY_SPEED_MIN_SAMPLES): customers with a real median of their own rank
 * slowest-first (the top of that list is the follow-up list); customers
 * with thin history follow at the bottom of the same list with a "—"
 * median, because their forecasts run on the company median and pretending
 * otherwise would lie. Only customers with open billed money appear — this
 * is a chase surface, not an archive.
 */
import type { StageRow } from '../jobsStagesBoard'
import { stageRowBilledRemainingAmount } from './invoiceBilling'
import { PAY_SPEED_MIN_SAMPLES, type CustomerSegment, type PayReceipt, type PaySpeedData } from './billedExpectedPay'

export type PaySpeedCustomerRow = {
  customerId: string
  name: string
  segment: CustomerSegment | null
  /** Null = thin history (fewer than PAY_SPEED_MIN_SAMPLES payments) — forecast uses the company median. */
  medianDays: number | null
  samples: number
  /** Open billed dollars on the board right now (the header chips' sum rule). */
  open: number
  /** The measurable payments behind the median (v3 RPC; empty on older payloads). */
  receipts: PayReceipt[]
}

export type PaySpeedsBreakdown = {
  /** Customers with their own median, slowest first (ties: biggest open $ first). */
  ranked: PaySpeedCustomerRow[]
  /** Thin-history customers (company median applies), biggest open $ first. */
  thin: PaySpeedCustomerRow[]
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
      receipts: paySpeeds?.receipts[customerId] ?? [],
    })
  }
  const all = [...byCustomer.values()]
  const ranked = all
    .filter((c) => c.medianDays != null)
    .sort((a, b) => (b.medianDays ?? 0) - (a.medianDays ?? 0) || b.open - a.open)
  const thin = all.filter((c) => c.medianDays == null).sort((a, b) => b.open - a.open)
  return { ranked, thin }
}

/** "2026-05-01" → "05/01" — the receipt chips' compact date form. */
export function formatYmdSlash(ymd: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return ymd
  return `${m[1]}/${m[2]}`
}

export type ReceiptGapTone = 'fast' | 'mid' | 'slow' | 'neutral'

/**
 * Color rule for a receipt's gap pill, judged against the company median:
 * green at/under it, amber above, red at 2× or more ('neutral' when there is
 * no company median to compare against).
 */
export function receiptGapTone(gapDays: number, companyMedianDays: number | null): ReceiptGapTone {
  if (companyMedianDays == null || companyMedianDays <= 0) return 'neutral'
  if (gapDays >= companyMedianDays * 2) return 'slow'
  if (gapDays > companyMedianDays) return 'mid'
  return 'fast'
}

