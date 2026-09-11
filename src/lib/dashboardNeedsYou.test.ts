import { describe, expect, it } from 'vitest'
import { buildNeedsYouItems, needsYouKind, rankNeedsYouItems, visibleNeedsYouItems, type NeedsYouInputs, type NeedsYouItem } from './dashboardNeedsYou'

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
    robotLockedShadows: null,
    d22UncodedEnabled: true,
    d22UncodedCount: 0,
    lienUnconditionalEnabled: true,
    lienUnconditionalOwed: null,
    demandDeadlineEnabled: true,
    demandDeadlineOverdue: null,
    lienWatchEnabled: true,
    lienWatch: null,
    hoursApprovalsEnabled: true,
    hoursApprovals: null,
    hoursApprovalsMinAgeDays: 3,
    labelApprovalsEnabled: true,
    labelApprovals: null,
    labelApprovalsMinAgeDays: 3,
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

describe('customer waiting (v2.3248): tier 0, red while uncalled, amber once called', () => {
  it('names the lead and the wait; sorts first; quiet when disabled or null', () => {
    const on = buildNeedsYouItems(inputs({
      customerWaitingEnabled: true,
      customerWaiting: { count: 1, uncalled: 1, oldestMinutes: 14, leadName: 'Jane Doe' },
      dispatchAgedEnabled: true,
      dispatchAged: { count: 2, total: 5, oldestAgeDays: 4 },
      dispatchMinAgeDays: 3,
    }))
    expect(on[0]).toMatchObject({ key: 'customer-waiting', severity: 'red', kicker: 'Customer portal', figure: '1', actionLabel: 'Open the inbox', title: 'Jane Doe is waiting · 14 min' })
    const many = buildNeedsYouItems(inputs({ customerWaitingEnabled: true, customerWaiting: { count: 3, uncalled: 2, oldestMinutes: 75, leadName: 'Jane Doe' } }))
    expect(many.find((i) => i.key === 'customer-waiting')?.title).toBe('3 customers waiting · oldest 1 h 15 min')
    const called = buildNeedsYouItems(inputs({ customerWaitingEnabled: true, customerWaiting: { count: 1, uncalled: 0, oldestMinutes: 0, leadName: 'Jane Doe' } }))
    expect(called.find((i) => i.key === 'customer-waiting')).toMatchObject({ severity: 'amber', title: 'Jane Doe was called — request still open' })
    expect(buildNeedsYouItems(inputs({ customerWaitingEnabled: true, customerWaiting: null })).some((i) => i.key === 'customer-waiting')).toBe(false)
    expect(buildNeedsYouItems(inputs({ customerWaitingEnabled: false, customerWaiting: { count: 1, uncalled: 1, oldestMinutes: 5, leadName: 'X' } })).some((i) => i.key === 'customer-waiting')).toBe(false)
  })
})

