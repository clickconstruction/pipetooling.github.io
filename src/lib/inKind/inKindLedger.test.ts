import { describe, expect, it } from 'vitest'
import {
  addMonths,
  dueMonths,
  inKindMonths,
  inKindTotals,
  isMonthlyArrangement,
  jobIsScheduledInKind,
  lastCreditMonth,
  lastDayOfMonth,
  lineStanding,
  monthMemo,
  monthName,
  monthOf,
  monthYear,
  monthYearShort,
  noCreditMemo,
  parseInKindAddResult,
  suggestedCredit,
  type InKindJob,
  type InKindLine,
  type InKindPayment,
} from './inKindLedger'

const line = (o: Partial<InKindLine> & { id: string }): InKindLine => ({
  arrangement_id: 'a1',
  given_on: '2026-05-03',
  amount: 1500,
  memo: 'Rent credit',
  cost_job_id: null,
  for_month: null,
  removed_at: null,
  ...o,
})
const pay = (o: Partial<InKindPayment> & { id: string; job_id: string; amount: number }): InKindPayment => ({
  invoice_id: null,
  paid_on: '2026-05-03',
  note: null,
  line_id: null,
  ...o,
})
const rent = { monthly_amount: 1500, monthly_due: 3000, starts_on: '2026-05-01', ended_at: null }

describe('months', () => {
  it('steps a month across a year end', () => {
    expect(addMonths('2026-11-01', 1)).toBe('2026-12-01')
    expect(addMonths('2026-12-01', 1)).toBe('2027-01-01')
    expect(addMonths('2026-01-01', -1)).toBe('2025-12-01')
    expect(addMonths('2026-05-01', 12)).toBe('2027-05-01')
  })
  it('names a month and finds its last day', () => {
    expect(monthOf('2026-11-10')).toBe('2026-11-01')
    expect(monthName('2026-11-01')).toBe('November')
    expect(monthYear('2026-11-01')).toBe('November 2026')
    expect(monthYearShort('2026-11-01')).toBe('Nov 2026')
    expect(lastDayOfMonth('2026-02-01')).toBe('2026-02-28')
    expect(lastDayOfMonth('2028-02-01')).toBe('2028-02-29')
    expect(lastDayOfMonth('2026-11-01')).toBe('2026-11-30')
  })
  it('writes the memos', () => {
    expect(monthMemo('Rent credit', '2026-11-01')).toBe('Rent credit, November 2026')
    expect(monthMemo('  ', '2026-11-01')).toBe('In kind, November 2026')
    expect(noCreditMemo('2026-10-01')).toBe('No credit, October 2026. The whole bill was paid.')
  })
})

describe('isMonthlyArrangement / jobIsScheduledInKind', () => {
  it('is monthly only with an amount and a first month', () => {
    expect(isMonthlyArrangement(rent)).toBe(true)
    expect(isMonthlyArrangement({ monthly_amount: null, starts_on: null })).toBe(false)
    expect(isMonthlyArrangement({ monthly_amount: 1500, starts_on: null })).toBe(false)
  })
  it('reads the job row', () => {
    expect(jobIsScheduledInKind({ in_kind_arrangement_id: 'a1' })).toBe(true)
    expect(jobIsScheduledInKind({ in_kind_arrangement_id: null })).toBe(false)
    expect(jobIsScheduledInKind({})).toBe(false)
    expect(jobIsScheduledInKind(null)).toBe(false)
  })
})

