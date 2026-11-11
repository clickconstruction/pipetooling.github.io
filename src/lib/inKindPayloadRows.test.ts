import { describe, expect, it } from 'vitest'
import { IN_KIND_READ_CHUNK, readInKindDealByJob, stampInKindDeals, withInKindDeals } from '../../supabase/functions/_shared/inKindPayloadRows'
import { buildForecastFromPayload, inKindApartLine, rowIsScheduledInKind } from '../../supabase/functions/_shared/paymentForecastCore'
import { buildMoneyWaitingFromPayload } from '../../supabase/functions/_shared/moneyWaitingCore'
import { buildBilledPaymentForecast } from './jobs/billedPaymentForecast'
import { sampleForecastPayload, sampleMoneyWaitingPayload } from './teamSampleEmails'
import type { StageRow } from './jobsStagesBoard'

type Call = { table: string; select: string; ids: string[]; not: [string, string, unknown] }

/** A service client that answers the one read the stamp makes, from `deals` (job id → deal id). */
function fakeAdmin(deals: Record<string, string>, fail?: string) {
  const calls: Call[] = []
  const admin = {
    from(table: string) {
      const call: Call = { table, select: '', ids: [], not: ['', '', undefined] }
      const q = {
        select(cols: string) {
          call.select = cols
          return q
        },
        in(_col: string, ids: string[]) {
          call.ids = ids
          return q
        },
        not(col: string, op: string, value: unknown) {
          call.not = [col, op, value]
          calls.push(call)
          if (fail) return Promise.resolve({ data: null, error: { message: fail } })
          return Promise.resolve({
            data: call.ids.filter((id) => deals[id]).map((id) => ({ id, in_kind_arrangement_id: deals[id] })),
            error: null,
          })
        },
      }
      return q
    },
  }
  return { admin, calls }
}

describe('the deal stamped on a money email’s rows (punch list #301)', () => {
  it('reads jobs_ledger for the payload’s jobs, only the ones on a deal', async () => {
    const { admin, calls } = fakeAdmin({ j2: 'deal-a' })
    const map = await readInKindDealByJob(admin, ['j1', 'j2', 'j2', '', 'j3'])
    expect([...map]).toEqual([['j2', 'deal-a']])
    expect(calls).toEqual([{ table: 'jobs_ledger', select: 'id, in_kind_arrangement_id', ids: ['j1', 'j2', 'j3'], not: ['in_kind_arrangement_id', 'is', null] }])
  })

  it('reads a long board in pieces and no board in none', async () => {
    const ids = Array.from({ length: IN_KIND_READ_CHUNK * 2 + 5 }, (_, i) => `job-${i}`)
    const { admin, calls } = fakeAdmin({ 'job-0': 'd', [`job-${IN_KIND_READ_CHUNK * 2 + 4}`]: 'd' })
    const map = await readInKindDealByJob(admin, ids)
    expect(calls.map((c) => c.ids.length)).toEqual([IN_KIND_READ_CHUNK, IN_KIND_READ_CHUNK, 5])
    expect(map.size).toBe(2)
    const none = fakeAdmin({})
    expect((await readInKindDealByJob(none.admin, [])).size).toBe(0)
    expect(none.calls).toEqual([])
  })

  it('a failed read throws with its reason, so no email calls a credit money coming', async () => {
    const { admin } = fakeAdmin({}, 'permission denied for table jobs_ledger')
    await expect(readInKindDealByJob(admin, ['j1'])).rejects.toThrow('jobs_ledger in kind read: permission denied for table jobs_ledger')
    await expect(stampInKindDeals(admin, { rows: [{ job_id: 'j1' }] })).rejects.toThrow('jobs_ledger in kind read')
  })

  it('stamps every row, null for a bill paid with money, and keeps the rest of the payload', async () => {
    expect(withInKindDeals([{ job_id: 'j1', remaining: 5 }, { job_id: 'j2', remaining: 7 }], new Map([['j2', 'deal-a']]))).toEqual([
      { job_id: 'j1', remaining: 5, in_kind_arrangement_id: null },
      { job_id: 'j2', remaining: 7, in_kind_arrangement_id: 'deal-a' },
    ])
    const { admin } = fakeAdmin({ j2: 'deal-a' })
    // Typed as a payload row is: the deal is an optional field the RPC never fills.
    const rows: Array<{ job_id: string; in_kind_arrangement_id?: string | null }> = [{ job_id: 'j1' }, { job_id: 'j2' }]
    const stamped = await stampInKindDeals(admin, { today: '2026-11-11', rows })
    expect(stamped.today).toBe('2026-11-11')
    expect(stamped.rows.map((r) => rowIsScheduledInKind(r))).toEqual([false, true])
  })
})

