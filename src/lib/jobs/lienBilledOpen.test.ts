import { describe, expect, it } from 'vitest'
import { gcNoticeRowsWithBilledOpen, lienBilledOpen } from './lienBilledOpen'

const inv = (id: string, job_id: string, amount: number, status = 'billed') => ({ id, job_id, amount, status })

describe('lienBilledOpen — what the sent bills owe, never the job’s price', () => {
  it('nets each sent bill against the payments tied to it; a draft at Ready to Bill and a paid bill owe nothing', () => {
    // Job 922 (2026-10-08): a $5,000 job, two $2,000 bills sent, the last $1,000 not billed.
    const job = { id: 'j922', status: 'billed', revenue: 5000, payments_made: 0 }
    const invoices = [inv('rough', 'j922', 2000), inv('top', 'j922', 2000), inv('final', 'j922', 1000, 'ready_to_bill')]
    expect(lienBilledOpen(job, invoices, [])).toBe(4000)
    expect(lienBilledOpen(job, invoices, [{ invoice_id: 'rough', amount: 2000 }, { invoice_id: 'top', amount: 500.5 }])).toBe(1499.5)
    // Both bills paid, the last $1,000 never billed: nothing is owed on sent bills — the $1,000 is work not yet billed, not a shell (bill truth's shell row would say $1,000; the lien rule does not).
    expect(lienBilledOpen({ ...job, payments_made: 4000 }, [inv('rough', 'j922', 2000, 'paid'), inv('top', 'j922', 2000, 'paid'), inv('final', 'j922', 1000, 'ready_to_bill')], [])).toBe(0)
    // A payment on the job with no bill behind it lowers no bill — the Bill tab reads it the same way.
    expect(lienBilledOpen(job, invoices, [{ invoice_id: null, amount: 1000 }])).toBe(4000)
  })

  it('a job billed as one shell is price less payments; a job with no bill sent and not billed owes nothing', () => {
    expect(lienBilledOpen({ id: 'j1', status: 'billed', revenue: 3500, payments_made: 1000 }, [], [])).toBe(2500)
    expect(lienBilledOpen({ id: 'j1', status: 'billed', revenue: 3500, payments_made: 4000 }, [], [])).toBe(0)
    expect(lienBilledOpen({ id: 'j1', status: 'working', revenue: 3500, payments_made: 0 }, [], [])).toBe(0)
    // A sent bill is a sent bill whatever the job's own status.
    expect(lienBilledOpen({ id: 'j1', status: 'working', revenue: 3500, payments_made: 0 }, [inv('a', 'j1', 1000)], [])).toBe(1000)
  })
})

describe('gcNoticeRowsWithBilledOpen — Put a GC on notice', () => {
  it('a billed job’s rows take what its sent bills owe; a job not billed yet keeps what it will bill', () => {
    const rows = [
      { job_id: 'j922', work_month: '2026-09', is_billed: true, open_balance: 5000 },
      { job_id: 'j922', work_month: '2026-08', is_billed: true, open_balance: 5000 },
      { job_id: 'j1031', work_month: '2026-07', is_billed: false, open_balance: 9800 },
      { job_id: 'j-gone', work_month: '2026-07', is_billed: true, open_balance: 700 },
    ]
    const jobs = new Map([
      ['j922', { id: 'j922', status: 'billed', revenue: 5000, payments_made: 0 }],
      ['j1031', { id: 'j1031', status: 'working', revenue: 9800, payments_made: 0 }],
    ])
    const out = gcNoticeRowsWithBilledOpen(rows, jobs, [inv('rough', 'j922', 2000), inv('top', 'j922', 2000)], [{ job_id: 'j922', invoice_id: 'rough', amount: 2000 }])
    expect(out.map((r) => [r.job_id, r.open_balance])).toEqual([
      ['j922', 2000],
      ['j922', 2000],
      ['j1031', 9800],
      ['j-gone', 700],
    ])
    expect(out[2]).toBe(rows[2])
  })
})
