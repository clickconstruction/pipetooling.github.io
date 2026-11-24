import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { contactNameForConfirm, removeContactConfirm } from './removeContactConfirm'

/** Every name here is made up. */
describe('the question before a contact is removed', () => {
  it('names the contact on its press, and says where they come back from', () => {
    expect(removeContactConfirm({ name: 'Dana Whitlock', getsBillCopies: false })).toEqual({
      message: 'Remove Dana Whitlock from this customer’s contacts? A dev can put them back for 90 days, from Recently deleted in Settings.',
      confirmLabel: 'Remove Dana Whitlock',
      cancelLabel: 'Keep them',
      danger: true,
      cancelIsSafe: true,
    })
  })

  it('says a contact who gets every bill stops getting one', () => {
    expect(removeContactConfirm({ name: 'Accounts Payable', getsBillCopies: true }).message).toBe('Remove Accounts Payable from this customer’s contacts? They stop getting a copy of every bill. A dev can put them back for 90 days, from Recently deleted in Settings.')
  })

  it('never names the act OK, and reads a row with no name as this contact', () => {
    expect(contactNameForConfirm('  Dana   Whitlock ')).toBe('Dana Whitlock')
    expect(contactNameForConfirm(' ')).toBe('this contact')
    expect(removeContactConfirm({ name: null, getsBillCopies: false }).confirmLabel).toBe('Remove this contact')
  })

  it('makes Keep them the safe answer, whoever the contact is', () => {
    expect(removeContactConfirm({ name: 'Dana Whitlock', getsBillCopies: true }).cancelIsSafe).toBe(true)
    expect(removeContactConfirm({ name: null, getsBillCopies: false }).cancelIsSafe).toBe(true)
  })

  it('reads in plain words', () => {
    const q = removeContactConfirm({ name: 'Dana Whitlock', getsBillCopies: true })
    expect([q.message, q.confirmLabel, q.cancelLabel ?? ''].flatMap((t) => plainWordsFailures(t))).toEqual([])
  })
})
