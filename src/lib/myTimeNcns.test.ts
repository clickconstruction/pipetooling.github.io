import { describe, expect, it } from 'vitest'
import {
  ncnsButtonTitle,
  ncnsClickAllowed,
  ncnsEntryPhase,
  ncnsRecordRpcArgs,
  type NcnsGateInput,
} from './myTimeNcns'

/** A lead looking at someone else's closed day, everything loaded. */
const base: NcnsGateInput = {
  allowNcnsFromMyTime: true,
  editingSelf: false,
  allowPunchTimeActions: true,
  hasSubjectUser: true,
  sessionsLoading: false,
  pendingAuthForFetch: false,
  sessionCount: 2,
  hasOpenSession: false,
  subjectHasScheduleBlocksForDay: null,
}

describe('ncnsClickAllowed', () => {
  it('a day with clock sessions can be recorded, whatever the schedule probe says', () => {
    expect(ncnsClickAllowed(base)).toBe(true)
    expect(ncnsClickAllowed({ ...base, subjectHasScheduleBlocksForDay: false })).toBe(true)
    expect(ncnsClickAllowed({ ...base, hasOpenSession: true })).toBe(true)
  })

  it('an empty day can be recorded only when the person was scheduled', () => {
    const empty = { ...base, sessionCount: 0 }
    expect(ncnsClickAllowed({ ...empty, subjectHasScheduleBlocksForDay: true })).toBe(true)
    expect(ncnsClickAllowed({ ...empty, subjectHasScheduleBlocksForDay: false })).toBe(false)
    expect(ncnsClickAllowed({ ...empty, subjectHasScheduleBlocksForDay: null })).toBe(false)
  })

  it.each([
    ['the seat may not record NCNS', { allowNcnsFromMyTime: false }],
    ['it is your own day', { editingSelf: true }],
    ['punch times are read-only', { allowPunchTimeActions: false }],
    ['there is no person', { hasSubjectUser: false }],
    ['the sessions are loading', { sessionsLoading: true }],
    ['the sign-in is not known yet', { pendingAuthForFetch: true }],
  ] as const)('is refused when %s', (_label, over) => {
    expect(ncnsClickAllowed({ ...base, ...over })).toBe(false)
  })
})

describe('ncnsButtonTitle', () => {
  it('is empty where the button does not render', () => {
    expect(ncnsButtonTitle({ ...base, allowNcnsFromMyTime: false })).toBe('')
    expect(ncnsButtonTitle({ ...base, editingSelf: true })).toBe('')
    expect(ncnsButtonTitle({ ...base, allowPunchTimeActions: false })).toBe('')
  })

  it('reads Loading… while the sessions, the sign-in or an empty day’s probe are pending', () => {
    expect(ncnsButtonTitle({ ...base, sessionsLoading: true })).toBe('Loading…')
    expect(ncnsButtonTitle({ ...base, pendingAuthForFetch: true })).toBe('Loading…')
    expect(ncnsButtonTitle({ ...base, sessionCount: 0 })).toBe('Loading…')
  })

  it('an empty day says whether the person was scheduled', () => {
    const empty = { ...base, sessionCount: 0 }
    expect(ncnsButtonTitle({ ...empty, subjectHasScheduleBlocksForDay: true })).toBe(
      'Record no-call-no-show (scheduled, no clock time)'
    )
    expect(ncnsButtonTitle({ ...empty, subjectHasScheduleBlocksForDay: false })).toBe(
      'No sessions or schedule for this day'
    )
  })

  it('a day with sessions says whether open ones will be clocked out first', () => {
    expect(ncnsButtonTitle(base)).toBe('Record no-call-no-show for this day')
    expect(ncnsButtonTitle({ ...base, hasOpenSession: true })).toBe(
      'Click to clock out open sessions at current time, then record NCNS'
    )
  })

  it('has no words for a missing person — the press is refused with the fallback toast', () => {
    const noPerson = { ...base, hasSubjectUser: false }
    expect(ncnsClickAllowed(noPerson)).toBe(false)
    expect(ncnsButtonTitle(noPerson)).toBe('Record no-call-no-show for this day')
  })
})

describe('ncnsEntryPhase', () => {
  it('opens on the plain confirm when nothing is approved', () => {
    expect(ncnsEntryPhase([])).toBe('simple')
    expect(ncnsEntryPhase([{ approved_at: null }, { approved_at: null }])).toBe('simple')
  })

  it('opens on the warning when any session is approved', () => {
    expect(ncnsEntryPhase([{ approved_at: null }, { approved_at: '2026-01-06T00:00:00Z' }])).toBe('approved_warn')
  })
})

describe('ncnsRecordRpcArgs', () => {
  it('sends the person and the day, the details trimmed', () => {
    expect(ncnsRecordRpcArgs('u1', '2026-01-05', '  did not answer  ')).toEqual({
      p_subject_user_id: 'u1',
      p_work_date: '2026-01-05',
      p_details: 'did not answer',
    })
  })

  it('leaves the details out when blank, so the RPC default applies', () => {
    const args = ncnsRecordRpcArgs('u1', '2026-01-05', '   ')
    expect(args).toEqual({ p_subject_user_id: 'u1', p_work_date: '2026-01-05' })
    expect('p_details' in args).toBe(false)
  })
})
