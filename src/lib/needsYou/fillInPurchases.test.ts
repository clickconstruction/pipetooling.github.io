import { describe, expect, it } from 'vitest'
import {
  EMPTY_PURCHASE_DECISION,
  comparePurchaseRows,
  purchaseDecisionReady,
  purchaseFillInRows,
  purchaseJobOptionFromSearch,
  purchaseKnows,
  purchaseSetAmount,
  purchaseToggleJob,
  purchaseTrailWords,
  purchaseWrites,
  type PurchaseSource,
} from './fillInPurchases'

// A Saturday morning in company time, 2026-10-31 at 10:00.
const NOW = Date.parse('2026-10-31T15:00:00Z')

const charge = (p: Partial<PurchaseSource> = {}): PurchaseSource => ({
  mercury_transaction_id: 'tx-1',
  // Swiped Tuesday 2026-10-27 at 2:10 pm, posted the next morning.
  posted_at: '2026-10-28T13:00:00Z',
  amount: -184.2,
  counterparty_name: 'Ferguson Plumbing',
  note: null,
  tally_user_note: null,
  mercury_account_nickname: null,
  raw: { createdAt: '2026-10-27T19:10:00Z', mercuryCategory: 'FuelAndGas' },
  job_splits: [],
  jobs_summary: null,
  invoices_summary: null,
  ...p,
})

const FERGUSON = { id: 'j-650', main: 'JP650 · Maple Street remodel', address: '12 Maple St' }
const CEDAR = { id: 'j-712', main: 'JP712 · Cedar Loop clinic', address: '' }