describe('the emailed Payment forecast sets a bill paid in kind apart, as the modal does', () => {
  const p = sampleForecastPayload('2026-09-29')
  const inKindJob = 'job-3'
  const stamped = { ...p, rows: p.rows.map((r) => (r.job_id === inKindJob ? { ...r, in_kind_arrangement_id: 'deal-a' } : r)) }
  const bill = p.rows.find((r) => r.job_id === inKindJob)!

  it('the bill is in no bucket and not in the total, and is counted apart', () => {
    const before = buildForecastFromPayload(p)
    const after = buildForecastFromPayload(stamped)
    expect(before.inKind).toEqual({ count: 0, dollars: 0 })
    expect(after.inKind).toEqual({ count: 1, dollars: bill.remaining })
    expect(after.rowCount).toBe(before.rowCount - 1)
    expect(after.openTotal).toBe(before.openTotal - bill.remaining)
    expect(after.buckets.flatMap((b) => b.rows).some((r) => r.jobId === inKindJob)).toBe(false)
    // A promise on the job does not bring it back into a week.
    const promised = buildForecastFromPayload({ ...stamped, promises: { ...stamped.promises, [inKindJob]: { promisedYmd: '2026-10-01', markedByName: 'Wendi' } } })
    expect(promised.rowCount).toBe(after.rowCount)
  })

  it('a paid-to-zero row on a deal is a paid-to-zero row, not a bill in kind', () => {
    const f = buildForecastFromPayload({ ...stamped, rows: stamped.rows.map((r) => (r.job_id === inKindJob ? { ...r, remaining: 0 } : r)) })
    expect(f.inKind.count).toBe(0)
    expect(f.skippedNoMoney).toBe(1)
  })

  it('counts what the screen’s kernel counts for the same bills', () => {
    // The same two bills through the modal's kernel: one on a deal, one paid with money.
    const row = (id: string, amount: number, deal: string | null): StageRow =>
      ({
        kind: 'invoice',
        job: { id, customer_id: 'c1', customer_name: 'Gun Dog', job_name: id, hcp_number: '1', click_number: null, in_kind_arrangement_id: deal, payments: [], invoices: [] },
        inv: { id: `inv-${id}`, job_id: id, amount, status: 'billed', sequence_order: 1, billed_at: '2026-04-01T12:00:00Z' },
      }) as unknown as StageRow
    const screen = buildBilledPaymentForecast([row('a', 726.5, 'deal-a'), row('b', 300, null)], null, '2026-11-11')
    const email = buildForecastFromPayload({
      generated_at: '2026-11-11T14:00:00Z',
      today: '2026-11-11',
      pay_speeds: null,
      promises: {},
      rows: [
        { invoice_id: 'inv-a', job_id: 'a', display_number: '1', job_name: 'a', customer_id: 'c1', customer_name: 'Gun Dog', billed_at: '2026-04-01T12:00:00Z', est_bill_ymd: null, remaining: 726.5, in_kind_arrangement_id: 'deal-a' },
        { invoice_id: 'inv-b', job_id: 'b', display_number: '1', job_name: 'b', customer_id: 'c1', customer_name: 'Gun Dog', billed_at: '2026-04-01T12:00:00Z', est_bill_ymd: null, remaining: 300 },
      ],
    })
    expect(email.inKind).toEqual(screen.inKind)
    expect(email.openTotal).toBe(screen.openTotal)
    expect(email.rowCount).toBe(screen.rowCount)
  })

  it('the line reads as the modal’s last line does', () => {
    expect(inKindApartLine({ count: 8, dollars: 9375.4 }, 'money coming')).toBe('$9,375 on 8 bills is scheduled in kind, not money coming')
    expect(inKindApartLine({ count: 1, dollars: 726.5 }, 'money waiting')).toBe('$727 on 1 bill is scheduled in kind, not money waiting')
    expect(inKindApartLine({ count: 0, dollars: 0 }, 'money coming')).toBeNull()
  })
})

describe('the emailed Money waiting list leaves a bill paid in kind off every customer', () => {
  const p = sampleMoneyWaitingPayload('2026-09-29')

  it('a customer whose only late bill is on a deal is on nobody’s list, and the bill is counted apart', () => {
    const before = buildMoneyWaitingFromPayload(p)!
    const slowest = before.rows[0]!
    const stamped = { ...p, rows: p.rows.map((r) => (r.customer_id === slowest.customerId ? { ...r, in_kind_arrangement_id: 'deal-a' } : r)) }
    const after = buildMoneyWaitingFromPayload(stamped)!
    expect(after.rows.map((r) => r.customerId)).toEqual(before.rows.slice(1).map((r) => r.customerId))
    expect(after.inKind).toEqual({ count: slowest.bills.length, dollars: slowest.open })
    expect(after.onPaceCount).toBe(before.onPaceCount)
    expect(after.onPaceOpen).toBe(before.onPaceOpen)
    expect(before.inKind).toEqual({ count: 0, dollars: 0 })
  })
})
