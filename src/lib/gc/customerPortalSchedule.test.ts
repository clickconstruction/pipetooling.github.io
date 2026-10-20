/**
 * The schedule's PR 15b: the customer's picture as `customer-portal` works it out (`_shared/gcCustomerSchedule.ts`), on a
 * small job laid out as its rows. Stone Oak Retail, being built for Cibolo Creek, today Mon Oct 12: grading, footings and
 * slab, wall framing, then rough-in, each by a company of its own. The rain moved the framing a week, a decision on the
 * storefront glass is theirs to make, and change order 2 waits on their signature. The answer is words and dates
 * (call 2): the never-sees test plants every company, dollar, spare day, note, the late finish's fee and our fee, and the
 * trade side's own rows (gc 3, gc 5), and none of them reach it. The same picture through `src`'s own kernels gives the
 * same answer, so the copy reads as the office's print reads.
 */
import { describe, expect, it } from 'vitest'
import { customerPortalJobs, customerPortalSchedule, customerSchedulesFromRows } from '../../../supabase/functions/_shared/gcCustomerSchedule'
import type { ScheduleReadRows } from '../../../supabase/functions/_shared/gcScheduleRead'
import type { TradeScheduleJob } from '../../../supabase/functions/_shared/gcTradePortalSchedule'
import type { GcProjectRows } from './projectRows'
import { customerSchedulePicture } from './schedule/customerSchedule'
import type { ScheduleRows } from './schedule/rows'
import { initialGcState } from './schedule/testState'
import { lateFinish } from './lateFinish'

const TODAY = '2026-10-12'
const CUSTOMER = 'cust'

/** Every dollar figure on the job, the late finish's fee and our fee and contingency among them: none may reach the answer. */
const DOLLARS = ['76543.21', '65432.1', '54321.09', '43210.98', '111111.11', '222222.22', '333333.33', '444444.44', '12345.67', '23456.78', '34567.89', '45678.9', '56789.01', '98765.43', '87654.32', '7654.33', '1717.17', '18181.18', '9090.09']
/** Every word that is not the customer's: the companies, the notes, a contact, the trade side's own rows. None may reach it. */
const NEVER = [
  'Lone Grade Sitework',
  'Bedrock Concrete',
  'Frame Right',
  'Spark Electric',
  'Ray Ortiz',
  '210-555-0177',
  'Our walls slip a week.',
  'Spark is slow on the panel',
  'They keep changing their mind on the glass',
  'These dates do not work for us',
  'Crew was on another job',
  'Footings are not at 60. We see 45.',
  'spare',
]

type Line = { id: string; pkg: string; label: string; start: string; finish: string; amount: number }
const LINES: Line[] = [
  { id: 'sS1', pkg: 'kS', label: 'Grading', start: '2026-10-01', finish: '2026-10-05', amount: 12345.67 },
  { id: 'sC1', pkg: 'kC', label: 'Footings', start: '2026-10-06', finish: '2026-10-09', amount: 23456.78 },
  { id: 'sC2', pkg: 'kC', label: 'Slab', start: '2026-10-12', finish: '2026-10-16', amount: 34567.89 },
  { id: 'sF1', pkg: 'kF', label: 'Wall framing', start: '2026-10-19', finish: '2026-10-23', amount: 45678.9 },
  { id: 'sE1', pkg: 'kE', label: 'Rough-in', start: '2026-10-26', finish: '2026-10-30', amount: 56789.01 },
]
const TRADES = [
  { id: 'kS', trade: 'Sitework', budget: 76543.21, company: 'lonegrade', name: 'Lone Grade Sitework', price: '111111.11' },
  { id: 'kC', trade: 'Concrete', budget: 65432.1, company: 'bedrock', name: 'Bedrock Concrete', price: '222222.22' },
  { id: 'kF', trade: 'Framing', budget: 54321.09, company: 'frameright', name: 'Frame Right', price: '333333.33' },
  { id: 'kE', trade: 'Electrical', budget: 43210.98, company: 'spark', name: 'Spark Electric', price: '444444.44' },
]