describe('aging queues (journey-map #40): dispatch requests + HR reports', () => {
  it('dispatch: amber past the min age, red once the oldest passes the red line, quiet otherwise', () => {
    const on = buildNeedsYouItems(inputs({
      dispatchAgedEnabled: true,
      dispatchAged: { count: 2, total: 5, oldestAgeDays: 4 },
      dispatchMinAgeDays: 3,
      dispatchRedDays: 7,
    }))
    const item = on.find((i) => i.key === 'dispatch-requests-aged')
    expect(item).toMatchObject({ severity: 'amber', kicker: 'Dispatch inbox', figure: '2', actionLabel: 'Open Dispatch inbox' })
    expect(item?.title).toBe('2 dispatch requests have waited 3+ days')
    expect(item?.detail).toContain('the oldest asked 4 days ago')
    expect(item?.detail).toContain('(5 open in all)')

    const red = buildNeedsYouItems(inputs({ dispatchAgedEnabled: true, dispatchAged: { count: 1, total: 1, oldestAgeDays: 46 }, dispatchMinAgeDays: 3, dispatchRedDays: 7 }))
    expect(red.find((i) => i.key === 'dispatch-requests-aged')).toMatchObject({ severity: 'red', title: 'A dispatch request has waited 3+ days' })
    expect(red.find((i) => i.key === 'dispatch-requests-aged')?.detail).not.toContain('open in all')

    expect(buildNeedsYouItems(inputs({ dispatchAgedEnabled: true, dispatchAged: null })).some((i) => i.key === 'dispatch-requests-aged')).toBe(false)
    expect(buildNeedsYouItems(inputs({ dispatchAgedEnabled: false, dispatchAged: { count: 3, total: 3, oldestAgeDays: 40 } })).some((i) => i.key === 'dispatch-requests-aged')).toBe(false)
    expect(buildNeedsYouItems(inputs({ dispatchAged: { count: 3, total: 3, oldestAgeDays: 40 } })).some((i) => i.key === 'dispatch-requests-aged')).toBe(false)
  })

  it('hr reports: same shape, dev-gated by the caller, names the oldest', () => {
    const on = buildNeedsYouItems(inputs({ hrReportsEnabled: true, hrReportsAged: { count: 1, total: 2, oldestAgeDays: 11 }, hrReportsMinAgeDays: 3, hrReportsRedDays: 7 }))
    const item = on.find((i) => i.key === 'hr-reports-pending')
    expect(item).toMatchObject({ severity: 'red', kicker: 'HR reports', figure: '1', actionLabel: 'Open pending reports' })
    expect(item?.title).toBe('A field report has waited 3+ days to be filed')
    expect(item?.detail).toContain('the oldest 11 days ago (2 pending in all)')
    const amber = buildNeedsYouItems(inputs({ hrReportsEnabled: true, hrReportsAged: { count: 3, total: 3, oldestAgeDays: 4 }, hrReportsMinAgeDays: 3, hrReportsRedDays: 7 }))
    expect(amber.find((i) => i.key === 'hr-reports-pending')).toMatchObject({ severity: 'amber', title: '3 field reports have waited 3+ days to be filed' })
    expect(buildNeedsYouItems(inputs({ hrReportsEnabled: false, hrReportsAged: { count: 3, total: 3, oldestAgeDays: 40 } })).some((i) => i.key === 'hr-reports-pending')).toBe(false)
    expect(buildNeedsYouItems(inputs({ hrReportsEnabled: true, hrReportsAged: null })).some((i) => i.key === 'hr-reports-pending')).toBe(false)
  })

  it('ranks: dispatch sits with the revenue-chasing tier, HR reports with people/planning', () => {
    const items = buildNeedsYouItems(inputs({
      dispatchAgedEnabled: true,
      dispatchAged: { count: 1, total: 1, oldestAgeDays: 4 },
      dispatchMinAgeDays: 3,
      hrReportsEnabled: true,
      hrReportsAged: { count: 9, total: 9, oldestAgeDays: 4 },
      hrReportsMinAgeDays: 3,
      lostBidNudge: { count: 50, value: 0 },
    }))
    expect(items.map((i) => i.key)).toEqual(['dispatch-requests-aged', 'hr-reports-pending', 'lost-bids'])
  })
})

describe('jobs stale open (v2.2825)', () => {
  it('names the pile, the money, and how many are the reader’s own; quiet while loading or off', () => {
    const on = buildNeedsYouItems(inputs({ staleOpenEnabled: true, staleOpen: { count: 25, total: 343162, mine: 3, minIdleDays: 21 } }))
    const item = on.find((i) => i.key === 'jobs-stale-open')
    expect(item).toMatchObject({ severity: 'amber', kicker: 'Jobs', figure: '25', actionLabel: 'See them' })
    expect(item?.title).toBe('25 open jobs have sat idle 21+ days')
    expect(item?.detail).toContain('$343,162 of contract')
    expect(item?.detail).toContain('3 are yours')
    expect(buildNeedsYouItems(inputs({ staleOpenEnabled: true, staleOpen: { count: 1, total: 900, mine: 1, minIdleDays: 21 } })).find((i) => i.key === 'jobs-stale-open')?.title).toBe('An open job has sat idle 21+ days')
    expect(buildNeedsYouItems(inputs({ staleOpenEnabled: true, staleOpen: null })).some((i) => i.key === 'jobs-stale-open')).toBe(false)
    expect(buildNeedsYouItems(inputs({ staleOpenEnabled: false, staleOpen: { count: 5, total: 1, mine: 0, minIdleDays: 21 } })).some((i) => i.key === 'jobs-stale-open')).toBe(false)
  })
})

