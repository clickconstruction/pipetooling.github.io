import { describe, expect, it } from 'vitest'
import {
  engagementChangePayload,
  engagementClosePayload,
  engagementCovers,
  engagementDraftProblem,
  engagementLineWords,
  engagementOpenPayload,
  engagementWithdrawPayload,
  latestEngagement,
  liveEngagements,
  runningEngagement,
  standingOn,
  standingWords,
  type PersonEngagementRow,
} from './personEngagements'

/** Made-up rows: an employee for a spring and summer, then a subcontractor who is still engaged. */
const row = (id: string, kind: string, started_on: string, ended_on: string | null, over: Partial<PersonEngagementRow> = {}): PersonEngagementRow => ({ id, kind, started_on, ended_on, source: 'contract', source_ref: '', note: '', withdrawn_at: null, ...over })
const ROWS: PersonEngagementRow[] = [
  row('b', 'subcontractor', '2025-09-01', null, { source: 'payroll' }),
  row('a', 'employee', '2025-03-03', '2025-08-31'),
  row('w', 'employee', '2024-01-01', '2024-12-31', { withdrawn_at: '2025-10-01T12:00:00Z' }),
  row('x', 'partner', '2023-01-01', '2023-12-31'),
]

describe('the stretches that stand', () => {
  it('leaves out a withdrawn stretch and a kind this code does not know, oldest first', () => {
    expect(liveEngagements(ROWS).map((e) => e.id)).toEqual(['a', 'b'])
    expect(runningEngagement(ROWS)?.id).toBe('b')
    expect(latestEngagement(ROWS)?.id).toBe('b')
    expect(liveEngagements([])).toEqual([])
  })

  it('says what a person was on a day, both ends counted, and nothing on a day no stretch covers', () => {
    expect(standingOn(ROWS, '2025-03-03')?.kind).toBe('employee')
    expect(standingOn(ROWS, '2025-08-31')?.kind).toBe('employee')
    expect(standingOn(ROWS, '2025-09-01')?.kind).toBe('subcontractor')
    expect(standingOn(ROWS, '2031-01-01')?.kind).toBe('subcontractor')
    // The withdrawn 2024 stretch does not answer for 2024.
    expect(standingOn(ROWS, '2024-06-01')).toBeNull()
    expect(standingOn(ROWS, '2025-03-02')).toBeNull()
    expect(engagementCovers({ startedOn: '2025-03-03', endedOn: null }, '2025-03-02')).toBe(false)
  })
})

describe('the words', () => {
  it('the fact strip speaks of the running stretch, else the newest closed one, else nothing', () => {
    expect(standingWords(ROWS)).toBe('Subcontractor · since Sep 1, 2025 · still engaged')
    expect(standingWords([ROWS[1]!])).toBe('Employee · Mar 3, 2025 to Aug 31, 2025')
    expect(standingWords([])).toBeNull()
    expect(standingWords([ROWS[2]!])).toBeNull()
  })

  it('a stretch reads as one line with where the fact comes from', () => {
    const [a, b] = liveEngagements(ROWS)
    expect(engagementLineWords(a!)).toBe('Employee from Mar 3, 2025 to Aug 31, 2025, by a signed paper')
    expect(engagementLineWords(b!)).toBe('Subcontractor since Sep 1, 2025, by how they were paid')
  })
})

describe('a stretch to record', () => {
  const draft = { kind: 'employee', startedOn: '2024-01-01', endedOn: '2024-12-31', source: 'record' }

  it('is refused in words for a bad kind, source or day, and for a day a standing stretch already holds', () => {
    expect(engagementDraftProblem(draft, ROWS)).toBeNull()
    expect(engagementDraftProblem({ ...draft, kind: 'partner' }, ROWS)).toBe('Pick employee or subcontractor.')
    expect(engagementDraftProblem({ ...draft, source: '' }, ROWS)).toBe('Say where the fact comes from.')
    expect(engagementDraftProblem({ ...draft, startedOn: '' }, ROWS)).toBe('Set the first day.')
    expect(engagementDraftProblem({ ...draft, endedOn: '2023-12-31' }, ROWS)).toBe('The last day is before the first day.')
    expect(engagementDraftProblem({ ...draft, endedOn: '2025-03-03' }, ROWS)).toBe('These days overlap a stretch already on file: Employee from Mar 3, 2025 to Aug 31, 2025, by a signed paper. A person is in one capacity a day.')
    // A stretch with no last day runs into everything after it.
    expect(engagementDraftProblem({ ...draft, endedOn: null }, ROWS)).toContain('These days overlap')
    expect(engagementDraftProblem({ ...draft, startedOn: '2026-01-01', endedOn: null }, ROWS)).toContain('Subcontractor since Sep 1, 2025')
    expect(engagementDraftProblem({ ...draft, note: 'x'.repeat(1001) }, ROWS)).toBe('The note is longer than 1,000 characters.')
  })

  it("builds the door's four payloads, leaving out what was left blank", () => {
    expect(engagementOpenPayload('p1', { ...draft, sourceRef: '  the hire form ', note: '' })).toEqual({ person_id: 'p1', open: { kind: 'employee', started_on: '2024-01-01', ended_on: '2024-12-31', source: 'record', source_ref: 'the hire form' } })
    expect(engagementOpenPayload('p1', { kind: 'subcontractor', startedOn: '2026-01-05', source: 'contract' })).toEqual({ person_id: 'p1', open: { kind: 'subcontractor', started_on: '2026-01-05', source: 'contract' } })
    expect(engagementChangePayload('p1', { kind: 'employee', on: '2026-02-01', source: 'payroll', note: ' first paycheck ' })).toEqual({ person_id: 'p1', change: { kind: 'employee', on: '2026-02-01', source: 'payroll', note: 'first paycheck' } })
    expect(engagementClosePayload('p1', '2026-03-31')).toEqual({ person_id: 'p1', close: { ended_on: '2026-03-31' } })
    expect(engagementWithdrawPayload('p1', 'a', ' wrong person ')).toEqual({ person_id: 'p1', withdraw: { id: 'a', why: 'wrong person' } })
  })
})
