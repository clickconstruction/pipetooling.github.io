import { describe, expect, it } from 'vitest'
import { gcNoticeRowsWithBilledOpen, lienBilledOpen } from './lienBilledOpen'

const inv = (id: string, job_id: string, amount: number, status = 'billed', sequence_order?: number, billed_at?: string) => ({ id, job_id, amount, status, sequence_order, billed_at })

describe('lienBilledOpen — what the sent bills owe, never the job’s price', () => {
  it('nets each sent bill against the payments tied to it; a draft at Ready to Bill and a paid bill owe nothing', () => {
    // Job 922 (2026-10-08): a $5,000 job, two $2,000 bills sent, the last $1,000 not billed.
    const job = { id: 'j922', status: 'billed', revenue: 5000, payments_made: 0 }
    const invoices = [inv('rough', 'j922', 2000), inv('top', 'j922', 2000), inv('final', 'j922', 1000, 'ready_to_bill')]
    expect(lienBilledOpen(job, invoices, [])).toBe(4000)
    expect(lienBilledOpen(job, invoices, [{ invoice_id: 'rough', amount: 2000 }, { invoice_id: 'top', amount: 500.5 }])).toBe(1499.5)
    // Both bills paid, the last $1,000 never billed: nothing is owed on sent bills — the $1,000 is work not yet billed, not a shell (bill truth's shell row would say $1,000; the lien rule does not).
    expect(lienBilledOpen({ ...job, payments_made: 4000 }, [inv('rough', 'j922', 2000, 'paid'), inv('top', 'j922', 2000, 'paid'), inv('final', 'j922', 1000, 'ready_to_bill')], [])).toBe(0)
    // A payment on the job with no bill picked pays the part of the job on no sent bill first (v2.5093): here the $1,000 not
    // billed yet, so the sent bills still owe $4,000.
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

describe('lienBilledOpen — a payment with no bill picked, under the one rule (v2.5093, the owner’s call of 2026-10-09)', () => {
  // Job 273 on prod (2026-10-09): a $56,365 job, three billed bills of $13,420, $665 and $3,500, and $39,680 paid on the job with no bill picked.
  const job273 = { id: 'j273', status: 'billed', revenue: 56365, payments_made: 39680 }
  const bills273 = [inv('b1', 'j273', 13420, 'billed', 1), inv('b2', 'j273', 665, 'billed', 2), inv('b3', 'j273', 3500, 'billed', 3)]
  const unlinked = (...amounts: number[]) => amounts.map((amount) => ({ invoice_id: null, amount }))

  it('pays the part of the job on no bill first, then the oldest bill: job 273 claims $16,685, not $17,585', () => {
    expect(lienBilledOpen(job273, bills273, unlinked(20000, 10000, 8780, 900))).toBe(16685)
    // Money that only covers the work on no bill leaves every bill owing: $38,780 is exactly that part.
    expect(lienBilledOpen(job273, bills273, unlinked(38780))).toBe(17585)
    // The total only shows the order when a paid bill takes its turn: the oldest bill (sequence 1) marked paid with nothing
    // tied to it takes the $13,420 first, so the two billed ones still owe $665 + $3,500 — whatever order the rows arrive in.
    const paidFirst = [bills273[2]!, { ...bills273[0]!, status: 'paid' }, bills273[1]!]
    expect(lienBilledOpen({ ...job273, revenue: 17585 }, paidFirst, unlinked(13420))).toBe(4165)
  })

  it('a paid bill still takes its share in its turn; with no job total the rule is oldest bill first alone', () => {
    // An older bill marked paid with nothing tied to it needs its $1,000 first; the $500 left lowers the billed one.
    const job = { id: 'j1', status: 'billed', revenue: 3000, payments_made: 1500 }
    expect(lienBilledOpen(job, [inv('old', 'j1', 1000, 'paid', 0), inv('new', 'j1', 2000, 'billed', 1)], unlinked(1500))).toBe(1500)
    // No revenue on file: nothing is set aside for work on no bill, so the $1,000 lowers the oldest bill.
    expect(lienBilledOpen({ ...job, revenue: null as unknown as number }, [inv('a', 'j1', 2000, 'billed', 0), inv('b', 'j1', 2000, 'billed', 1)], unlinked(1000))).toBe(3000)
    // Ties on sequence_order go to the earlier day: the earlier bill, paid with nothing tied to it, takes the $1,500 first.
    expect(lienBilledOpen({ ...job, revenue: 2500 }, [inv('later', 'j1', 1000, 'billed', 0, '2026-09-30T15:00:00Z'), inv('earlier', 'j1', 1500, 'paid', 0, '2026-09-24T15:00:00Z')], unlinked(1500))).toBe(1000)
  })

  it('a refund on the job is never applied to a bill, and a bill’s own payments stay its own', () => {
    const job = { id: 'j1', status: 'billed', revenue: 4000, payments_made: 600 }
    const bills = [inv('a', 'j1', 2000, 'billed', 0), inv('b', 'j1', 2000, 'billed', 1)]
    expect(lienBilledOpen(job, bills, [...unlinked(1000), ...unlinked(-400)])).toBe(3000)
    // $2,500 tied to bill a covers it with $500 over; that overpay is not moved to bill b.
    expect(lienBilledOpen(job, bills, [{ invoice_id: 'a', amount: 2500 }])).toBe(2000)
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

  it('a row reads the rule too: job 273’s money with no bill picked lowers its oldest bill (v2.5093)', () => {
    const out = gcNoticeRowsWithBilledOpen(
      [{ job_id: 'j273', work_month: '2026-03', is_billed: true, open_balance: 16685 + 38780 }],
      new Map([['j273', { id: 'j273', status: 'billed', revenue: 56365, payments_made: 39680 }]]),
      [inv('b1', 'j273', 13420, 'billed', 1), inv('b2', 'j273', 665, 'billed', 2), inv('b3', 'j273', 3500, 'billed', 3)],
      [39680].map((amount) => ({ job_id: 'j273', invoice_id: null, amount })),
    )
    expect(out[0]!.open_balance).toBe(16685)
  })
})
