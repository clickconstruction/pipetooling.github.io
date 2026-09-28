import { describe, expect, it } from 'vitest'
import { buildPayloads } from './myTimeDayEditorPayloads'
import { initialClusterSplitState } from './myTimeDayTimeline'
import {
  buildPeopleHoursManualDraftSession,
  DRAFT_PEOPLE_HOURS_SESSION_ID_PREFIX,
  isDraftPeopleHoursSessionId,
} from './peopleHoursManualDraftSession'

describe('isDraftPeopleHoursSessionId', () => {
  it('knows a draft by its prefix', () => {
    expect(isDraftPeopleHoursSessionId(`${DRAFT_PEOPLE_HOURS_SESSION_ID_PREFIX}abc`)).toBe(true)
    expect(isDraftPeopleHoursSessionId('2b1f0c1e-6f0a-4c59-9d0e-1c8f1c7f2a11')).toBe(false)
    expect(isDraftPeopleHoursSessionId('')).toBe(false)
  })
})

describe('buildPeopleHoursManualDraftSession', () => {
  it('starts at 8:00 AM Central on the work date and runs the entered hours', () => {
    const winter = buildPeopleHoursManualDraftSession('2026-01-05', 6.5)
    expect(winter.clocked_in_at).toBe('2026-01-05T14:00:00.000Z')
    expect(winter.clocked_out_at).toBe('2026-01-05T20:30:00.000Z')
    expect(winter.work_date).toBe('2026-01-05')
  })

  it('follows daylight time', () => {
    const summer = buildPeopleHoursManualDraftSession('2026-07-06', 8)
    expect(summer.clocked_in_at).toBe('2026-07-06T13:00:00.000Z')
    expect(summer.clocked_out_at).toBe('2026-07-06T21:00:00.000Z')
  })

  it('is a closed, unapproved punch with no job, under a fresh draft id', () => {
    const a = buildPeopleHoursManualDraftSession('2026-01-05', 1)
    const b = buildPeopleHoursManualDraftSession('2026-01-05', 1)
    expect(isDraftPeopleHoursSessionId(a.id)).toBe(true)
    expect(a.id).not.toBe(b.id)
    expect(a).toMatchObject({
      job_ledger_id: null,
      bid_id: null,
      approved_at: null,
      origin: 'user_punch',
      salary_segment_index: null,
      quick_add_minutes: null,
    })
  })

  it('carries a note, so an untouched draft can save', () => {
    const s = buildPeopleHoursManualDraftSession('2026-01-05', 2)
    expect(s.notes.trim()).not.toBe('')
    const nowMs = new Date(s.clocked_out_at!).getTime()
    expect(buildPayloads(s, initialClusterSplitState([s], nowMs), nowMs)).toHaveLength(1)
  })

  it('negative hours make a zero-length session', () => {
    const s = buildPeopleHoursManualDraftSession('2026-01-05', -3)
    expect(s.clocked_out_at).toBe(s.clocked_in_at)
  })

  it('throws on a work date it cannot read', () => {
    expect(() => buildPeopleHoursManualDraftSession('01/05/2026', 8)).toThrow('Invalid work date for draft session')
  })
})
