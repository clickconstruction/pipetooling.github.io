import { describe, expect, it } from 'vitest'
import {
  crewAssignCellState,
  crewLinkButtonLabel,
  crewLinkPatch,
  crewLinkSuccessMessage,
  groupCrewDaySessionsByPerson,
  type CrewDaySession,
} from './crewAssignSessionLinkPlan'

function s(over: Partial<CrewDaySession> & { id: string }): CrewDaySession {
  return {
    user_id: 'u-isiah',
    job_ledger_id: null,
    bid_id: null,
    clocked_in_at: '2026-09-05T13:00:00Z',
    clocked_out_at: '2026-09-05T15:00:00Z',
    users: { name: 'Isiah' },
    ...over,
  }
}

describe('groupCrewDaySessionsByPerson', () => {
  it('keys by the trimmed user name and splits linked from unlinked', () => {
    const out = groupCrewDaySessionsByPerson([
      s({ id: 'a' }),
      s({ id: 'b', users: { name: ' Isiah ' }, job_ledger_id: 'j1' }),
      s({ id: 'c', user_id: 'u-tristen', users: { name: 'Tristen' }, bid_id: 'b1' }),
    ])
    expect(Object.keys(out).sort()).toEqual(['Isiah', 'Tristen'])
    expect(out.Isiah).toEqual({ userId: 'u-isiah', unlinkedIds: ['a'], unlinkedHours: 2, linkedCount: 1 })
    expect(out.Tristen).toEqual({ userId: 'u-tristen', unlinkedIds: [], unlinkedHours: 0, linkedCount: 1 })
  })

  it('sums unlinked hours across sessions and skips nameless or still-open rows', () => {
    const out = groupCrewDaySessionsByPerson([
      s({ id: 'a', clocked_in_at: '2026-09-05T13:00:00Z', clocked_out_at: '2026-09-05T13:30:00Z' }),
      s({ id: 'b', clocked_in_at: '2026-09-05T16:00:00Z', clocked_out_at: '2026-09-05T17:15:00Z' }),
      s({ id: 'open', clocked_out_at: null }),
      s({ id: 'ghost', users: null }),
      s({ id: 'blank', users: { name: '  ' } }),
    ])
    expect(Object.keys(out)).toEqual(['Isiah'])
    expect(out.Isiah?.unlinkedIds).toEqual(['a', 'b'])
    expect(out.Isiah?.unlinkedHours).toBeCloseTo(1.75, 5)
  })

  it('treats a negative or unparsable span as zero hours but still lists the session', () => {
    const out = groupCrewDaySessionsByPerson([
      s({ id: 'a', clocked_in_at: '2026-09-05T15:00:00Z', clocked_out_at: '2026-09-05T13:00:00Z' }),
    ])
    expect(out.Isiah).toEqual({ userId: 'u-isiah', unlinkedIds: ['a'], unlinkedHours: 0, linkedCount: 0 })
  })
})

describe('crewAssignCellState', () => {
  it('is no-clock when the person has no approved session that day', () => {
    expect(crewAssignCellState(undefined)).toEqual({ kind: 'no-clock' })
    expect(crewAssignCellState({ userId: 'u', unlinkedIds: [], unlinkedHours: 0, linkedCount: 0 })).toEqual({ kind: 'no-clock' })
  })

  it('offers a link while any session is unlinked, even when others are already linked', () => {
    expect(crewAssignCellState({ userId: 'u', unlinkedIds: ['a', 'b'], unlinkedHours: 3.4, linkedCount: 1 })).toEqual({
      kind: 'link',
      unlinkedIds: ['a', 'b'],
      unlinkedHours: 3.4,
      linkedCount: 1,
    })
  })

  it('locks the row once every session is linked', () => {
    expect(crewAssignCellState({ userId: 'u', unlinkedIds: [], unlinkedHours: 0, linkedCount: 2 })).toEqual({ kind: 'locked', linkedCount: 2 })
  })
})

describe('crewLinkPatch', () => {
  it('sets exactly one of job_ledger_id / bid_id and clears the other', () => {
    expect(crewLinkPatch({ type: 'job', id: 'j1' })).toEqual({ job_ledger_id: 'j1', bid_id: null })
    expect(crewLinkPatch({ type: 'bid', id: 'b1' })).toEqual({ job_ledger_id: null, bid_id: 'b1' })
  })
})

describe('labels', () => {
  it('pluralises the session count and shows hours to two places', () => {
    expect(crewLinkButtonLabel({ kind: 'link', unlinkedIds: ['a'], unlinkedHours: 0.72, linkedCount: 0 })).toBe('Link 1 session (0.72 h)')
    expect(crewLinkButtonLabel({ kind: 'link', unlinkedIds: ['a', 'b'], unlinkedHours: 3.4, linkedCount: 0 })).toBe('Link 2 sessions (3.40 h)')
    expect(crewLinkSuccessMessage(2, 3.4, 'J523 · Mission Hills')).toBe(
      'Linked 2 sessions (3.40 h) to J523 · Mission Hills — split recomputed from the clock',
    )
  })
})