describe('fillInPurchases · the rows (punch list #178, PR 2)', () => {
  it('keeps the unlinked charges over the age floor, oldest posting first, titled by the amount, the store and the swipe day', () => {
    const rows = purchaseFillInRows({
      rows: [
        charge(),
        charge({ mercury_transaction_id: 'tx-2', posted_at: '2026-10-26T13:00:00Z', amount: -40, counterparty_name: 'Home Depot', raw: { createdAt: '2026-10-26T01:00:00Z' } }),
        // The same day as tx-2, bigger: it leads that day.
        charge({ mercury_transaction_id: 'tx-3', posted_at: '2026-10-26T15:00:00Z', amount: -90.5, counterparty_name: 'Lowe’s', raw: { createdAt: '2026-10-26T01:00:00Z' } }),
      ],
      payrollFlagged: [],
      floorYmd: null,
      nowMs: NOW,
    })
    expect(rows.map((r) => r.key)).toEqual(['purchase:tx-3', 'purchase:tx-2', 'purchase:tx-1'])
    expect(rows[2]!.title).toBe('$184.20 at Ferguson Plumbing · Oct 27')
    expect(rows[2]!.doorHref).toBe('/tally?tab=transactions')
    expect(rows[2]!.severity).toBe('amber')
    expect(rows[2]!.swipeAtIso).toBe('2026-10-27T19:10:00Z')
    expect(rows[2]!.ageDays).toBe(3)
    expect(rows[2]!.amount).toBe(-184.2)
  })

  it('leaves out what the line’s count leaves out: a split, an invoice link, a payroll mark, a posting under the floor, a posting too young', () => {
    const rows = purchaseFillInRows({
      rows: [
        charge({ mercury_transaction_id: 'split', job_splits: [{ job_id: 'j-1', amount: -184.2, hcp_number: '650', job_name: 'x' }] }),
        charge({ mercury_transaction_id: 'summary', jobs_summary: '650 · Maple' }),
        charge({ mercury_transaction_id: 'invoice', invoices_summary: 'Ferguson · 4412' }),
        charge({ mercury_transaction_id: 'payroll' }),
        charge({ mercury_transaction_id: 'floor', posted_at: '2026-09-30T13:00:00Z' }),
        charge({ mercury_transaction_id: 'young', posted_at: '2026-10-30T13:00:00Z' }),
        charge({ mercury_transaction_id: 'unposted', posted_at: null }),
        charge({ mercury_transaction_id: 'kept' }),
      ],
      payrollFlagged: new Set(['payroll']),
      floorYmd: '2026-10-01',
      nowMs: NOW,
    })
    expect(rows.map((r) => r.txId)).toEqual(['kept'])
  })

  it('a refund reads as money back', () => {
    const [row] = purchaseFillInRows({ rows: [charge({ amount: 40 })], payrollFlagged: [], floorYmd: null, nowMs: NOW })
    expect(row!.title).toBe('$40.00 back from Ferguson Plumbing · Oct 27')
  })

  it('says what the app knows: the swipe day, the posting and its age, the category, the memos, the account', () => {
    expect(purchaseKnows(charge({ tally_user_note: 'PRV and fittings for Beck', note: 'FERGUSON ENT 1123', mercury_account_nickname: 'Ops' }), NOW)).toEqual([
      'Bought Tuesday, Oct 27.',
      'Posted Oct 28, 3 days ago, after the swipe.',
      'Mercury filed it under Fuel and gas.',
      'Your memo: “PRV and fittings for Beck”.',
      'Mercury\'s memo: “FERGUSON ENT 1123”.',
      'On the Ops account.',
    ])
    // Swiped and posted the same day, nothing else known.
    expect(purchaseKnows(charge({ raw: { createdAt: '2026-10-28T13:00:00Z' } }), NOW)).toEqual(['Bought Wednesday, Oct 28.', 'Posted Oct 28, 3 days ago.'])
  })

  it('one job takes the whole charge; a second splits it evenly; an amount typed balances on the other line', () => {
    const total = -184.2
    const one = purchaseToggleJob(EMPTY_PURCHASE_DECISION, total, FERGUSON)
    expect(one.lines).toEqual([{ jobId: 'j-650', amount: -184.2 }])
    expect(purchaseDecisionReady(one, total)).toBe(true)
    const two = purchaseToggleJob(one, total, CEDAR)
    expect(two.lines).toEqual([
      { jobId: 'j-650', amount: -92.1 },
      { jobId: 'j-712', amount: -92.1 },
    ])
    const typed = purchaseSetAmount(two, total, 'j-650', 150)
    expect(typed.lines).toEqual([
      { jobId: 'j-650', amount: -150 },
      { jobId: 'j-712', amount: -34.2 },
    ])
    expect(purchaseDecisionReady(typed, total)).toBe(true)
    // Tapping a picked job takes it out and the rest re-split.
    const back = purchaseToggleJob(typed, total, FERGUSON)
    expect(back.lines).toEqual([{ jobId: 'j-712', amount: -184.2 }])
    expect(back.jobs['j-650']).toBeUndefined()
    expect(purchaseDecisionReady(EMPTY_PURCHASE_DECISION, total)).toBe(false)
  })

  it('writes the Sort screen’s rows, signed as the charge is, and the trail says where it went', () => {
    const [row] = purchaseFillInRows({ rows: [charge()], payrollFlagged: [], floorYmd: null, nowMs: NOW })
    expect(purchaseWrites(row!, EMPTY_PURCHASE_DECISION)).toBeNull()
    const one = purchaseWrites(row!, purchaseToggleJob(EMPTY_PURCHASE_DECISION, row!.amount, FERGUSON))!
    expect(one).toEqual({ txId: 'tx-1', rows: [{ job_id: 'j-650', amount: -184.2 }], labels: ['JP650 · Maple Street remodel'] })
    expect(purchaseTrailWords(one)).toBe('on JP650 · Maple Street remodel · the tally has it')
    const two = purchaseWrites(row!, purchaseToggleJob(purchaseToggleJob(EMPTY_PURCHASE_DECISION, row!.amount, FERGUSON), row!.amount, CEDAR))!
    expect(two.rows).toEqual([
      { job_id: 'j-650', amount: -92.1 },
      { job_id: 'j-712', amount: -92.1 },
    ])
    expect(purchaseTrailWords(two)).toBe('split $92.10 to JP650 · Maple Street remodel and $92.10 to JP712 · Cedar Loop clinic · the tally has it')
  })

  it('a search row is labelled as the Assign window labels it', () => {
    expect(purchaseJobOptionFromSearch({ id: 'j-9', hcp_number: '901', job_name: 'Pinecrest warehouse', job_address: '4 Pine Rd' })).toEqual({ id: 'j-9', main: '901 · Pinecrest warehouse', address: '4 Pine Rd' })
    expect(purchaseJobOptionFromSearch({ id: 'j-9', hcp_number: '', job_name: 'Pinecrest warehouse', job_address: '' })).toEqual({ id: 'j-9', main: 'Pinecrest warehouse', address: '' })
    expect(purchaseJobOptionFromSearch({ id: 'abcdefgh-1', hcp_number: null, job_name: null, job_address: null }).main).toBe('abcdefgh')
  })

  it('orders the oldest posting first', () => {
    const a = purchaseFillInRows({ rows: [charge({ mercury_transaction_id: 'a', posted_at: '2026-10-20T13:00:00Z' })], payrollFlagged: [], floorYmd: null, nowMs: NOW })[0]!
    const b = purchaseFillInRows({ rows: [charge({ mercury_transaction_id: 'b', posted_at: '2026-10-22T13:00:00Z' })], payrollFlagged: [], floorYmd: null, nowMs: NOW })[0]!
    expect([b, a].sort(comparePurchaseRows).map((r) => r.txId)).toEqual(['a', 'b'])
  })
})
