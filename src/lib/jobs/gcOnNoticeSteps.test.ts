import { describe, expect, it } from 'vitest'
import { gcNoticeJobClaim, type GcNoticeJob, type GcNoticeMonth, type GcNoticeSummary } from './gcOnNotice'
import {
  buildGcNoticeSteps,
  countGcNoticeChanges,
  daysLeftWords,
  gcNoticeChanges,
  gcNoticeClaimTotals,
  gcNoticeNextWindow,
  gcNoticeOwnersSettled,
  sortOwnerRowsAttentionFirst,
  splitNoticeMonths,
} from './gcOnNoticeSteps'

const TODAY = '2026-09-21'

function month(key: string, deadline: string, closed: boolean): GcNoticeMonth {
  return { key, hours: 8, deadline, closed, fromCreation: false }
}

function job(over: Partial<GcNoticeJob>): GcNoticeJob {
  const claim = gcNoticeJobClaim(over.months ?? [], over.claimAmount ?? 0, null)
  return { jobId: 'j', customerId: null, gcCustomerId: 'gc', isBilled: true, jobStatus: 'billed', claimAmount: 0, openBalance: 0, claimCorrected: false, claimDelta: 0, claimOver: false, months: [], datedFromCreation: false, noticedMonths: [], ownerState: 'on_file', propertyKind: '', affidavitBy: '', item: null, readiness: 'ready', ...claim, ...over }
}

function summary(over: Partial<GcNoticeSummary>): GcNoticeSummary {
  return { jobs: 6, billedJobs: 4, unbilledJobs: 2, openOnBills: 30680, notYetBilled: 24170, unpaidMonths: 17, ownersOnFile: 6, ownersMissing: 0, ownersUnconfirmed: 0, publicOwners: 0, ready: 6, waitingOwner: 0, excluded: 0, claimTotal: 54850, envelopes: 12, earliestOpenDeadline: '2026-10-15', ...over }
}

const base = { foundOnRoll: 0, lookingUp: false, claimTotalWords: '$54,850', includeLetter: true, letterIsEmpty: false, reasonLabel: 'GC is not paying its subs', changes: 3 }

describe('buildGcNoticeSteps', () => {
  it('a settled run: owners done, the rest plain, each with its live status', () => {
    const steps = buildGcNoticeSteps({ ...base, summary: summary({}) })
    expect(steps.map((s) => `${s.n} ${s.name}: ${s.status} [${s.tone}]`)).toEqual([
      '1 Owners: 6 of 6 on file [done]',
      '2 Claims: 6 notices · $54,850 [open]',
      '3 Cover letter: included [open]',
      '4 Decision: GC is not paying its subs · 3 changes [open]',
      '5 The grid: 0 of 6 owners answered [open]',
    ])
    expect(gcNoticeOwnersSettled(summary({}))).toBe(true)
  })

  it('owners wants someone while any is missing or unconfirmed, and says what is left', () => {
    const s = summary({ jobs: 4, ownersOnFile: 1, ownersMissing: 2, ownersUnconfirmed: 0, publicOwners: 1, ready: 2 })
    const [owners] = buildGcNoticeSteps({ ...base, summary: s, foundOnRoll: 1 })
    expect(owners).toMatchObject({ tone: 'attention', status: '2 of 4 on file · 1 owner found · press Use · 1 to find · 1 public · left out' })
    expect(gcNoticeOwnersSettled(s)).toBe(false)
    const [looking] = buildGcNoticeSteps({ ...base, summary: s, lookingUp: true })
    expect(looking!.status).toBe('2 of 4 on file · looking up… · 1 public · left out')
  })

  it('a public owner alone keeps the step open to read but not waiting on anyone', () => {
    const s = summary({ jobs: 2, ownersOnFile: 1, publicOwners: 1, ready: 1 })
    expect(buildGcNoticeSteps({ ...base, summary: s })[0]).toMatchObject({ tone: 'done', status: '2 of 2 on file · 1 public · left out' })
    expect(gcNoticeOwnersSettled(s)).toBe(false)
  })

  it('nothing ready, the letter left out or empty, one change', () => {
    const steps = buildGcNoticeSteps({ ...base, summary: summary({ ready: 0 }), includeLetter: false, changes: 1 })
    expect(steps[1]).toMatchObject({ status: 'nothing ready yet', tone: 'attention' })
    expect(steps[2]!.status).toBe('left out · standard cover note')
    expect(steps[3]!.status).toBe('GC is not paying its subs · 1 change')
    expect(buildGcNoticeSteps({ ...base, summary: summary({}), letterIsEmpty: true })[2]).toMatchObject({ status: 'empty · standard cover note prints', tone: 'attention' })
  })
})

