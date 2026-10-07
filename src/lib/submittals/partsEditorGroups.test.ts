import { describe, expect, it } from 'vitest'
import { editStatusChoices, editWindowTitle, groupPartDrafts, neighborInGroup, newRowIsBlank, partCallMark } from './partsEditorGroups'

const d = (on_submittal: boolean, left_out = false) => ({ on_submittal, left_out })

describe('groupPartDrafts', () => {
  // LAV-1 on the SpaceX bid: two GC parts, five order only, then one more the GC sees at the end.
  const lav = [d(true), d(true), d(false), d(false), d(false), d(false), d(false), d(true)]

  it('the GC’s parts first, then order only, each with its count and its places in the drafts', () => {
    const g = groupPartDrafts(lav)
    expect(g.map((x) => [x.key, x.title, x.indexes])).toEqual([
      ['gc', 'The GC sees these · 3', [0, 1, 7]],
      ['order', 'Order only · 5', [2, 3, 4, 5, 6]],
    ])
    expect(g[0]?.hint).toBe('in this order on the submittal')
  })

  it('a left out part has its own group, last; an empty group is not drawn', () => {
    const g = groupPartDrafts([d(true), d(false, true), d(true, true)])
    expect(g.map((x) => [x.key, x.title, x.indexes])).toEqual([
      ['gc', 'The GC sees these · 1', [0]],
      ['out', 'Left out · 2', [1, 2]],
    ])
  })

  it('on an order-only fixture every part kept is order only, whatever its own pick', () => {
    const g = groupPartDrafts([d(true), d(false), d(true, true)], true)
    expect(g.map((x) => [x.key, x.indexes])).toEqual([['order', [0, 1]], ['out', [2]]])
    expect(g[0]?.hint).toBe('every part is order only, with its fixture')
  })

  it('no parts, no groups', () => {
    expect(groupPartDrafts([])).toEqual([])
  })
})

describe('neighborInGroup', () => {
  const group = { indexes: [0, 1, 7] }
  it('trades places with the next part of the same group, however far apart they are kept', () => {
    expect(neighborInGroup(group, 1, 1)).toBe(7)
    expect(neighborInGroup(group, 7, -1)).toBe(1)
  })
  it('nothing past the edge of the group, and nothing for a part that is not in it', () => {
    expect(neighborInGroup(group, 0, -1)).toBeNull()
    expect(neighborInGroup(group, 7, 1)).toBeNull()
    expect(neighborInGroup(group, 3, 1)).toBeNull()
  })
})

describe('partCallMark', () => {
  it('says the answer and its day, with the reviewer’s note', () => {
    expect(partCallMark({ review_decision: 'rejected', review_note: ' TEL145 ', reviewed_at: '2026-10-02T15:00:00Z' })).toEqual({ tone: 'rejected', words: 'Rejected Oct 2', note: 'TEL145' })
    expect(partCallMark({ review_decision: 'approved', review_note: null, reviewed_at: null })).toEqual({ tone: 'approved', words: 'Approved', note: '' })
  })
  it('no answer, no mark', () => {
    expect(partCallMark({ review_decision: null, review_note: 'x', reviewed_at: null })).toBeNull()
    expect(partCallMark({ review_decision: 'maybe', review_note: null, reviewed_at: null })).toBeNull()
  })
})

describe('editStatusChoices', () => {
  it('Proposed leads on a row with nothing specified, and stays on a row that already is Proposed', () => {
    expect(editStatusChoices('proposed', false)[0]).toBe('proposed')
    expect(editStatusChoices('missing', false)[0]).toBe('proposed')
    expect(editStatusChoices('proposed', true)).toHaveLength(8)
  })
  it('a row checked against the schedule keeps the seven', () => {
    const seven = editStatusChoices('alternate', true)
    expect(seven).toEqual(['as_specified', 'superseded', 'equal', 'alternate', 'design_change', 'missing', 'accessory'])
  })
})

describe('editWindowTitle', () => {
  it('names the row, or says it is a new one', () => {
    expect(editWindowTitle('LAV-1', false)).toBe('Edit LAV-1')
    expect(editWindowTitle('  ', false)).toBe('Edit accessory')
    expect(editWindowTitle('', true)).toBe('Add a row')
  })
})

describe('newRowIsBlank', () => {
  it('blank until a tag, a product or a part is typed', () => {
    expect(newRowIsBlank(' ', ' ', null)).toBe(true)
    expect(newRowIsBlank('HB-4', '', null)).toBe(false)
    expect(newRowIsBlank('', 'WOODFORD B74C', null)).toBe(false)
    expect(newRowIsBlank('', 'ignored once it has parts', [{ label: ' ', left_out: false }])).toBe(true)
    expect(newRowIsBlank('', '', [{ label: 'WOODFORD B74C', left_out: true }])).toBe(true)
    expect(newRowIsBlank('', '', [{ label: 'WOODFORD B74C', left_out: false }])).toBe(false)
  })
})
