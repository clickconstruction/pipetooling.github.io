import { describe, expect, it } from 'vitest'
import {
  FILL_IN_KIND_ITEM,
  FILL_IN_KINDS_BUILT,
  fillInDoneWords,
  fillInKindOfItem,
  fillInKindPositionWords,
  fillInOrder,
  fillInProgressWords,
  fillInRowsOrdered,
  fillInStartIndex,
  pushFillInHandled,
  type FillInRowBase,
} from './fillIn'
import { NEEDS_YOU_RANK } from '../dashboardNeedsYou'

const row = (key: string, kind: FillInRowBase['kind']): FillInRowBase => ({ key, kind, severity: 'gray', title: key, knows: [], doorHref: '/x', doorLabel: 'Open' })

describe('fillIn · the deck’s shell (punch list #145)', () => {
  it('every kind names a line the rank table knows, and the built kinds open from their line', () => {
    for (const kind of Object.keys(FILL_IN_KIND_ITEM) as Array<keyof typeof FILL_IN_KIND_ITEM>) {
      expect(NEEDS_YOU_RANK[FILL_IN_KIND_ITEM[kind]]).toBeTypeOf('number')
    }
    expect(FILL_IN_KINDS_BUILT).toEqual(['lost-bid'])
    expect(fillInKindOfItem('lost-bids')).toBe('lost-bid')
    expect(fillInKindOfItem('vehicle-records-missing')).toBeNull()
    expect(fillInKindOfItem('tally-self')).toBeNull()
  })

  it('orders kinds by their line’s rank, each kind’s rows as given', () => {
    const out = fillInRowsOrdered({
      'lost-bid': [row('lost-bid:1', 'lost-bid'), row('lost-bid:2', 'lost-bid')],
      contract: [row('contract:1', 'contract')],
      vehicle: [row('vehicle:1', 'vehicle')],
    })
    // contract-stale ranks 50, lost-bids and vehicles 60 (insertion order among equals).
    expect(out.map((r) => r.key)).toEqual(['contract:1', 'lost-bid:1', 'lost-bid:2', 'vehicle:1'])
  })

  it('a skipped row goes to the back; the deck opens on the first row of the asked kind', () => {
    const rows = [row('a', 'contract'), row('b', 'lost-bid'), row('c', 'lost-bid')]
    expect(fillInOrder(rows, ['a']).map((r) => r.key)).toEqual(['b', 'c', 'a'])
    expect(fillInStartIndex(rows, 'lost-bid')).toBe(1)
    expect(fillInStartIndex(rows, 'vehicle')).toBe(0)
    expect(fillInStartIndex(rows, null)).toBe(0)
  })

  it('says where you are and what was saved', () => {
    expect(fillInProgressWords(3, 12, 2)).toBe('3 of 12 · 2 saved')
    expect(fillInProgressWords(1, 12, 0)).toBe('1 of 12')
    expect(fillInKindPositionWords('lost-bid', 1, 6)).toBe('1 of 6 lost bids')
    expect(fillInKindPositionWords('lost-bid', 1, 1)).toBe('1 of 1 lost bid')
  })

  it('the done words count by kind and name where the skipped rows wait', () => {
    expect(fillInDoneWords({ 'lost-bid': 6, vehicle: 2 }, 2)).toEqual({
      title: 'That is every row. 8 saved, 2 skipped.',
      lines: ['6 lost bids have a reason. 2 trucks have a record.', 'The 2 you skipped are still on the Dashboard and here tomorrow.'],
    })
    expect(fillInDoneWords({ 'lost-bid': 1 }, 1)).toEqual({
      title: 'That is every row. 1 saved, 1 skipped.',
      lines: ['1 lost bid has a reason.', 'The one you skipped is still on the Dashboard and here tomorrow.'],
    })
    expect(fillInDoneWords({}, 0)).toEqual({ title: 'Nothing left to fill in.', lines: [] })
  })

  it('the trail keeps one entry per row, newest first', () => {
    const a = row('a', 'lost-bid')
    const t1 = pushFillInHandled([], { row: a, how: 'skipped', words: 'skipped' })
    const t2 = pushFillInHandled(t1, { row: row('b', 'lost-bid'), how: 'saved', words: 'b saved' })
    const t3 = pushFillInHandled(t2, { row: a, how: 'saved', words: 'a saved' })
    expect(t3.map((t) => `${t.row.key}:${t.how}`)).toEqual(['a:saved', 'b:saved'])
  })
})
