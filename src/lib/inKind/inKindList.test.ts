import { describe, expect, it } from 'vitest'
import { inKindLeftWords, inKindListRows, inKindListTotals, inKindNextWords, inKindRowHref, inKindSoFarWords, type InKindListDeal } from './inKindList'
import type { InKindMonth } from './inKindLedger'

const arr = (id: string, partner: string, o: Partial<InKindListDeal['arrangement']> = {}): InKindListDeal['arrangement'] => ({
  id,
  customer_id: `c-${id}`,
  partner_name: partner,
  what_given: 'Concrete, as delivered',
  note: '',
  monthly_amount: null,
  monthly_due: null,
  bank_payee: '',
  starts_on: null,
  ended_at: null,
  ...o,
})
const line = (id: string, arrangement_id: string, given_on: string, amount: number, cost_job_id: string | null = null) => ({ id, arrangement_id, given_on, amount, memo: 'm', cost_job_id, for_month: null, removed_at: null })

const rent: InKindListDeal = {
  arrangement: arr('rent', 'Calloway Holdings', { what_given: 'Rent credit, the shop', monthly_amount: 1500, starts_on: '2026-10-01' }),
  jobs: [{ id: 'j1', status: 'billed', revenue: 19875.4, payments_made: 10500 }],
  lines: [],
  payments: [{ id: 'p', job_id: 'j1', invoice_id: null, amount: 10500, paid_on: '2026-09-01', note: null, line_id: null }],
}
const concrete: InKindListDeal = {
  arrangement: arr('con', 'Lone Oak Concrete'),
  jobs: [{ id: 'j9', status: 'billed', revenue: 6800, payments_made: 3540 }],
  lines: [line('c1', 'con', '2026-10-09', 1180), line('c2', 'con', '2026-10-22', 1475, 'oak'), line('c3', 'con', '2026-11-04', 885)],
  payments: [
    { id: 'q1', job_id: 'j9', invoice_id: null, amount: 1180, paid_on: null, note: null, line_id: 'c1' },
    { id: 'q2', job_id: 'j9', invoice_id: null, amount: 1475, paid_on: null, note: null, line_id: 'c2' },
    { id: 'q3', job_id: 'j9', invoice_id: null, amount: 885, paid_on: null, note: null, line_id: 'c3' },
  ],
}
const welding: InKindListDeal = { arrangement: arr('weld', 'Dale’s Welding', { what_given: 'A trailer rack' }), jobs: [], lines: [line('w1', 'weld', '2026-10-20', 900)], payments: [] }
const ended: InKindListDeal = { arrangement: arr('old', 'Hartwell Electric', { ended_at: '2026-08-14T00:00:00Z' }), jobs: [], lines: [], payments: [] }
const months = new Map<string, InKindMonth[]>([
  ['rent', [{ month: '2026-11-01', state: 'due', line: null, bankPaid: 1500 }, { month: '2026-10-01', state: 'due', line: null, bankPaid: 0 }]],
])

describe('inKindListRows', () => {
  const rows = inKindListRows([ended, welding, concrete, rent], months)
  it('puts a deal with a month due first, then by what is left, and the ended last', () => {
    expect(rows.map((r) => r.id)).toEqual(['rent', 'con', 'weld', 'old'])
  })
  it('reads each deal’s money and its next step', () => {
    expect(rows[0]).toMatchObject({ partner: 'Calloway Holdings', kind: 'Every month', left: 9375.4, paidInKind: 10500, dueMonth: '2026-10-01', dueCount: 2, next: '2 months are due. October is the oldest.' })
    expect(rows[1]).toMatchObject({ kind: 'As it comes', left: 3260, paidInKind: 3540, lineCount: 3, dueMonth: null, next: 'The last line was Nov 4.' })
    expect(rows[2]).toMatchObject({ left: 0, ahead: 900, next: 'Waits for a job of theirs.' })
    expect(rows[3]).toMatchObject({ ended: true, kind: 'Ended', next: 'Ended.' })
  })
  it('totals the open deals only', () => {
    expect(inKindListTotals([ended, welding, concrete, rent], rows)).toEqual({ open: 3, left: 12635.4, asOverhead: 2965, onJobs: 1475, ahead: 900, dueCount: 1 })
  })
})

describe('the words on a row', () => {
  it('says what is next', () => {
    expect(inKindNextWords({ ended: false, dueMonth: '2026-11-01', dueCount: 1, lastLineDay: null, jobCount: 3, left: 100, ahead: 0 })).toBe('November is due.')
    expect(inKindNextWords({ ended: false, dueMonth: null, dueCount: 0, lastLineDay: null, jobCount: 3, left: 100, ahead: 0 })).toBe('Nothing given yet.')
    expect(inKindNextWords({ ended: false, dueMonth: null, dueCount: 0, lastLineDay: '2026-11-04', jobCount: 3, left: 0, ahead: 0 })).toBe('Nothing is left on its bills.')
    expect(inKindNextWords({ ended: false, dueMonth: null, dueCount: 0, lastLineDay: null, jobCount: 0, left: 0, ahead: 0 })).toBe('No job is on it yet.')
  })
  it('says how far along and which way what is left runs', () => {
    expect(inKindSoFarWords({ paidInKind: 3540, work: 6800, ahead: 0, lineCount: 3 })).toBe('$3,540.00 of $6,800.00')
    expect(inKindSoFarWords({ paidInKind: 0, work: 0, ahead: 900, lineCount: 1 })).toBe('$900.00 given, on no bill yet')
    expect(inKindSoFarWords({ paidInKind: 0, work: 0, ahead: 0, lineCount: 0 })).toBe('Nothing given yet')
    expect(inKindLeftWords({ left: 3260, ahead: 0, ended: false })).toEqual({ amount: '$3,260.00', words: 'still to come' })
    expect(inKindLeftWords({ left: 0, ahead: 900, ended: false })).toEqual({ amount: '$900.00', words: 'of work we owe' })
    expect(inKindLeftWords({ left: 0, ahead: 0, ended: false })).toEqual({ amount: '$0.00', words: 'even' })
    expect(inKindLeftWords({ left: 0, ahead: 0, ended: true })).toEqual({ amount: '$0.00', words: 'ended' })
  })
})

describe('inKindRowHref', () => {
  it('opens the deal on its customer’s page, on the month that is due', () => {
    expect(inKindRowHref({ id: 'a1', customerId: 'c1', dueMonth: '2026-11-01' })).toBe('/customers/c1?inKind=a1&month=2026-11-01')
    expect(inKindRowHref({ id: 'a1', customerId: 'c1', dueMonth: null })).toBe('/customers/c1?inKind=a1')
    expect(inKindRowHref({ id: 'a1', customerId: null, dueMonth: null })).toBeNull()
  })
})
