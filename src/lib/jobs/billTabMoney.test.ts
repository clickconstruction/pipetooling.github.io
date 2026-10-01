import { describe, expect, it } from 'vitest'
import type { FixtureRow } from './jobFormTypes'
import { buildJobSegmentsBar, type JobDollarCoverage } from './jobSegmentsCoverage'
import { stagePlanFromForm } from './stagePlanForm'
import { billTabFigures, billTabLines, dollarWords, makeABillHeading, showBillTabLines, wholeRestAction } from './billTabMoney'

const row = (over: Partial<FixtureRow> & { id: string; name: string }): FixtureRow => ({
  count: 1,
  line_unit_price: 1000,
  line_description: '',
  invoice_id: null,
  ...over,
})

const covered = (byId: Record<string, [number, number]>): JobDollarCoverage => ({
  unattributedDollars: Object.values(byId).reduce((s, [c]) => s + c, 0),
  remainingDollars: 0,
  bySegmentKey: Object.fromEntries(Object.entries(byId).map(([id, [c, amt]]) => [id, { coveredDollars: c, fullyCovered: c >= amt }])),
})

describe('dollarWords', () => {
  it('drops the cents on whole dollars and keeps them otherwise', () => {
    expect(dollarWords(3600)).toBe('$3,600')
    expect(dollarWords(6077.51)).toBe('$6,077.51')
    expect(dollarWords(0.1 + 0.2)).toBe('$0.30')
  })
})

describe('billTabFigures', () => {
  it('a Working job, 60% done, one $1,200 bill open: done $2,880, of which $1,680 is not billed', () => {
    const f = billTabFigures({ total: 4800, paid: 0, billedUnpaid: 1200, draft: 0, remaining: 3600 }, 60)
    expect(f).toEqual({ total: 4800, pctDone: 60, done: 2880, paid: 0, billedOpen: 1200, drafted: 0, leftToBill: 3600, doneNotBilled: 1680 })
  })

  it('job 1059: 100% done and all of it billed, so nothing is done but not billed', () => {
    const f = billTabFigures({ total: 250, paid: 0, billedUnpaid: 250, draft: 0, remaining: 0 }, 100)
    expect([f.done, f.doneNotBilled, f.leftToBill]).toEqual([250, 0, 0])
  })

  it('no % done: no done figure and no done-not-billed', () => {
    const f = billTabFigures({ total: 900, paid: 100, billedUnpaid: 0, draft: 0, remaining: 800 }, null)
    expect([f.pctDone, f.done, f.doneNotBilled]).toEqual([null, null, null])
  })

  it('a draft counts as spoken for, and done-not-billed never runs past what is left', () => {
    const f = billTabFigures({ total: 1000, paid: 0, billedUnpaid: 0, draft: 400, remaining: 600 }, 100)
    expect(f.doneNotBilled).toBe(600)
    expect(billTabFigures({ total: 1000, paid: 0, billedUnpaid: 0, draft: 400, remaining: 600 }, 30).doneNotBilled).toBe(0)
  })

  it('clamps a stray % done into 0–100', () => {
    expect(billTabFigures({ total: 100, paid: 0, billedUnpaid: 0, draft: 0, remaining: 100 }, 130).pctDone).toBe(100)
  })
})

describe('wholeRestAction', () => {
  it('a Working job moves to Ready to Bill with all of it', () => {
    expect(wholeRestAction('working', 3600)).toEqual({
      kind: 'move_to_ready_to_bill',
      amount: 3600,
      label: 'Move to Ready to Bill · $3,600',
      hint: 'All of it as one bill. The job moves to Ready to Bill.',
    })
  })

  it('a Ready to Bill job opens Bill Customer; any other job makes one bill for the rest', () => {
    expect(wholeRestAction('ready_to_bill', 1250.5)?.kind).toBe('bill_customer')
    expect(wholeRestAction('ready_to_bill', 1250.5)?.label).toBe('Bill Customer · $1,250.50')
    expect(wholeRestAction('billed', 500)?.kind).toBe('new_invoice')
    expect(wholeRestAction('billed', 500)?.label).toBe('Bill the rest · $500')
  })

  it('nothing left, no button', () => {
    expect(wholeRestAction('working', 0)).toBeNull()
    expect(wholeRestAction('working', 0.004)).toBeNull()
  })
})