function projectRows(id: string, stage: string, role: string): GcProjectRows {
  return {
    project: { id, name: id === 'p1' ? 'Stone Oak Retail' : `Job ${id}`, address: '1 Stone Oak Pkwy', customer_id: CUSTOMER, plans_link: null },
    // The late finish's fee and our fee and contingency, planted on the row: the read never asks for them.
    gc: { stage, bid_due: null, sq_ft: null, size_note: '', customer_role: role, property_owner_customer_id: null, architect_customer_id: null, project_manager_user_id: null, drive_folder_url: '', lost_on: null, owner_late_finish_per_day: 1717.17, our_fee: 18181.18, our_contingency: 9090.09 } as GcProjectRows['gc'],
    packages: TRADES.map((t, i) => ({ id: `${id}-${t.id}`, trade: t.trade, position: i, budget: t.budget, ours: false, own_bid_id: null, awarded_invite_id: `${id}-i-${t.company}` })),
    scopeItems: LINES.map((l, i) => ({ id: `${id}-${l.id}`, package_id: `${id}-${l.pkg}`, position: i, label: l.label, sheets: null, specs: null, added_in_set_id: null })),
    exclusions: [],
    sets: [],
    setItems: [],
    questions: [],
  }
}

function scheduleOf(id: string): TradeScheduleJob['schedule'] & Partial<ScheduleRows> {
  const lineId = (l: Line) => `${id}-${l.id}`
  return {
    schedule: { version: 7, template_id: null, template_name: null, template_used_on: null },
    activities: LINES.map((l, i) => ({ id: lineId(l), kind: 'line', position: i, package_id: `${id}-${l.pkg}`, start: l.start, finish: l.finish, not_before: null, must_finish_by: null, actual_start: null, actual_finish: null, place: null, label: null, passed_on: null, who: null, done_on: null })),
    links: LINES.slice(1).map((l, i) => ({ from_activity_id: lineId(LINES[i]!), to_activity_id: lineId(l), gap: 0, created_at: '2026-09-20T12:00:00Z' })),
    baselines: [{ id: `${id}-b0`, name: null, locked_on: '2026-09-28', locked_by: null, why: null, created_at: '2026-09-28T12:00:00Z' }],
    baselineDates: LINES.map((l) => ({ baseline_id: `${id}-b0`, activity_id: lineId(l), start: l.start, finish: l.id === 'sC2' ? '2026-10-14' : l.finish })),
    milestones: [
      { id: `${id}-ms1`, label: 'Dried in', planned: '2026-10-23', package_id: null, met_on: null, position: 0 },
      { id: `${id}-ms2`, label: 'Substantial completion', planned: '2026-11-06', package_id: null, met_on: null, position: 1 },
    ],
    // The rain moved the framing a week, three days ago: a change this week, with a note that is ours alone.
    moves: [
      { id: `${id}-m1`, activity_id: `${id}-sF1`, made_on: '2026-10-09', made_at: '2026-10-09T12:00:00Z', made_by_name: 'Ray Ortiz', from_start: '2026-10-12', from_finish: '2026-10-16', to_start: '2026-10-19', to_finish: '2026-10-23', reason: 'weather', note: 'Our walls slip a week.', links_changed: false, finish_from: '2026-10-30', finish_to: '2026-10-30', undone_on: null, undone_by: null, change_order_id: null, late_notice_id: null, pull_finished: null, recovery_how: null, recovery_after_activity_id: null, recovery_gap_was: null, recovery_gap: null, from_what_if_on: null, parts: null, schedule_version: 6 },
    ] as unknown as ScheduleRows['moves'],
    // Their decision on the glass holds the framing.
    waits: [{ id: `${id}-w1`, kind: 'decision', title: 'the storefront glass', package_id: null, who: 'Cibolo Creek', asked_on: '2026-10-05', expected_on: '2026-10-16', shipped_on: null, done_on: null, note: 'They keep changing their mind on the glass', created_at: '2026-10-05T12:00:00Z' }],
    waitHolds: [{ wait_id: `${id}-w1`, activity_id: `${id}-sF1` }],
    // The trade side's own rows (gc 3): a told company's answer, a crew count, a mark with our reason. None is read
    // for the customer; planted here anyway.
    answers: [{ move_id: `${id}-m1`, company_id: 'frameright', answered_on: '2026-10-10', ok: false, day: '2026-10-21', note: 'These dates do not work for us', created_at: '2026-10-10T12:00:00Z' }],
    crewCounts: [{ package_id: `${id}-kF`, company_id: 'frameright', week_of: '2026-10-19', count: 7, said_on: '2026-10-10', created_at: '2026-10-10T12:00:00Z' }],
    marks: [{ activity_id: `${id}-sC1`, week_of: '2026-10-05', done: false, reason: 'rain', marked_on: '2026-10-09', verified_on: '2026-10-10', verified_done: false, verified_reason: 'Crew was on another job', created_at: '2026-10-10T12:00:00Z' }],
    lateNotices: [
      { id: `${id}-n1`, company_id: 'spark', activity_id: `${id}-sE1`, sent_on: '2026-10-09', sent_by: 'Sam', started: false, was_start: '2026-10-26', was_finish: '2026-10-30', to_start: '2026-11-02', to_finish: '2026-11-06', reason: 'materials', note: 'Spark is slow on the panel', pushed_back_on: null, pushed_back_by: null, pushed_back_note: null, kept_on: null, created_at: '2026-10-09T12:00:00Z' },
    ],
  }
}

