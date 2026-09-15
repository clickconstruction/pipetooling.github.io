import { describe, expect, it } from 'vitest'
import {
  buildLienDeskQueue,
  draftReadiness,
  holdExpired,
  PUBLIC_OWNER_DESK_SENTENCE,
  holdUntilFor,
  severityForDaysLeft,
  submitOutcome,
  summarizeLienDeskForNeedsYou,
  type LienDeskItemRow,
  type LienNoticeMonthRow,
} from './lienDesk'

const TODAY = '2026-09-14'

function row(partial: Partial<LienNoticeMonthRow> & { job_id: string; work_month: string; deadline: string }): LienNoticeMonthRow {
  return {
    approved_hours: 40,
    noticed: false,
    open_balance: 10_000,
    customer_id: 'cust-' + partial.job_id,
    gc_customer_id: 'gc-1',
    property_kind: '',
    has_owner: true,
    desk_item_id: null,
    desk_status: null,
    desk_months: null,
    ...partial,
  }
}

function item(partial: Partial<LienDeskItemRow> & { job_id: string; status: LienDeskItemRow['status'] }): LienDeskItemRow {
  return {
    id: 'it-' + partial.job_id,
    kind: 'notice_53_056',
    months: ['2026-06'],
    fields: {},
    cover_note: true,
    drafted_by: 'u-taunya',
    drafted_at: '2026-09-14T14:00:00Z',
    submitted_at: null,
    approved_by: null,
    approved_at: null,
    approval_mode: null,
    word_note: '',
    word_channel: '',
    held_by: null,
    held_at: null,
    hold_reason: '',
    hold_until: null,
    sent_filing_id: null,
    sent_at: null,
    pulled_back_by: null,
    pulled_back_at: null,
    created_at: '2026-09-14T14:00:00Z',
    updated_at: '2026-09-14T14:00:00Z',
    voided_at: null,
    ...partial,
  } as LienDeskItemRow
}

// J650: June (due tomorrow), July, August — none noticed, owner missing.
const J650 = [
  row({ job_id: 'j650', work_month: '2026-06', deadline: '2026-09-15', open_balance: 33_500, has_owner: false }),
  row({ job_id: 'j650', work_month: '2026-07', deadline: '2026-10-15', open_balance: 33_500, has_owner: false }),
  row({ job_id: 'j650', work_month: '2026-08', deadline: '2026-11-16', open_balance: 33_500, has_owner: false }),
]

