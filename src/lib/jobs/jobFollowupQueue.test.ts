import { describe, expect, it } from 'vitest'
import {
  DEFAULT_JOB_FOLLOWUP_SETTINGS,
  JOB_FOLLOWUP_STAGES,
  computeJobFollowupQueue,
  dropDeletedFollowupCandidates,
  followupStagesCoveredByScopes,
  jobFollowupQuietDays,
  jobFollowupIdleDays,
  jobFollowupIdleSummary,
  jobFollowupNeed,
  jobFollowupQuietEntries,
  jobFollowupQuietSeverity,
  jobFollowupReviewActionLabel,
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

  it('history action labels: looks-fine vs snoozed-until', () => {
    expect(jobFollowupReviewActionLabel(null)).toBe('✓ Looks fine')
    expect(jobFollowupReviewActionLabel('2026-08-19')).toBe('Snoozed until Aug 19')
    expect(jobFollowupReviewActionLabel('junk')).toBe('Snoozed')
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

describe('dropDeletedFollowupCandidates', () => {
  const ALL_STAGES = new Set(JOB_FOLLOWUP_STAGES)

  it('drops candidates whose job left the live list', () => {
    const a = job({ id: 'a' })
    const b = job({ id: 'b' })
    expect(dropDeletedFollowupCandidates([a, b], new Set(['a']), ALL_STAGES)).toEqual([a])
  })

  it('returns the same array when nothing is missing (memo-friendly)', () => {
    const list = [job({ id: 'a' }), job({ id: 'b' })]
    expect(dropDeletedFollowupCandidates(list, new Set(['a', 'b', 'c']), ALL_STAGES)).toBe(list)
  })

  it('never wipes the deck while the jobs list is still loading (empty set)', () => {
    const list = [job({ id: 'a' })]
    expect(dropDeletedFollowupCandidates(list, new Set(), ALL_STAGES)).toBe(list)
  })

  it('only treats covered stages as authoritative — a scoped board load cannot wipe the deck (v2.1824 regression)', () => {
    // Board has only Ready to Bill loaded; billed/working candidates are
    // absent from the live list because their sections were never fetched.
    const rtb = job({ id: 'rtb', stage: 'ready_to_bill' })
    const working = job({ id: 'w', stage: 'working' })
    const billed = job({ id: 'b', stage: 'billed' })
    const list = [rtb, working, billed]
    expect(dropDeletedFollowupCandidates(list, new Set(['rtb']), new Set(['ready_to_bill']))).toBe(list)
  })

  it('still drops a deleted job inside a covered stage while keeping uncovered stages', () => {
    const deletedRtb = job({ id: 'gone', stage: 'ready_to_bill' })
    const liveRtb = job({ id: 'rtb', stage: 'ready_to_bill' })
    const working = job({ id: 'w', stage: 'working' })
    expect(
      dropDeletedFollowupCandidates([deletedRtb, liveRtb, working], new Set(['rtb']), new Set(['ready_to_bill'])),
    ).toEqual([liveRtb, working])
  })

  it('keeps everything when no stage is covered yet', () => {
    const list = [job({ id: 'a' })]
    expect(dropDeletedFollowupCandidates(list, new Set(['x']), new Set())).toBe(list)
  })
})

describe('followupStagesCoveredByScopes', () => {
  it('maps loaded board scopes to the stages their fetches actually return', () => {
    expect(followupStagesCoveredByScopes(new Set(['waiting', 'working', 'ready_to_bill', 'billed_all']))).toEqual(
      new Set(['waiting', 'working', 'ready_to_bill', 'billed']),
    )
    expect(followupStagesCoveredByScopes(new Set(['ready_to_bill']))).toEqual(new Set(['ready_to_bill']))
    // No scoped fetch returns a literal 'collections' status, and paid jobs
    // are never candidates — neither scope covers anything.
    expect(followupStagesCoveredByScopes(new Set(['paid']))).toEqual(new Set())
    expect(followupStagesCoveredByScopes(new Set())).toEqual(new Set())
  })
})

describe('the idle rule (v2.5510): no field work in 21+ days joins the deck whatever the notes say', () => {
  const s = DEFAULT_JOB_FOLLOWUP_SETTINGS

  it('counts idle days from the last approved field day, else the day the job was made; only Working and Waiting have one', () => {
    expect(jobFollowupIdleDays({ stage: 'working', lastWorkYmd: '2026-07-01', createdYmd: '2026-06-01' }, TODAY)).toBe(46)
    expect(jobFollowupIdleDays({ stage: 'working', lastWorkYmd: null, createdYmd: '2026-08-01' }, TODAY)).toBe(15)
    expect(jobFollowupIdleDays({ stage: 'working', lastWorkYmd: '2026-07-01T00:00:00Z', createdYmd: null }, TODAY)).toBe(46)
    // A job still waiting to begin is queued, not idle; once a crew was on site it can go idle.
    expect(jobFollowupIdleDays({ stage: 'waiting', lastWorkYmd: null, createdYmd: '2026-01-01' }, TODAY)).toBeNull()
    expect(jobFollowupIdleDays({ stage: 'waiting', lastWorkYmd: '2026-07-20', createdYmd: '2026-01-01' }, TODAY)).toBe(27)
    expect(jobFollowupIdleDays({ stage: 'billed', lastWorkYmd: '2026-01-01', createdYmd: '2026-01-01' }, TODAY)).toBeNull()
    expect(jobFollowupIdleDays({ stage: 'working', lastWorkYmd: null, createdYmd: null }, TODAY)).toBeNull()
  })

  it('a Working job noted yesterday but with no crew on site for 46 days is an idle card, with the field-day words and a Next line', () => {
    const queue = computeJobFollowupQueue(
      [job({ id: 'idle', latestActivityAt: '2026-08-15T14:00:00Z', lastWorkYmd: '2026-07-01', pctComplete: 70, revenue: 41550 })],
      [],
      s,
      TODAY,
    )
    expect(queue).toHaveLength(1)
    const e = queue[0]!
    expect([e.why, e.quietDays, e.idleDays]).toEqual(['idle', 0, 46])
    expect(e.reason).toBe('No field work in 46 days · 70% done · $41,550 bid')
    expect(e.need).toEqual({ kind: 'schedule_or_close', words: 'Schedule the next visit or close it' })
  })

  it('twenty days idle is not idle yet; a quiet card keeps its stage words and a Next line of its own', () => {
    const queue = computeJobFollowupQueue(
      [job({ id: 'q', latestActivityAt: '2026-08-05T14:00:00Z', lastWorkYmd: '2026-07-27', pctComplete: 100 })],
      [],
      s,
      TODAY,
    )
    expect(queue).toHaveLength(1)
    expect([queue[0]!.why, queue[0]!.idleDays]).toEqual(['quiet', 20])
    expect(queue[0]!.reason).toMatch(/^Working quiet 10 days/)
    expect(queue[0]!.need).toEqual({ kind: 'bill', words: 'Bill it, the work is done' })
  })

  it('a visit on the schedule, a Looks fine rest and a snooze keep an idle job out, the way they keep a quiet one out', () => {
    const idle = job({ id: 'idle', latestActivityAt: '2026-08-15T14:00:00Z', lastWorkYmd: '2026-07-01' })
    expect(computeJobFollowupQueue([{ ...idle, nextScheduledOn: '2026-08-20' }], [], s, TODAY)).toEqual([])
    expect(computeJobFollowupQueue([idle], [{ jobId: 'idle', reviewedAt: '2026-08-15T09:00:00Z', snoozedUntil: null }], s, TODAY)).toEqual([])
    expect(computeJobFollowupQueue([idle], [{ jobId: 'idle', reviewedAt: '2026-08-01T09:00:00Z', snoozedUntil: '2026-08-30' }], s, TODAY)).toEqual([])
    // The rest over, the field-day clock has not moved: it is back.
    expect(computeJobFollowupQueue([idle], [{ jobId: 'idle', reviewedAt: '2026-08-10T09:00:00Z', snoozedUntil: null }], s, TODAY).map((e) => e.why)).toEqual(['idle'])
  })

  it('idle cards rank by their field-day gap, so the longest-neglected job deals first', () => {
    const queue = computeJobFollowupQueue(
      [
        job({ id: 'quiet9', hcpNumber: '100', latestActivityAt: '2026-08-07T00:00:00Z' }),
        job({ id: 'idle30', hcpNumber: '200', latestActivityAt: '2026-08-15T00:00:00Z', lastWorkYmd: '2026-07-17' }),
        job({ id: 'idle60', hcpNumber: '300', latestActivityAt: '2026-08-15T00:00:00Z', lastWorkYmd: '2026-06-17' }),
      ],
      [],
      s,
      TODAY,
    )
    expect(queue.map((e) => e.job.id)).toEqual(['idle60', 'idle30', 'quiet9'])
  })

  it('the Dashboard figures: idle cards alone, the contract behind them, and how many are the reader’s; the quiet card counts the rest', () => {
    const queue = computeJobFollowupQueue(
      [
        job({ id: 'a', hcpNumber: '1', latestActivityAt: '2026-08-15T00:00:00Z', lastWorkYmd: '2026-07-01', revenue: 10000, masterUserId: 'u1' }),
        job({ id: 'b', hcpNumber: '2', latestActivityAt: '2026-08-15T00:00:00Z', lastWorkYmd: '2026-07-10', revenue: 2500, masterUserId: 'u2' }),
        job({ id: 'c', hcpNumber: '3', latestActivityAt: '2026-08-01T00:00:00Z', stage: 'billed' }),
      ],
      [],
      s,
      TODAY,
    )
    expect(jobFollowupIdleSummary(queue, 'u1')).toEqual({ count: 2, total: 12500, mine: 1 })
    expect(jobFollowupIdleSummary(queue, null).mine).toBe(0)
    expect(jobFollowupQuietEntries(queue).map((e) => e.job.id)).toEqual(['c'])
  })

  it('the Next line per stage', () => {
    expect(jobFollowupNeed({ stage: 'ready_to_bill', pctComplete: null })?.words).toBe('Bill it')
    expect(jobFollowupNeed({ stage: 'working', pctComplete: 100 })?.kind).toBe('bill')
    expect(jobFollowupNeed({ stage: 'working', pctComplete: 40 })?.kind).toBe('schedule_or_close')
    expect(jobFollowupNeed({ stage: 'working', pctComplete: null })?.kind).toBe('schedule_or_close')
    expect(jobFollowupNeed({ stage: 'waiting', pctComplete: null })?.words).toBe('Put the next visit on the schedule')
    expect(jobFollowupNeed({ stage: 'billed', pctComplete: null })?.kind).toBe('nudge')
    expect(jobFollowupNeed({ stage: 'collections', pctComplete: null })?.kind).toBe('collect')
  })
})
