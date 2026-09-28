import { describe, expect, it } from 'vitest'
import {
  coalescedMixedClusterPartitionForSave,
  mixedClusterSegmentsAllowPerRowPersist,
  orderedSegmentsFollowTheirRows,
} from './myTimeDaySavePlan'
import type { DayEditorSession, SplitEditorState } from './myTimeDayTimeline'
import { dayEditorClusterCanSave } from './myTimeDayEditorPayloads'

const H = 3_600_000
const T = (h: number) => Date.UTC(2026, 0, 5, 14) + h * H
const NOW = T(9)

function mk(id: string, a: number, b: number | null, over: Partial<DayEditorSession> = {}): DayEditorSession {
  return {
    id,
    clocked_in_at: new Date(a).toISOString(),
    clocked_out_at: b == null ? null : new Date(b).toISOString(),
    work_date: '2026-01-05',
    notes: 'n',
    job_ledger_id: null,
    bid_id: null,
    approved_at: null,
    origin: 'user_punch',
    salary_segment_index: null,
    ...over,
  }
}

/** a j1 0–2 h, b j2 2–4 h, c j1 4–6 h — one origin. */
const threeJobs = () => [
  mk('a', T(0), T(2), { job_ledger_id: 'j1' }),
  mk('b', T(2), T(4), { job_ledger_id: 'j2' }),
  mk('c', T(4), T(6), { job_ledger_id: 'j1' }),
]
/** The same shape with the middle row on the salary schedule. */
const punchSalaryPunch = () => [
  mk('a', T(0), T(2)),
  mk('b', T(2), T(4), { origin: 'salary_schedule', salary_segment_index: 1 }),
  mk('c', T(4), T(6)),
]
const split = (hours: number[], over: Partial<SplitEditorState> = {}): SplitEditorState => ({
  boundaries: hours.map(T),
  notes: hours.slice(1).map((_, i) => `n${i}`),
  ...over,
})

describe('orderedSegmentsFollowTheirRows', () => {
  it('the rows as they were follow their rows', () => {
    expect(orderedSegmentsFollowTheirRows(threeJobs(), split([0, 2, 4, 6]), NOW)).toBe(true)
  })

  it('seams slid within the block still follow their rows', () => {
    expect(orderedSegmentsFollowTheirRows(threeJobs(), split([0, 3, 3.5, 6]), NOW)).toBe(true)
    expect(orderedSegmentsFollowTheirRows(threeJobs(), split([0, 0.5, 5, 6]), NOW)).toBe(true)
  })

  it('a split in one row and a merge across the next two does not: part 1 (1–2 h) only meets row b (2–4 h) at its edge', () => {
    expect(orderedSegmentsFollowTheirRows(threeJobs(), split([0, 1, 2, 6]), NOW)).toBe(false)
  })

  it('a job chosen for a part that is not its row’s own does not', () => {
    const chosen = (job: string) => ({ segmentJobOverrides: { 2: { job_ledger_id: job, bid_id: null } } })
    expect(orderedSegmentsFollowTheirRows(threeJobs(), split([0, 2, 3, 6], chosen('j1')), NOW)).toBe(true)
    expect(orderedSegmentsFollowTheirRows(threeJobs(), split([0, 2, 3, 6], chosen('j2')), NOW)).toBe(false)
  })

  it('choosing no job for a part of a row that has one does not', () => {
    const none = { segmentJobOverrides: { 0: { job_ledger_id: null, bid_id: null } } }
    expect(orderedSegmentsFollowTheirRows(threeJobs(), split([0, 2, 4, 6], none), NOW)).toBe(false)
  })

  it('another count of parts than rows does not', () => {
    expect(orderedSegmentsFollowTheirRows(threeJobs(), split([0, 6]), NOW)).toBe(false)
    expect(orderedSegmentsFollowTheirRows(threeJobs(), split([0, 1, 2, 4, 6]), NOW)).toBe(false)
  })

  it('an open last row is measured to now', () => {
    const c = [mk('a', T(0), T(2)), mk('b', T(2), null)]
    expect(orderedSegmentsFollowTheirRows(c, split([0, 3, 9]), NOW)).toBe(true)
  })
})

describe('the save paths that write part i onto row i', () => {
  it('per-row persist is not offered for punch and salary rows cut out of line with their rows', () => {
    expect(mixedClusterSegmentsAllowPerRowPersist(punchSalaryPunch(), split([0, 1, 2, 6]), NOW)).toBe(false)
    expect(mixedClusterSegmentsAllowPerRowPersist(punchSalaryPunch(), split([0, 3, 3.5, 6]), NOW)).toBe(true)
  })

  it('the coalesced partition refuses them too', () => {
    const s = split([0, 1, 2, 6])
    expect(coalescedMixedClusterPartitionForSave(punchSalaryPunch(), s, s.notes, NOW)).toBeNull()
  })

  it('so Save is off for them, and on for slid seams', () => {
    expect(dayEditorClusterCanSave(punchSalaryPunch(), split([0, 1, 2, 6]), NOW)).toBe(false)
    expect(dayEditorClusterCanSave(punchSalaryPunch(), split([0, 3, 3.5, 6]), NOW)).toBe(true)
  })

  it('one-origin rows cut out of line can still save: they are rebuilt, not written row by row', () => {
    expect(mixedClusterSegmentsAllowPerRowPersist(threeJobs(), split([0, 1, 2, 6]), NOW)).toBe(false)
    expect(dayEditorClusterCanSave(threeJobs(), split([0, 1, 2, 6]), NOW)).toBe(true)
  })
})
