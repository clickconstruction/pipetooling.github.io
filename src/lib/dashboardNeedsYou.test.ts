import { describe, expect, it } from 'vitest'
import { buildNeedsYouItems, type NeedsYouInputs } from './dashboardNeedsYou'

function inputs(overrides: Partial<NeedsYouInputs> = {}): NeedsYouInputs {
  return {
    role: 'dev',
    arBankUnallocatedCount: 0,
    arBankEnabled: true,
    tallyStaleUnlinkedCount: 0,
    tallyStaffStalePeopleCount: 0,
    tallyStaffStaleTxCount: 0,
    tallyStaffEligible: true,
    tallyMinAgeDays: 2,
    lostBidNudge: null,
    lostBidNudgeLoading: false,
    teamReviewsOverdue: [],
    teamReviewCadenceDays: 30,
    roadmapNudges: [],
    jobFollowupsEnabled: true,
    jobFollowupCount: 0,
    jobFollowupStageCounts: null,
    gcReviewEnabled: true,
    gcReviewStatus: null,
    gcReviewNudge: null,
    gcReviewIsWednesday: false,
    bulkDeleteAlerts: null,
    ...overrides,
  }
}

function burst(over: Partial<{ actor_name: string; bundles: number; window_start: string }> = {}) {
  return {
    actor_id: 'a1',
    actor_name: 'Taunya',
    bundles: 7,
    row_count: 20,
    window_start: '2026-08-28T16:00:00Z',
    window_end: '2026-08-28T16:05:00Z',
    tables: ['jobs_ledger'],
    ...over,
  }
}

