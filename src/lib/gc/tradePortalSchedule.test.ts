/**
 * The schedule's PR 14b: the trade's chart as `gc-trade-portal` works it out (`_shared/gcTradePortalSchedule.ts`), on a
 * small job laid out as its rows. Stone Oak Retail, being built, today Mon Oct 12: Lone Grade's grading, then our
 * reader's footings and slab (Bedrock Concrete), then Frame Right's walls, then Spark Electric's rough-in. The chart
 * shows Bedrock its own bars, Lone Grade before and Frame Right after, by name and percent. Spark, every dollar, every
 * note and every contact never reach it (call 6, with gc 3's three plants), and a neighbour's percent is its own report,
 * never the percent we see on a draw we sent it back (amendment 1). The same rows through `src`'s own builders give the
 * same answer, so the copy reads as the office reads.
 */
import { describe, expect, it } from 'vitest'
import {
  portalScheduleJobs,
  portalSchedulesFromRows,
  withoutOthersSendBacks,
  type TradeScheduleJob,
  type TradeScheduleRows,
} from '../../../supabase/functions/_shared/gcTradePortalSchedule'
import { boardStateFromRows, type BoardRows } from './boardRows'
import { withDraws } from './drawRows'
import { gcProjectFromRows, type GcProjectRows } from './projectRows'
import { portalSchedule } from './schedule/portalSchedule'
import { withScheduleRows, type ScheduleRows } from './schedule/rows'

const TODAY = '2026-10-12'
const MINE = 'bedrock'

/** Every dollar figure on the job: none may reach the answer. */
const DOLLARS = ['76543.21', '65432.1', '54321.09', '43210.98', '111111.11', '222222.22', '333333.33', '444444.44', '12345.67', '23456.78', '34567.89', '45678.9', '56789.01', '98765.43', '87654.32', '7654.33']
/** Every word that is not the chart's: a third company, notes, contacts. None may reach the answer. */
const NEVER = [
  'Spark Electric',
  'Rough-in',
  '210-555-0177',
  'boss@frameright.example',
  'Spark is slow on the panel',
  'Framing is behind. We see 10 percent.',
  'Our walls slip a week.',
  'Ray Ortiz',
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
  { id: 'kC', trade: 'Concrete', budget: 65432.1, company: MINE, name: 'Bedrock Concrete', price: '222222.22' },
  { id: 'kF', trade: 'Framing', budget: 54321.09, company: 'frameright', name: 'Frame Right', price: '333333.33' },
  { id: 'kE', trade: 'Electrical', budget: 43210.98, company: 'spark', name: 'Spark Electric', price: '444444.44' },
]

function projectRows(id: string, stage: string, trades = TRADES): GcProjectRows {
  return {
    project: { id, name: id === 'p1' ? 'Stone Oak Retail' : `Job ${id}`, address: '1 Stone Oak Pkwy', customer_id: 'cust', plans_link: null },
    gc: { stage, bid_due: null, sq_ft: null, size_note: '', customer_role: 'owner', property_owner_customer_id: null, architect_customer_id: null, project_manager_user_id: null, drive_folder_url: '', lost_on: null },
    packages: trades.map((t, i) => ({ id: `${id}-${t.id}`, trade: t.trade, position: i, budget: t.budget, ours: false, own_bid_id: null, awarded_invite_id: `${id}-i-${t.company}` })),
    scopeItems: LINES.filter((l) => trades.some((t) => t.id === l.pkg)).map((l, i) => ({ id: `${id}-${l.id}`, package_id: `${id}-${l.pkg}`, position: i, label: l.label, sheets: null, specs: null, added_in_set_id: null })),
    exclusions: [],
    sets: [],
    setItems: [],
    questions: [],
  }
}

