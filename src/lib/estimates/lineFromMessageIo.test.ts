import { describe, expect, it, vi } from 'vitest'
import { becameFromRows, lineContactOf, lineEstimatesOf } from './lineFromMessageIo'

vi.mock('../supabase', () => ({ supabase: {} }))

// Dana Whitfield and her Helotes job, the mockups' demo people; nothing here is a real row.
describe('the reads behind Line on the estimate', () => {
  it('reads a person under their own customer, or under the customer of the person at it', () => {
    expect(lineContactOf({ id: 'c-dana', kind: 'customer', name: ' Dana Whitfield ', goes_by: null, customer_id: 'cust-dana' })).toEqual({
      id: 'c-dana',
      kind: 'customer',
      name: 'Dana Whitfield',
      first: 'Dana',
      customerId: 'cust-dana',
    })
    expect(lineContactOf({ id: 'c-mark', kind: 'customer', name: 'Mark Whitfield', goes_by: 'Mark', customer_id: null }, 'cust-dana').customerId).toBe('cust-dana')
    expect(lineContactOf({ id: 'c-x', kind: 'customer', name: null, goes_by: null, customer_id: null }).customerId).toBeNull()
  })

  it('maps each message on an estimate to its number, and leaves out one whose estimate it cannot read', () => {
    const became = becameFromRows(
      [
        { id: 'm-heater', estimate_id: 'e-1044' },
        { id: 'm-bib', estimate_id: 'e-1044' },
        { id: 'm-gone', estimate_id: 'e-hidden' },
        { id: 'm-none', estimate_id: null },
      ],
      [{ id: 'e-1044', estimate_number: 1044 }],
    )
    expect([...became]).toEqual([
      ['m-heater', { estimateId: 'e-1044', estimateNumber: 1044 }],
      ['m-bib', { estimateId: 'e-1044', estimateNumber: 1044 }],
    ])
  })

  it('reads the job’s estimates as the kernel takes them, on that job, with when each was read and whether it has options', () => {
    const rows = [
      {
        id: 'e-1044',
        doc_kind: 'estimate',
        status: 'draft',
        estimate_number: 1044,
        line_items_snapshot: [{ line_item: 'Water heater swap', description: '50 gallon gas', quantity: '1', unit_price_cents: 185000 }],
        options_snapshot: null,
        updated_at: '2026-10-12T20:00:00.123456+00:00',
      },
      { id: 'e-1050', doc_kind: null, status: null, estimate_number: 1050, line_items_snapshot: 'not lines', options_snapshot: [{ key: 'a' }], updated_at: '2026-10-12T20:01:00+00:00' },
      { id: 'e-new', doc_kind: 'estimate', status: 'draft', estimate_number: null, line_items_snapshot: [], options_snapshot: null, updated_at: '2026-10-12T20:02:00+00:00' },
    ]
    expect(lineEstimatesOf('j-helotes', rows)).toEqual([
      {
        id: 'e-1044',
        jobId: 'j-helotes',
        docKind: 'estimate',
        status: 'draft',
        number: 1044,
        lines: [{ line_item: 'Water heater swap', description: '50 gallon gas', quantity: 1, unit_price_cents: 185000, amount_cents: 185000 }],
        seenAt: '2026-10-12T20:00:00.123456+00:00',
        hasOptions: false,
      },
      { id: 'e-1050', jobId: 'j-helotes', docKind: 'estimate', status: '', number: 1050, lines: [], seenAt: '2026-10-12T20:01:00+00:00', hasOptions: true },
    ])
  })
})