function rowsOf(role = 'owner'): ScheduleReadRows {
  const jobs = [
    { project: projectRows('p1', 'building', role), schedule: scheduleOf('p1') },
    // A job of theirs in buyout: no schedule, even with one drawn.
    { project: projectRows('p3', 'buyout', role), schedule: scheduleOf('p3') },
  ] as ScheduleReadRows['jobs']
  const trades = jobs.flatMap((j) => j.project.packages.map((k) => ({ pkg: k, t: TRADES.find((t) => k.id.endsWith(`-${t.id}`))!, job: j.project.project.id })))
  return {
    customer: { id: CUSTOMER, name: 'Cibolo Creek Partners' },
    jobs,
    invites: trades.map(({ pkg, t }) => ({ id: pkg.awarded_invite_id!, package_id: pkg.id, company_id: t.company, status: 'bid', invited_on: '2026-09-01' })),
    companies: TRADES.map((t) => ({ id: t.company, name: t.name, phone: '210-555-0177', contact_name: 'Ray Ortiz' })) as ScheduleReadRows['companies'],
    sows: trades.map(({ pkg, t, job }) => ({ id: `${job}-sow-${t.id}`, package_id: pkg.id, status: 'signed', price: t.price, retainage_pct: 10, based_on_rev: 0, their_sov: null, excluded: null, sent_on: '2026-09-10', signed_on: '2026-09-12', accepted_on: null })) as unknown as ScheduleReadRows['sows'],
    sowLines: jobs.flatMap((j) =>
      LINES.map((l, i) => ({ id: `${j.project.project.id}-sl-${l.id}`, sow_id: `${j.project.project.id}-sow-${l.pkg}`, position: i, label: l.label, amount: l.amount, scope_item_id: `${j.project.project.id}-${l.id}`, change_order_id: null })),
    ) as unknown as ScheduleReadRows['sowLines'],
    draws: {
      draws: [{ id: 'p1-d-kC', sow_id: 'p1-sow-kC', number: 1, seq: 1, status: 'sent_back', gross: 98765.43, net: 87654.32, retainage: 7654.33, requested_on: '2026-10-08', period_to: '2026-10-07', address: '', license: '', signed_by: 'Ray Ortiz', signed_on: '2026-10-08', signed_title: 'Owner', asked: null, approved_on: null, paid_on: null, sent_back_on: '2026-10-09', sent_back_note: 'Footings are not at 60. We see 45.', final: false, waiver: 'conditional', waiver_on: null, drive_url: null, file_name: null, recorded_by: null, created_at: '2026-10-08T12:00:00Z' }],
      drawLines: [{ draw_id: 'p1-d-kC', sow_line_id: 'p1-sl-sC1', to_pct: 60, stored: 0, we_see: 45 }],
      reports: ['sS1', 'sC1'].map((k) => ({ id: `p1-r-${k}`, sow_line_id: `p1-sl-${k}`, company_id: 'x', pct: k === 'sS1' ? 100 : 60, reported_on: '2026-10-08', seq: 1, recorded_by: null, created_at: '2026-10-08T12:00:00Z' })),
    } as unknown as ScheduleReadRows['draws'],
    // Change order 2 waits on their signature: the office view's columns only, so no price is ever read.
    changeOrders: [{ id: 'co2', project_id: 'p1', number: 2, description: 'Add a coffee bar cabinet', reason: 'owner', schedule_words: '', package_id: null, status: 'sent', sent_on: '2026-10-10', answered_on: null, days: 3, days_on_chart: false }],
  }
}