describe('buildLienDeskQueue', () => {
  it('folds a job’s months into one entry: due months, the earliest deadline, severity, and the needs-owner pile', () => {
    const q = buildLienDeskQueue(J650, [], {}, TODAY)
    expect(q.entries).toHaveLength(1)
    const e = q.entries[0]!
    expect(e.dueMonths).toEqual(['2026-06', '2026-07', '2026-08'])
    expect(e.earliestDeadline).toBe('2026-09-15')
    expect(e.daysLeft).toBe(1)
    expect(e.severity).toBe('red')
    expect(e.pile).toBe('needs_owner')
    expect(e.policy).toBe('ask')
    expect(q.counts.needs_owner).toBe(1)
  })

  it('a job with the owner on file lands in to_draft; a noticed month is left out of dueMonths; all-noticed jobs vanish', () => {
    const rows = [
      row({ job_id: 'j825', work_month: '2026-06', deadline: '2026-09-15', noticed: true }),
      row({ job_id: 'j825', work_month: '2026-07', deadline: '2026-10-15' }),
      row({ job_id: 'j1001', work_month: '2026-08', deadline: '2026-11-16', noticed: true }),
    ]
    const q = buildLienDeskQueue(rows, [], {}, TODAY)
    expect(q.entries.map((e) => e.jobId)).toEqual(['j825'])
    expect(q.entries[0]!.dueMonths).toEqual(['2026-07'])
    expect(q.entries[0]!.pile).toBe('to_draft')
    expect(q.entries[0]!.severity).toBe('quiet')
  })

  it('a closed, unnoticed month is missed; the job shows in the missed pile when nothing else is due', () => {
    const q = buildLienDeskQueue([row({ job_id: 'j9', work_month: '2026-05', deadline: '2026-08-17' })], [], {}, TODAY)
    expect(q.entries[0]!.missedMonths).toEqual(['2026-05'])
    expect(q.entries[0]!.pile).toBe('missed')
  })

  it('a live item decides the pile and its months decide the deadline; sent items stay 30 days then drop', () => {
    const awaiting = item({ job_id: 'j650', status: 'awaiting_approval', months: ['2026-06', '2026-07'] })
    const q1 = buildLienDeskQueue(J650, [awaiting], {}, TODAY)
    expect(q1.entries[0]!.pile).toBe('awaiting')
    expect(q1.entries[0]!.earliestDeadline).toBe('2026-09-15')
    const ready = item({ job_id: 'j650', status: 'approved', approval_mode: 'leader', approved_by: 'u-robert', months: ['2026-07'] })
    const q2 = buildLienDeskQueue(J650, [ready], {}, TODAY)
    expect(q2.entries[0]!.pile).toBe('ready')
    expect(q2.entries[0]!.earliestDeadline).toBe('2026-10-15')
    const sentFresh = item({ job_id: 'j2', status: 'sent', sent_at: '2026-09-01T10:00:00Z' })
    const sentOld = item({ job_id: 'j3', status: 'sent', sent_at: '2026-07-01T10:00:00Z' })
    const q3 = buildLienDeskQueue([], [sentFresh, sentOld], {}, TODAY)
    expect(q3.entries.map((e) => e.jobId)).toEqual(['j2'])
    expect(q3.entries[0]!.pile).toBe('sent')
  })

  it('reads the GC’s standing rule and sorts by earliest deadline then dollars', () => {
    const rows = [
      row({ job_id: 'a', work_month: '2026-07', deadline: '2026-10-15', gc_customer_id: 'knight', open_balance: 500 }),
      row({ job_id: 'b', work_month: '2026-06', deadline: '2026-09-15', gc_customer_id: 'loberg', open_balance: 33_500 }),
      row({ job_id: 'c', work_month: '2026-06', deadline: '2026-09-15', gc_customer_id: 'dudley', open_balance: 13_420 }),
    ]
    const q = buildLienDeskQueue(rows, [], { knight: 'send', loberg: 'ask' }, TODAY)
    expect(q.entries.map((e) => e.jobId)).toEqual(['b', 'c', 'a'])
    expect(q.entries.find((e) => e.jobId === 'a')!.policy).toBe('send')
    expect(q.entries.find((e) => e.jobId === 'c')!.policy).toBe('ask')
  })
})

describe('the leader’s decision', () => {
  const entry = { policy: 'ask' as const, earliestDeadline: '2026-09-15' }
  it('a standing "send" rule approves on submit; a live promise always comes back to the leader', () => {
    expect(submitOutcome({ ...entry, policy: 'send' }, { promiseYmd: null, gcHasPriorNotice: true, gcHeldBefore: false }, TODAY)).toEqual({ status: 'approved', approval_mode: 'rule' })
    expect(submitOutcome({ ...entry, policy: 'send' }, { promiseYmd: '2026-09-15', gcHasPriorNotice: true, gcHeldBefore: false }, TODAY)).toEqual({ status: 'awaiting_approval', reason: 'promise_live' })
  })
  it('"ask" names the reason: first notice, held before, else no rule', () => {
    expect(submitOutcome(entry, { promiseYmd: null, gcHasPriorNotice: false, gcHeldBefore: false }, TODAY)).toEqual({ status: 'awaiting_approval', reason: 'first_notice' })
    expect(submitOutcome(entry, { promiseYmd: null, gcHasPriorNotice: true, gcHeldBefore: true }, TODAY)).toEqual({ status: 'awaiting_approval', reason: 'held_before' })
    expect(submitOutcome(entry, { promiseYmd: null, gcHasPriorNotice: true, gcHeldBefore: false }, TODAY)).toEqual({ status: 'awaiting_approval', reason: 'no_rule' })
  })
  it('"hold" parks it with a re-ask three days before the deadline, never before today', () => {
    expect(submitOutcome({ ...entry, policy: 'hold', earliestDeadline: '2026-10-15' }, { promiseYmd: null, gcHasPriorNotice: true, gcHeldBefore: false }, TODAY)).toEqual({ status: 'held', hold_reason: 'rule', hold_until: '2026-10-12' })
    expect(holdUntilFor('call_first', '2026-09-15', null, TODAY)).toBe(TODAY)
    expect(holdUntilFor('promised', '2026-10-15', '2026-09-25', TODAY)).toBe('2026-09-25')
    expect(holdUntilFor('promised', '2026-10-15', '2026-10-30', TODAY)).toBe('2026-10-12')
    expect(holdUntilFor('call_first', null, null, TODAY)).toBe('2026-09-21')
    expect(holdExpired({ status: 'held', hold_until: '2026-09-14' }, TODAY)).toBe(true)
    expect(holdExpired({ status: 'held', hold_until: '2026-09-15' }, TODAY)).toBe(false)
  })
  it('severity bands follow the forecast’s 7 / 14 days', () => {
    expect(severityForDaysLeft(0)).toBe('red')
    expect(severityForDaysLeft(7)).toBe('red')
    expect(severityForDaysLeft(8)).toBe('amber')
    expect(severityForDaysLeft(14)).toBe('amber')
    expect(severityForDaysLeft(15)).toBe('quiet')
    expect(severityForDaysLeft(null)).toBe('quiet')
  })
})

