import { describe, expect, it } from 'vitest'
import {
  buildSessionMatchSuggestions,
  extractCandidateJobNumbersFromNote,
  isMatchableUnassignedSession,
  singleDispatchSuggestion,
  type MatchableClockSession,
  type MatchJobIdentity,
} from './matchClockSessions'
import type { DispatchScheduledJobForAssign } from './jobScheduleBlocks'

const session = (over: Partial<MatchableClockSession> = {}): MatchableClockSession => ({
  id: 's1',
  user_id: 'u1',
  work_date: '2026-08-11',
  clocked_in_at: '2026-08-11T12:02:00Z',
  clocked_out_at: null,
  notes: '',
  job_ledger_id: null,
  bid_id: null,
  salary_segment_index: null,
  ...over,
})

const job = (id: string, hcp: string, name: string): MatchJobIdentity => ({
  id,
  hcp_number: hcp,
  click_number: null,
  job_name: name,
  service_type_name: 'Plumbing',
})

const pick = (jobId: string, hcp: string, name: string, windows = '8 AM–12 PM'): DispatchScheduledJobForAssign => ({
  jobId,
  hcp_number: hcp,
  job_name: name,
  job_address: '',
  service_type_id: null,
  click_number: null,
  windowSpans: [],
  windowsLabel: windows,
  scheduledMinutes: 240,
  earliestStartMinutes: 480,
})

describe('isMatchableUnassignedSession', () => {
  it('true only when job, bid, AND salary segment are all null', () => {
    expect(isMatchableUnassignedSession(session())).toBe(true)
    expect(isMatchableUnassignedSession(session({ job_ledger_id: 'j1' }))).toBe(false)
    expect(isMatchableUnassignedSession(session({ bid_id: 'b1' }))).toBe(false)
    expect(isMatchableUnassignedSession(session({ salary_segment_index: 0 }))).toBe(false)
  })
})

describe('extractCandidateJobNumbersFromNote', () => {
  it('finds standalone 3-4 digit numbers, deduped, in order, capped at 3', () => {
    expect(extractCandidateJobNumbersFromNote('961 trim set then 878, 961 again')).toEqual(['961', '878'])
    expect(extractCandidateJobNumbersFromNote('101 202 303 404')).toEqual(['101', '202', '303'])
  })

  it('ignores longer runs (phones, zips) and hyphenated fragments', () => {
    expect(extractCandidateJobNumbersFromNote('call 210-555-1234 zip 78209')).toEqual([])
    expect(extractCandidateJobNumbersFromNote(null)).toEqual([])
  })
})

describe('buildSessionMatchSuggestions', () => {
  const jobs = new Map([
    ['j878', job('j878', '878', 'Lyndsey Lane- Remodel')],
    ['j961', job('j961', '961', 'Cop Properties')],
  ])
  const byNumber = new Map([
    ['878', jobs.get('j878')!],
    ['961', jobs.get('j961')!],
  ])

  it('orders dispatch → crew → note and dedupes by target with the stronger kind winning', () => {
    const s = session({ notes: '878 then helped on 961' })
    const sugs = buildSessionMatchSuggestions({
      session: s,
      dispatchPicks: [pick('j878', '878', 'Lyndsey Lane- Remodel')],
      sameDaySessions: [session({ id: 's2', job_ledger_id: 'j961' })],
      jobsById: jobs,
      bidsById: new Map(),
      jobsByNumber: byNumber,
    })
    expect(sugs.map((x) => x.kind)).toEqual(['dispatch', 'crew'])
    // 878 came from dispatch, so the note's "878" adds nothing; 961 came from
    // crew, so the note's "961" adds nothing either.
    expect(sugs[0]!.target).toMatchObject({ type: 'job', job: { id: 'j878' } })
    expect(sugs[0]!.detail).toBe('scheduled 8 AM–12 PM')
    expect(sugs[1]!.target).toMatchObject({ type: 'job', job: { id: 'j961' } })
  })

  it('note-only suggestions resolve through jobsByNumber and quote the number', () => {
    const sugs = buildSessionMatchSuggestions({
      session: session({ notes: '961 trim set with paige' }),
      dispatchPicks: [],
      sameDaySessions: [],
      jobsById: jobs,
      bidsById: new Map(),
      jobsByNumber: byNumber,
    })
    expect(sugs).toHaveLength(1)
    expect(sugs[0]).toMatchObject({ kind: 'note', detail: '"961" in the clock note' })
  })

  it('crew ignores other people and other days; caps at 3 total', () => {
    const sugs = buildSessionMatchSuggestions({
      session: session(),
      dispatchPicks: [
        pick('j1', '1', 'A'),
        pick('j2', '2', 'B'),
        pick('j3', '3', 'C'),
        pick('j4', '4', 'D'),
      ],
      sameDaySessions: [
        session({ id: 'sx', user_id: 'OTHER', job_ledger_id: 'j961' }),
        session({ id: 'sy', work_date: '2026-08-10', job_ledger_id: 'j961' }),
      ],
      jobsById: jobs,
      bidsById: new Map(),
      jobsByNumber: new Map(),
    })
    expect(sugs).toHaveLength(3)
    expect(sugs.every((x) => x.kind === 'dispatch')).toBe(true)
  })
})

describe('singleDispatchSuggestion', () => {
  const dispatchSug = (jobId: string) =>
    buildSessionMatchSuggestions({
      session: session(),
      dispatchPicks: [pick(jobId, '1', 'A')],
      sameDaySessions: [],
      jobsById: new Map(),
      bidsById: new Map(),
      jobsByNumber: new Map(),
    })

  it('returns the suggestion only when exactly one dispatch match exists', () => {
    const one = dispatchSug('j1')
    expect(singleDispatchSuggestion(one)?.kind).toBe('dispatch')
    const two = buildSessionMatchSuggestions({
      session: session(),
      dispatchPicks: [pick('j1', '1', 'A'), pick('j2', '2', 'B')],
      sameDaySessions: [],
      jobsById: new Map(),
      bidsById: new Map(),
      jobsByNumber: new Map(),
    })
    expect(singleDispatchSuggestion(two)).toBeNull()
    expect(singleDispatchSuggestion([])).toBeNull()
  })
})
