import { describe, expect, it } from 'vitest'
import type { TallyQueueCard } from './tallyTeamQueue'
import type { StaleStaffRow } from './teamPurchaseRows'
import {
  isTallyPaySend,
  tallyCashAppSendKind,
  tallyPayBarWords,
  tallyPayMarkToast,
  tallyPaySendGroups,
  tallyPaySendPayee,
  tallyPayUnmarkToast,
} from './tallyPaySends'

// Made-up holders, payees and amounts.
const row = (id: string, holder: string, store: string, amount: number, bank: string | null, note = ''): StaleStaffRow =>
  ({
    note,
    target_user_id: holder,
    target_name: holder === 'u-rob' ? 'Rob' : 'Ann',
    mercury_transaction_id: id,
    posted_at: '2026-09-30T12:00:00-05:00',
    amount,
    counterparty_name: store,
    raw: bank ? { bankDescription: bank } : {},
    job_splits: [],
  }) as unknown as StaleStaffRow

const card = (holderId: string, holderName: string, rows: StaleStaffRow[]): TallyQueueCard =>
  ({
    holderId,
    holderName,
    ymd: '2026-09-30',
    charges: rows.map((r) => ({ row: r, charge: { id: r.mercury_transaction_id, holderId, madeAt: r.posted_at, amount: Number(r.amount), counterparty: r.counterparty_name ?? '', category: null } })),
    total: 0,
    suggestion: {} as TallyQueueCard['suggestion'],
    sorted: [],
  }) as TallyQueueCard

describe('isTallyPaySend', () => {
  it('is a Cash App send by its counterparty or by its bank description', () => {
    expect(isTallyPaySend(row('a', 'u-rob', 'Cash App', -500, null))).toBe(true)
    expect(isTallyPaySend(row('b', 'u-rob', 'Square Inc', -500, 'CASH APP*ISAIAH WHITES'))).toBe(true)
    expect(isTallyPaySend(row('c', 'u-rob', 'CashApp', -500, null))).toBe(true)
  })

  it('is not a store purchase', () => {
    expect(isTallyPaySend(row('d', 'u-rob', 'Ridge Supply', -88.2, 'RIDGE SUPPLY #12'))).toBe(false)
    expect(isTallyPaySend(row('e', 'u-rob', 'Corner Fuel', -31.47, null))).toBe(false)
  })

  it('is not money coming in by Cash App', () => {
    expect(isTallyPaySend(row('f', 'u-rob', 'Cash App', 120, 'CASH APP*BO RAY'))).toBe(false)
    expect(isTallyPaySend(row('g', 'u-rob', 'Cash App', 0, null))).toBe(false)
  })
})

describe('a send to a person, or an expense (the owner, 2026-10-09)', () => {
  it('a send with no note, or a pay or advance note, goes to a person', () => {
    expect(tallyCashAppSendKind(row('a', 'u-rob', 'Cash App', -500, 'CASH APP*ISAIAH WHITES'))).toBe('pay')
    expect(tallyCashAppSendKind(row('b', 'u-rob', 'Cash App', -500, 'CASH APP*ISAIAH WHITES', 'Week of 9/29'))).toBe('pay')
    expect(tallyCashAppSendKind(row('c', 'u-rob', 'Cash App', -200, 'CASH APP*ISAIAH WHITES', 'advance'))).toBe('pay')
  })

  it('a send whose note reads as an expense stays off the bar', () => {
    for (const note of ['gas', 'Home Depot run', 'materials for Hill St', 'Reimbursement', 'lunch']) {
      expect(tallyCashAppSendKind(row('d', 'u-rob', 'Cash App', -40, 'CASH APP*PAIGE DOE', note))).toBe('expense')
      expect(isTallyPaySend(row('d', 'u-rob', 'Cash App', -40, 'CASH APP*PAIGE DOE', note))).toBe(false)
    }
  })

  it('a store charge is neither', () => {
    expect(tallyCashAppSendKind(row('e', 'u-rob', 'Ridge Supply', -88.2, null, 'gas'))).toBeNull()
  })
})

describe('tallyPaySendPayee', () => {
  it('reads the name after the star, in title case', () => {
    expect(tallyPaySendPayee({ bankDescription: 'CASH APP*ISAIAH WHITES' })).toBe('Isaiah Whites')
    expect(tallyPaySendPayee({ bankDescription: 'Cash App* paige  doe ' })).toBe('Paige Doe')
  })

  it('is null with no star, no name after it, or no description', () => {
    expect(tallyPaySendPayee({ bankDescription: 'CASH APP' })).toBeNull()
    expect(tallyPaySendPayee({ bankDescription: 'CASH APP*  ' })).toBeNull()
    expect(tallyPaySendPayee({})).toBeNull()
    expect(tallyPaySendPayee(null)).toBeNull()
  })
})

