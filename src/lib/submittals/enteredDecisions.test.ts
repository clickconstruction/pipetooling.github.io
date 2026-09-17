import { describe, expect, it } from 'vitest'
import { CLEAR_DECISION_PATCH, enteredDecisionPatch, enteredEntryBody, enteredSuffix } from './enteredDecisions'

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
})
