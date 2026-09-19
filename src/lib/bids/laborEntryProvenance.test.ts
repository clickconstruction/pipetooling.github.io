import { describe, expect, it } from 'vitest'
import {
  bookSummaryWords,
  calibrationProposalWords,
  calibrationSetPlan,
  canResetToRobot,
  entryProvenance,
  laborBookForTrade,
  laborBookRights,
  shortDateWords,
  stageHoursWords,
} from './laborEntryProvenance'

const names = (id: string) => ({ u1: 'Wendi', u2: 'Robert' })[id] ?? null
const robot = (o: Record<string, unknown> = {}) => ({ origin: 'robot', rough_in_hrs: 1, top_out_hrs: 0.5, trim_set_hrs: 1, robot_rough_in_hrs: 1, robot_top_out_hrs: 0.5, robot_trim_set_hrs: 1, set_by: null, set_at: null, set_note: null, ...o })

describe('entryProvenance', () => {
  it('reads the five kinds off the columns the fold wrote', () => {
    expect(entryProvenance(robot(), names)).toMatchObject({ kind: 'robot', words: 'robot', differsFromRobot: false })
    expect(entryProvenance(robot({ set_note: 'Default had 2.00/3.00/2.00 — Robot kept' }), names).words).toBe('robot · picked over Default 2/3/2')
    expect(entryProvenance({ origin: 'human', rough_in_hrs: 1, top_out_hrs: 2, trim_set_hrs: 1, set_at: '2026-09-18T20:00:00Z', set_note: 'from Default' }, names)).toMatchObject({ kind: 'human', words: 'human · from Default' })
    expect(entryProvenance({ origin: 'human', rough_in_hrs: 1, top_out_hrs: 2, trim_set_hrs: 1, set_by: 'u1', set_at: '2026-09-18T20:00:00Z' }, names).words).toBe('human · Wendi · Sep 18')
    const over = entryProvenance(robot({ rough_in_hrs: 0.75, set_by: 'u1', set_at: '2026-09-18T20:00:00Z' }), names)
    expect(over).toMatchObject({ kind: 'override', words: 'override · Wendi · Sep 18', title: 'robot said 1/0.5/1', differsFromRobot: true })
    expect(entryProvenance({ origin: 'human', rough_in_hrs: 1.2, top_out_hrs: 0, trim_set_hrs: 0, set_by: 'u1', set_note: 'learned from BP375' }, names).words).toBe('learned · BP375 · Wendi')
    expect(entryProvenance(robot({ rough_in_hrs: 1.25, set_by: 'u2', set_at: '2026-09-18T20:00:00Z', set_note: 'calibrated ×1.13 · 4 jobs' }), names)).toMatchObject({ kind: 'calibrated', words: 'calibrated ×1.13 · 4 jobs · Sep 18', title: 'set by Robert · robot said 1/0.5/1' })
  })
  it('a stamp on hours that equal the robot’s reads as the robot’s number', () => {
    expect(entryProvenance(robot({ set_by: 'u1' }), names).kind).toBe('robot')
    expect(entryProvenance({ rough_in_hrs: '2.00', top_out_hrs: '3.00', trim_set_hrs: '2.00', robot_rough_in_hrs: '2', robot_top_out_hrs: '3', robot_trim_set_hrs: '2' }).differsFromRobot).toBe(false)
  })
  it('an unknown setter reads as someone', () => {
    expect(entryProvenance(robot({ rough_in_hrs: 2, set_by: 'gone' }), names).words).toBe('override · someone')
  })
})

describe('words', () => {
  it('formats hours and dates', () => {
    expect(stageHoursWords({ rough: 1, top: 0.5, trim: 1.25 })).toBe('1/0.5/1.25')
    expect(shortDateWords('2026-09-18T20:00:00Z')).toBe('Sep 18')
    expect(shortDateWords('nope')).toBeNull()
    expect(shortDateWords(null)).toBeNull()
  })
  it('sums the book up', () => {
    expect(bookSummaryWords([robot({ alias_names: ['WC', 'Water closet'] }), robot({ rough_in_hrs: 2, set_by: 'u1' }), { origin: 'human', rough_in_hrs: 1, top_out_hrs: 0, trim_set_hrs: 0, set_note: 'learned from BP375', alias_names: ['LAV2'] }])).toBe('3 entries · 3 aliases · 1 override · 1 learned')
    expect(bookSummaryWords([])).toBe('0 entries · 0 aliases')
  })
  it('names a proposal', () => {
    expect(calibrationProposalWords({ multiplier: 1.13, byName: 'Wendi', at: '2026-09-18T20:00:00Z' })).toBe('proposed ×1.13 by Wendi · Sep 18')
    expect(calibrationProposalWords({ multiplier: 0.9, byName: null, at: null })).toBe('proposed ×0.90')
  })
})