describe('buildNeedsYouItems', () => {
  it('unpriced work-order drafts (v2.2829): one item, names the subs, gated by the flag', () => {
    const one = buildNeedsYouItems(inputs({ unpricedWorkOrdersEnabled: true, unpricedWorkOrders: { count: 1, subNames: ['Rudy'], oldestDays: 2 } }))
    expect(one.map((i) => i.key)).toEqual(['work-orders-unpriced'])
    expect(one[0]!.title).toBe('A sub work order is waiting for a price')
    expect(one[0]!.detail).toContain('for Rudy')
    expect(one[0]!.detail).toContain('2 days ago')
    expect(one[0]!.actionLabel).toBe('Price it')
    const many = buildNeedsYouItems(inputs({ unpricedWorkOrdersEnabled: true, unpricedWorkOrders: { count: 4, subNames: ['A', 'B', 'C', 'D'], oldestDays: 0 } }))
    expect(many[0]!.title).toBe('4 sub work orders are waiting for a price')
    expect(many[0]!.detail).toContain('for A, B and 2 more')
    expect(many[0]!.figure).toBe('4')
    expect(buildNeedsYouItems(inputs({ unpricedWorkOrdersEnabled: false, unpricedWorkOrders: { count: 3, subNames: [], oldestDays: null } }))).toEqual([])
    expect(buildNeedsYouItems(inputs({ unpricedWorkOrdersEnabled: true, unpricedWorkOrders: null }))).toEqual([])
  })

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
    expect(tr?.detail).toBe('No review from you in 45+ days.')
    expect(tr?.figure).toBe('4')
  })

  it('team reviews copy is the same for one person, and empty gate', () => {
    expect(buildNeedsYouItems(inputs())).toEqual([])
    const items = buildNeedsYouItems(inputs({ teamReviewsOverdue: [{ id: 'u1', name: 'Ana' }] }))
    expect(items[0]?.detail).toBe('No review from you in 30+ days.')
  })

  it('roadmap nudge is its own group AFTER the company stack, however big its figure (Tier-2 #41)', () => {
    const items = buildNeedsYouItems(
      inputs({
        teamReviewsOverdue: [{ id: 'u1', name: 'Ana' }],
        roadmapNudges: [
          { roadmapId: 'r1', title: 'Farm 1', needsName: 56, ready: 4, next: { taskId: 't1', label: '10.2 setup auto watering' } },
        ],
        jobFollowupCount: 9,
      }),
    )
    expect(items.map((i) => i.key)).toEqual(['job-followups', 'team-reviews', 'roadmap-needs-person'])
    const rm = items[2]
    expect(rm?.kind).toBe('roadmap')
    expect(needsYouKind(rm!)).toBe('roadmap')
    expect(needsYouKind(items[0]!)).toBe('company')
    expect(rm?.title).toBe('Farm 1 · 56 roadmap tasks need a person')
    expect(rm?.detail).toBe('next: 10.2 setup auto watering — open the Plan to hand them out.')
    expect(rm?.figure).toBe('56')
  })

  it('roadmap nudge never reaches a non-dev stack — the builder drops it for every other role (Tier-2 #41)', () => {
    const nudge = [{ roadmapId: 'r1', title: 'Farm 1', needsName: 56, ready: 4, next: null }]
    for (const role of ['master_technician', 'assistant', 'controller', 'primary', 'estimator', 'superintendent', 'subcontractor', 'helpers', null] as const) {
      const items = buildNeedsYouItems(inputs({ role, roadmapNudges: nudge, teamReviewsOverdue: [{ id: 'u1', name: 'Ana' }] }))
      expect(items.map((i) => i.key), `role ${role}`).toEqual(['team-reviews'])
    }
    expect(buildNeedsYouItems(inputs({ role: 'dev', roadmapNudges: nudge })).map((i) => i.key)).toEqual(['roadmap-needs-person'])
  })

  it('visibleNeedsYouItems is the same rule on a prebuilt list', () => {
    const roadmap: NeedsYouItem = { key: 'roadmap-needs-person', kind: 'roadmap', severity: 'amber', kicker: '', title: '', detail: '', figure: '5', actionLabel: '' }
    const company: NeedsYouItem = { key: 'team-reviews', severity: 'amber', kicker: '', title: '', detail: '', figure: '1', actionLabel: '' }
    expect(visibleNeedsYouItems([roadmap, company], 'dev')).toHaveLength(2)
    expect(visibleNeedsYouItems([roadmap, company], 'assistant').map((i) => i.key)).toEqual(['team-reviews'])
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
    // Badge = GCs not yet certified AND sent: without gcs_done, min(certified, sent) is the best lower bound on the intersection.
    expect(gc?.figure).toBe('10')
    expect(buildNeedsYouItems(inputs({ gcReviewStatus: due, gcReviewNudge: 'due' }))[0]?.title).toBe(
      'GC review is still due this week',
    )
  })

  it('GC weekly: all certified but nothing sent still shows every GC as to-do and says so', () => {
    const certifiedNotSent = { gcs_outstanding: 10, gcs_certified: 10, gcs_sent: 0, gcs_done: 0 }
    const gc = buildNeedsYouItems(inputs({ gcReviewStatus: certifiedNotSent, gcReviewNudge: 'due' }))[0]
    expect(gc?.figure).toBe('10')
    expect(gc?.detail).toBe(
      '10 of 10 GCs certified · 0 statements sent — every group is certified; send each statement off so every GC knows what they owe.',
    )
    const partlyDone = { gcs_outstanding: 10, gcs_certified: 7, gcs_sent: 5, gcs_done: 4 }
    expect(buildNeedsYouItems(inputs({ gcReviewStatus: partlyDone, gcReviewNudge: 'due' }))[0]?.figure).toBe('6')
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

  it('robot-locked (v2.3126): no sealed shadows (null, [], or disabled) → no item', () => {
    expect(buildNeedsYouItems(inputs({ robotLockedShadows: null }))).toEqual([])
    expect(buildNeedsYouItems(inputs({ robotLockedShadows: [] }))).toEqual([])
    const sealed = [{ shadowBid: '490', referenceBid: '481', project: 'Galloway Park', lockedAt: '2026-09-06T12:00:00Z', teacher: 'Wendi' }]
    expect(buildNeedsYouItems(inputs({ robotAuditsEnabled: false, robotLockedShadows: sealed }))).toEqual([])
  })

  it('robot-locked (v2.3126): one names the bid, many count them — blue, figure = count, opens the Robot Board (v2.3222)', () => {
    const one = buildNeedsYouItems(inputs({
      robotLockedShadows: [{ shadowBid: '490', referenceBid: '481', project: 'Galloway Park', lockedAt: '2026-09-06T12:00:00Z', teacher: 'Wendi' }],
    }))
    expect(one[0]).toMatchObject({
      key: 'robot-locked',
      severity: 'blue',
      kicker: 'Robot bid',
      title: 'The robot has a sealed number on b481 (Galloway Park)',
      figure: '1',
      actionLabel: 'Open Robot Board',
    })
    expect(one[0]?.detail).toBe('Locked before ours went out — the score lands the moment we send, and the envelope opens for you right then. Nothing to do; this is the head start.')
    expect(needsYouKind(one[0] as NeedsYouItem)).toBe('company')
    const many = buildNeedsYouItems(inputs({
      robotLockedShadows: [
        { shadowBid: '492', referenceBid: '485', project: null, lockedAt: '2026-09-07T09:00:00Z', teacher: null },
        { shadowBid: '491', referenceBid: '483', project: 'Elm St', lockedAt: '2026-09-06T18:00:00Z', teacher: 'Wendi' },
        { shadowBid: '490', referenceBid: '481', project: 'Galloway Park', lockedAt: '2026-09-06T12:00:00Z', teacher: 'Wendi' },
      ],
    }))
    expect(many[0]?.title).toBe('The robot has sealed numbers on 3 live bids')
    expect(many[0]?.figure).toBe('3')
    expect(buildNeedsYouItems(inputs({
      robotLockedShadows: [{ shadowBid: '490', referenceBid: '481', project: null, lockedAt: '2026-09-06T12:00:00Z', teacher: null }],
    }))[0]?.title).toBe('The robot has a sealed number on b481')
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
    expect(one[0]?.detail).toContain('Open the list')
    expect(one[0]?.actionLabel).toBe('Issue release')
    const many = buildNeedsYouItems(inputs({ lienUnconditionalOwed: { count: 3, total: 5400 } }))
    expect(many[0]?.title).toBe('3 payments cleared behind conditional releases')
    expect(many[0]?.figure).toBe('3')
    expect(many[0]?.actionLabel).toBe('Issue releases')
  })

  it('lien watches (v2.2645): serve-copy red, notice/file windows amber, quiet at empty/disabled/loading', () => {
    expect(buildNeedsYouItems(inputs({ lienWatch: { noticeDue: [], filingDue: [], serveDue: [] } }))).toEqual([])
    expect(buildNeedsYouItems(inputs({ lienWatchEnabled: false, lienWatch: { noticeDue: [], filingDue: [], serveDue: [{ serveDue: '2026-09-09' }] } }))).toEqual([])
    const items = buildNeedsYouItems(
      inputs({
        lienWatch: {
          serveDue: [{ serveDue: '2026-09-09' }],
          noticeDue: [
            { deadline: '2026-10-15', openBalance: 2711.5 },
            { deadline: '2026-11-16', openBalance: 900 },
          ],
          filingDue: [{ deadline: '2026-11-16', openBalance: 2711.5 }],
        },
      }),
    )
    expect(items.map((i) => i.key)).toEqual(['lien-serve-copy', 'lien-notice-window', 'lien-file-window'])
    expect(items[0]?.severity).toBe('red')
    expect(items[0]?.title).toBe('A filed lien has not been served')
    expect(items[1]?.title).toBe('2 lien notice windows close soon (first: 2026-10-15)')
    expect(items[1]?.detail).toContain('$3,612')
    expect(items[2]?.title).toBe('A lien filing window closes 2026-11-16')
  })

  it('demand-deadline (v2.2640): red follow-through item, quiet at zero/disabled/loading', () => {
    expect(buildNeedsYouItems(inputs({ demandDeadlineOverdue: { count: 0, total: 0 } }))).toEqual([])
    expect(buildNeedsYouItems(inputs({ demandDeadlineEnabled: false, demandDeadlineOverdue: { count: 2, total: 5000 } }))).toEqual([])
    const one = buildNeedsYouItems(inputs({ demandDeadlineOverdue: { count: 1, total: 2711.5 } }))
    expect(one[0]?.key).toBe('demand-deadline')
    expect(one[0]?.severity).toBe('red')
    expect(one[0]?.title).toBe('A demand-letter deadline passed unpaid')
    expect(one[0]?.detail).toContain('$2,712')
    const many = buildNeedsYouItems(inputs({ demandDeadlineOverdue: { count: 3, total: 9000 } }))
    expect(many[0]?.title).toBe('3 demand-letter deadlines passed unpaid')
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
      'team-reviews',
      'lost-bids',
      'roadmap-needs-person', // kind: roadmap — its own group after the company stack (Tier-2 #41)
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
    const tie = rankNeedsYouItems([item('team-reviews', '5'), item('robot-audits', '5')])
    expect(tie.map((i) => i.key)).toEqual(['team-reviews', 'robot-audits'])
    // A roadmap-kind item groups after company items even when it would outrank them by tier.
    const grouped = rankNeedsYouItems([{ ...item('roadmap-needs-person', '99+'), kind: 'roadmap' }, item('lost-bids', '1')])
    expect(grouped.map((i) => i.key)).toEqual(['lost-bids', 'roadmap-needs-person'])
  })

  it('singular copy reads naturally', () => {
    const items = buildNeedsYouItems(inputs({ arBankUnallocatedCount: 1, tallyStaleUnlinkedCount: 1, lostBidNudge: { count: 1, value: 0 } }))
    expect(items[0]?.title).toBe('Allocate a bank deposit')
    expect(items[1]?.title).toBe('One purchase needs a job')
    expect(items[2]?.title).toBe('One lost bid has no reason recorded · all trades')
    // v2.2896: the all-trade scope gloss leads even when there is no dollar figure.
    expect(items[2]?.detail.startsWith('Across every trade — work them')).toBe(true)
  })

  it('hours-approvals: appears only once the oldest pending day crosses the age gate', () => {
    const pending = { sessions: 152, totalHours: 799.1, people: 12, oldestAgeDays: 19 }
    // Quiet: disabled, loading, empty, or a fresh queue.
    expect(buildNeedsYouItems(inputs({ hoursApprovalsEnabled: false, hoursApprovals: pending }))).toEqual([])
    expect(buildNeedsYouItems(inputs({ hoursApprovals: null }))).toEqual([])
    expect(buildNeedsYouItems(inputs({ hoursApprovals: { ...pending, sessions: 0 } }))).toEqual([])
    expect(buildNeedsYouItems(inputs({ hoursApprovals: { ...pending, oldestAgeDays: 2 } }))).toEqual([])
    // At the gate it shows, amber, with the count as the figure.
    const items = buildNeedsYouItems(inputs({ hoursApprovals: pending }))
    expect(items).toHaveLength(1)
    expect(items[0]?.key).toBe('hours-approvals')
    expect(items[0]?.severity).toBe('amber')
    expect(items[0]?.figure).toBe('99+')
    expect(items[0]?.title).toBe('152 clock sessions are waiting on approval')
    expect(items[0]?.detail).toContain('12 people have 799h unapproved')
    expect(items[0]?.detail).toContain('19 days ago')
  })

  it('hours-approvals: singular copy reads naturally', () => {
    const items = buildNeedsYouItems(
      inputs({ hoursApprovals: { sessions: 1, totalHours: 7.5, people: 1, oldestAgeDays: 3 } }),
    )
    expect(items[0]?.title).toBe('A clock session is waiting on approval')
    expect(items[0]?.detail.startsWith('One person has 8h unapproved')).toBe(true)
    expect(items[0]?.figure).toBe('1')
  })
})