function scheduleOf(id: string, trades = TRADES): TradeScheduleJob['schedule'] {
  const lines = LINES.filter((l) => trades.some((t) => t.id === l.pkg))
  const lineId = (l: Line) => `${id}-${l.id}`
  return {
    schedule: { version: 7, template_id: null, template_name: null, template_used_on: null },
    activities: lines.map((l, i) => ({ id: lineId(l), kind: 'line', position: i, package_id: `${id}-${l.pkg}`, start: l.start, finish: l.finish, not_before: null, must_finish_by: null, actual_start: null, actual_finish: null, place: null, label: null, passed_on: null, who: null, done_on: null })),
    // Each line waits on the one before it.
    links: lines.slice(1).map((l, i) => ({ from_activity_id: lineId(lines[i]!), to_activity_id: lineId(l), gap: 0, created_at: '2026-09-20T12:00:00Z' })),
    baselines: [{ id: `${id}-b0`, name: null, locked_on: '2026-09-28', locked_by: null, why: null, created_at: '2026-09-28T12:00:00Z' }],
    // The slab was planned to finish Wed Oct 14: two days slipped.
    baselineDates: lines.map((l) => ({ baseline_id: `${id}-b0`, activity_id: lineId(l), start: l.start, finish: l.id === 'sC2' ? '2026-10-14' : l.finish })),
  }
}

/** The draw tables' rows: a report on each line, and two pay applications sent back, ours and Frame Right's. */
function drawsOf(id: string): TradeScheduleRows['draws'] {
  const draw = (pkg: string, n: number, note: string) => ({
    id: `${id}-d-${pkg}`,
    sow_id: `${id}-sow-${pkg}`,
    number: n,
    seq: n,
    status: 'sent_back',
    gross: 98765.43,
    net: 87654.32,
    retainage: 7654.33,
    requested_on: '2026-10-08',
    period_to: '2026-10-07',
    address: '',
    license: '',
    signed_by: 'Ray Ortiz',
    signed_on: '2026-10-08',
    signed_title: 'Owner',
    asked: null,
    approved_on: null,
    paid_on: null,
    sent_back_on: '2026-10-09',
    sent_back_note: note,
    final: false,
    waiver: 'conditional',
    waiver_on: null,
    drive_url: null,
    file_name: null,
    recorded_by: null,
    created_at: '2026-10-08T12:00:00Z',
  })
  const report = (lineKey: string, pct: number) => ({ id: `${id}-r-${lineKey}`, sow_line_id: `${id}-sl-${lineKey}`, company_id: 'x', pct, reported_on: '2026-10-08', seq: 1, recorded_by: null, created_at: '2026-10-08T12:00:00Z' })
  return {
    draws: [draw('kC', 1, 'Footings are not at 60. We see 45.'), draw('kF', 1, 'Framing is behind. We see 10 percent.')],
    drawLines: [
      { draw_id: `${id}-d-kC`, sow_line_id: `${id}-sl-sC1`, to_pct: 60, stored: 0, we_see: 45 },
      { draw_id: `${id}-d-kF`, sow_line_id: `${id}-sl-sF1`, to_pct: 30, stored: 0, we_see: 10 },
    ],
    reports: [report('sS1', 100), report('sC1', 60), report('sF1', 30), report('sE1', 50)],
  }
}

