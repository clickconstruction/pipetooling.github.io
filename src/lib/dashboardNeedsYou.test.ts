import { describe, expect, it } from 'vitest'
import { buildNeedsYouItems, rankNeedsYouItems, type NeedsYouInputs, type NeedsYouItem } from './dashboardNeedsYou'

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
    claimDevRefusedCount: null,
    claimDevLookbackDays: 7,
    robotAuditsEnabled: true,
    robotAuditsPending: 0,
    d22UncodedEnabled: true,
    d22UncodedCount: 0,
    lienUnconditionalEnabled: true,
    lienUnconditionalOwed: null,
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

  it('builds all four v1 items with faithful copy (their worst-first order matches the old stack)', () => {
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

  it('team reviews ranks below job-followups but above lost-bids, with the banner copy', () => {
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
    expect(items.map((i) => i.key)).toEqual(['job-followups', 'team-reviews', 'lost-bids'])
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

  it('roadmap nudge shares the people/planning tier and outranks a smaller team-reviews pile', () => {
    const items = buildNeedsYouItems(
      inputs({
        teamReviewsOverdue: [{ id: 'u1', name: 'Ana' }],
        roadmapNudges: [
          { roadmapId: 'r1', title: 'Farm 1', needsName: 56, ready: 4, next: { taskId: 't1', label: '10.2 setup auto watering' } },
        ],
        jobFollowupCount: 9,
      }),
    )
    expect(items.map((i) => i.key)).toEqual(['job-followups', 'roadmap-needs-person', 'team-reviews'])
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

  it('job follow-ups outranks lost-bid hygiene, with the banner breakdown', () => {
    const items = buildNeedsYouItems(
      inputs({
        lostBidNudge: { count: 61, value: 8_700_000 },
        jobFollowupCount: 68,
        jobFollowupStageCounts: { billed: 41, working: 15, waiting: 12, ready_to_bill: 0, collections: 0 },
      }),
    )
    expect(items.map((i) => i.key)).toEqual(['job-followups', 'lost-bids'])
    expect(items[0]?.title).toBe('68 jobs are waiting on a follow-up')
    expect(items[0]?.detail).toBe(
      '41 billed with no nudge · 15 working with no recent notes · 12 waiting with nothing scheduled — review them one card at a time.',
    )
    expect(items[0]?.figure).toBe('68')
    expect(items[0]?.actionLabel).toBe('Start review')
  })

  it('job follow-ups respects the office gate and survives a missing breakdown', () => {
    expect(buildNeedsYouItems(inputs({ jobFollowupsEnabled: false, jobFollowupCount: 9 }))).toEqual([])
    const items = buildNeedsYouItems(inputs({ jobFollowupCount: 1 }))
    expect(items[0]?.title).toBe('One job is waiting on a follow-up')
    expect(items[0]?.detail).toBe('review them one card at a time.')
  })

  it('GC weekly: only the due state becomes an item, ranked above the work queues', () => {
    const due = { gcs_outstanding: 11, gcs_certified: 3, gcs_sent: 1 }
    const items = buildNeedsYouItems(
      inputs({ jobFollowupCount: 9, gcReviewStatus: due, gcReviewNudge: 'due', gcReviewIsWednesday: true }),
    )
    expect(items.map((i) => i.key)).toEqual(['gc-review-weekly', 'job-followups'])
    const gc = items[0]
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

  it('bulk-delete is a red item with snooze/dismiss secondaries, worst of all', () => {
    const items = buildNeedsYouItems(
      inputs({
        jobFollowupCount: 9,
        bulkDeleteAlerts: [burst(), burst({ actor_name: 'Wendi', bundles: 5 }), burst({ bundles: 7 })],
      }),
    )
    expect(items.map((i) => i.key)).toEqual(['bulk-delete', 'job-followups'])
    const bd = items[0]
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

  it('claim-dev shares the alert tier (bigger figure first), keeping the rotate-the-code warning', () => {
    const items = buildNeedsYouItems(inputs({ bulkDeleteAlerts: [burst()], claimDevRefusedCount: 2 }))
    expect(items.map((i) => i.key)).toEqual(['claim-dev', 'bulk-delete'])
    const cd = items[0]
    expect(cd?.severity).toBe('red')
    expect(cd?.title).toBe('Someone tried to become a dev')
    expect(cd?.detail).toContain('2 refused attempts to use the admin code in the last 7 days')
    expect(cd?.detail).toContain('rotate the code')
    expect(cd?.secondary?.map((s) => s.key)).toEqual(['snooze', 'dismiss'])
    expect(buildNeedsYouItems(inputs({ claimDevRefusedCount: 0 }))).toEqual([])
    expect(buildNeedsYouItems(inputs({ claimDevRefusedCount: null }))).toEqual([])
  })

  it('robot-audits (v2.2573): amber work-queue item for the auditing roles, gone at zero or when disabled', () => {
    expect(buildNeedsYouItems(inputs({ robotAuditsPending: 0 }))).toEqual([])
    expect(buildNeedsYouItems(inputs({ robotAuditsEnabled: false, robotAuditsPending: 23 }))).toEqual([])
    const one = buildNeedsYouItems(inputs({ robotAuditsPending: 1 }))
    expect(one[0]?.key).toBe('robot-audits')
    expect(one[0]?.severity).toBe('amber')
    expect(one[0]?.title).toBe('One robot bid is waiting on your audit')
    expect(one[0]?.actionLabel).toBe('Open Audits')
    const many = buildNeedsYouItems(inputs({ robotAuditsPending: 23 }))
    expect(many[0]?.title).toBe('23 robot bids are waiting on your audit')
    expect(many[0]?.figure).toBe('23')
    expect(buildNeedsYouItems(inputs({ robotAuditsPending: 120 }))[0]?.figure).toBe('99+')
  })

  it('d22-uncoded (v2.2627): amber hygiene item for the ledger-teaching roles, gone at zero or when disabled', () => {
    expect(buildNeedsYouItems(inputs({ d22UncodedCount: 0 }))).toEqual([])
    expect(buildNeedsYouItems(inputs({ d22UncodedEnabled: false, d22UncodedCount: 40 }))).toEqual([])
    const one = buildNeedsYouItems(inputs({ d22UncodedCount: 1 }))
    expect(one[0]?.key).toBe('d22-uncoded')
    expect(one[0]?.severity).toBe('amber')
    expect(one[0]?.kicker).toBe('Division 22')
    expect(one[0]?.title).toBe('One fixture name has no Division 22 code')
    expect(one[0]?.actionLabel).toBe('Pin codes')
    const many = buildNeedsYouItems(inputs({ d22UncodedCount: 1182 }))
    expect(many[0]?.title).toBe('1182 fixture names have no Division 22 code')
    expect(many[0]?.figure).toBe('99+')
    expect(many[0]?.detail).toContain('pin a name once and every bid is fixed')
  })

  it('lien-unconditional (v2.2582): blue money item, gone at zero, disabled, or while loading', () => {
    expect(buildNeedsYouItems(inputs({ lienUnconditionalOwed: { count: 0, total: 0 } }))).toEqual([])
    expect(buildNeedsYouItems(inputs({ lienUnconditionalEnabled: false, lienUnconditionalOwed: { count: 2, total: 3000 } }))).toEqual([])
    expect(buildNeedsYouItems(inputs({ lienUnconditionalOwed: null }))).toEqual([])
    const one = buildNeedsYouItems(inputs({ lienUnconditionalOwed: { count: 1, total: 2200 } }))
    expect(one[0]?.key).toBe('lien-unconditional')
    expect(one[0]?.severity).toBe('blue')
    expect(one[0]?.title).toBe('A payment cleared behind a conditional release')
    expect(one[0]?.detail).toContain('$2,200')
    expect(one[0]?.actionLabel).toBe('Issue release')
    const many = buildNeedsYouItems(inputs({ lienUnconditionalOwed: { count: 3, total: 5400 } }))
    expect(many[0]?.title).toBe('3 payments cleared behind conditional releases')
    expect(many[0]?.figure).toBe('3')
    expect(many[0]?.actionLabel).toBe('Issue releases')
  })

  it('lien-unconditional sits in the received-money tier: below ar-deposits, above billing accuracy', () => {
    const items = buildNeedsYouItems(
      inputs({
        arBankUnallocatedCount: 5,
        tallyStaleUnlinkedCount: 2,
        lienUnconditionalOwed: { count: 1, total: 2200 },
      }),
    )
    expect(items.map((i) => i.key)).toEqual(['ar-deposits', 'lien-unconditional', 'tally-self'])
  })

  it('robot-audits shares the people/planning tier: below revenue chasing, above hygiene', () => {
    const items = buildNeedsYouItems(
      inputs({
        jobFollowupCount: 3,
        jobFollowupStageCounts: null,
        robotAuditsPending: 23,
        lostBidNudge: { count: 60, value: 8_700_000 },
      }),
    )
    expect(items.map((i) => i.key)).toEqual(['job-followups', 'robot-audits', 'lost-bids'])
  })

  it('worst-first: a full house ranks alerts, money, deadline, billing, chasing, people, hygiene', () => {
    const items = buildNeedsYouItems(
      inputs({
        arBankUnallocatedCount: 2,
        tallyStaleUnlinkedCount: 97,
        tallyStaffStalePeopleCount: 2,
        tallyStaffStaleTxCount: 2,
        lostBidNudge: { count: 60, value: 8_700_000 },
        teamReviewsOverdue: [{ id: 'u1', name: 'Ana' }],
        roadmapNudges: [{ roadmapId: 'r1', title: 'Farm 1', needsName: 56, ready: 4, next: null }],
        jobFollowupCount: 68,
        jobFollowupStageCounts: null,
        gcReviewStatus: { gcs_outstanding: 11, gcs_certified: 0, gcs_sent: 0 },
        gcReviewNudge: 'due',
        bulkDeleteAlerts: [burst()],
        claimDevRefusedCount: 1,
      }),
    )
    expect(items.map((i) => i.key)).toEqual([
      'bulk-delete', // tier 0, tie with claim-dev on figure 1 → build order
      'claim-dev',
      'ar-deposits',
      'gc-review-weekly',
      'tally-self', // 97 beats the team's 2 in the shared billing tier
      'tally-team',
      'job-followups',
      'roadmap-needs-person', // 56 beats 1 in the shared people/planning tier
      'team-reviews',
      'lost-bids',
    ])
  })

  it('rankNeedsYouItems treats 99+ as bigger than any two-digit figure and keeps ties stable', () => {
    const item = (key: NeedsYouItem['key'], figure: string): NeedsYouItem => ({
      key,
      severity: 'amber',
      kicker: '',
      title: key,
      detail: '',
      figure,
      actionLabel: '',
    })
    const ranked = rankNeedsYouItems([item('tally-team', '99'), item('tally-self', '99+')])
    expect(ranked.map((i) => i.key)).toEqual(['tally-self', 'tally-team'])
    const tie = rankNeedsYouItems([item('team-reviews', '5'), item('roadmap-needs-person', '5')])
    expect(tie.map((i) => i.key)).toEqual(['team-reviews', 'roadmap-needs-person'])
  })

  it('singular copy reads naturally', () => {
    const items = buildNeedsYouItems(inputs({ arBankUnallocatedCount: 1, tallyStaleUnlinkedCount: 1, lostBidNudge: { count: 1, value: 0 } }))
    expect(items[0]?.title).toBe('Allocate a bank deposit')
    expect(items[1]?.title).toBe('One purchase needs a job')
    expect(items[2]?.title).toBe('One lost bid has no reason recorded')
    expect(items[2]?.detail.startsWith('work them')).toBe(true)
  })
})
