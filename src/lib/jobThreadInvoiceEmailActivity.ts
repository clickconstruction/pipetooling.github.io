import type { JobStripeEmailSendRow } from './fetchJobStripeEmailSendsForJobLedger'
import type { JobThreadEventActivityItem } from './jobActivityEvent'

/** Stripe "emailed customer" sends → generic `event` items (financial). */
export function stripeEmailSendsToActivityItems(
  rows: JobStripeEmailSendRow[],
): JobThreadEventActivityItem[] {
  return rows
    .filter((r) => (r.sent_at ?? '').trim().length > 0)
    .map((r) => ({
      kind: 'event' as const,
      event: {
        dedupeKey: `ev:stripeemail:${r.id}`,
        type: 'invoice_stripe_email_sent' as const,
        occurredAt: r.sent_at as string,
        actorName: null,
        summary: 'Invoice emailed to customer (Stripe)',
        financial: true,
        detail: { invoice_id: r.jobs_ledger_invoice_id, source_id: r.id },
      },
    }))
}