describe('makeABillHeading', () => {
  it('says what is left, or that it sits on the Ready to Bill draft', () => {
    expect(makeABillHeading(3600, 3600)).toBe('$3,600 left to bill')
    expect(makeABillHeading(9000, 0)).toBe('$9,000 on the Ready to Bill draft')
    expect(makeABillHeading(0, 0)).toBeNull()
  })
})

describe('billTabLines', () => {
  it('job 1059: a $250 line a plain $250 bill covers reads covered, locks, and needs no list', () => {
    const fixtures = [row({ id: 'pre', name: 'Pretest', stage_kind: 'any', line_unit_price: 250 })]
    const plan = stagePlanFromForm({ fixtures, windows: [], orders: [], sheets: [], invoices: [{ id: 'inv-250', status: 'billed', billed_at: '2026-09-30T15:00:00Z' }], payments: [], todayYmd: '2026-10-01' })
    const segments = buildJobSegmentsBar({ fixtures, riderFeesDollars: 0, invoiceStatusById: {} })
    const lines = billTabLines({ segments, plan, coverage: covered({ pre: [250, 250] }) })
    expect(lines).toEqual([
      { key: 'pre', label: '◆ Pretest', amount: 250, workWords: null, moneyWords: 'covered', tone: 'blue', selectable: false, billIt: false, coveredDollars: 250 },
    ])
    expect(showBillTabLines(lines)).toBe(false)
  })

  it('a line on a bill reads that bill: paid, billed and open, or on a draft', () => {
    const fixtures = [
      row({ id: 'a', name: 'Water heater swap', line_unit_price: 1200, invoice_id: 'inv-a' }),
      row({ id: 'b', name: 'Repipe', line_unit_price: 3600 }),
      row({ id: 'c', name: 'Hose bibs', line_unit_price: 500, invoice_id: 'inv-c' }),
      row({ id: 'd', name: 'Permit', line_unit_price: 300, invoice_id: 'inv-d' }),
    ]
    const plan = stagePlanFromForm({
      fixtures,
      windows: [],
      orders: [],
      sheets: [],
      invoices: [
        { id: 'inv-a', status: 'billed', billed_at: '2026-09-29T15:00:00Z' },
        { id: 'inv-c', status: 'paid', billed_at: '2026-09-12T15:00:00Z' },
        { id: 'inv-d', status: 'ready_to_bill', billed_at: null },
      ],
      payments: [{ invoice_id: 'inv-c', paid_on: '2026-09-22' }],
      todayYmd: '2026-10-01',
    })
    const segments = buildJobSegmentsBar({ fixtures, riderFeesDollars: 0, invoiceStatusById: { 'inv-a': 'billed', 'inv-c': 'paid', 'inv-d': 'ready_to_bill' } })
    const lines = billTabLines({ segments, plan })
    expect(lines.map((l) => [l.key, l.moneyWords, l.tone, l.selectable])).toEqual([
      ['a', 'billed Sep 29 · open', 'blue', false],
      ['b', 'not billed', 'muted', true],
      ['c', 'paid Sep 22', 'green', false],
      ['d', 'on a draft', 'draft', false],
    ])
    expect(showBillTabLines(lines)).toBe(true)
  })

  it('a line covered in part says how much, stays tickable, and the plain rows wait for the final draw', () => {
    const fixtures = [
      row({ id: 'rough', name: 'Rough-in', stage_kind: 'order', line_unit_price: 3000 }),
      row({ id: 'permit', name: 'Permit', stage_kind: null, line_unit_price: 600 }),
    ]
    const plan = stagePlanFromForm({ fixtures, windows: [], orders: [], sheets: [], invoices: [], payments: [], todayYmd: '2026-10-01' })
    const segments = buildJobSegmentsBar({ fixtures, riderFeesDollars: 0, invoiceStatusById: {} })
    const lines = billTabLines({ segments, plan, coverage: covered({ rough: [1000, 3000] }) })
    expect(lines.map((l) => [l.label, l.moneyWords, l.tone, l.selectable, l.coveredDollars])).toEqual([
      ['Draw 1 · Rough-in', '$1,000 of $3,000 covered · after it passes inspection', 'blue', true, 1000],
      ['Permit', 'with the final draw', 'muted', true, 0],
    ])
  })

  it('passed stages: the first is ready with Bill it, the next waits on it until a bill covers it', () => {
    const fixtures = [
      row({ id: 'rough', name: 'Rough-in', stage_kind: 'order', line_unit_price: 1000 }),
      row({ id: 'top', name: 'Top-out', stage_kind: 'order', line_unit_price: 1000 }),
    ]
    const plan = stagePlanFromForm({
      fixtures,
      windows: [
        { id: 'w-rough', fixture_id: 'rough', window_start: '2026-09-01', window_end: '2026-09-02' },
        { id: 'w-top', fixture_id: 'top', window_start: '2026-09-08', window_end: '2026-09-09' },
      ],
      orders: [
        { id: 'o-rough', stage_window_id: 'w-rough', status: 'settled', picked_start: '2026-09-01', picked_end: '2026-09-02', labor_job_id: 's-rough' },
        { id: 'o-top', stage_window_id: 'w-top', status: 'settled', picked_start: '2026-09-08', picked_end: '2026-09-09', labor_job_id: 's-top' },
      ],
      sheets: [
        { id: 's-rough', stage: 'customer_pay', progress_pct: 100, stage_changed_at: '2026-09-02T15:00:00Z' },
        { id: 's-top', stage: 'customer_pay', progress_pct: 100, stage_changed_at: '2026-09-09T15:00:00Z' },
      ],
      invoices: [],
      payments: [],
      todayYmd: '2026-09-10',
    })
    const segments = buildJobSegmentsBar({ fixtures, riderFeesDollars: 0, invoiceStatusById: {} })
    const before = billTabLines({ segments, plan })
    expect(before.map((l) => [l.key, l.workWords, l.moneyWords, l.tone, l.billIt])).toEqual([
      ['rough', 'passed Sep 2', 'ready to bill', 'amber', true],
      ['top', 'passed Sep 9', 'waits on stage 1', 'muted', false],
    ])
    const after = billTabLines({ segments, plan, coverage: covered({ rough: [1000, 1000] }) })
    expect(after.map((l) => [l.key, l.moneyWords, l.billIt, l.selectable])).toEqual([
      ['rough', 'covered', false, false],
      ['top', 'ready to bill', true, true],
    ])
  })

  it('an Any time line with no stage dates says only where its money is', () => {
    const fixtures = [row({ id: 'a', name: 'Repipe', stage_kind: 'any', line_unit_price: 3600 }), row({ id: 'b', name: 'Water heater', stage_kind: 'any', line_unit_price: 1200 })]
    const plan = stagePlanFromForm({ fixtures, windows: [], orders: [], sheets: [], invoices: [], payments: [], todayYmd: '2026-10-01' })
    const segments = buildJobSegmentsBar({ fixtures, riderFeesDollars: 0, invoiceStatusById: {} })
    expect(billTabLines({ segments, plan }).map((l) => [l.label, l.workWords, l.moneyWords])).toEqual([
      ['◆ Repipe', null, 'not billed'],
      ['◆ Water heater', null, 'not billed'],
    ])
  })

  it('hazmat riders are their own row, never ticked', () => {
    const fixtures = [row({ id: 'a', name: 'Repipe', line_unit_price: 3600 })]
    const segments = buildJobSegmentsBar({ fixtures, riderFeesDollars: 150, invoiceStatusById: {} })
    const lines = billTabLines({ segments })
    expect(lines.map((l) => [l.key, l.label, l.amount, l.moneyWords, l.selectable])).toEqual([
      ['a', 'Repipe', 3600, 'not billed', true],
      ['riders', 'Riders (hazmat fees)', 150, 'not billed', false],
    ])
  })

  it('a one-line job that can still be ticked keeps its list', () => {
    const fixtures = [row({ id: 'a', name: 'Repipe', line_unit_price: 3600 })]
    const segments = buildJobSegmentsBar({ fixtures, riderFeesDollars: 0, invoiceStatusById: {} })
    expect(showBillTabLines(billTabLines({ segments }))).toBe(true)
  })
})
