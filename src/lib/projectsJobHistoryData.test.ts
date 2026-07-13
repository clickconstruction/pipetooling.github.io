import { describe, expect, it } from 'vitest'
import {
  aggregateClockSessionsToBars,
  enumerateDaysInRange,
  peopleCountColor,
  type ProjectsJobHistoryClockRow,
  type ProjectsJobHistoryJob,
} from './projectsJobHistoryData'

const JOB_A: ProjectsJobHistoryJob = {
  id: 'job-a',
  hcp_number: '101',
  job_name: 'Acme HVAC',
  job_address: '100 Acme Way',
  service_type_id: 'st-1',
  project_id: 'proj-1',
}
const JOB_B: ProjectsJobHistoryJob = {
  id: 'job-b',
  hcp_number: '102',
  job_name: 'Bravo Plumbing',
  job_address: '200 Bravo Blvd',
  service_type_id: 'st-2',
  project_id: null,
}
const JOB_C: ProjectsJobHistoryJob = {
  id: 'job-c',
  hcp_number: '103',
  job_name: 'Cobra Build',
  job_address: '',
  service_type_id: null,
  project_id: null,
}

function session(
  jobId: string | null,
  userId: string,
  workDate: string,
  clockedOutAt: string | null = '2026-05-13T22:00:00.000Z',
): ProjectsJobHistoryClockRow {
  return {
    job_ledger_id: jobId,
    user_id: userId,
    work_date: workDate,
    clocked_out_at: clockedOutAt,
  }
}

describe('enumerateDaysInRange', () => {
  it('returns inclusive day list for a single-day range', () => {
    expect(enumerateDaysInRange('2026-05-13', '2026-05-13')).toEqual(['2026-05-13'])
  })

  it('returns YMDs spanning multiple days inclusive', () => {
    expect(enumerateDaysInRange('2026-05-13', '2026-05-16')).toEqual([
      '2026-05-13',
      '2026-05-14',
      '2026-05-15',
      '2026-05-16',
    ])
  })

  it('handles month / year rollovers (e.g. Dec 30 → Jan 2)', () => {
    expect(enumerateDaysInRange('2026-12-30', '2027-01-02')).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ])
  })

  it('returns empty when end is before start', () => {
    expect(enumerateDaysInRange('2026-05-13', '2026-05-12')).toEqual([])
  })

  it('returns empty for blank inputs', () => {
    expect(enumerateDaysInRange('', '2026-05-13')).toEqual([])
    expect(enumerateDaysInRange('2026-05-13', '')).toEqual([])
  })
})

describe('peopleCountColor', () => {
  it('returns transparent for 0 (and negatives, defensively)', () => {
    expect(peopleCountColor(0).background).toBe('transparent')
    expect(peopleCountColor(-3).background).toBe('transparent')
  })

  it('returns light blue with dark fg for 1', () => {
    const c = peopleCountColor(1)
    expect(c.background).toBe('var(--bg-blue-200)')
    expect(c.foreground).toBe('var(--text-blue-900)')
  })

  it('walks the palette through 2 / 3 with dark fg', () => {
    expect(peopleCountColor(2).background).toBe('#bfdbfe')
    expect(peopleCountColor(3).background).toBe('#93c5fd')
    expect(peopleCountColor(2).foreground).toBe('#1e3a8a')
    expect(peopleCountColor(3).foreground).toBe('#1e3a8a')
  })

  it('switches to white fg at 4 and clamps at >= 5', () => {
    expect(peopleCountColor(4).background).toBe('#60a5fa')
    expect(peopleCountColor(4).foreground).toBe('#ffffff')
    expect(peopleCountColor(5).background).toBe('#3b82f6')
    expect(peopleCountColor(99).background).toBe('#3b82f6')
    expect(peopleCountColor(99).foreground).toBe('#ffffff')
  })
})