describe('summarizeLienDeskForNeedsYou', () => {
  it('counts the office’s drafting pile (jobs, months, dollars, owners missing) and the leader’s queue', () => {
    const rows = [
      ...J650,
      row({ job_id: 'j825', work_month: '2026-06', deadline: '2026-09-15', open_balance: 3_850 }),
      row({ job_id: 'j789', work_month: '2026-06', deadline: '2026-09-15', open_balance: 2_245 }),
    ]
    const items = [item({ job_id: 'j789', status: 'awaiting_approval' })]
    const s = summarizeLienDeskForNeedsYou(buildLienDeskQueue(rows, items, {}, TODAY))
    expect(s.office).toEqual({ jobs: 2, months: 4, dollars: 37_350, needsOwner: 1, earliestDeadline: '2026-09-15', ready: 0 })
    expect(s.leader).toEqual({ jobs: 1, dollars: 2_245, earliestDeadline: '2026-09-15' })
    expect(s.held).toBe(0)
  })
})

describe('draftReadiness (v2.3450)', () => {
  const ok = { gcName: 'Loberg Contracting', ownerName: 'Elbel Holdings LLC', ownerMailingAddress: '4 Example Way, Schertz, TX', monthsCount: 2 }
  it('is ready with a GC, an owner with a mailing address, and at least one month', () => {
    expect(draftReadiness(ok)).toEqual({ ready: true, reason: null })
  })
  it('names the first block in pane order: GC, owner, months', () => {
    expect(draftReadiness({ ...ok, gcName: '' })).toEqual({ ready: false, reason: 'no_gc' })
    expect(draftReadiness({ ...ok, ownerName: '' })).toEqual({ ready: false, reason: 'no_owner' })
    expect(draftReadiness({ ...ok, ownerMailingAddress: ' ' })).toEqual({ ready: false, reason: 'no_owner' })
    expect(draftReadiness({ ...ok, monthsCount: 0 })).toEqual({ ready: false, reason: 'no_months' })
  })
  it('a public owner is never draftable — the remedy is a bond claim', () => {
    expect(draftReadiness({ ...ok, ownerName: 'CITY OF ROUND ROCK', ownerMailingAddress: '221 E Main St, Round Rock, TX' })).toEqual({ ready: false, reason: 'public_owner' })
    expect(draftReadiness({ ...ok, ownerName: 'Comal ISD' })).toEqual({ ready: false, reason: 'public_owner' })
    expect(draftReadiness({ ...ok, ownerName: 'USA Properties LLC' })).toEqual({ ready: true, reason: null })
    expect(PUBLIC_OWNER_DESK_SENTENCE).toMatch(/payment bond/)
  })
})
