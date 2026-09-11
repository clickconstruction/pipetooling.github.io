import { describe, expect, it } from 'vitest'
import {
  buildLocalStripeBillPreview,
  dueDateUnixFromYmd,
  stripePreviewBlocker,
  stripePreviewBlockerHint,
  type LocalPreviewFixture,
} from './localStripeBillPreview'

const work = (id: string, name: string, price: number, seq: number, extra: Partial<LocalPreviewFixture> = {}): LocalPreviewFixture => ({
  id,
  name,
  count: 1,
  line_unit_price: price,
  line_description: '',
  sequence_order: seq,
  invoice_id: null,
  line_kind: 'work',
  ...extra,
})
const scratchJob = (): LocalPreviewFixture[] => [
  work('a', 'Water heater install', 3000, 0),
  work('b', 'Repipe kitchen', 2000, 1),
  { id: 'd', name: 'Negotiated discount', count: 1, line_unit_price: -500, sequence_order: 2, invoice_id: null, line_kind: 'discount', discount_pct: 10, discount_basis_positions: null },
]
const base = {
  invoiceId: null,
  isPrimaryRtbBundle: true,
  amountDollars: 4500,
  lineDescriptionOverride: '',
  extraLines: [],
  customerName: 'ZZ Scratch Customer',
  customerEmail: null,
  jobName: 'ZZ Discount test',
  jobNumber: '1018',
  dueDateYmd: '2026-09-15',
  now: Date.UTC(2026, 8, 11, 17, 5),
}

describe('buildLocalStripeBillPreview', () => {
  it('prints the work lines and the negative discount shares before any bill row or email exists', () => {
    const sp = buildLocalStripeBillPreview({ ...base, fixtures: scratchJob() })
    expect(sp).not.toBeNull()
    const lines = sp!.lines
    const positives = lines.filter((l) => l.amount > 0)
    const negatives = lines.filter((l) => l.amount < 0)
    expect(positives.map((l) => l.description)).toEqual(['Water heater install', 'Repipe kitchen'])
    expect(positives.reduce((a, l) => a + l.amount, 0)).toBe(500000)
    expect(negatives.length).toBeGreaterThan(0)
    expect(negatives.every((l) => l.source?.kind === 'discount' && /Negotiated discount/.test(l.description))).toBe(true)
    expect(negatives.reduce((a, l) => a + l.amount, 0)).toBe(-50000)
    expect(sp!.total).toBe(450000)
    expect(sp!.amount_remaining).toBe(450000)
    expect(sp!.customer_email).toBeNull()
    expect(sp!.invoice_number).toBe('1018-2609151205')
    expect(sp!.due_date).toBe(dueDateUnixFromYmd('2026-09-15'))
  })

  it('a Line-on-bill override collapses the bill to one line, like the edge function', () => {
    const sp = buildLocalStripeBillPreview({ ...base, fixtures: scratchJob(), lineDescriptionOverride: 'Plumbing — as agreed' })
    expect(sp!.lines).toHaveLength(1)
    expect(sp!.lines[0]).toMatchObject({ amount: 450000, source: { kind: 'single_line' } })
  })

  it('hazmat extras come off the fixture target and append as their own lines', () => {
    const sp = buildLocalStripeBillPreview({
      ...base,
      fixtures: scratchJob(),
      amountDollars: 4550,
      extraLines: [{ amountCents: 5000, description: 'Biohazard remediation fee' }],
    })
    const extra = sp!.lines.find((l) => l.source?.kind === 'extra_line')
    expect(extra).toMatchObject({ amount: 5000, description: 'Biohazard remediation fee' })
    expect(sp!.lines.filter((l) => l.source?.kind !== 'extra_line').reduce((a, l) => a + l.amount, 0)).toBe(450000)
    expect(sp!.total).toBe(455000)
  })

  it('nothing to show: no amount, extras that swallow the amount, a job number with no digits keeps the lines but drops the number', () => {
    expect(buildLocalStripeBillPreview({ ...base, fixtures: scratchJob(), amountDollars: 0 })).toBeNull()
    expect(
      buildLocalStripeBillPreview({ ...base, fixtures: scratchJob(), amountDollars: 50, extraLines: [{ amountCents: 5000, description: 'fee' }] }),
    ).toBeNull()
    const noNumber = buildLocalStripeBillPreview({ ...base, fixtures: scratchJob(), jobNumber: null })
    expect(noNumber!.lines.length).toBeGreaterThan(0)
    expect(noNumber!.invoice_number).toBeNull()
  })

  it('an existing segment bill lists exactly its linked rows', () => {
    const rows = [work('a', 'Rough In', 1500, 0, { invoice_id: 'inv-1' }), work('b', 'Top Out', 1500, 1, { invoice_id: null })]
    const sp = buildLocalStripeBillPreview({ ...base, fixtures: rows, invoiceId: 'inv-1', isPrimaryRtbBundle: false, amountDollars: 1500 })
    expect(sp!.lines.map((l) => l.description)).toEqual(['Rough In'])
  })
})

describe('stripePreviewBlocker', () => {
  it('names the first real blocker in the gate\'s order', () => {
    const ok = { ensureLoading: false, ensureError: false, hasCustomer: true, hasEmail: true, hasBillRow: true }
    expect(stripePreviewBlocker(ok)).toBeNull()
    expect(stripePreviewBlocker({ ...ok, hasEmail: false, hasBillRow: false })).toBe('no_email')
    expect(stripePreviewBlocker({ ...ok, hasBillRow: false })).toBe('no_bill_row')
    expect(stripePreviewBlocker({ ...ok, hasCustomer: false, hasEmail: false })).toBe('no_customer')
    expect(stripePreviewBlocker({ ...ok, ensureLoading: true, hasEmail: false })).toBe('loading')
    expect(stripePreviewBlockerHint('no_email')).toMatch(/Add the customer's email/)
    expect(stripePreviewBlockerHint(null)).toBeNull()
  })
})
