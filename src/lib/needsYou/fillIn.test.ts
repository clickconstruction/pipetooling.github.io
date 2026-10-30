import { describe, expect, it } from 'vitest'
import {
  FILL_IN_KIND_ITEM,
  FILL_IN_KINDS_BUILT,
  fillInDoneWords,
  fillInKindOfItem,
  fillInKindPositionWords,
  fillInOrder,
  fillInKindIsViewers,
  fillInOtherLinesHeading,
  needsYouStationOpening,
  fillInProgressWords,
  fillInKindFirst,
  fillInRowsOrdered,
  pushFillInHandled,
  type FillInRowBase,
} from './fillIn'
import { NEEDS_YOU_RANK } from '../dashboardNeedsYou'

const row = (key: string, kind: FillInRowBase['kind']): FillInRowBase => ({ key, kind, severity: 'gray', title: key, knows: [], doorHref: '/x', doorLabel: 'Open' })

describe('fillIn · the deck’s shell (punch list #146)', () => {
  it('every kind names a line the rank table knows, and the built kinds open from their line', () => {
    for (const kind of Object.keys(FILL_IN_KIND_ITEM) as Array<keyof typeof FILL_IN_KIND_ITEM>) {
      expect(NEEDS_YOU_RANK[FILL_IN_KIND_ITEM[kind]]).toBeTypeOf('number')
    }
    expect(FILL_IN_KINDS_BUILT).toEqual(['lost-bid', 'vehicle', 'job-account', 'contract', 'contract-missing', 'purchase', 'move-window', 'work-order'])
    expect(fillInKindOfItem('lost-bids')).toBe('lost-bid')
    expect(fillInKindOfItem('vehicle-records-missing')).toBe('vehicle')
    expect(fillInKindOfItem('job-account-missing')).toBe('job-account')
    expect(fillInKindOfItem('contract-stale')).toBe('contract')
    expect(fillInKindOfItem('contract-missing')).toBe('contract-missing')
    expect(fillInKindOfItem('tally-self')).toBe('purchase')
    expect(fillInKindOfItem('job-account-window')).toBe('move-window')
    expect(fillInKindOfItem('work-orders-unpriced')).toBe('work-order')
    expect(fillInKindOfItem('statement-round')).toBeNull()
  })

  it('orders kinds by their line’s rank, each kind’s rows as given', () => {
    const out = fillInRowsOrdered({
      'lost-bid': [row('lost-bid:1', 'lost-bid'), row('lost-bid:2', 'lost-bid')],
      contract: [row('contract:1', 'contract')],
      vehicle: [row('vehicle:1', 'vehicle')],
      purchase: [row('purchase:1', 'purchase')],
      'move-window': [row('move-window:1', 'move-window')],
      'work-order': [row('work-order:1', 'work-order')],
    })
    // The viewer's own purchases rank 30, the move window and the work orders 40, contract-stale 50, lost-bids and vehicles 60 (insertion order among equals).
    expect(out.map((r) => r.key)).toEqual(['purchase:1', 'move-window:1', 'work-order:1', 'contract:1', 'lost-bid:1', 'lost-bid:2', 'vehicle:1'])
  })

  it('a skipped row goes to the back; the asked kind walks first until its rows are saved or skipped (v2.6129)', () => {
    const rows = [row('a', 'contract'), row('b', 'lost-bid'), row('c', 'lost-bid')]
    const keys = (rs: FillInRowBase[]) => rs.map((r) => r.key)
    expect(keys(fillInOrder(rows, ['a']))).toEqual(['b', 'c', 'a'])
    expect(keys(fillInKindFirst(rows, 'lost-bid', []))).toEqual(['b', 'c', 'a'])
    // A Skip keeps to the kind: the next lost bid, not the contract on top.
    expect(keys(fillInKindFirst(fillInOrder(rows, ['b']), 'lost-bid', ['b']))).toEqual(['c', 'a', 'b'])
    // A saved row has left the list: the next of the kind still leads.
    expect(keys(fillInKindFirst(fillInOrder([rows[0]!, rows[2]!], []), 'lost-bid', []))).toEqual(['c', 'a'])
    // Every row of the kind skipped: the deck's own order, the skipped rows at the back.
    expect(keys(fillInKindFirst(fillInOrder(rows, ['b', 'c']), 'lost-bid', ['b', 'c']))).toEqual(['a', 'b', 'c'])
    expect(keys(fillInKindFirst(rows, 'vehicle', []))).toEqual(['a', 'b', 'c'])
    expect(keys(fillInKindFirst(rows, null, []))).toEqual(['a', 'b', 'c'])
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

describe('fillIn · the deck as the station’s body (v2.5907, punch list #178)', () => {
  const rows = [row('lost-bid:1', 'lost-bid'), row('contract-missing:2', 'contract-missing')]

  it('the office’s kinds are the assistant’s to fill, never the owner’s or the controller’s; the purchases kind is everyone’s own', () => {
    for (const kind of FILL_IN_KINDS_BUILT.filter((k) => k !== 'purchase')) {
      expect(fillInKindIsViewers(kind, 'assistant')).toBe(true)
      expect(fillInKindIsViewers(kind, 'dev')).toBe(false)
      expect(fillInKindIsViewers(kind, 'master_technician')).toBe(false)
      expect(fillInKindIsViewers(kind, 'controller')).toBe(false)
    }
    for (const role of ['assistant', 'dev', 'master_technician', 'controller', 'subcontractor'] as const) expect(fillInKindIsViewers('purchase', role)).toBe(true)
  })

  it('the assistant’s station opens on the deck while it holds her rows', () => {
    expect(needsYouStationOpening({ rows, loading: false, role: 'assistant' })).toBe('deck')
    expect(needsYouStationOpening({ rows, loading: true, role: 'assistant' })).toBe('deck')
  })

  it('and while it is still reading them, so her morning never opens on the card and then jumps', () => {
    expect(needsYouStationOpening({ rows: [], loading: true, role: 'assistant' })).toBe('deck')
  })

  it('and on the card once the read ends with nothing to fill', () => {
    expect(needsYouStationOpening({ rows: [], loading: false, role: 'assistant' })).toBe('card')
  })

  it('the owner and the controller open on their own lines, the office’s rows one chip away (the first live look)', () => {
    for (const role of ['dev', 'master_technician', 'controller'] as const) {
      expect(needsYouStationOpening({ rows, loading: false, role })).toBe('card')
      // Since v2.6071 a kind is theirs too, their own card purchases, so a read in progress holds the deck for them as well.
      expect(needsYouStationOpening({ rows: [], loading: true, role })).toBe('deck')
      expect(needsYouStationOpening({ rows: [...rows, row('purchase:9', 'purchase')], loading: false, role })).toBe('deck')
    }
    // Before auth has a role, nothing is the viewer's.
    expect(needsYouStationOpening({ rows, loading: false, role: null })).toBe('card')
  })

  it('the heading over the lines the deck cannot fill counts them', () => {
    expect(fillInOtherLinesHeading(1)).toBe('Your other line')
    expect(fillInOtherLinesHeading(4)).toBe('Your other lines · 4')
  })
})
