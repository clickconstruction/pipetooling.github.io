import { describe, expect, it } from 'vitest'
import { jobHasUnbilled, jobOwedLines, jobOwedSplit } from './jobOwedSplit'
import { plainWordsFailures } from '../plainWords'

const bill = (id: string, amount: number, status: 'billed' | 'paid' | 'ready_to_bill', sequence_order: number) => ({ id, job_id: 'j1', amount, status, sequence_order, billed_at: `2026-07-0${sequence_order + 1}T12:00:00Z` })

describe('jobOwedSplit: billed and still open beside not billed (v2.7532)', () => {
  // One stage of three billed: a $42,300 price, a $16,800 bill paid 90%, a $350 bill unpaid, the job 30% complete.
  const staged = {
    id: 'j1', status: 'billed', revenue: 42_300, payments_made: 15_120, pct_complete: 30,
    invoices: [bill('i1', 16_800, 'billed', 0), bill('i2', 350, 'billed', 1)],
    payments: [{ invoice_id: 'i1', amount: 15_120 }],
  }

  it('a job billed one stage of three owes its bills, and the rest of the price is not billed', () => {
    const s = jobOwedSplit(staged)
    expect(s.billedOpen).toBe(2_030)
    expect(s.unbilled).toBe(25_150)
    expect(s.jobTotal).toBe(42_300)
    expect(s.sentBills).toBe(2)
    expect(s.pctBilled).toBe(41)
    expect(s.pctComplete).toBe(30)
    expect(jobHasUnbilled(s)).toBe(true)
  })

  it('says each figure in one plain sentence, with the two percents and what to do', () => {
    const lines = jobOwedLines(jobOwedSplit(staged))
    expect(lines).toEqual({
      billed: '$2,030 billed and still open.',
      unbilled: '$25,150 of the job’s $42,300 is not billed.',
      percent: 'The job is 30% complete and 41% billed.',
      check: 'Collections chases what is billed. If the rest will not be done, correct the job total on the job.',
    })
    for (const l of Object.values(lines)) expect(plainWordsFailures(l)).toEqual([])
  })

  it('a job whose bills carry its whole price says the one figure and nothing else', () => {
    const whole = jobOwedSplit({ id: 'j1', status: 'billed', revenue: 9_800, payments_made: 8_000, pct_complete: 100, invoices: [bill('i1', 8_000, 'paid', 0), bill('i2', 1_800, 'billed', 1)], payments: [{ invoice_id: 'i1', amount: 8_000 }] })
    expect(whole.billedOpen).toBe(1_800)
    expect(whole.unbilled).toBe(0)
    expect(jobOwedLines(whole)).toEqual({ billed: '$1,800 billed and still open.', unbilled: '', percent: '', check: '' })
  })

  it('a job billed as one shell, with no bill ever sent, owes its price less payments', () => {
    const shell = jobOwedSplit({ id: 'j1', status: 'billed', revenue: 1_050, payments_made: 50, invoices: [], payments: [] })
    expect(shell.billedOpen).toBe(1_000)
    expect(shell.unbilled).toBe(0)
    expect(shell.pctBilled).toBeNull()
    expect(shell.pctComplete).toBeNull()
  })

  it('a bill still at Ready to Bill is not a sent bill: it is part of what is not billed', () => {
    const s = jobOwedSplit({ id: 'j1', status: 'billed', revenue: 5_000, payments_made: 0, invoices: [bill('i1', 2_000, 'billed', 0), bill('i2', 3_000, 'ready_to_bill', 1)], payments: [] })
    expect(s.billedOpen).toBe(2_000)
    expect(s.unbilled).toBe(3_000)
    expect(s.sentBills).toBe(1)
  })

  it('the percents are left out when one is unknown, and missing rows read as none', () => {
    const s = jobOwedSplit({ id: 'j1', status: 'billed', revenue: 5_000, payments_made: 0, pct_complete: null, invoices: [bill('i1', 2_000, 'billed', 0)], payments: null })
    expect(jobOwedLines(s).percent).toBe('')
    expect(jobOwedSplit({ id: 'j1', status: 'working', revenue: null, payments_made: null }).billedOpen).toBe(0)
  })
})
