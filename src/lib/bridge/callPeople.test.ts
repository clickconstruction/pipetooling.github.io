import { describe, expect, it } from 'vitest'
import { parseMoveMarks } from './callPeople'

// Made-up people and moves.
describe('parseMoveMarks', () => {
  it('reads the Done stamps off the calls’ moves, and nothing from a move without one', () => {
    const marks = parseMoveMarks([
      { id: 'c1', moves: [{ key: 'bill', title: 'Bill.', doneAt: '2026-11-11T15:00:00Z', doneBy: ' Dana Reyes ' }, { key: 'price', title: 'Price.' }, { key: 'other', title: 'x', doneAt: '2026-11-12T09:00:00Z' }] },
      { id: 'c2', moves: {} },
      { id: 'c3', moves: [null, { doneAt: '' }] },
    ])
    expect(marks).toEqual([{ callId: 'c1', idx: 0, doneBy: 'Dana Reyes' }, { callId: 'c1', idx: 2, doneBy: '' }])
  })
})