function rowsOf(): TradeScheduleRows {
  const jobs: TradeScheduleJob[] = [
    {
      project: projectRows('p1', 'building'),
      // Notes the read never asks for, planted anyway: a move's and another company's late notice.
      schedule: {
        ...scheduleOf('p1'),
        moves: [
          { id: 'm1', activity_id: 'p1-sF1', made_on: '2026-10-09', made_at: '2026-10-09T12:00:00Z', made_by_name: 'Ray Ortiz', from_start: '2026-10-12', from_finish: '2026-10-16', to_start: '2026-10-19', to_finish: '2026-10-23', reason: 'crew', note: 'Our walls slip a week.', links_changed: false, finish_from: '2026-12-01', finish_to: '2026-12-08', undone_on: null, undone_by: null, change_order_id: null, late_notice_id: null, pull_finished: null, recovery_how: null, recovery_after_activity_id: null, recovery_gap_was: null, recovery_gap: null, from_what_if_on: null, parts: null, schedule_version: 6 },
        ],
        lateNotices: [
          { id: 'n1', company_id: 'spark', activity_id: 'p1-sE1', sent_on: '2026-10-09', sent_by: 'Sam', started: false, was_start: '2026-10-26', was_finish: '2026-10-30', to_start: '2026-11-02', to_finish: '2026-11-06', reason: 'materials', note: 'Spark is slow on the panel', pushed_back_on: null, pushed_back_by: null, pushed_back_note: null, kept_on: null, created_at: '2026-10-09T12:00:00Z' },
        ] as ScheduleRows['lateNotices'],
      },
    },
    // A second job, being built, with no trade of Bedrock's.
    { project: projectRows('p2', 'building', TRADES.filter((t) => t.company !== MINE)), schedule: scheduleOf('p2', TRADES.filter((t) => t.company !== MINE)) },
    // A job in buyout: no chart, even with Bedrock awarded.
    { project: projectRows('p3', 'buyout'), schedule: scheduleOf('p3') },
  ]
  const trades = jobs.flatMap((j) => j.project.packages.map((k) => ({ pkg: k, t: TRADES.find((t) => k.id.endsWith(`-${t.id}`))!, job: j.project.project.id })))
  // Contacts the read never asks for, planted on the companies anyway.
  const companies = TRADES.map((t) => ({ id: t.company, name: t.name, phone: '210-555-0177', email: 'boss@frameright.example', contact_name: 'Ray Ortiz' }))
  const draws = jobs.map((j) => drawsOf(j.project.project.id))
  return {
    jobs,
    invites: trades.map(({ pkg, t }) => ({ id: pkg.awarded_invite_id!, package_id: pkg.id, company_id: t.company, status: 'bid', invited_on: '2026-09-01' })),
    companies,
    sows: trades.map(({ pkg, t, job }) => ({ id: `${job}-sow-${t.id}`, package_id: pkg.id, status: 'signed', price: t.price, retainage_pct: 10, based_on_rev: 0, their_sov: null, excluded: null, sent_on: '2026-09-10', signed_on: '2026-09-12', accepted_on: null })),
    sowLines: jobs.flatMap((j) =>
      LINES.filter((l) => j.project.packages.some((k) => k.id === `${j.project.project.id}-${l.pkg}`)).map((l, i) => ({
        id: `${j.project.project.id}-sl-${l.id}`,
        sow_id: `${j.project.project.id}-sow-${l.pkg}`,
        position: i,
        label: l.label,
        amount: l.amount,
        scope_item_id: `${j.project.project.id}-${l.id}`,
        change_order_id: null,
      })),
    ),
    draws: { draws: draws.flatMap((d) => d.draws), drawLines: draws.flatMap((d) => d.drawLines), reports: draws.flatMap((d) => d.reports) },
  }
}

describe('the jobs a company sees a chart on (call 3)', () => {
  const packages = [
    { id: 'k1', project_id: 'p1', awarded_invite_id: 'i-mine' },
    { id: 'k2', project_id: 'p2', awarded_invite_id: 'i-other' },
    { id: 'k3', project_id: 'p3', awarded_invite_id: 'i-mine-3' },
    { id: 'k4', project_id: 'p4', awarded_invite_id: null },
  ]
  const stages = [
    { project_id: 'p1', stage: 'building' },
    { project_id: 'p2', stage: 'building' },
    { project_id: 'p3', stage: 'buyout' },
    { project_id: 'p4', stage: 'building' },
  ]

  it('is each job being built with a trade awarded to one of its own invites', () => {
    expect(portalScheduleJobs(packages, ['i-mine', 'i-mine-3', 'i-lost'], stages)).toEqual(['p1'])
  })

  it('is none for a company with no award, or none being built', () => {
    expect(portalScheduleJobs(packages, ['i-lost'], stages)).toEqual([])
    expect(portalScheduleJobs(packages, ['i-mine'], stages.map((s) => ({ ...s, stage: 'closed' })))).toEqual([])
  })
})

