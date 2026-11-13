import { describe, expect, it } from 'vitest'
import { callPeople, parseMoveMarks } from './callPeople'

// Made-up people and moves.
describe('callPeople', () => {
  it('lists the accounts by name: no archived account, no one twice, no one with no name', () => {
    const people = callPeople([
      { userId: 'u6', name: 'Rio Plumbing', archived: false, role: 'subcontractor' },
      { userId: 'u7', name: 'Robot Estimator', archived: false, role: 'estimator', twin: true },
      { userId: 'u8', name: 'Training Assistant', archived: false, role: 'assistant', readOnly: true },
      { userId: 'u2', name: 'Sam Holt', archived: false },
      { userId: 'u1', name: ' Dana Reyes ', archived: false },
      { userId: 'u3', name: 'Lee Gone', archived: true },
      { userId: 'u4', name: 'Unnamed', archived: false },
      { userId: 'u1', name: 'Dana Reyes', archived: false },
      { userId: 'u5', name: 'Dana Ortiz', archived: false },
    ])
    expect(people).toEqual([{ id: 'u5', name: 'Dana Ortiz' }, { id: 'u1', name: 'Dana Reyes' }, { id: 'u2', name: 'Sam Holt' }])
  })
})

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