describe('aggregateClockSessionsToBars', () => {
  it('returns empty when there are no jobs in scope', () => {
    const bars = aggregateClockSessionsToBars([], [session('job-a', 'u1', '2026-05-13')], '2026-05-20')
    expect(bars).toEqual([])
  })

  it('returns empty when no sessions match the provided jobs', () => {
    const bars = aggregateClockSessionsToBars([JOB_A, JOB_B], [], '2026-05-20')
    expect(bars).toEqual([])
  })

  it('ignores sessions with null job_ledger_id and sessions not in scope', () => {
    const bars = aggregateClockSessionsToBars(
      [JOB_A],
      [
        session(null, 'u1', '2026-05-13'),
        session('job-unknown', 'u2', '2026-05-13'),
        session('job-a', 'u1', '2026-05-13'),
      ],
      '2026-05-20',
    )
    expect(bars).toHaveLength(1)
    expect(bars[0]!.jobId).toBe('job-a')
  })

  it('first/last bounds use min work_date and max closed work_date', () => {
    const bars = aggregateClockSessionsToBars(
      [JOB_A],
      [
        session('job-a', 'u1', '2026-05-13', '2026-05-13T22:00:00Z'),
        session('job-a', 'u1', '2026-05-15', '2026-05-15T22:00:00Z'),
        session('job-a', 'u2', '2026-05-14', '2026-05-14T22:00:00Z'),
      ],
      '2026-05-20',
    )
    expect(bars[0]!.firstWorkDateYmd).toBe('2026-05-13')
    expect(bars[0]!.lastWorkDateYmd).toBe('2026-05-15')
    expect(bars[0]!.openEnded).toBe(false)
    expect(bars[0]!.jobAddress).toBe('100 Acme Way')
  })

  it('open-ended bar extends to today when no closed clock-out exists', () => {
    const bars = aggregateClockSessionsToBars(
      [JOB_A],
      [
        session('job-a', 'u1', '2026-05-13', null),
        session('job-a', 'u2', '2026-05-14', null),
      ],
      '2026-05-20',
    )
    expect(bars[0]!.openEnded).toBe(true)
    expect(bars[0]!.firstWorkDateYmd).toBe('2026-05-13')
    expect(bars[0]!.lastWorkDateYmd).toBe('2026-05-20')
  })

  it('open-ended bar clamps right edge to first day when first work date is in the future relative to today', () => {
    // Edge case: defensive — work_date later than today, no closed out. Shouldn't happen in practice
    // but the helper must not produce an end < start.
    const bars = aggregateClockSessionsToBars(
      [JOB_A],
      [session('job-a', 'u1', '2026-06-01', null)],
      '2026-05-20',
    )
    expect(bars[0]!.firstWorkDateYmd).toBe('2026-06-01')
    expect(bars[0]!.lastWorkDateYmd).toBe('2026-06-01')
    expect(bars[0]!.openEnded).toBe(true)
  })

  it('per-day distinct-user count deduplicates same user clocking twice on the same day', () => {
    const bars = aggregateClockSessionsToBars(
      [JOB_A],
      [
        session('job-a', 'u1', '2026-05-13'),
        session('job-a', 'u1', '2026-05-13'), // same person same day → still 1
        session('job-a', 'u2', '2026-05-13'),
        session('job-a', 'u3', '2026-05-13'),
        session('job-a', 'u1', '2026-05-14'),
      ],
      '2026-05-20',
    )
    expect(bars[0]!.perDayCounts.get('2026-05-13')).toBe(3)
    expect(bars[0]!.perDayCounts.get('2026-05-14')).toBe(1)
    // Days with no sessions are absent from the map (not 0).
    expect(bars[0]!.perDayCounts.has('2026-05-12')).toBe(false)
  })

  it('omits jobs with no matching sessions but keeps unrelated jobs out of the result', () => {
    const bars = aggregateClockSessionsToBars(
      [JOB_A, JOB_B, JOB_C],
      [session('job-b', 'u1', '2026-05-13')],
      '2026-05-20',
    )
    expect(bars.map((b) => b.jobId)).toEqual(['job-b'])
  })

  it('sorts bars by firstWorkDate desc, breaking ties on HCP numerically', () => {
    const bars = aggregateClockSessionsToBars(
      [JOB_A, JOB_B, JOB_C],
      [
        session('job-a', 'u1', '2026-05-10'),
        session('job-b', 'u1', '2026-05-12'),
        session('job-c', 'u1', '2026-05-12'),
      ],
      '2026-05-20',
    )
    // job-b and job-c both start 2026-05-12; job-b HCP "102" < job-c HCP "103" → b first.
    expect(bars.map((b) => b.jobId)).toEqual(['job-b', 'job-c', 'job-a'])
  })

  it('carries project_id through to bar.projectId so the UI can filter on it', () => {
    const bars = aggregateClockSessionsToBars(
      [JOB_A, JOB_B],
      [
        session('job-a', 'u1', '2026-05-13'),
        session('job-b', 'u1', '2026-05-13'),
      ],
      '2026-05-20',
    )
    const byId = new Map(bars.map((b) => [b.jobId, b]))
    expect(byId.get('job-a')!.projectId).toBe('proj-1')
    expect(byId.get('job-b')!.projectId).toBeNull()
  })

  it('drops the day from perDayCounts when only sessions for it have unknown jobs', () => {
    const bars = aggregateClockSessionsToBars(
      [JOB_A],
      [
        session('job-a', 'u1', '2026-05-13'),
        session('job-unknown', 'u2', '2026-05-14'),
      ],
      '2026-05-20',
    )
    expect(bars[0]!.perDayCounts.get('2026-05-13')).toBe(1)
    expect(bars[0]!.perDayCounts.has('2026-05-14')).toBe(false)
  })
})
