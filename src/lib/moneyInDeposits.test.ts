import { describe, expect, it } from 'vitest'
import {
  depositOnNoBill,
  depositsOnNoBillByDay,
  matchMoneyInDeposits,
  moneyInDepositsFromRows,
  moneyInDepositsReadFrom,
  moneyInDepositsSince,
  moneyInUnlinkedFromRows,
  returnCaseLivePaymentIds,
  returnedPaymentIdsOfCases,
  type MoneyInDeposit,
  type MoneyInPostedDepositRow,
  type MoneyInUnlinkedPayment,
} from './moneyInDeposits'

// Made-up data throughout: no live deposit, payer, check number or amount.
const TODAY = '2026-10-27'

const posted = (over: Partial<MoneyInPostedDepositRow> & { mercury_transaction_id: string }): MoneyInPostedDepositRow => ({
  amount: 640,
  posted_at: '2026-10-26T17:00:00.000Z',
  counterparty_name: 'JUNIPER HILL',
  note: null,
  kind: 'checkDeposit',
  remaining_available: 640,
  returned: false,
  ...over,
})
const deposit = (over: Partial<MoneyInDeposit> & { mercuryTransactionId: string }): MoneyInDeposit => ({ usd: 640, kind: 'checkDeposit', counterpartyName: 'JUNIPER HILL', state: 'posted', dayYmd: '2026-10-26', ...over })
const typed = (over: Partial<MoneyInUnlinkedPayment> & { paymentId: string }): MoneyInUnlinkedPayment => ({ jobId: 'job-1', usd: 640, paidOnYmd: '2026-10-23', paymentType: 'Check', referenceNumber: '4471', payerName: 'Cedar Ridge Builders', ...over })

describe('moneyInDepositsFromRows', () => {
  it('keeps a posted deposit that still holds money, at the money not applied, on the Central day it posted', () => {
    const out = moneyInDepositsFromRows([], [posted({ mercury_transaction_id: 'm1', amount: 1000, remaining_available: 360, posted_at: '2026-10-27T03:30:00.000Z' })], null)
    expect(out).toEqual([{ mercuryTransactionId: 'm1', usd: 360, kind: 'checkDeposit', counterpartyName: 'JUNIPER HILL', state: 'posted', dayYmd: '2026-10-26' }])
  })

  it('leaves out a deposit that came back, one fully applied, a Stripe payout and one the org’s filter leaves out', () => {
    const rows = [
      posted({ mercury_transaction_id: 'back', returned: true }),
      posted({ mercury_transaction_id: 'applied', remaining_available: 0 }),
      posted({ mercury_transaction_id: 'payout', counterparty_name: 'STRIPE TRANSFER' }),
      posted({ mercury_transaction_id: 'owner', counterparty_name: 'OWNER DRAW' }),
      posted({ mercury_transaction_id: 'kept' }),
    ]
    const filter = { kinds: [], excludeCounterpartyContains: ['owner draw'], excludeNoteContains: [] }
    expect(moneyInDepositsFromRows([], rows, filter).map((d) => d.mercuryTransactionId)).toEqual(['kept'])
  })

  it('keeps a pending deposit at its whole amount, on the day it was made', () => {
    const out = moneyInDepositsFromRows([{ id: 'p1', amount: '250.50', kind: 'checkDeposit', created_at: '2026-10-26T17:00:00.000Z', counterparty_name: null, note: null }], [], null)
    expect(out).toEqual([{ mercuryTransactionId: 'p1', usd: 250.5, kind: 'checkDeposit', counterpartyName: null, state: 'pending', dayYmd: '2026-10-26', bankDayYmd: null, checkNumber: null }])
  })

  it('carries what the bank says of a pending check: the day it names and the number it read (#437, piece 2)', () => {
    const out = moneyInDepositsFromRows([{ id: 'p1', amount: 4980, kind: 'checkDeposit', created_at: '2026-10-23T17:00:00.000Z', counterparty_name: null, note: null, check_number: ' 03310 ', bank_day: '2026-10-30T21:00:00.000Z' }], [], null)
    expect(out[0]).toMatchObject({ state: 'pending', dayYmd: '2026-10-23', bankDayYmd: '2026-10-30', checkNumber: '03310' })
  })
})

