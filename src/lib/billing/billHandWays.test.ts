import { describe, expect, it } from 'vitest'
import {
  BILL_HAND_WAYS_BUILT_IN,
  BILL_HAND_WAYS_CAP,
  billHandWaysOrBuiltIn,
  cleanHandWayLabel,
  handWayAddProblem,
  handWayAddedWords,
  handWayBringBackProblem,
  handWayCountWords,
  handWayMove,
  handWayNameProblem,
  handWayTakeOffProblem,
  handWayTakenOffWords,
  liveBillHandWays,
  parseBillHandWay,
  retiredBillHandWays,
  type BillHandWay,
} from './billHandWays'

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

describe('editing the list — what each press says and refuses', () => {
  const way = (id: string, label: string, sortOrder: number, over: Partial<BillHandWay> = {}): BillHandWay => ({ id, key: `k_${id}`, label, sentHow: 'other', sortOrder, retiredAtIso: null, retiredByName: '', createdByName: '', createdAtIso: null, ...over })
  const ways = [way('a', 'Handed over', 1), way('b', 'Mailed', 2), way('c', 'Their own email', 3), way('x', 'Faxed', 9, { retiredAtIso: '2026-11-09T16:00:00Z', retiredByName: 'Marcus' })]
  const full = Array.from({ length: BILL_HAND_WAYS_CAP }, (_, i) => way(`f${i}`, `Way ${i + 1}`, i + 1))

  it('keeps typed words tidy and says how full the list is', () => {
    expect(cleanHandWayLabel('  Left at   the\tfront desk ')).toBe('Left at the front desk')
    expect(handWayCountWords(ways)).toBe('3 of 12')
  })

  it('refuses a name that is blank, too long or already on the list, and lets a way keep its own name', () => {
    expect(handWayNameProblem('   ', ways)).toBe('Type the way in a few words.')
    expect(handWayNameProblem('x'.repeat(61), ways)).toBe('Keep it to 60 characters. This is 61.')
    expect(handWayNameProblem(' MAILED ', ways)).toBe('That way is already on the list.')
    expect(handWayNameProblem('Mailed', ways, 'b')).toBe('')
    // A way taken off has freed its words.
    expect(handWayNameProblem('Faxed', ways)).toBe('')
  })

  it('refuses a 13th way, and a new way with nothing typed', () => {
    expect(handWayAddProblem('', ways)).toBe('Type the new way in a few words.')
    expect(handWayAddProblem('Left at the front desk', ways)).toBe('')
    expect(handWayAddProblem('Left at the front desk', full)).toBe('The list is full at 12 ways. Take one off first.')
  })

  it('keeps one way on the list, and brings one back only when there is room and its words are free', () => {
    expect(handWayTakeOffProblem(ways[0]!, ways)).toBe('')
    expect(handWayTakeOffProblem(ways[0]!, [ways[0]!, ways[3]!])).toBe('The list needs one way. Add another before you take this one off.')
    expect(handWayBringBackProblem(ways[3]!, ways)).toBe('')
    expect(handWayBringBackProblem(ways[3]!, [...full, ways[3]!])).toBe('The list is full at 12 ways. Take one off first.')
    expect(handWayBringBackProblem(ways[3]!, [...ways, way('y', 'faxed', 4)])).toBe('A way with these words is on the list now. Rename that one first.')
  })

  it('moves a way one place: two rows trade places, a tie is numbered again, the ends stay', () => {
    expect(handWayMove(ways, 'b', 'up')).toEqual([{ id: 'b', sortOrder: 1 }, { id: 'a', sortOrder: 2 }])
    expect(handWayMove(ways, 'b', 'down')).toEqual([{ id: 'b', sortOrder: 3 }, { id: 'c', sortOrder: 2 }])
    expect(handWayMove(ways, 'a', 'up')).toBeNull()
    expect(handWayMove(ways, 'c', 'down')).toBeNull()
    // A way off the list has no place to move from.
    expect(handWayMove(ways, 'x', 'up')).toBeNull()
    const tied = [way('a', 'Alpha', 5), way('b', 'Bravo', 5), way('c', 'Charlie', 6)]
    expect(handWayMove(tied, 'a', 'down')).toEqual([{ id: 'b', sortOrder: 1 }, { id: 'a', sortOrder: 2 }, { id: 'c', sortOrder: 3 }])
  })

  it('says who added a way and who took one off, with the day', () => {
    expect(handWayAddedWords(way('n', 'Portal', 5, { createdByName: 'Priya', createdAtIso: '2026-11-11T18:00:00Z' }))).toBe('Added by Priya on Wed, Nov 11')
    expect(handWayAddedWords(ways[0]!)).toBe('')
    expect(handWayTakenOffWords(ways[3]!)).toBe('Taken off by Marcus on Mon, Nov 9')
    expect(handWayTakenOffWords(ways[0]!)).toBe('')
  })
})