describe('label approvals (journey-map Tier-2 #27)', () => {
  const backlog = { pending: 349, stale: 340, staleAmount: 139_250.5, oldestAgeDays: 16 }

  it('counts only the stale exceptions, once the oldest crosses the age gate; quiet when disabled, loading, fresh, or empty', () => {
    expect(buildNeedsYouItems(inputs({ labelApprovalsEnabled: false, labelApprovals: backlog }))).toEqual([])
    expect(buildNeedsYouItems(inputs({ labelApprovals: null }))).toEqual([])
    // A same-week trickle: pending rows exist but none is old enough.
    expect(buildNeedsYouItems(inputs({ labelApprovals: { pending: 12, stale: 0, staleAmount: 0, oldestAgeDays: 1 } }))).toEqual([])
    expect(buildNeedsYouItems(inputs({ labelApprovals: { ...backlog, oldestAgeDays: 2 } }))).toEqual([])

    const items = buildNeedsYouItems(inputs({ labelApprovals: backlog }))
    expect(items).toHaveLength(1)
    expect(items[0]?.key).toBe('label-approvals')
    expect(items[0]?.severity).toBe('amber')
    expect(items[0]?.figure).toBe('99+')
    expect(items[0]?.title).toBe('340 bank-label suggestions have waited 3+ days for an OK')
    expect(items[0]?.detail).toContain('$139,251 of card charges and transfers')
    expect(items[0]?.detail).toContain('16 days ago')
    expect(items[0]?.detail).toContain('plus 9 newer still inside the 3-day window')
    expect(items[0]?.actionLabel).toBe('Open approvals')
  })

  it('singular copy reads naturally and omits the "newer" tail when everything pending is stale', () => {
    const items = buildNeedsYouItems(
      inputs({ labelApprovals: { pending: 1, stale: 1, staleAmount: 412.18, oldestAgeDays: 5 } }),
    )
    expect(items[0]?.title).toBe('A bank-label suggestion has waited 3+ days for an OK')
    expect(items[0]?.figure).toBe('1')
    expect(items[0]?.detail.startsWith('$412 of card charges')).toBe(true)
    expect(items[0]?.detail).not.toContain('newer')
  })

  it('ranks as billing accuracy: above hours approvals, below a stale tally', () => {
    const items = buildNeedsYouItems(
      inputs({
        labelApprovals: backlog,
        hoursApprovals: { sessions: 3, totalHours: 20, people: 1, oldestAgeDays: 9 },
        tallyStaleUnlinkedCount: 2,
      }),
    )
    expect(items.map((i) => i.key)).toEqual(['tally-self', 'label-approvals', 'hours-approvals'])
  })
})