describe('inKindTotals', () => {
  const jobs: InKindJob[] = [
    { id: 'j1', status: 'paid', revenue: 2140, payments_made: 2140 },
    { id: 'j2', status: 'billed', revenue: 1865.5, payments_made: 860 },
    { id: 'j3', status: 'billed', revenue: 3420, payments_made: 0 },
  ]
  it('reads the money from the bills and the story from the lines', () => {
    const lines = [line({ id: 'l1', amount: 3000, for_month: '2026-05-01' }), line({ id: 'l2', amount: 500, cost_job_id: 'j9' }), line({ id: 'gone', amount: 99, removed_at: '2026-06-01T00:00:00Z' })]
    const payments = [pay({ id: 'p1', job_id: 'j1', amount: 2140, line_id: 'l1' }), pay({ id: 'p2', job_id: 'j2', amount: 860, line_id: 'l1' })]
    expect(inKindTotals(jobs, lines, payments)).toEqual({
      work: 7425.5,
      jobCount: 3,
      paidInKind: 3000,
      left: 4425.5,
      openJobCount: 2,
      unbilled: 0,
      unbilledJobCount: 0,
      given: 3500,
      ahead: 500,
      byHand: 0,
      byHandCount: 0,
      asOverhead: 3000,
      onJobs: 500,
    })
  })
  it('counts a payment typed by hand as paid, and as by hand', () => {
    const t = inKindTotals(jobs, [], [pay({ id: 'p1', job_id: 'j1', amount: 2140 }), pay({ id: 'p2', job_id: 'j2', amount: 860 })])
    expect(t.paidInKind).toBe(3000)
    expect(t.byHand).toBe(3000)
    expect(t.byHandCount).toBe(2)
    expect(t.given).toBe(0)
    expect(t.ahead).toBe(0)
  })
  it('counts a payment whose line was taken back as by hand', () => {
    const t = inKindTotals(jobs, [line({ id: 'l1', removed_at: '2026-06-01T00:00:00Z' })], [pay({ id: 'p1', job_id: 'j1', amount: 100, line_id: 'l1' })])
    expect(t.byHand).toBe(100)
  })
  it('counts a job that is not billed yet apart: it is on no bill, so it is not still to come', () => {
    const t = inKindTotals([...jobs, { id: 'j4', status: 'working', revenue: 250, payments_made: 0 }, { id: 'j5', status: 'ready_to_bill', revenue: 100, payments_made: 40 }], [], [])
    expect(t.left).toBe(4425.5)
    expect(t.openJobCount).toBe(2)
    expect(t.unbilled).toBe(310)
    expect(t.unbilledJobCount).toBe(2)
    expect(t.work).toBe(7775.5)
  })
  it('never counts a paid job as open', () => {
    expect(inKindTotals([{ id: 'j', status: 'paid', revenue: 100, payments_made: 40 }], [], []).left).toBe(0)
  })
  it('is all zeroes with nothing', () => {
    const t = inKindTotals([], [], [])
    expect(t.work + t.left + t.given + t.paidInKind).toBe(0)
  })
})

describe('lineStanding', () => {
  it('says how much of a line is on bills', () => {
    const l = line({ id: 'l1', amount: 5000 })
    expect(lineStanding(l, [pay({ id: 'p1', job_id: 'j2', amount: 1005.5, line_id: 'l1' }), pay({ id: 'p2', job_id: 'j3', amount: 3420, line_id: 'l1' }), pay({ id: 'p3', job_id: 'j3', amount: 9, line_id: 'other' })])).toEqual({ onBills: 4425.5, onNoBill: 574.5 })
  })
})

describe('inKindMonths', () => {
  const may = line({ id: 'may', amount: 3000, for_month: '2026-05-01' })
  const oct = line({ id: 'oct', amount: 0, for_month: '2026-10-01', memo: 'No credit' })
  it('is empty for a deal with no monthly amount', () => {
    expect(inKindMonths({ monthly_amount: null, starts_on: null, ended_at: null }, [may], '2026-11-10')).toEqual([])
  })
  it('lists every month from the first, newest first, with its state', () => {
    const months = inKindMonths({ ...rent, starts_on: '2026-09-01' }, [oct, line({ id: 'gone', for_month: '2026-09-01', removed_at: 'x' })], '2026-11-10')
    expect(months.map((m) => `${m.month} ${m.state}`)).toEqual(['2026-11-01 waiting', '2026-10-01 no_credit', '2026-09-01 due'])
  })
  it('makes this month due once its bill has left the bank', () => {
    const months = inKindMonths({ ...rent, starts_on: '2026-11-01' }, [], '2026-11-10', new Map([['2026-11-01', 1500]]))
    expect(months).toEqual([{ month: '2026-11-01', state: 'due', line: null, bankPaid: 1500 }])
  })
  it('keeps this month waiting while nothing has left the bank', () => {
    expect(inKindMonths({ ...rent, starts_on: '2026-11-01' }, [], '2026-11-10', new Map([['2026-11-01', 0]]))[0]?.state).toBe('waiting')
  })
  it('makes a month that is over due whatever the bank says', () => {
    expect(inKindMonths({ ...rent, starts_on: '2026-10-01' }, [], '2026-11-10', new Map([['2026-10-01', 0]]))[1]?.state).toBe('due')
  })
  it('reads a line with an amount as entered', () => {
    expect(inKindMonths(rent, [may], '2026-05-20')).toEqual([{ month: '2026-05-01', state: 'entered', line: may, bankPaid: null }])
  })
  it('asks nothing of an ended deal', () => {
    expect(inKindMonths({ ...rent, starts_on: '2026-10-01', ended_at: '2026-11-01T00:00:00Z' }, [], '2026-11-10').map((m) => m.state)).toEqual(['waiting', 'waiting'])
  })
  it('gives the due months oldest first', () => {
    const months = inKindMonths({ ...rent, starts_on: '2026-08-01' }, [oct], '2026-11-10')
    expect(dueMonths(months).map((m) => m.month)).toEqual(['2026-08-01', '2026-09-01'])
  })
  it('starts no earlier than the first month', () => {
    expect(inKindMonths({ ...rent, starts_on: '2026-12-01' }, [], '2026-11-10')).toEqual([])
  })
})

