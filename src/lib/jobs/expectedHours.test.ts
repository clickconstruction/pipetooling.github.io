import { describe, expect, it } from 'vitest'

import { changesOf, changeWords, openTargetsOf, undoOf, type ExpectedHoursRow } from './expectedHours'

const row = (p: Partial<ExpectedHoursRow> & { id: string; job_id: string; set_at: string }): ExpectedHoursRow => ({
  hours: 100,
  from_hours: null,
  set_by: 'u1',
  set_by_name: 'Robert',
  why: 'the bid carried too many hours',
  cleared_at: null,
  cleared_by: null,
  cleared_by_name: null,
  ...p,
})

// Job A: set to 110 (from the budget's 138), then to 96 (replacing 110 in the same instant). Job B: set to 60, then cleared.
const T1 = '2026-11-01T20:00:00+00:00'
const T2 = '2026-11-02T01:00:00+00:00'
const T3 = '2026-11-02T02:00:00+00:00'
const T4 = '2026-11-02T03:00:00+00:00'
const rows: ExpectedHoursRow[] = [
  row({ id: 'a1', job_id: 'A', hours: '110.0', from_hours: '138.0', set_at: T1, cleared_at: T2, cleared_by_name: 'Robert' }),
  row({ id: 'a2', job_id: 'A', hours: 96, from_hours: 110, set_at: T2, why: 'framed in a week' }),
  row({ id: 'b1', job_id: 'B', hours: 60, from_hours: 80, set_at: T3, set_by_name: 'Taunya', cleared_at: T4, cleared_by_name: 'Taunya' }),
]

describe('openTargetsOf', () => {
  it('reads the one open row per job and none for a cleared job', () => {
    const open = openTargetsOf(rows)
    expect(open.get('A')).toEqual({ id: 'a2', jobId: 'A', hours: 96, from: 110, by: 'Robert', at: T2, why: 'framed in a week' })
    expect(open.has('B')).toBe(false)
  })

  it('names the office when the setter has no name', () => {
    expect(openTargetsOf([row({ id: 'x', job_id: 'X', set_at: T1, set_by_name: '  ' })]).get('X')?.by).toBe('the office')
  })
})

describe('changesOf', () => {
  it('lists every set and every clear with no successor, newest first', () => {
    const changes = changesOf(rows)
    expect(changes.map((c) => `${c.kind}:${c.id}@${c.at}`)).toEqual([`clear:b1@${T4}`, `set:b1@${T3}`, `set:a2@${T2}`, `set:a1@${T1}`])
    // a1 was replaced by a2 in the same instant: no clear line for it.
    expect(changes.some((c) => c.kind === 'clear' && c.id === 'a1')).toBe(false)
  })

  it('reads each change in words', () => {
    const [clear, b, a2, a1] = changesOf(rows)
    expect(changeWords(clear!)).toBe('60 → budget · Taunya · back to the budget')
    expect(changeWords(b!)).toBe('80 → 60 h · Taunya · the bid carried too many hours')
    expect(changeWords(a2!)).toBe('110 → 96 h · Robert · framed in a week')
    expect(changeWords(a1!)).toBe('138 → 110 h · Robert · the bid carried too many hours')
    expect(changeWords({ kind: 'set', id: 'n', jobId: 'N', hours: 50, from: null, by: 'Robert', at: T1, why: 'why' })).toBe('50 h · Robert · why')
  })

  it('honours the limit', () => {
    expect(changesOf(rows, 2)).toHaveLength(2)
  })
})

describe('undoOf', () => {
  it('after a clear, sets the cleared target again', () => {
    expect(undoOf(rows)).toEqual({ kind: 'set', jobId: 'B', hours: 60, from: null, why: 'undo: back to 60 h' })
  })

  it('after a set that replaced a target, goes back to the replaced one', () => {
    expect(undoOf(rows.slice(0, 2))).toEqual({ kind: 'set', jobId: 'A', hours: 110, from: 96, why: 'undo: back to 110 h' })
  })

  it('after a first set, clears back to the budget', () => {
    expect(undoOf([row({ id: 'a1', job_id: 'A', hours: 110, from_hours: 138, set_at: T1 })])).toEqual({ kind: 'clear', jobId: 'A' })
  })

  it('has nothing to undo on an empty ledger', () => {
    expect(undoOf([])).toBeNull()
  })
})