describe('statement round (v2.2771)', () => {
  it('lists the ready GCs with the total and opens the round; silent when empty or disabled', () => {
    const items = buildNeedsYouItems(
      inputs({
        statementRoundEnabled: true,
        statementRound: { count: 2, total: 96257.27, gcNames: ['RMC- Dudley Mason', 'Knight Contracting'] },
      }),
    )
    const sr = items.find((i) => i.key === 'statement-round')
    expect(sr?.title).toBe('2 GCs are waiting on your statement')
    expect(sr?.detail).toBe('RMC- Dudley Mason, Knight Contracting · $96,257 certified and ready — a personal email from you.')
    expect(sr?.figure).toBe('2')
    expect(sr?.actionLabel).toBe('Start round')
    expect(buildNeedsYouItems(inputs({ statementRoundEnabled: true, statementRound: null }))).toEqual([])
    expect(buildNeedsYouItems(inputs({ statementRoundEnabled: false, statementRound: { count: 1, total: 5, gcNames: ['x'] } }))).toEqual([])
  })
})

describe('lost-bids card ↔ Why we lost lens scope gloss (J14-F6)', () => {
  it('the card names its all-trade scope and says the lens opens on one trade, so 60 → 59 reads as scope, not drift', () => {
    const items = buildNeedsYouItems(inputs({ role: 'estimator', lostBidNudge: { count: 60, value: 1_250_000 }, lostBidNudgeLoading: false }))
    const card = items.find((i) => i.key === 'lost-bids')
    expect(card?.figure).toBe('60')
    expect(card?.detail).toContain('across every trade')
    expect(card?.detail).toContain('it opens on one trade')
  })
})