describe('suggestedCredit', () => {
  it('is the bill less what left the bank', () => {
    expect(suggestedCredit(rent, 1500, 9375.4)).toEqual({ amount: 1500, why: 'bank_part' })
    expect(suggestedCredit(rent, 0, 9375.4)).toEqual({ amount: 3000, why: 'bank_none' })
    expect(suggestedCredit(rent, 3000, 9375.4)).toEqual({ amount: 0, why: 'bank_all' })
    expect(suggestedCredit(rent, 3200, 9375.4)).toEqual({ amount: 0, why: 'bank_all' })
    expect(suggestedCredit(rent, 2000, 9375.4)).toEqual({ amount: 1000, why: 'bank_part' })
  })
  it('is the usual credit when the bank was not read or the bill is not known', () => {
    expect(suggestedCredit(rent, null, 9375.4)).toEqual({ amount: 1500, why: 'usual' })
    expect(suggestedCredit({ monthly_amount: 500, monthly_due: null }, 200, 9000)).toEqual({ amount: 500, why: 'usual' })
  })
  it('is never more than is left', () => {
    expect(suggestedCredit(rent, 1500, 375.4)).toEqual({ amount: 375.4, why: 'bank_part' })
    expect(suggestedCredit(rent, 0, 375.4)).toEqual({ amount: 375.4, why: 'bank_none' })
    expect(suggestedCredit(rent, null, 0)).toEqual({ amount: 0, why: 'usual' })
  })
})

describe('lastCreditMonth', () => {
  it('counts the months the usual credit takes', () => {
    expect(lastCreditMonth(9375.4, 1500, '2026-11-01')).toEqual({ month: '2027-05-01', months: 7 })
    expect(lastCreditMonth(3000, 1500, '2026-11-01')).toEqual({ month: '2026-12-01', months: 2 })
    expect(lastCreditMonth(1500, 1500, '2026-11-01')).toEqual({ month: '2026-11-01', months: 1 })
  })
  it('says nothing with nothing left or no monthly amount', () => {
    expect(lastCreditMonth(0, 1500, '2026-11-01')).toBeNull()
    expect(lastCreditMonth(500, null, '2026-11-01')).toBeNull()
  })
})

describe('parseInKindAddResult', () => {
  it('reads a real answer', () => {
    const r = parseInKindAddResult({
      ok: true,
      line_id: 'l1',
      applied: [
        { job_id: 'j1', invoice_id: 'i1', hcp_number: '1101', click_number: null, job_name: 'Shop restroom', amount: 680.5, left_after: 0, pays_off: true },
        { job_id: 'j2', invoice_id: null, hcp_number: '', click_number: 'C12', job_name: 'Gas line', amount: '819.50', left_after: '1092.90', pays_off: false },
      ],
      held: [{ job_id: 'j4', invoice_id: 'i4', hcp_number: '1113', click_number: null, job_name: 'Kitchen', open: 500, why: 'stripe' }],
      unapplied: 0,
    })
    expect(r.ok).toBe(true)
    expect(r.lineId).toBe('l1')
    expect(r.applied.map((a) => `${a.hcp_number ?? a.click_number} ${a.amount} ${a.left_after} ${a.pays_off}`)).toEqual(['1101 680.5 0 true', 'C12 819.5 1092.9 false'])
    expect(r.applied[1]?.invoice_id).toBeNull()
    expect(r.held).toEqual([{ job_id: 'j4', invoice_id: 'i4', hcp_number: '1113', click_number: null, job_name: 'Kitchen', open: 500, why: 'stripe' }])
  })
  it('reads a refusal', () => {
    expect(parseInKindAddResult({ error: 'That month already has its line.' })).toEqual({ ok: false, error: 'That month already has its line.', lineId: null, applied: [], held: [], unapplied: 0 })
  })
  it('reads nonsense as not ok', () => {
    expect(parseInKindAddResult(null).ok).toBe(false)
    expect(parseInKindAddResult('x').applied).toEqual([])
  })
})
