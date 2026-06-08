import { describe, expect, it } from 'vitest'
import type { JobInvoiceActivityRow } from './fetchJobInvoicesForActivity'
import { invoicesToActivityItems } from './jobThreadInvoiceActivity'

const row = (over: Partial<JobInvoiceActivityRow>): JobInvoiceActivityRow =>
  ({
    id: 'i1',
    amount: 1000,
    status: 'billed',
    created_at: '2026-06-01T10:00:00Z',
    billed_at: '2026-06-02T10:00:00Z',
    sent_to_customer_at: '2026-06-03T10:00:00Z',
    external_send_channel: 'stripe',
    agreed_write_down_at: null,
    agreed_write_down_note: null,
    agreed_write_down_previous_amount: null,
    ...over,
  }) as JobInvoiceActivityRow

describe('invoicesToActivityItems', () => {
  it('emits one item per non-null dated milestone with distinct keys', () => {
    const items = invoicesToActivityItems([row({ id: 'inv' })])
    expect(items.map((i) => i.event.type)).toEqual(['invoice_created', 'invoice_billed', 'invoice_sent'])
    expect(items.map((i) => i.event.dedupeKey)).toEqual([
      'ev:inv:inv:created',
      'ev:inv:inv:billed',
      'ev:inv:inv:sent',
    ])
    expect(items.every((i) => i.event.financial)).toBe(true)
    expect(items[2]!.event.summary).toBe('Invoice sent to customer (stripe)')
  })

  it('skips null-dated milestones', () => {
    const items = invoicesToActivityItems([
      row({ billed_at: null, sent_to_customer_at: null }),
    ])
    expect(items.map((i) => i.event.type)).toEqual(['invoice_created'])
  })

  it('emits a write-down milestone with previous→new amounts and note', () => {
    const items = invoicesToActivityItems([
      row({
        id: 'w',
        amount: 800,
        created_at: null,
        billed_at: null,
        sent_to_customer_at: null,
        agreed_write_down_at: '2026-06-05T10:00:00Z',
        agreed_write_down_previous_amount: 1000,
        agreed_write_down_note: 'customer dispute',
      }),
    ])
    expect(items).toHaveLength(1)
    expect(items[0]!.event.type).toBe('invoice_write_down')
    expect(items[0]!.event.summary).toBe('Agreed write-down: $1,000.00 → $800.00 — customer dispute')
  })
})