describe('job-account gap items', () => {
  const gaps = { unflaggedJobs: 3, unflaggedTotal: 8921.73, noPacketInvoices: 2, noPacketTotal: 1500 }
  it('builds both hygiene items from the RPC row, gated on the enable flag', () => {
    const items = buildNeedsYouItems(inputs({ jobAccountGapsEnabled: true, jobAccountGaps: gaps }))
    const unflagged = items.find((i) => i.key === 'job-account-unflagged')!
    const noPacket = items.find((i) => i.key === 'job-account-no-packet')!
    expect(unflagged.title).toBe('3 jobs with supply house job accounts have unflagged invoices')
    expect(unflagged.detail).toContain('$8,922')
    expect(unflagged.figure).toBe('3')
    expect(unflagged.severity).toBe('gray')
    expect(noPacket.title).toBe('2 invoices are flagged on job accounts with no packet on record')
    expect(noPacket.detail).toContain('$1,500')
    expect(buildNeedsYouItems(inputs({ jobAccountGapsEnabled: false, jobAccountGaps: gaps })).some((i) => i.key.startsWith('job-account'))).toBe(false)
    expect(buildNeedsYouItems(inputs({ jobAccountGapsEnabled: true, jobAccountGaps: null })).some((i) => i.key.startsWith('job-account'))).toBe(false)
  })
  it('each queue shows independently and reads singular at one', () => {
    const only = buildNeedsYouItems(inputs({ jobAccountGapsEnabled: true, jobAccountGaps: { ...gaps, noPacketInvoices: 0, unflaggedJobs: 1 } }))
    expect(only.map((i) => i.key).filter((k) => k.startsWith('job-account'))).toEqual(['job-account-unflagged'])
    expect(only.find((i) => i.key === 'job-account-unflagged')!.title).toBe('A job with a supply house job account has unflagged invoices')
  })
})