describe('the rows beside the deposits', () => {
  it('reads a typed-in payment with the payer its screen names', () => {
    const out = moneyInUnlinkedFromRows([{ payment_id: 'u1', job_id: 'j1', amount: '640.00', paid_on: '2026-10-23', payment_type: 'Check', reference_number: '4471', job_name: 'Cedar Ridge Lot 4' }], (u) => u.job_name ?? '')
    expect(out).toEqual([{ paymentId: 'u1', jobId: 'j1', usd: 640, paidOnYmd: '2026-10-23', paymentType: 'Check', referenceNumber: '4471', payerName: 'Cedar Ridge Lot 4' }])
  })

  it('names the payments an open return case still carries', () => {
    expect(returnCaseLivePaymentIds({ live_payments: [{ payment_id: 'a' }], recorded_payment: { payment_id: 'b' } })).toEqual(['a', 'b'])
    expect(returnCaseLivePaymentIds({})).toEqual([])
    // A check the bank never saw carries no money that came back.
    expect([...returnedPaymentIdsOfCases([{ source: 'bank', live_payments: [{ payment_id: 'a' }] }, { source: 'unbanked', recorded_payment: { payment_id: 'b' } }])]).toEqual(['a'])
  })

  it('reads posted deposits from far enough back to meet a drawer check', () => {
    expect(moneyInDepositsSince(TODAY) < TODAY).toBe(true)
  })

  it('never reads a deposit from before the day Accounts Receivable starts its own list', () => {
    // A month before the office's start date: the read starts at the start date, so its old deposits are not named.
    expect(moneyInDepositsReadFrom('2026-03-01', '2026-04-01')).toBe('2026-04-01')
    // A day after it: the read starts where it was asked to.
    expect(moneyInDepositsReadFrom('2026-11-10', '2026-04-01')).toBe('2026-11-10')
    // No start date on record, or one that is no day: the asked day stands.
    expect(moneyInDepositsReadFrom('2026-03-01', null)).toBe('2026-03-01')
    expect(moneyInDepositsReadFrom('2026-03-01', ' ')).toBe('2026-03-01')
    expect(moneyInDepositsReadFrom('2026-03-01', 'April')).toBe('2026-03-01')
  })
})

describe('matchMoneyInDeposits', () => {
  it('gives a deposit the typed-in payment of the same amount, once', () => {
    const { matches, usedPaymentIds } = matchMoneyInDeposits({
      deposits: [deposit({ mercuryTransactionId: 'm1' }), deposit({ mercuryTransactionId: 'm2', dayYmd: '2026-10-27' })],
      unlinked: [typed({ paymentId: 'u1' })],
      todayYmd: TODAY,
    })
    expect(matches.map((m) => [m.deposit.mercuryTransactionId, m.payment?.paymentId ?? null])).toEqual([
      ['m1', 'u1'],
      ['m2', null],
    ])
    expect([...usedPaymentIds]).toEqual(['u1'])
  })

  it('never lets an in-kind payment, or one on an open return case, carry a deposit', () => {
    const { matches, unlinked } = matchMoneyInDeposits({
      deposits: [deposit({ mercuryTransactionId: 'm1' })],
      unlinked: [typed({ paymentId: 'kind', paymentType: 'In kind' }), typed({ paymentId: 'back' })],
      returnedPaymentIds: new Set(['back']),
      todayYmd: TODAY,
    })
    expect(matches[0]?.payment).toBeNull()
    expect(unlinked).toEqual([])
  })

  it('leaves a payment typed in more than thirty days before the deposit alone', () => {
    const { matches } = matchMoneyInDeposits({ deposits: [deposit({ mercuryTransactionId: 'm1' })], unlinked: [typed({ paymentId: 'old', paidOnYmd: '2026-09-20' })], todayYmd: TODAY })
    expect(matches[0]?.payment).toBeNull()
  })
})

describe('deposits on no bill', () => {
  const run = (deposits: MoneyInDeposit[], unlinked: MoneyInUnlinkedPayment[] = []) => depositsOnNoBillByDay(matchMoneyInDeposits({ deposits, unlinked, todayYmd: TODAY }).matches, TODAY)

  it('counts each posted deposit no typed-in payment carries, on the day it posted, with the money not applied', () => {
    const days = run([deposit({ mercuryTransactionId: 'm1', usd: 640.1 }), deposit({ mercuryTransactionId: 'm2', usd: 1200.2 }), deposit({ mercuryTransactionId: 'm3', usd: 75, dayYmd: '2026-10-27' })])
    expect(days.get('2026-10-26')).toEqual({ deposits: 2, usd: 1840.3 })
    expect(days.get('2026-10-27')).toEqual({ deposits: 1, usd: 75 })
    expect(days.get('2026-10-25')).toBeUndefined()
  })

  it('leaves out a deposit a typed-in payment carries: that money is already on a job', () => {
    const days = run([deposit({ mercuryTransactionId: 'm1' }), deposit({ mercuryTransactionId: 'm2', usd: 900 })], [typed({ paymentId: 'u1' })])
    expect(days.get('2026-10-26')).toEqual({ deposits: 1, usd: 900 })
  })

  it('leaves out a deposit still pending at the bank, and a day that has not come', () => {
    const days = run([deposit({ mercuryTransactionId: 'p1', state: 'pending' }), deposit({ mercuryTransactionId: 'm1', dayYmd: '2026-10-28' })])
    expect(days.size).toBe(0)
  })

  it('says of one match whether it is on no bill', () => {
    expect(depositOnNoBill({ deposit: deposit({ mercuryTransactionId: 'm1' }), payment: null })).toBe(true)
    expect(depositOnNoBill({ deposit: deposit({ mercuryTransactionId: 'm1' }), payment: typed({ paymentId: 'u1' }) })).toBe(false)
    expect(depositOnNoBill({ deposit: deposit({ mercuryTransactionId: 'm1', state: 'pending' }), payment: null })).toBe(false)
  })
})