describe('buildNeedsYouItems', () => {
  it('returns nothing when every source is quiet', () => {
    expect(buildNeedsYouItems(inputs())).toEqual([])
  })

  it('mirrors the banner gating: loading sources contribute no item', () => {
    const items = buildNeedsYouItems(
      inputs({
        arBankUnallocatedCount: null,
        tallyStaleUnlinkedCount: null,
        lostBidNudge: { count: 61, value: 8_700_000 },
        lostBidNudgeLoading: true,
        jobFollowupCount: null,
      }),
    )
    expect(items).toEqual([])
  })

  it('builds all four items in banner-stack order with faithful copy', () => {
    const items = buildNeedsYouItems(
      inputs({
        arBankUnallocatedCount: 2,
        tallyStaleUnlinkedCount: 89,
        tallyStaffStalePeopleCount: 3,
        tallyStaffStaleTxCount: 41,
        lostBidNudge: { count: 61, value: 8_700_000 },
      }),
    )
    expect(items.map((i) => i.key)).toEqual(['ar-deposits', 'tally-self', 'tally-team', 'lost-bids'])
    expect(items[0]?.title).toBe('Allocate 2 bank deposits')
    expect(items[0]?.figure).toBe('2')
    expect(items[1]?.title).toBe('89 purchases need a job')
    expect(items[2]?.detail).toContain('3 people have 41 purchases')
    expect(items[3]?.detail).toContain('unexplained')
  })

  it('respects role/eligibility gates (AR + team tally off, sub keeps own tally)', () => {
    const items = buildNeedsYouItems(
      inputs({
        role: 'subcontractor',
        arBankEnabled: false,
        arBankUnallocatedCount: 5,
        tallyStaleUnlinkedCount: 6,
        tallyStaffEligible: false,
        tallyStaffStalePeopleCount: 3,
        tallyStaffStaleTxCount: 41,
      }),
    )
    expect(items.map((i) => i.key)).toEqual(['tally-self'])
  })

  it('team tally needs BOTH counts > 0, like the banner it replaces', () => {
    expect(buildNeedsYouItems(inputs({ tallyStaffStalePeopleCount: 3, tallyStaffStaleTxCount: 0 }))).toEqual([])
    expect(buildNeedsYouItems(inputs({ tallyStaffStalePeopleCount: 0, tallyStaffStaleTxCount: 5 }))).toEqual([])
  })

  it('team reviews slots between lost-bids and job-followups, with the banner copy', () => {
    const items = buildNeedsYouItems(
      inputs({
        lostBidNudge: { count: 61, value: 8_700_000 },
        teamReviewsOverdue: [
          { id: 'u1', name: 'Ana' },
          { id: 'u2', name: 'Bo' },
          { id: 'u3', name: 'Cy' },
          { id: 'u4', name: 'Di' },
        ],
        teamReviewCadenceDays: 45,
        jobFollowupCount: 9,
        jobFollowupStageCounts: null,
      }),
    )
    expect(items.map((i) => i.key)).toEqual(['lost-bids', 'team-reviews', 'job-followups'])
    const tr = items[1]
    expect(tr?.title).toBe('Team reviews due')
    expect(tr?.detail).toBe("Ana, Bo, Cy +1 more haven't had your review in 45+ days — rate them on Team → Review.")
    expect(tr?.figure).toBe('4')
  })

  it('team reviews singular copy and empty gate', () => {
    expect(buildNeedsYouItems(inputs())).toEqual([])
    const items = buildNeedsYouItems(inputs({ teamReviewsOverdue: [{ id: 'u1', name: 'Ana' }] }))
    expect(items[0]?.detail).toBe("Ana hasn't had your review in 30+ days — rate them on Team → Review.")
  })

  it('roadmap nudge slots between team-reviews and job-followups', () => {
    const items = buildNeedsYouItems(
      inputs({
        teamReviewsOverdue: [{ id: 'u1', name: 'Ana' }],
        roadmapNudges: [
          { roadmapId: 'r1', title: 'Farm 1', needsName: 56, ready: 4, next: { taskId: 't1', label: '10.2 setup auto watering' } },
        ],
        jobFollowupCount: 9,
      }),
    )
    expect(items.map((i) => i.key)).toEqual(['team-reviews', 'roadmap-needs-person', 'job-followups'])
    const rm = items[1]
    expect(rm?.title).toBe('Farm 1 · 56 roadmap tasks need a person')
    expect(rm?.detail).toBe('next: 10.2 setup auto watering — open the Plan to hand them out.')
    expect(rm?.figure).toBe('56')
  })

  it('roadmap nudge sums and lists multiple roadmaps', () => {
    const items = buildNeedsYouItems(
      inputs({
        roadmapNudges: [
          { roadmapId: 'r1', title: 'Farm 1', needsName: 40, ready: 0, next: null },
          { roadmapId: 'r2', title: 'Shop', needsName: 16, ready: 2, next: null },
        ],
      }),
    )
    expect(items[0]?.title).toBe('56 roadmap tasks need a person')
    expect(items[0]?.detail).toBe('Farm 1 · 40 · Shop · 16 — open the Plan to hand them out.')
  })

  it('job follow-ups joins after the original four, with the banner breakdown', () => {
    const items = buildNeedsYouItems(
      inputs({
        lostBidNudge: { count: 61, value: 8_700_000 },
        jobFollowupCount: 68,
        jobFollowupStageCounts: { billed: 41, working: 15, waiting: 12, ready_to_bill: 0, collections: 0 },
      }),
    )
    expect(items.map((i) => i.key)).toEqual(['lost-bids', 'job-followups'])
    expect(items[1]?.title).toBe('68 jobs are waiting on a follow-up')
    expect(items[1]?.detail).toBe(
      '41 billed with no nudge · 15 working with no recent notes · 12 waiting with nothing scheduled — review them one card at a time.',
    )
    expect(items[1]?.figure).toBe('68')
    expect(items[1]?.actionLabel).toBe('Start review')
  })

  it('job follow-ups respects the office gate and survives a missing breakdown', () => {
    expect(buildNeedsYouItems(inputs({ jobFollowupsEnabled: false, jobFollowupCount: 9 }))).toEqual([])
    const items = buildNeedsYouItems(inputs({ jobFollowupCount: 1 }))
    expect(items[0]?.title).toBe('One job is waiting on a follow-up')
    expect(items[0]?.detail).toBe('review them one card at a time.')
  })

  it('GC weekly: only the due state becomes an item, last in stack order', () => {
    const due = { gcs_outstanding: 11, gcs_certified: 3, gcs_sent: 1 }
    const items = buildNeedsYouItems(
      inputs({ jobFollowupCount: 9, gcReviewStatus: due, gcReviewNudge: 'due', gcReviewIsWednesday: true }),
    )
    expect(items.map((i) => i.key)).toEqual(['job-followups', 'gc-review-weekly'])
    const gc = items[1]
    expect(gc?.title).toBe('GC review is due today')
    expect(gc?.detail).toBe(
      '3 of 11 GCs certified · 1 statement sent — certify each group and send it off so every GC knows what they owe.',
    )
    expect(gc?.figure).toBe('8')
    expect(buildNeedsYouItems(inputs({ gcReviewStatus: due, gcReviewNudge: 'due' }))[0]?.title).toBe(
      'GC review is still due this week',
    )
  })

  it('GC weekly: done/hidden states and the enabled gate contribute no item', () => {
    const due = { gcs_outstanding: 4, gcs_certified: 0, gcs_sent: 0 }
    expect(buildNeedsYouItems(inputs({ gcReviewStatus: { gcs_outstanding: 4, gcs_certified: 4, gcs_sent: 4 }, gcReviewNudge: 'done' }))).toEqual([])
    expect(buildNeedsYouItems(inputs({ gcReviewStatus: due, gcReviewNudge: 'hidden' }))).toEqual([])
    expect(buildNeedsYouItems(inputs({ gcReviewEnabled: false, gcReviewStatus: due, gcReviewNudge: 'due' }))).toEqual([])
  })

  it('bulk-delete is a red item with snooze/dismiss secondaries, last in the stack', () => {
    const items = buildNeedsYouItems(
      inputs({
        jobFollowupCount: 9,
        bulkDeleteAlerts: [burst(), burst({ actor_name: 'Wendi', bundles: 5 }), burst({ bundles: 7 })],
      }),
    )
    expect(items.map((i) => i.key)).toEqual(['job-followups', 'bulk-delete'])
    const bd = items[1]
    expect(bd?.severity).toBe('red')
    expect(bd?.title).toBe('Bulk deletions detected')
    expect(bd?.detail).toContain('19 records across 3 bursts by 2 people')
    expect(bd?.detail).toContain('newest: Taunya')
    expect(bd?.figure).toBe('3')
    expect(bd?.secondary?.map((s) => s.key)).toEqual(['snooze', 'dismiss'])
  })

  it('bulk-delete singular copy, and null (hidden/snoozed/dismissed) contributes no item', () => {
    expect(buildNeedsYouItems(inputs({ bulkDeleteAlerts: null }))).toEqual([])
    expect(buildNeedsYouItems(inputs({ bulkDeleteAlerts: [] }))).toEqual([])
    const items = buildNeedsYouItems(inputs({ bulkDeleteAlerts: [burst({ bundles: 1 })] }))
    expect(items[0]?.title).toBe('Bulk deletion detected')
    expect(items[0]?.detail).toContain('Taunya deleted 1 record at once')
  })

  it('singular copy reads naturally', () => {
    const items = buildNeedsYouItems(inputs({ arBankUnallocatedCount: 1, tallyStaleUnlinkedCount: 1, lostBidNudge: { count: 1, value: 0 } }))
    expect(items[0]?.title).toBe('Allocate a bank deposit')
    expect(items[1]?.title).toBe('One purchase needs a job')
    expect(items[2]?.title).toBe('One lost bid has no reason recorded')
    expect(items[2]?.detail.startsWith('work them')).toBe(true)
  })
})