describe('price-matrix-ready (Price Matrix PR 5)', () => {
  const first = { bidId: 'b359', bidLabel: 'BP359', project: 'SpaceX BA-2', picks: 23, toSettle: 4, expiredHouses: 1 }
  it('one ready matrix reads as its own sentence, amber while rows wait on a choice', () => {
    const items = buildNeedsYouItems(inputs({ priceMatrixEnabled: true, priceMatrixReady: { count: 1, first } }))
    const it1 = items.find((i) => i.key === 'price-matrix-ready')!
    expect(it1.severity).toBe('amber')
    expect(it1.title).toBe('The robot priced BP359 SpaceX BA-2 — 23 picks ready, 4 to settle')
    expect(it1.detail).toMatch(/already expired when read/)
    expect(it1.figure).toBe('1')
    expect(it1.actionLabel).toBe('Review matrix')
  })
  it('nothing to settle → blue; several ready → the count leads', () => {
    const items = buildNeedsYouItems(inputs({ priceMatrixEnabled: true, priceMatrixReady: { count: 3, first: { ...first, toSettle: 0, expiredHouses: 0 } } }))
    const it1 = items.find((i) => i.key === 'price-matrix-ready')!
    expect(it1.severity).toBe('blue')
    expect(it1.title).toBe('3 robot price matrices are ready — newest BP359 SpaceX BA-2')
    expect(it1.detail).toMatch(/Apply picks to costs/)
  })
  it('disabled or empty → no item', () => {
    expect(buildNeedsYouItems(inputs({ priceMatrixEnabled: false, priceMatrixReady: { count: 1, first } })).some((i) => i.key === 'price-matrix-ready')).toBe(false)
    expect(buildNeedsYouItems(inputs({ priceMatrixEnabled: true, priceMatrixReady: null })).some((i) => i.key === 'price-matrix-ready')).toBe(false)
  })
})

