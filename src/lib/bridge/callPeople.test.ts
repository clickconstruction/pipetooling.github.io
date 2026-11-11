import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { MY_MOVES_WORDS, callPeople, chipName, moveDoor, myMovesNeed, parseMoveMarks, parseMyMoves } from './callPeople'

// Made-up people and moves.
describe('callPeople', () => {
  it('lists the accounts a move can go to: by name, no archived account, no one twice, no one with no name', () => {
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
    // The chip prints a first name, and the whole name when two share it.
    expect(chipName(people[2]!, people)).toBe('Sam')
    expect(chipName(people[0]!, people)).toBe('Dana Ortiz')
    expect(chipName(people[1]!, people)).toBe('Dana Reyes')
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

describe('the viewer’s own moves', () => {
  const rows = [
    { call_id: 'c1', week_start: '2026-11-08', called_on: '2026-11-09', called_by_name: 'Sam', link: 'bill', idx: 2, move_key: 'other', title: 'Take bank sorting off whoever bills.' },
    { call_id: 'c1', week_start: '2026-11-08', called_on: '2026-11-09', called_by_name: 'Sam', link: 'bill', idx: 0, move_key: 'bill', title: 'Bill the 11 finished jobs.' },
    { call_id: 'c1', idx: 1, move_key: 'a new kind', title: 'Something the app does not know.' },
    { call_id: 'c1', idx: 3, move_key: 'price', title: '  ' },
    { idx: 4, title: 'No call.' },
  ]

  it('reads the function’s rows in the call’s order and leaves out what does not read', () => {
    const moves = parseMyMoves(rows)
    expect(moves.map((m) => [m.idx, m.key, m.title])).toEqual([[0, 'bill', 'Bill the 11 finished jobs.'], [1, 'other', 'Something the app does not know.'], [2, 'other', 'Take bank sorting off whoever bills.']])
    expect(moves[0]).toMatchObject({ callId: 'c1', link: 'bill', calledByName: 'Sam' })
    expect(parseMyMoves(null)).toEqual([])
    expect(parseMyMoves({})).toEqual([])
  })

  it('opens the page where each kind of move is done, and none for a move the app has no page for', () => {
    expect(moveDoor('bill')).toEqual({ to: '/jobs?tab=stages', label: 'Open Stages' })
    expect(moveDoor('chase')).toEqual({ to: '/jobs?tab=billing', label: 'Open Billing' })
    expect(moveDoor('approve')?.to).toBe('/people?tab=hours&approvals=1')
    expect(moveDoor('price')?.to).toBe('/jobs?tab=stages')
    expect(moveDoor('pct')?.to).toBe('/jobs?tab=stages')
    expect(moveDoor('other')).toBeNull()
  })

  it('makes one Needs you line, on the first move, saying who made the call and how many more follow', () => {
    const three = myMovesNeed(parseMyMoves(rows))
    expect(three).toMatchObject({ count: 3, title: 'Bill the 11 finished jobs.', detail: 'Sam put it on the week’s call. 2 more moves are yours after it.', door: { label: 'Open Stages' } })
    const two = myMovesNeed(parseMyMoves(rows).slice(0, 2))
    expect(two?.detail).toBe('Sam put it on the week’s call. One more move is yours after it.')
    // One move with no page: the button marks it done.
    const one = myMovesNeed(parseMyMoves(rows).slice(2))
    expect(one).toMatchObject({ count: 1, title: 'Take bank sorting off whoever bills.', detail: 'Sam put it on the week’s call. Friday asks if it moved.', door: null })
    // No name on the call.
    expect(myMovesNeed([{ callId: 'c1', idx: 0, key: 'bill', title: 'Bill the finished work.', link: 'bill', calledByName: '' }])?.detail).toBe('It is on the week’s call. Friday asks if it moved.')
    expect(myMovesNeed([])).toBeNull()
  })

  it('writes plain words', () => {
    for (const n of [myMovesNeed(parseMyMoves(rows)), myMovesNeed(parseMyMoves(rows).slice(0, 2)), myMovesNeed(parseMyMoves(rows).slice(2))]) expect(plainWordsFailures(n?.detail ?? ''), n?.detail).toEqual([])
    for (const w of Object.values(MY_MOVES_WORDS)) expect(plainWordsFailures(w), w).toEqual([])
  })
})
