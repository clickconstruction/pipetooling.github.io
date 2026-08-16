import { describe, expect, it } from 'vitest'
import {
  DEFAULT_JOB_FOLLOWUP_SETTINGS,
  computeJobFollowupQueue,
  jobFollowupQuietDays,
  jobFollowupQuietSeverity,
  jobFollowupStageCounts,
  jobFollowupThresholdDays,
  type JobFollowupCandidate,
} from './jobFollowupQueue'

const TODAY = '2026-08-16'

function job(partial: Partial<JobFollowupCandidate> & Pick<JobFollowupCandidate, 'id'>): JobFollowupCandidate {
  return {
    stage: 'working',
    hcpNumber: '951',
    jobName: 'Cop Properties',
    address: '10 Cascade Gln',
    customerName: 'Todd Cop',
    pctComplete: 1,
    revenue: 41550,
    paymentsMade: 16620,
    latestActivityAt: '2026-08-10T14:00:00Z',
    nextScheduledOn: null,
    ...partial,
  }
}

describe('jobFollowupQuietDays / thresholds', () => {
  it('counts whole days since the activity instant', () => {
    expect(jobFollowupQuietDays('2026-08-10T14:00:00Z', TODAY)).toBe(5)
    expect(jobFollowupQuietDays('2026-08-16T01:00:00Z', TODAY)).toBe(0)
    expect(jobFollowupQuietDays('junk', TODAY)).toBe(0)
  })

  it('maps every stage to its settings knob', () => {
    const s = DEFAULT_JOB_FOLLOWUP_SETTINGS
    expect(jobFollowupThresholdDays('working', s)).toBe(5)
    expect(jobFollowupThresholdDays('waiting', s)).toBe(7)
    expect(jobFollowupThresholdDays('ready_to_bill', s)).toBe(2)
    expect(jobFollowupThresholdDays('billed', s)).toBe(7)
    expect(jobFollowupThresholdDays('collections', s)).toBe(3)
  })
})

describe('computeJobFollowupQueue', () => {
  const s = DEFAULT_JOB_FOLLOWUP_SETTINGS

  it('includes only jobs past their stage threshold, stalest first', () => {
    const queue = computeJobFollowupQueue(
      [
        job({ id: 'fresh', latestActivityAt: '2026-08-14T00:00:00Z' }),
        job({ id: 'stale6', latestActivityAt: '2026-08-10T00:00:00Z' }),
        job({ id: 'stale21', latestActivityAt: '2026-07-26T00:00:00Z', stage: 'billed' }),
      ],
      [],
      s,
      TODAY,
    )
    expect(queue.map((e) => e.job.id)).toEqual(['stale21', 'stale6'])
    expect(queue[0]!.quietDays).toBe(21)
    expect(queue[0]!.reason).toContain('Billed')
    expect(queue[1]!.reason).toContain('$41,550 bid')
  })

  it('a future scheduled visit exempts Waiting and Working jobs, but not billing stages', () => {
    const queue = computeJobFollowupQueue(
      [
        job({ id: 'scheduled', nextScheduledOn: '2026-08-18', latestActivityAt: '2026-08-01T00:00:00Z' }),
        job({ id: 'past-schedule', nextScheduledOn: '2026-08-01', latestActivityAt: '2026-08-08T00:00:00Z' }),
        job({ id: 'billed-scheduled', stage: 'billed', nextScheduledOn: '2026-08-18', latestActivityAt: '2026-08-01T00:00:00Z' }),
      ],
      [],
      s,
      TODAY,
    )
    expect(queue.map((e) => e.job.id)).toEqual(['billed-scheduled', 'past-schedule'])
  })

  it('a "Looks fine" review rests the job and then counts as its activity', () => {
    const stale = job({ id: 'j1', latestActivityAt: '2026-07-01T00:00:00Z' })
    // Reviewed yesterday → resting (restDays 3).
    expect(
      computeJobFollowupQueue([stale], [{ jobId: 'j1', reviewedAt: '2026-08-15T12:00:00Z', snoozedUntil: null }], s, TODAY),
    ).toHaveLength(0)
    // Reviewed 6 days ago → rest expired, quiet counts from the review (6 > 5).
    const requeued = computeJobFollowupQueue(
      [stale],
      [{ jobId: 'j1', reviewedAt: '2026-08-10T00:00:00Z', snoozedUntil: null }],
      s,
      TODAY,
    )
    expect(requeued).toHaveLength(1)
    expect(requeued[0]!.quietDays).toBe(6)
  })

  it('a snooze excludes until its date, inclusive', () => {
    const stale = job({ id: 'j1', latestActivityAt: '2026-07-01T00:00:00Z' })
    const snoozedToday = [{ jobId: 'j1', reviewedAt: '2026-08-01T00:00:00Z', snoozedUntil: '2026-08-16' }]
    expect(computeJobFollowupQueue([stale], snoozedToday, s, TODAY)).toHaveLength(0)
    const expired = [{ jobId: 'j1', reviewedAt: '2026-08-01T00:00:00Z', snoozedUntil: '2026-08-15' }]
    expect(computeJobFollowupQueue([stale], expired, s, TODAY)).toHaveLength(1)
  })

  it('only the latest review per job matters', () => {
    const stale = job({ id: 'j1', latestActivityAt: '2026-07-01T00:00:00Z' })
    const reviews = [
      { jobId: 'j1', reviewedAt: '2026-08-01T00:00:00Z', snoozedUntil: '2026-09-01' },
      { jobId: 'j1', reviewedAt: '2026-08-10T00:00:00Z', snoozedUntil: null },
    ]
    // Latest (plain review, 6d ago) wins over the older long snooze.
    expect(computeJobFollowupQueue([stale], reviews, s, TODAY)).toHaveLength(1)
  })

  it('quiet severity bands: soft under 7, amber 7–13, red 14+', () => {
    expect(jobFollowupQuietSeverity(4)).toBe('soft')
    expect(jobFollowupQuietSeverity(7)).toBe('amber')
    expect(jobFollowupQuietSeverity(13)).toBe('amber')
    expect(jobFollowupQuietSeverity(14)).toBe('red')
  })

  it('stage counts cover the queue', () => {
    const queue = computeJobFollowupQueue(
      [
        job({ id: 'a', latestActivityAt: '2026-08-01T00:00:00Z' }),
        job({ id: 'b', latestActivityAt: '2026-08-01T00:00:00Z', stage: 'billed' }),
        job({ id: 'c', latestActivityAt: '2026-08-01T00:00:00Z', stage: 'billed' }),
      ],
      [],
      s,
      TODAY,
    )
    expect(jobFollowupStageCounts(queue)).toMatchObject({ working: 1, billed: 2, waiting: 0 })
  })
})
