import type { JobInvoiceActivityRow } from './fetchJobInvoicesForActivity'
import type { JobThreadEventActivityItem } from './jobActivityEvent'
import { formatUsd } from './projectsJobHistoryDayCosts'

/**
 * Invoice rows → generic `event` items. One invoice can emit up to four
 * milestones keyed by its dated columns; null-dated milestones are skipped.
 * All are financial.
 */
export function invoicesToActivityItems(rows: JobInvoiceActivityRow[]): JobThreadEventActivityItem[] {
  const items: JobThreadEventActivityItem[] = []
  for (const r of rows) {
    const amount = Number(r.amount ?? 0)
    if ((r.created_at ?? '').trim()) {
      items.push({
        kind: 'event',
        event: {
          dedupeKey: `ev:inv:${r.id}:created`,
          type: 'invoice_created',
          occurredAt: r.created_at as string,
          actorName: null,
          summary: `Invoice created ${formatUsd(amount)}`,
          financial: true,
          detail: { invoice_id: r.id, source_id: r.id, milestone: 'created' },
        },
      })
    }
    if ((r.billed_at ?? '').trim()) {
      items.push({
        kind: 'event',
        event: {
          dedupeKey: `ev:inv:${r.id}:billed`,
          type: 'invoice_billed',
          occurredAt: r.billed_at as string,
          actorName: null,
          summary: `Marked billed ${formatUsd(amount)}`,
          financial: true,
          detail: { invoice_id: r.id, source_id: r.id, milestone: 'billed' },
        },
      })
    }
    if ((r.sent_to_customer_at ?? '').trim()) {
      const channel = r.external_send_channel?.trim()
      items.push({
        kind: 'event',
        event: {
          dedupeKey: `ev:inv:${r.id}:sent`,
          type: 'invoice_sent',
          occurredAt: r.sent_to_customer_at as string,
          actorName: null,
          summary: `Invoice sent to customer${channel ? ` (${channel})` : ''}`,
          financial: true,
          detail: { invoice_id: r.id, source_id: r.id, milestone: 'sent', channel: r.external_send_channel },
        },
      })
    }
    if ((r.agreed_write_down_at ?? '').trim()) {
      const prev = r.agreed_write_down_previous_amount
      const note = r.agreed_write_down_note?.trim()
      const change = prev != null ? `${formatUsd(Number(prev))} → ${formatUsd(amount)}` : formatUsd(amount)
      items.push({
        kind: 'event',
        event: {
          dedupeKey: `ev:inv:${r.id}:write_down`,
          type: 'invoice_write_down',
          occurredAt: r.agreed_write_down_at as string,
          actorName: null,
          summary: `Agreed write-down: ${change}${note ? ` — ${note}` : ''}`,
          financial: true,
          detail: { invoice_id: r.id, source_id: r.id, milestone: 'write_down', previous_amount: prev },
        },
      })
    }
  }
  return items
}
