import { describe, expect, it } from 'vitest'
import { savedMoveId } from './savedMove'
import type { ScheduleMove } from './types'

const move = (id: string, lineId: string, start: string, finish: string, note: string, over: Partial<ScheduleMove> = {}): ScheduleMove => ({
  id,
  on: '2026-10-09',
  by: 'Rosa',
  lineId,
  from: { start: '2026-10-05', finish: '2026-10-09' },
  to: { start, finish },
  reason: 'weather',
  note,
  pushed: [],
  finishFrom: '2026-12-01',
  finishTo: '2026-12-02',
  ...over,
})

describe('savedMoveId: the walk’s move id, read back after the save', () => {
  const ours = move('ours', 'fdry-1', '2026-10-06', '2026-10-12', 'Rain Tuesday.')
  const before = { moves: [move('m1', 'fdry-1', '2026-10-05', '2026-10-10', 'Earlier.')] }

  it('finds ours among two new moves, someone else’s saved between the two reads', () => {
    const theirs = move('theirs', 'felec-2', '2026-10-06', '2026-10-12', 'Rain Tuesday.')
    const after = { moves: [theirs, move('db-42', 'fdry-1', '2026-10-06', '2026-10-12', 'Rain Tuesday. '), ...before.moves] }
    expect(savedMoveId(before, after, ours)).toBe('db-42')
  })

  it('is null when no new move has our bar, our days and our note', () => {
    const after = { moves: [move('db-43', 'fdry-1', '2026-10-06', '2026-10-13', 'Rain Tuesday.'), ...before.moves] }
    expect(savedMoveId(before, after, ours)).toBeNull()
    expect(savedMoveId(before, { moves: before.moves }, ours)).toBeNull()
  })

  it('never takes a move the reads already had, or one undone', () => {
    const had = { moves: [move('m2', 'fdry-1', '2026-10-06', '2026-10-12', 'Rain Tuesday.')] }
    expect(savedMoveId(had, had, ours)).toBeNull()
    const undone = { moves: [move('db-44', 'fdry-1', '2026-10-06', '2026-10-12', 'Rain Tuesday.', { undoneOn: '2026-10-09' })] }
    expect(savedMoveId(before, undone, ours)).toBeNull()
  })

  it('reads a schedule with no moves yet, or none at all', () => {
    expect(savedMoveId(undefined, { moves: [move('db-1', 'fdry-1', '2026-10-06', '2026-10-12', 'Rain Tuesday.')] }, ours)).toBe('db-1')
    expect(savedMoveId(null, null, ours)).toBeNull()
  })
})
