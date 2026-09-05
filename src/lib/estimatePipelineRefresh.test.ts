import { describe, expect, it } from 'vitest'
import {
  computeEstimateListReadiness,
  computeSentWait,
  computeLedgerTotals,
  ledgerRowPasses,
  estimateDraftMeaningfulLineCount,
  isEmptyEstimateDraft,
  readinessDots,
  splitFollowupRows,
  type EstimatePipelineRowLike,
} from './estimatePipelineRefresh'

function row(overrides: Partial<EstimatePipelineRowLike>): EstimatePipelineRowLike {
  return {
    status: 'draft',
    customer_id: null,
    customer_email: null,
    title: null,
    line_items_snapshot: [],
    total_cents: 0,
    doc_kind: 'estimate',
    change_order_fields: null,
    terms_snapshot: null,
    customers: null,
    ...overrides,
  }
}

const STUB = { line_item: 'Custom Service Visit', description: '', quantity: 1, unit_price_cents: 0, amount_cents: 0 }

describe('isEmptyEstimateDraft', () => {
  it('flags a bare draft, including one carrying only the legacy stub line', () => {
    expect(isEmptyEstimateDraft(row({}))).toBe(true)
    expect(isEmptyEstimateDraft(row({ line_items_snapshot: [STUB] }))).toBe(true)
  })

  it('spares drafts with any real content', () => {
    expect(isEmptyEstimateDraft(row({ customer_id: 'c1' }))).toBe(false)
    expect(isEmptyEstimateDraft(row({ title: 'Repipe' }))).toBe(false)
    expect(
      isEmptyEstimateDraft(row({ line_items_snapshot: [{ ...STUB, line_item: 'Water heater', amount_cents: 100 }] })),
    ).toBe(false)
    expect(
      isEmptyEstimateDraft(
        row({ doc_kind: 'change_order', change_order_fields: { description_of_change: 'add bath' } }),
      ),
    ).toBe(false)
    expect(isEmptyEstimateDraft(row({ terms_snapshot: 'Net 30' }))).toBe(false)
  })

  it('never flags non-drafts', () => {
    expect(isEmptyEstimateDraft(row({ status: 'sent' }))).toBe(false)
  })
})

describe('meaningful line count', () => {
  it('ignores the stub in both shapes and blank rows; counts priced or labeled lines', () => {
    expect(estimateDraftMeaningfulLineCount([STUB], false)).toBe(0)
    expect(
      estimateDraftMeaningfulLineCount(
        [{ line_item: '', description: 'Custom Service Visit', quantity: 1, unit_price_cents: 0, amount_cents: 0 }],
        false,
      ),
    ).toBe(0)
    expect(estimateDraftMeaningfulLineCount([{ ...STUB, unit_price_cents: 5000, amount_cents: 5000 }], false)).toBe(1)
    // CO credit lines count (negative survives normalize)
    expect(
      estimateDraftMeaningfulLineCount(
        [{ line_item: 'Credit — lav', description: '', quantity: 1, unit_price_cents: -39000, amount_cents: -39000 }],
        true,
      ),
    ).toBe(1)
  })
})

describe('list readiness', () => {
  it('reads customer email from the embedded customer contact_info', () => {
    const r = computeEstimateListReadiness(
      row({
        customer_id: 'c1',
        customers: { contact_info: { email: 'a@b.com' } },
        line_items_snapshot: [{ ...STUB, line_item: 'Repipe', unit_price_cents: 100, amount_cents: 100 }],
      }),
    )
    expect(r.sendGate.ready).toBe(true)
    const d = readinessDots(r)
    expect(d.ready).toBe(true)
    expect(d.label).toBe('ready to send')
  })

  it('dots and shortened label for an untouched CO', () => {
    const d = readinessDots(computeEstimateListReadiness(row({ doc_kind: 'change_order' })))
    expect(d.ready).toBe(false)
    expect(d.done + d.todo).toBe(5)
    expect(d.label).toBe('3 left: customer · the change · cost lines')
  })
})

