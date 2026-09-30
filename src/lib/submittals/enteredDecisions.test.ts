import { describe, expect, it } from 'vitest'
import { CLEAR_DECISION_PATCH, enteredDecisionAt, enteredDecisionPatch, enteredEntryBody, enteredOnProblem, enteredSuffix, rowsToApproveAll } from './enteredDecisions'

describe('enteredDecisions', () => {
  it('the patch names the reviewer it came from and who typed it', () => {
    const p = enteredDecisionPatch({ decision: 'revise', note: '  hold 1.0 gpf ', person: { id: 'p1', name: ' Dana Whitfield ', email: 'Dana@Arch.test' }, byUserId: 'u1', byName: 'Wendi', now: '2026-09-17T15:00:00Z' })
    expect(p).toEqual({ review_decision: 'revise', review_note: 'hold 1.0 gpf', reviewed_by_person_id: 'p1', reviewed_by_name: 'Dana Whitfield', reviewed_by_email: 'dana@arch.test', reviewed_at: '2026-09-17T15:00:00Z', decision_source: 'entered', decision_entered_by: 'u1', decision_entered_by_name: 'Wendi' })
    expect(enteredDecisionPatch({ decision: 'approved', note: '', person: { id: 'p1', name: 'D', email: null }, byUserId: null, byName: null, now: 't', source: 'robot' })).toMatchObject({ review_note: null, reviewed_by_email: null, decision_source: 'robot', decision_entered_by_name: null })
    expect(CLEAR_DECISION_PATCH.decision_source).toBe('room')
  })
  it('the thread line never names the staff; the tab suffix does', () => {
    expect(enteredEntryBody('Dana Whitfield', { approved: 1, revise: 1, rejected: 0 })).toBe("from Dana Whitfield's file, entered by the office · 2 rows · 1 approve · 1 revise")
    expect(enteredEntryBody('Dana', { approved: 0, revise: 0, rejected: 1 }, 'robot')).toBe("from Dana's file, read by the robot, confirmed by the office · 1 row · 1 reject")
    expect(enteredSuffix({ decision_source: 'entered', decision_entered_by_name: 'Wendi' })).toBe('entered by Wendi')
    expect(enteredSuffix({ decision_source: 'entered', decision_entered_by_name: null })).toBe('entered by the office')
    expect(enteredSuffix({ decision_source: 'robot', decision_entered_by_name: 'Wendi' })).toBe('read by the robot · confirmed by Wendi')
    expect(enteredSuffix({ decision_source: 'room' })).toBe('')
    expect(enteredSuffix({})).toBe('')
  })
  it('a call can carry its own day: today is now, an earlier day is noon UTC, a later or unreadable day is refused', () => {
    const now = new Date('2026-09-30T20:15:00Z')
    expect(enteredDecisionAt('', now, '2026-09-30')).toBe('2026-09-30T20:15:00.000Z')
    expect(enteredDecisionAt('2026-09-30', now, '2026-09-30')).toBe('2026-09-30T20:15:00.000Z')
    // The log reads the date as the first ten characters; the tab reads it in the company's zone. Noon UTC is the same day in both.
    expect(enteredDecisionAt('2026-09-12', now, '2026-09-30')).toBe('2026-09-12T12:00:00.000Z')
    expect(enteredDecisionAt('2026-09-12', now, '2026-09-30').slice(0, 10)).toBe('2026-09-12')
    expect(enteredOnProblem('2026-09-12', '2026-09-30')).toBeNull()
    expect(enteredOnProblem('', '2026-09-30')).toBeNull()
    expect(enteredOnProblem('2026-10-01', '2026-09-30')).toBe('Their call cannot be dated after today.')
    expect(enteredOnProblem('0026-09-12', '2026-09-30')).toBe('That date does not read as a day.')
    expect(enteredOnProblem('Sep 12', '2026-09-30')).toBe('That date does not read as a day.')
    // A day that cannot stand never reaches the record.
    expect(enteredDecisionAt('2026-10-01', now, '2026-09-30')).toBe('2026-09-30T20:15:00.000Z')
    expect(enteredEntryBody('Dana Whitfield', { approved: 14, revise: 0, rejected: 0 }, 'entered', '2026-09-12')).toBe("from Dana Whitfield's file, entered by the office · 14 rows · 14 approve · dated Sep 12, 2026")
    expect(enteredEntryBody('Dana', { approved: 1, revise: 0, rejected: 0 }, 'entered', null)).toBe("from Dana's file, entered by the office · 1 row · 1 approve")
  })
  it('one entry for the whole submittal covers every row with no call and a product; a call already there stays', () => {
    const rows = [
      { id: 'a', status: 'as_specified', review_decision: null },
      { id: 'b', status: 'alternate', review_decision: 'revise' },
      { id: 'c', status: 'missing', review_decision: null },
      { id: 'd', status: 'accessory', review_decision: null },
      { id: 'e', status: 'proposed', review_decision: 'approved' },
      { id: 'f', status: 'proposed', review_decision: null },
    ]
    expect(rowsToApproveAll(rows).map((r) => r.id)).toEqual(['a', 'd', 'f'])
    expect(rowsToApproveAll([])).toEqual([])
  })
})