describe('robot-backlog (v2.3287, dev only)', () => {
  const backlog = {
    bidsWaiting: 4, bidsRequested: 2, oldestRequestMs: 3 * 86400000, firstBid: 'BP482 Marriott shell', requestOverdue: false,
    matricesOpen: 2, matricesStuck: 0, oldestMatrixMs: 5 * 3600000, firstMatrix: 'BP359 SpaceX BA-2',
  }
  it('reads as one sentence with both piles, their ages, and the first of each — blue, hygiene tier', () => {
    const items = buildNeedsYouItems(inputs({ robotBacklogEnabled: true, robotBacklog: backlog }))
    const it1 = items.find((i) => i.key === 'robot-backlog')!
    expect(it1.severity).toBe('blue')
    expect(it1.title).toBe('Robots have work waiting')
    expect(it1.detail).toBe('4 bids want a shadow (oldest asked 3 days ago) · 2 price matrices queued (oldest 5 hours) — BP482 Marriott shell · BP359 SpaceX BA-2 matrix.')
    expect(it1.figure).toBe('6')
    expect(it1.actionLabel).toBe('Open the Console')
    expect(it1.secondary?.map((s) => s.key)).toEqual(['snooze', 'dismiss'])
    expect(items[items.length - 1]!.key).toBe('robot-backlog')
  })
  it('amber only when something is stuck: a silent matrix, or a request over a week old', () => {
    const stuck = buildNeedsYouItems(inputs({ robotBacklogEnabled: true, robotBacklog: { ...backlog, matricesStuck: 1 } })).find((i) => i.key === 'robot-backlog')!
    expect(stuck.severity).toBe('amber')
    expect(stuck.detail).toMatch(/^A matrix has been working with no heartbeat for over an hour, or sit blocked\. 4 bids/)
    const overdue = buildNeedsYouItems(inputs({ robotBacklogEnabled: true, robotBacklog: { ...backlog, requestOverdue: true } })).find((i) => i.key === 'robot-backlog')!
    expect(overdue.severity).toBe('amber')
    expect(overdue.detail).toMatch(/^A bid request has waited over a week\. /)
  })
  it('one pile alone, singulars, and no request yet', () => {
    const only = buildNeedsYouItems(inputs({ robotBacklogEnabled: true, robotBacklog: { ...backlog, bidsWaiting: 1, bidsRequested: 0, oldestRequestMs: null, matricesOpen: 0, oldestMatrixMs: null, firstMatrix: null } })).find((i) => i.key === 'robot-backlog')!
    expect(only.detail).toBe('1 bid wants a shadow (nobody asked yet) — BP482 Marriott shell.')
    const mx = buildNeedsYouItems(inputs({ robotBacklogEnabled: true, robotBacklog: { ...backlog, bidsWaiting: 0, bidsRequested: 0, oldestRequestMs: null, firstBid: null, matricesOpen: 1 } })).find((i) => i.key === 'robot-backlog')!
    expect(mx.detail).toBe('1 price matrix queued (oldest 5 hours) — BP359 SpaceX BA-2 matrix.')
  })
  it('disabled, null, or empty → no item', () => {
    expect(buildNeedsYouItems(inputs({ robotBacklogEnabled: false, robotBacklog: backlog })).some((i) => i.key === 'robot-backlog')).toBe(false)
    expect(buildNeedsYouItems(inputs({ robotBacklogEnabled: true, robotBacklog: null })).some((i) => i.key === 'robot-backlog')).toBe(false)
    expect(buildNeedsYouItems(inputs({ robotBacklogEnabled: true, robotBacklog: { ...backlog, bidsWaiting: 0, matricesOpen: 0 } })).some((i) => i.key === 'robot-backlog')).toBe(false)
  })
})

describe('legal-review (Legal portal PR 2)', () => {
  const review = { underReview: 3, withFirm: 1, requested: [{ key: 'c:sam', name: 'Sam Coyle', by: 'Taunya', note: 'Ready for your eyes.', days: 2 }], oldestDays: 69, firstKey: 'c:sam', balanceUnderReview: 22375 }
  it('devs get one card that names who asked and how long the oldest has sat', () => {
    const it1 = buildNeedsYouItems(inputs({ legalReviewEnabled: true, legalReview: review })).find((i) => i.key === 'legal-review')!
    expect(it1.title).toBe('3 Collections accounts await your review before an attorney sees them')
    expect(it1.detail).toContain('1 asked for your eyes: Sam Coyle — Taunya “Ready for your eyes.”')
    expect(it1.detail).toContain('Oldest has sat 69 days')
    expect(it1.detail).toContain('1 already with the firm')
    expect(it1.severity).toBe('amber')
    expect(it1.figure).toBe('3')
  })
  it('stays blue with nothing asked and nothing old; absent when disabled or empty', () => {
    const quiet = buildNeedsYouItems(inputs({ legalReviewEnabled: true, legalReview: { ...review, requested: [], oldestDays: 3, withFirm: 0 } })).find((i) => i.key === 'legal-review')!
    expect(quiet.severity).toBe('blue')
    expect(buildNeedsYouItems(inputs({ legalReviewEnabled: false, legalReview: review })).some((i) => i.key === 'legal-review')).toBe(false)
    expect(buildNeedsYouItems(inputs({ legalReviewEnabled: true, legalReview: { ...review, underReview: 0 } })).some((i) => i.key === 'legal-review')).toBe(false)
  })
})
