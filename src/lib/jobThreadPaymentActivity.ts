import type { JobPaymentRow } from './fetchJobPaymentsForJobLedger'
import type { JobThreadEventActivityItem } from './jobActivityEvent'
import { formatUsd } from './projectsJobHistoryDayCosts'

/** ISO sort key: prefer the business paid-on date (midday), else the record time. */
function paymentOccurredAt(row: JobPaymentRow): string {
  const paidOn = row.paid_on?.trim()
  if (paidOn) return new Date(`${paidOn}T12:00:00`).toISOString()
  return row.created_at ?? new Date(0).toISOString()
}

/** Recorded payments → generic `event` items (financial). */
export function paymentsToActivityItems(rows: JobPaymentRow[]): JobThreadEventActivityItem[] {
  return rows.map((r) => {
    const typePart = r.payment_type?.trim()
    const refPart = r.reference_number?.trim()
    const qualifier = typePart
      ? ` (${typePart}${refPart ? ` · ${refPart}` : ''})`
      : refPart
        ? ` (${refPart})`
        : ''
    return {
      kind: 'event' as const,
      event: {
        dedupeKey: `ev:payment:${r.id}`,
        type: 'payment_added' as const,
        occurredAt: paymentOccurredAt(r),
        actorName: null,
        summary: `Payment ${formatUsd(Number(r.amount ?? 0))}${qualifier}`,
        financial: true,
        detail: { amount: r.amount, payment_type: r.payment_type, source_id: r.id },
      },
    }
  })
}