describe('computeSentWait', () => {
  const now = Date.parse('2026-08-20T18:00:00Z')

  it('neutral under a week, warn at 7+, null when never sent', () => {
    expect(computeSentWait({ change_order_fields: null, sent_at: '2026-08-18T18:00:00Z' }, now)).toMatchObject({
      level: 'ok',
      label: 'sent 2d ago',
    })
    expect(computeSentWait({ change_order_fields: null, sent_at: '2026-08-11T12:00:00Z' }, now)).toMatchObject({
      level: 'warn',
      label: 'sent 9d ago — nudge?',
    })
    expect(computeSentWait({ change_order_fields: null, sent_at: null }, now)).toBeNull()
    expect(computeSentWait({ change_order_fields: null, sent_at: '2026-08-20T15:00:00Z' }, now)?.label).toBe('sent today')
  })

  it('overdue response-by beats age, even on a fresh send', () => {
    const r = computeSentWait(
      { change_order_fields: { response_requested_by: '2026-08-15' }, sent_at: '2026-08-19T12:00:00Z' },
      now,
    )
    expect(r).toMatchObject({ level: 'overdue', label: 'response requested by 8/15 — 5d overdue' })
  })

  it('future response-by stays neutral', () => {
    const r = computeSentWait(
      { change_order_fields: { response_requested_by: '2026-08-25' }, sent_at: '2026-08-18T12:00:00Z' },
      now,
    )
    expect(r?.level).toBe('ok')
  })
})

describe('ledger money view', () => {
  const now = Date.parse('2026-08-20T18:00:00Z')
  const L = [
    { status: 'customer_accepted', doc_kind: 'estimate', total_cents: 678000, job_ledger_id: 'j1', acceptor_consented_at: '2026-08-12T10:00:00Z', updated_at: '2026-08-12T10:00:00Z' },
    { status: 'customer_accepted', doc_kind: 'change_order', total_cents: 245000, job_ledger_id: null, acceptor_consented_at: '2026-08-19T10:00:00Z', updated_at: '2026-08-19T10:00:00Z' },
    { status: 'customer_accepted', doc_kind: 'estimate', total_cents: 100000, job_ledger_id: 'j2', acceptor_consented_at: '2026-07-02T10:00:00Z', updated_at: '2026-07-02T10:00:00Z' },
    { status: 'sent', doc_kind: 'estimate', total_cents: 460000, job_ledger_id: null, acceptor_consented_at: null, updated_at: '2026-08-18T10:00:00Z' },
    { status: 'declined', doc_kind: 'change_order', total_cents: 98000, job_ledger_id: null, acceptor_consented_at: null, updated_at: '2026-08-01T10:00:00Z' },
  ]

  it('totals: accepted-this-month, outstanding sent, accepted-unlinked', () => {
    expect(computeLedgerTotals(L, now)).toEqual({
      acceptedThisMonthCents: 678000 + 245000,
      outstandingSentCents: 460000,
      acceptedUnlinkedCents: 245000,
    })
  })

  it('filters: closed toggle, kind, and date window', () => {
    const base = { kind: 'all' as const, includeClosed: false, withinDays: 0 }
    expect(L.filter((r) => ledgerRowPasses(r, base, now))).toHaveLength(4)
    expect(L.filter((r) => ledgerRowPasses(r, { ...base, includeClosed: true }, now))).toHaveLength(5)
    expect(L.filter((r) => ledgerRowPasses(r, { ...base, kind: 'change_order' }, now))).toHaveLength(1)
    expect(L.filter((r) => ledgerRowPasses(r, { ...base, withinDays: 30 }, now))).toHaveLength(3)
  })
})

describe('splitFollowupRows', () => {
  const row = (id: string, status: string, updated_at: string, doc_kind: string | null = null) => ({ id, status, updated_at, doc_kind })

  it('declined rows get their own bucket instead of hiding in Sent (J17-N2)', () => {
    const b = splitFollowupRows([
      row('d', 'draft', '2026-09-01'),
      row('s', 'sent', '2026-09-02'),
      row('x', 'declined', '2026-09-03'),
      row('a', 'customer_accepted', '2026-09-04'),
      row('old', 'superseded', '2026-09-05'),
    ])
    expect(b.unsent.map((r) => r.id)).toEqual(['d'])
    expect(b.sent.map((r) => r.id)).toEqual(['s'])
    expect(b.declined.map((r) => r.id)).toEqual(['x'])
    expect(b.accepted.map((r) => r.id)).toEqual(['a'])
  })

  it('sorts each bucket newest-updated first and skips signed bid-room proposals', () => {
    const b = splitFollowupRows([
      row('older', 'sent', '2026-09-01'),
      row('newer', 'sent', '2026-09-03'),
      row('bid', 'customer_accepted', '2026-09-04', 'bid_proposal'),
    ])
    expect(b.sent.map((r) => r.id)).toEqual(['newer', 'older'])
    expect(b.accepted).toEqual([])
    expect(b.declined).toEqual([])
  })
})