describe('rights', () => {
  it('leaders set and reset anything; estimators override, reset their own, propose; the office reads', () => {
    expect(laborBookRights('dev')).toEqual({ read: true, edit: true, resetAny: true, calibrate: 'set' })
    expect(laborBookRights('master_technician').calibrate).toBe('set')
    expect(laborBookRights('estimator')).toEqual({ read: true, edit: true, resetAny: false, calibrate: 'propose' })
    expect(laborBookRights('assistant')).toEqual({ read: true, edit: false, resetAny: false, calibrate: 'none' })
    expect(laborBookRights('controller').read).toBe(true)
    expect(laborBookRights('helpers').read).toBe(false)
    expect(laborBookRights(null).read).toBe(false)
  })
  it('Reset to robot needs a robot number that differs, and the right to undo it', () => {
    const mine = robot({ rough_in_hrs: 2, set_by: 'u1' })
    expect(canResetToRobot(mine, laborBookRights('estimator'), 'u1')).toBe(true)
    expect(canResetToRobot(mine, laborBookRights('estimator'), 'u2')).toBe(false)
    expect(canResetToRobot(mine, laborBookRights('master_technician'), 'u2')).toBe(true)
    expect(canResetToRobot(mine, laborBookRights('assistant'), 'u1')).toBe(false)
    expect(canResetToRobot(robot(), laborBookRights('dev'), 'u1')).toBe(false)
    expect(canResetToRobot({ origin: 'human', rough_in_hrs: 1, top_out_hrs: 1, trim_set_hrs: 1, set_by: 'u1' }, laborBookRights('dev'), 'u1')).toBe(false)
  })
})

describe('laborBookForTrade', () => {
  it('the robot book first, never an archived one, else the oldest live book', () => {
    const vs = [
      { id: 'h', is_robot: false, archived_at: null, created_at: '2026-02-01' },
      { id: 'r', is_robot: true, archived_at: null, created_at: '2026-08-30' },
      { id: 'a', is_robot: false, archived_at: '2026-09-18', created_at: '2026-01-01' },
    ]
    expect(laborBookForTrade(vs)?.id).toBe('r')
    expect(laborBookForTrade(vs.filter((v) => v.id !== 'r'))?.id).toBe('h')
    expect(laborBookForTrade([vs[2]!])).toBeNull()
  })
})

describe('calibrationSetPlan', () => {
  const entries = [
    { id: 'toilet', ...robot({ rough_in_hrs: 1, top_out_hrs: 1, trim_set_hrs: 1, robot_rough_in_hrs: 1, robot_top_out_hrs: 1, robot_trim_set_hrs: 1 }) },
    { id: 'lav', ...robot({ rough_in_hrs: 0.75, set_by: 'u1' }) },
    { id: 'cal', ...robot({ rough_in_hrs: 1.25, set_by: 'u2', set_note: 'calibrated ×1.25 · 2 jobs' }) },
    { id: 'human', origin: 'human', rough_in_hrs: 1, top_out_hrs: 2, trim_set_hrs: 1, set_note: 'from Default' },
    { id: 'untouched', ...robot() },
  ]
  it('writes the robot’s numbers × the multiplier onto the robot entries the jobs touched, to the quarter hour; a person’s override stays; a past calibration is re-read from the robot, not compounded', () => {
    const plan = calibrationSetPlan(entries, 1.13, new Set(['toilet', 'lav', 'cal', 'human']), 4)
    expect(plan.map((w) => w.id)).toEqual(['toilet', 'cal'])
    expect(plan[0]).toEqual({ id: 'toilet', rough_in_hrs: 1.25, top_out_hrs: 1.25, trim_set_hrs: 1.25, set_note: 'calibrated ×1.13 · 4 jobs' })
    expect(plan[1]).toMatchObject({ rough_in_hrs: 1.25, top_out_hrs: 0.5, trim_set_hrs: 1.25 })
  })
  it('nothing for a bad multiplier', () => {
    expect(calibrationSetPlan(entries, 0, new Set(['toilet']), 1)).toEqual([])
  })
})