describe('the trade’s chart, worked out from the rows (calls 4 to 6)', () => {
  const answer = portalSchedulesFromRows(rowsOf(), MINE, TODAY)
  const chart = answer.p1!

  it('is on the job being built with its bars, and on no other', () => {
    expect(Object.keys(answer)).toEqual(['p1'])
  })

  it('draws its own bars with the percent its portal already reads, our send-back’s', () => {
    expect(chart.mine).toEqual([
      { lineId: 'p1-sC1', label: 'Footings', company: 'Bedrock Concrete', start: '2026-10-06', finish: '2026-10-09', pct: 45, slipDays: 0, mine: true },
      { lineId: 'p1-sC2', label: 'Slab', company: 'Bedrock Concrete', start: '2026-10-12', finish: '2026-10-16', pct: 0, slipDays: 2, mine: true },
    ])
  })

  it('names the work right before and right after, each with its own report, never what we see on a draw we sent back', () => {
    expect(chart.before).toEqual([{ lineId: 'p1-sS1', label: 'Grading', company: 'Lone Grade Sitework', start: '2026-10-01', finish: '2026-10-05', pct: 100, slipDays: 0, mine: false }])
    expect(chart.after).toEqual([{ lineId: 'p1-sF1', label: 'Wall framing', company: 'Frame Right', start: '2026-10-19', finish: '2026-10-23', pct: 30, slipDays: 0, mine: false }])
    expect(chart.first).toBe('2026-10-01')
    expect(chart.last).toBe('2026-10-23')
  })

  it('names our own crew as a neighbour by its dates alone, with no percent (call 7)', () => {
    const rows = rowsOf()
    const job = rows.jobs[0]!
    job.project.packages = job.project.packages.map((k) => (k.id === 'p1-kF' ? { ...k, ours: true, own_bid_id: null, awarded_invite_id: null } : k))
    const ours = portalSchedulesFromRows(rows, MINE, TODAY).p1!
    expect(ours.after).toEqual([{ lineId: 'p1-sF1', label: 'Wall framing', company: 'Our own crew', start: '2026-10-19', finish: '2026-10-23', pct: 0, slipDays: 0, mine: false }])
  })

  it('never carries a third company, a dollar, a note or a contact (the never-sees test)', () => {
    const json = JSON.stringify(answer)
    for (const word of NEVER) expect(json, word).not.toContain(word)
    for (const figure of DOLLARS) expect(json, figure).not.toContain(figure)
    expect(json).not.toContain('$')
    expect(json).not.toContain('worth')
    // Only the fields the chart draws.
    for (const bar of [...chart.before, ...chart.mine, ...chart.after]) expect(Object.keys(bar).sort()).toEqual(['company', 'finish', 'label', 'lineId', 'mine', 'pct', 'slipDays', 'start'])
  })
})

describe('the copy reads as the office reads (call 1)', () => {
  it('gives the answer src’s own builders give on the same rows, with the neighbours’ send-backs off', () => {
    const rows = rowsOf()
    const job = rows.jobs[0]!
    const board: BoardRows = {
      today: TODAY,
      projects: [gcProjectFromRows(job.project)],
      boardDates: {},
      customers: [],
      companies: rows.companies.map((c) => ({ id: c.id, name: c.name, trades: [], contact_name: '', phone: '', email: '', address: '', max_miles: null, license: '', lang: 'en', vetting_status: null, vetting_limit: null, vetting_decided_on: null, vetting_decided_by: null, vetting_note: '' })),
      invites: rows.invites.map((i) => ({ ...i, declined_why: null, decline_reason: null, decline_note: '', declined_on: null, plugs: null, exclusion_covers: null, taken_alternates: null })),
      quotes: [],
      contacts: [],
      promises: [],
      promiseMoves: [],
      sows: rows.sows,
      sowLines: rows.sowLines,
    }
    const state = withDraws(boardStateFromRows(board), {
      sows: rows.sows.map((s) => ({ id: s.id, package_id: s.package_id })),
      sowLines: rows.sowLines.map((l) => ({ id: l.id, sow_id: l.sow_id, position: l.position, scope_item_id: l.scope_item_id })),
      ...rows.draws,
      backCharges: [],
      tradeSends: [],
    })
    const empty = { parts: [], milestones: [], failures: [], moves: [], pushes: [], tells: [], answers: [], walks: [], marks: [], lateNotices: [], waits: [], waitHolds: [], crewCounts: [], sends: [], whatIf: null, rough: null }
    const read = withScheduleRows({ state: withoutOthersSendBacks(state, MINE), projectId: 'p1', rows: { ...empty, ...scheduleOf('p1') }, templates: [], names: new Map() })!
    expect(portalSchedule(read.state, MINE, read.project)).toEqual(portalSchedulesFromRows(rows, MINE, TODAY).p1)
    // Without taking the neighbours' send-backs off, Frame Right would read our 10, not its 30.
    const raw = withScheduleRows({ state, projectId: 'p1', rows: { ...empty, ...scheduleOf('p1') }, templates: [], names: new Map() })!
    expect(portalSchedule(raw.state, MINE, raw.project)!.after[0]!.pct).toBe(10)
  })
})