describe('the jobs a customer sees a schedule on (call 3)', () => {
  const projects = [
    { id: 'p1', customer_id: CUSTOMER },
    { id: 'p2', customer_id: 'someone-else' },
    { id: 'p3', customer_id: CUSTOMER },
    { id: 'p4', customer_id: CUSTOMER },
  ]
  const stages = [
    { project_id: 'p1', stage: 'building' },
    { project_id: 'p2', stage: 'building' },
    { project_id: 'p3', stage: 'buyout' },
    { project_id: 'p4', stage: 'building' },
  ]

  it('is each of their own jobs being built with a schedule drawn', () => {
    expect(customerPortalJobs(projects, stages, [{ project_id: 'p1' }, { project_id: 'p2' }, { project_id: 'p3' }], CUSTOMER)).toEqual(['p1'])
  })

  it('is none for a job with nothing drawn, or none being built', () => {
    expect(customerPortalJobs(projects, stages, [], CUSTOMER)).toEqual([])
    expect(customerPortalJobs(projects, stages.map((s) => ({ ...s, stage: 'closed' })), [{ project_id: 'p1' }], CUSTOMER)).toEqual([])
  })
})

describe('the customer’s picture, worked out from the rows (calls 2 to 5)', () => {
  const answer = customerSchedulesFromRows(rowsOf(), TODAY)
  const picture = answer.p1!

  it('is on the job being built, never on one in buyout', () => {
    expect(Object.keys(answer)).toEqual(['p1'])
  })

  it('says the finish, the stages, the dates to meet, what changed and what we need from them', () => {
    expect(picture.today).toBe(TODAY)
    // The finish reads the pace of the work too, as the office's measure does: the slab is behind.
    expect(picture.finish).toBe('2026-11-04')
    expect(picture.stages.length).toBeGreaterThan(1)
    expect(picture.dates.map((d) => [d.label, d.due])).toEqual([
      ['Dried in', '2026-10-23'],
      ['Substantial completion', '2026-11-06'],
    ])
    expect(picture.next).toMatchObject({ label: 'Dried in', due: '2026-10-23' })
    expect(picture.changes).toEqual([expect.stringContaining('because of the weather')])
    expect(picture.asks).toEqual(expect.arrayContaining([expect.stringContaining('Your signature on change order 2, Add a coffee bar cabinet'), expect.stringContaining('Your decision on the storefront glass')]))
    // An owner reads the stages; every bar is a GC's or an owner's rep's.
    expect([picture.everyBar, picture.groups]).toEqual([false, []])
  })

  it('shows every bar by its name and dates, in their words, to a GC or an owner’s rep', () => {
    const rep = customerSchedulesFromRows(rowsOf('ownersRep'), TODAY).p1!
    expect(rep.everyBar).toBe(true)
    const bars = rep.groups.flatMap((g) => g.bars)
    expect(bars.map((b) => b.label).sort()).toEqual(['Footings', 'Grading', 'Rough-in', 'Slab', 'Wall framing'])
    for (const bar of bars) expect(Object.keys(bar).sort()).toEqual(['finish', 'label', 'start', 'tone', 'words'])
  })

  it('never carries a company, a dollar, a spare day, a note or the trade side’s rows (the never-sees test)', () => {
    for (const shown of [answer, customerSchedulesFromRows(rowsOf('gc'), TODAY)]) {
      const json = JSON.stringify(shown)
      for (const word of NEVER) expect(json, word).not.toContain(word)
      for (const figure of DOLLARS) expect(json, figure).not.toContain(figure)
      expect(json).not.toContain('$')
      expect(json).not.toContain('worth')
      expect(json).not.toContain('company')
    }
    expect(Object.keys(picture).sort()).toEqual(['asks', 'changes', 'contract', 'contractDays', 'dates', 'donePct', 'doneWords', 'everyBar', 'finish', 'finishWords', 'groups', 'late', 'lateWords', 'next', 'plannedPct', 'stages', 'today'])
  })
})

describe('the copy reads as the office’s print reads (call 1)', () => {
  it('gives src’s own picture of Fair Oaks D in words and dates', () => {
    const s = initialGcState()
    const fairOaks = s.projects.find((p) => p.id === 'fairoaksd')!
    const office = customerSchedulePicture(s, fairOaks)
    const portal = customerPortalSchedule(office, lateFinish(s, fairOaks).customerWords, s.today)
    expect(portal.finishWords).toBe(office.standing.finishWords)
    expect(portal.stages).toEqual(office.stages.map((g) => ({ label: g.label, start: g.start, finish: g.finish, pct: Math.round(g.pct), state: g.state })))
    expect(portal.dates.map((d) => d.label)).toEqual(office.milestones.map((m) => m.milestone.label))
    expect([portal.changes, portal.asks, portal.contractDays]).toEqual([office.changes, office.asks, office.contractDays])
  })
})