describe('the claims table', () => {
  const jobs = [
    job({ jobId: '273', claimAmount: 17585, months: [month('2026-04', '2026-07-15', true), month('2026-06', '2026-09-15', true), month('2026-07', '2026-10-15', false), month('2026-08', '2026-11-16', false)] }),
    job({ jobId: '651', claimAmount: 13170, isBilled: false, propertyKind: 'residential', months: [month('2026-03', '2026-06-15', true), month('2026-05', '2026-08-17', true)] }),
    job({ jobId: '881', claimAmount: 1050, months: [month('2026-07', '2026-10-15', false)] }),
    job({ jobId: 'city', claimAmount: 9000, readiness: 'public_owner', ownerState: 'public', months: [month('2026-07', '2026-10-01', false)] }),
  ]

  it('splits a notice into windows still open and the ones named as information', () => {
    const split = splitNoticeMonths(jobs[0]!.months)
    expect(split.open.map((m) => m.key)).toEqual(['2026-07', '2026-08'])
    expect(split.closed.map((m) => m.key)).toEqual(['2026-04', '2026-06'])
  })

  it('totals what the forms claim — each noticed job’s whole balance; a public owner is not listed, a job with every window closed is left out (v2.3818)', () => {
    // 273 claims its whole $17,585, closed months named as information; 651: every window closed → no notice.
    expect(gcNoticeClaimTotals(jobs)).toEqual({ notices: 2, rows: 3, openWindows: 3, closedWindows: 4, kindUnknown: 2, total: 18635, leftOut: 1, leftOutOwed: 13170 })
  })

  it('names the next window, how far off, and how many jobs share it', () => {
    expect(gcNoticeNextWindow(jobs, TODAY)).toEqual({ deadline: '2026-10-15', days: 24, jobs: 2 })
    expect(gcNoticeNextWindow([jobs[1]!], TODAY)).toBeNull()
    expect([daysLeftWords(0), daysLeftWords(1), daysLeftWords(24)]).toEqual(['today', 'tomorrow', '24 days'])
  })
})

describe('gcNoticeChanges', () => {
  it('each tick is a named change with its before and after', () => {
    const changes = gcNoticeChanges({ policy: null, termsKey: 'standard', termsLabel: 'Standard', legalMatterExists: false, legalMatterJobs: 0, jobs: 6, publicOwners: 0 })
    expect(changes.map((c) => `${c.title} — ${c.label}: ${c.from} → ${c.to}`)).toEqual([
      'Send future notices without asking — Standing rule: ask each time → send without asking',
      'Wind the account down — Payment terms: Standard → Winding down',
      'Open a Legal desk matter with all 6 jobs — Legal desk: no matter → a matter · 6 jobs',
    ])
    expect(countGcNoticeChanges(changes, { rule: true, terms: true, legal: false })).toBe(2)
  })

  it('a value already there is said so and not counted; an existing matter is added to', () => {
    const changes = gcNoticeChanges({ policy: 'send', termsKey: 'winding_down', termsLabel: 'Winding down', legalMatterExists: true, legalMatterJobs: 2, jobs: 1, publicOwners: 1 })
    expect(changes.map((c) => c.alreadySet)).toEqual([true, true, false])
    expect(changes[2]).toMatchObject({ title: 'Add all 1 job to the Legal desk matter', from: 'a matter · 2 jobs', to: 'a matter · 1 job' })
    expect(changes[2]!.why).toContain('the bond claim goes there too')
    expect(countGcNoticeChanges(changes, { rule: true, terms: true, legal: true })).toBe(1)
  })
})

describe('sortOwnerRowsAttentionFirst', () => {
  it('rows that want someone come first; the rest keep their order', () => {
    const rows = [{ id: 'a', ownerState: 'on_file' as const }, { id: 'b', ownerState: 'missing' as const }, { id: 'c', ownerState: 'on_file' as const }, { id: 'd', ownerState: 'public' as const }]
    expect(sortOwnerRowsAttentionFirst(rows).map((r) => r.id)).toEqual(['b', 'd', 'a', 'c'])
  })
})