describe('tallyPaySendGroups', () => {
  it('gathers each card holder’s sends across their days, by name, and skips a card with none and a credit', () => {
    const groups = tallyPaySendGroups([
      card('u-rob', 'Rob', [
        row('p1', 'u-rob', 'Cash App', -500, 'CASH APP*ISAIAH WHITES'),
        row('s1', 'u-rob', 'Ridge Supply', -88.2, null),
        row('c1', 'u-rob', 'Cash App', 75, 'CASH APP*BO RAY'),
      ]),
      card('u-ann', 'Ann', [row('s2', 'u-ann', 'Corner Fuel', -31.47, null)]),
      card('u-rob', 'Rob', [row('p2', 'u-rob', 'Cash App', -250.5, 'CASH APP*PAIGE DOE')]),
    ])
    expect(groups).toEqual([
      {
        holderId: 'u-rob',
        holderName: 'Rob',
        sends: [
          { chargeId: 'p1', payee: 'Isaiah Whites', amount: -500 },
          { chargeId: 'p2', payee: 'Paige Doe', amount: -250.5 },
        ],
        total: -750.5,
        expenseSends: 0,
      },
    ])
  })

  it('a mixed card: the sends to a person make the bar, and the expense sends are counted off it', () => {
    const groups = tallyPaySendGroups([
      card('u-rob', 'Rob', [
        row('p1', 'u-rob', 'Cash App', -500, 'CASH APP*ISAIAH WHITES'),
        row('x1', 'u-rob', 'Cash App', -42.5, 'CASH APP*PAIGE DOE', 'gas'),
        row('x2', 'u-rob', 'Cash App', -88, 'CASH APP*PAIGE DOE', 'Home Depot'),
      ]),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]!.sends.map((s) => s.chargeId)).toEqual(['p1'])
    expect(groups[0]!.total).toBe(-500)
    expect(groups[0]!.expenseSends).toBe(2)
    expect(tallyPayBarWords(groups[0]!).leftOff).toBe('2 more sends have a note like gas or Home Depot. Sort them by hand.')
  })

  it('a card whose Cash App sends are all expenses has no bar', () => {
    expect(tallyPaySendGroups([card('u-rob', 'Rob', [row('x1', 'u-rob', 'Cash App', -42.5, 'CASH APP*PAIGE DOE', 'gas')])])).toEqual([])
  })
})

describe('tallyPayBarWords', () => {
  const group = (payees: Array<string | null>) => ({
    holderId: 'u-rob',
    holderName: 'Rob',
    sends: payees.map((payee, i) => ({ chargeId: `p${i}`, payee, amount: -100 })),
    total: -100 * payees.length,
    expenseSends: 0,
  })

  it('says what, whose and how much, who it went to, and counts the button', () => {
    expect(tallyPayBarWords(group(['Isaiah Whites', 'Paige Doe']))).toEqual({
      title: '2 Cash App pay sends on Rob’s card · $200.00',
      payees: 'To Isaiah Whites and Paige Doe.',
      leftOff: '',
      button: 'Mark 2 payroll',
    })
    expect(tallyPayBarWords(group(['Isaiah Whites']))).toEqual({
      title: '1 Cash App pay send on Rob’s card · $100.00',
      payees: 'To Isaiah Whites.',
      leftOff: '',
      button: 'Mark it payroll',
    })
  })

  it('names three payees once each and counts the rest, and says nothing when no name is known', () => {
    expect(tallyPayBarWords(group(['A Lee', 'B Lee', 'A Lee', 'C Lee', 'D Lee', null])).payees).toBe('To A Lee, B Lee, C Lee and 1 more.')
    expect(tallyPayBarWords(group([null, null])).payees).toBe('')
  })
})

describe('the messages', () => {
  it('after marking, with the server’s own words for the first refusal', () => {
    expect(tallyPayMarkToast(1, 0)).toEqual({ message: 'Marked 1 Cash App pay send as payroll.', type: 'success' })
    expect(tallyPayMarkToast(3, 0)).toEqual({ message: 'Marked 3 Cash App pay sends as payroll.', type: 'success' })
    expect(tallyPayMarkToast(2, 1, 'Transaction is allocated to jobs; remove job splits before marking payroll')).toEqual({
      message: 'Marked 2 of 3 as payroll. Transaction is allocated to jobs; remove job splits before marking payroll.',
      type: 'error',
    })
    expect(tallyPayMarkToast(0, 2, 'Not authorized.')).toEqual({ message: 'Nothing was marked. Not authorized.', type: 'error' })
    expect(tallyPayMarkToast(0, 2)).toEqual({ message: 'Nothing was marked. Try again.', type: 'error' })
  })

  it('after undoing a mark', () => {
    expect(tallyPayUnmarkToast(1, 0)).toEqual({ message: '1 pay send is back to sort.', type: 'success' })
    expect(tallyPayUnmarkToast(3, 0)).toEqual({ message: '3 pay sends are back to sort.', type: 'success' })
    expect(tallyPayUnmarkToast(2, 1)).toEqual({ message: '2 of 3 are back to sort. The rest could not be undone.', type: 'error' })
    expect(tallyPayUnmarkToast(0, 1, 'timeout')).toEqual({ message: 'Nothing was undone. timeout.', type: 'error' })
    expect(tallyPayUnmarkToast(0, 1)).toEqual({ message: 'Nothing was undone. Try again.', type: 'error' })
  })
})
