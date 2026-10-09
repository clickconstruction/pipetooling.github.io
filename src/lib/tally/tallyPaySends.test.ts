import { describe, expect, it } from 'vitest'
import type { TallyQueueCard } from './tallyTeamQueue'
import type { StaleStaffRow } from './teamPurchaseRows'
import {
  isTallyPaySend,
  tallyPayBarWords,
  tallyPayMarkToast,
  tallyPaySendGroups,
  tallyPaySendPayee,
  tallyPayUnmarkToast,
} from './tallyPaySends'

// Made-up holders, payees and amounts.
const row = (id: string, holder: string, store: string, amount: number, bank: string | null): StaleStaffRow =>
  ({
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
  it('gathers each card holder’s sends across their days, by name, and skips a card with none', () => {
    const groups = tallyPaySendGroups([
      card('u-rob', 'Rob', [row('p1', 'u-rob', 'Cash App', -500, 'CASH APP*ISAIAH WHITES'), row('s1', 'u-rob', 'Ridge Supply', -88.2, null)]),
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
      },
    ])
  })
})

describe('tallyPayBarWords', () => {
  const group = (payees: Array<string | null>) => ({
    holderId: 'u-rob',
    holderName: 'Rob',
    sends: payees.map((payee, i) => ({ chargeId: `p${i}`, payee, amount: -100 })),
    total: -100 * payees.length,
  })

  it('says what, whose and how much, who it went to, and counts the button', () => {
    expect(tallyPayBarWords(group(['Isaiah Whites', 'Paige Doe']))).toEqual({
      title: '2 Cash App pay sends on Rob’s card · $200.00',
      payees: 'To Isaiah Whites and Paige Doe.',
      button: 'Mark 2 payroll',
    })
    expect(tallyPayBarWords(group(['Isaiah Whites']))).toEqual({
      title: '1 Cash App pay send on Rob’s card · $100.00',
      payees: 'To Isaiah Whites.',
      button: 'Mark it payroll',
    })
  })

  it('names three payees once each and counts the rest, and says nothing when no name is known', () => {
    expect(tallyPayBarWords(group(['A Lee', 'B Lee', 'A Lee', 'C Lee', 'D Lee', null])).payees).toBe('To A Lee, B Lee, C Lee and 1 more.')
    expect(tallyPayBarWords(group([null, null])).payees).toBe('')
  })
})

describe('the messages', () => {
  it('after marking', () => {
    expect(tallyPayMarkToast(1, 0)).toEqual({ message: 'Marked 1 Cash App pay send as payroll.', type: 'success' })
    expect(tallyPayMarkToast(3, 0)).toEqual({ message: 'Marked 3 Cash App pay sends as payroll.', type: 'success' })
    expect(tallyPayMarkToast(2, 1)).toEqual({ message: 'Marked 2 of 3 as payroll. The rest need another look.', type: 'error' })
    expect(tallyPayMarkToast(0, 2)).toEqual({ message: 'Nothing was marked. Try again.', type: 'error' })
  })

  it('after undoing a mark', () => {
    expect(tallyPayUnmarkToast(1, 0)).toEqual({ message: '1 pay send is back to sort.', type: 'success' })
    expect(tallyPayUnmarkToast(3, 0)).toEqual({ message: '3 pay sends are back to sort.', type: 'success' })
    expect(tallyPayUnmarkToast(2, 1)).toEqual({ message: '2 of 3 are back to sort. The rest could not be undone.', type: 'error' })
    expect(tallyPayUnmarkToast(0, 1)).toEqual({ message: 'Nothing was undone. Try again.', type: 'error' })
  })
})
