import { describe, expect, it } from 'vitest'
import { BILL_HAND_WAYS_BUILT_IN, BILL_HAND_WAYS_CAP, billHandWaysOrBuiltIn, liveBillHandWays, parseBillHandWay, retiredBillHandWays } from './billHandWays'

/** The ways a bill can go when the app did not send it (punch list #340). Every name is made up. */
const row = (over: Record<string, unknown> = {}) => ({ id: 'w1', key: 'handed', label: 'Handed over', sent_how: 'hand', sort_order: 1, retired_at: null, retired_by_name: '', created_by_name: '', created_at: '2026-11-13T15:00:00Z', ...over })

describe('parseBillHandWay — a stored row, read defensively', () => {
  it('reads a row as the form needs it', () => {
    expect(parseBillHandWay(row({ id: 'w5', key: 'w_3f9a1c2e77', label: ' Uploaded to the builder’s pay portal ', sent_how: 'other', sort_order: 5, created_by_name: ' Priya ' }))).toEqual({
      id: 'w5',
      key: 'w_3f9a1c2e77',
      label: 'Uploaded to the builder’s pay portal',
      sentHow: 'other',
      sortOrder: 5,
      retiredAtIso: null,
      retiredByName: '',
      createdByName: 'Priya',
      createdAtIso: '2026-11-13T15:00:00Z',
    })
  })

  it('drops a row with no id, no key or no words, and reads an unknown how as another way', () => {
    expect(parseBillHandWay(row({ id: '' }))).toBeNull()
    expect(parseBillHandWay(row({ key: null }))).toBeNull()
    expect(parseBillHandWay(row({ label: '   ' }))).toBeNull()
    expect(parseBillHandWay(null)).toBeNull()
    expect(parseBillHandWay(row({ sent_how: 'print' }))?.sentHow).toBe('other')
  })
})

describe('the list the form offers', () => {
  const ways = [
    parseBillHandWay(row({ id: 'w3', key: 'own_mailbox', label: 'Their own email', sent_how: 'email', sort_order: 3 }))!,
    parseBillHandWay(row({ id: 'w2', key: 'mailed', label: 'Mailed', sent_how: 'mail', sort_order: 2, retired_at: '2026-11-10T16:00:00Z', retired_by_name: 'Marcus' }))!,
    parseBillHandWay(row())!,
    parseBillHandWay(row({ id: 'w9', key: 'w_aa', label: 'Faxed', sent_how: 'other', sort_order: 9, retired_at: '2026-11-12T16:00:00Z', retired_by_name: 'Priya' }))!,
  ]

  it('is the ways on the list in the list’s order, and the ways taken off apart, the latest first', () => {
    expect(liveBillHandWays(ways).map((w) => w.label)).toEqual(['Handed over', 'Their own email'])
    expect(retiredBillHandWays(ways).map((w) => [w.label, w.retiredByName])).toEqual([
      ['Faxed', 'Priya'],
      ['Mailed', 'Marcus'],
    ])
  })

  it('uses the read when it has a way on the list, and the four in code when it was refused or came back empty', () => {
    expect(billHandWaysOrBuiltIn(ways)).toEqual({ ways, fromTable: true })
    expect(billHandWaysOrBuiltIn(null)).toEqual({ ways: BILL_HAND_WAYS_BUILT_IN, fromTable: false })
    expect(billHandWaysOrBuiltIn([])).toEqual({ ways: BILL_HAND_WAYS_BUILT_IN, fromTable: false })
    expect(billHandWaysOrBuiltIn(retiredBillHandWays(ways)).fromTable).toBe(false)
  })

  it('keeps the four the form began with under the keys the oldest records carry', () => {
    expect(BILL_HAND_WAYS_BUILT_IN.map((w) => [w.key, w.label, w.sentHow])).toEqual([
      ['handed', 'Handed over', 'hand'],
      ['mailed', 'Mailed', 'mail'],
      ['own_mailbox', 'Emailed from a person’s own mailbox', 'email'],
      ['housecall_pro', 'Sent from Housecall Pro', 'email'],
    ])
    expect(BILL_HAND_WAYS_CAP).toBe(12)
  })
})
