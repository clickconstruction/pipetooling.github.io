/**
 * The Portal's P5d-ii: the trade's side of the schedule as `gc-trade-portal` works it out (`_shared/gcTradePortalSchedule.ts`),
 * on a small job laid out as its rows. Stone Oak Retail, being built, today Fri Oct 16: Lone Grade's grading, then our
 * reader Bedrock's footings and slab, then Frame Right's walls, then Spark's rough-in. Rain held the grading, and the
 * move pushed both of Bedrock's bars: Bedrock was told and gets its dates to answer, though its own bars never moved
 * (gc 4's amendment). Bedrock said its slab would be late and we pushed back. It marked last week and gave a crew count.
 * Frame Right's move was told to others, Spark has its own notice, count and checked mark, and every trade has a
 * dollar: none of those reach the answer (call 3). The same rows through `src`'s kernels give the same answers.
 */
import { describe, expect, it } from 'vitest'
import {
  lateWaitingFromRows,
  portalScheduleWorkFromRows,
  withoutOthersSendBacks,
  type TradeScheduleJob,
  type TradeScheduleRows,
} from '../../../supabase/functions/_shared/gcTradePortalSchedule'
import { boardStateFromRows, type BoardRows } from './boardRows'
import { portalLookAhead } from './portal'
import { gcProjectFromRows, type GcProjectRows } from './projectRows'
import { portalCrewAsks } from './schedule/crewCounts'
import { withScheduleRows, type ScheduleRows } from './schedule/rows'

const TODAY = '2026-10-16'
const MINE = 'bedrock'

/** Every word and figure that is not Bedrock's to read. None may reach the answer. */
const NEVER = ['Our walls slip a week.', 'Spark is slow on the panel', 'Spark left the site early.', '"count":47', 'user-pressed-it', '76543.21', '65432.1', '54321.09', '43210.98', 'Ray Ortiz']

const TRADES = [
  { id: 'kS', trade: 'Sitework', budget: 76543.21, company: 'lonegrade', name: 'Lone Grade Sitework' },
  { id: 'kC', trade: 'Concrete', budget: 65432.1, company: MINE, name: 'Bedrock Concrete' },
  { id: 'kF', trade: 'Framing', budget: 54321.09, company: 'frameright', name: 'Frame Right' },
  { id: 'kE', trade: 'Electrical', budget: 43210.98, company: 'spark', name: 'Spark Electric' },
]
/** Each bar as it stands now: the grading move pushed the footings and the slab two days. */
const BARS = [
  { id: 'p1-sS1', pkg: 'kS', label: 'Grading', start: '2026-10-01', finish: '2026-10-07' },
  { id: 'p1-sC1', pkg: 'kC', label: 'Footings', start: '2026-10-08', finish: '2026-10-13' },
  { id: 'p1-sC2', pkg: 'kC', label: 'Slab', start: '2026-10-14', finish: '2026-10-20' },
  { id: 'p1-sF1', pkg: 'kF', label: 'Wall framing', start: '2026-10-21', finish: '2026-10-27' },
  { id: 'p1-sE1', pkg: 'kE', label: 'Rough-in', start: '2026-10-28', finish: '2026-11-03' },
]

const project: GcProjectRows = {
  project: { id: 'p1', name: 'Stone Oak Retail', address: '1 Stone Oak Pkwy', customer_id: 'cust', plans_link: null },
  gc: { stage: 'building', bid_due: null, sq_ft: null, size_note: '', customer_role: 'owner', property_owner_customer_id: null, architect_customer_id: null, project_manager_user_id: null, drive_folder_url: '', lost_on: null },
  packages: TRADES.map((t, i) => ({ id: `p1-${t.id}`, trade: t.trade, position: i, budget: t.budget, ours: false, own_bid_id: null, awarded_invite_id: `p1-i-${t.company}` })),
  scopeItems: BARS.map((b, i) => ({ id: b.id, package_id: `p1-${b.pkg}`, position: i, label: b.label, sheets: null, specs: null, added_in_set_id: null })),
  exclusions: [],
  sets: [],
  setItems: [],
  questions: [],
}

const move = (id: string, bar: string, from: [string, string], to: [string, string], reason: string, note: string) => ({
  id,
  activity_id: bar,
  made_on: '2026-10-14',
  made_at: '2026-10-14T12:00:00Z',
  made_by_name: 'Ray Ortiz',
  from_start: from[0],
  from_finish: from[1],
  to_start: to[0],
  to_finish: to[1],
  reason,
  note,
  links_changed: false,
  finish_from: '2026-12-01',
  finish_to: '2026-12-03',
  undone_on: null,
  undone_by: null,
  change_order_id: null,
  late_notice_id: null,
  pull_finished: null,
  recovery_how: null,
  recovery_after_activity_id: null,
  recovery_gap_was: null,
  recovery_gap: null,
  from_what_if_on: null,
  parts: null,
  schedule_version: 7,
})

const notice = (id: string, company: string, bar: string, was: [string, string], to: [string, string], note: string, pushedBack: string | null) => ({
  id,
  company_id: company,
  activity_id: bar,
  sent_on: '2026-10-14',
  sent_by: 'Dana',
  started: false,
  was_start: was[0],
  was_finish: was[1],
  to_start: to[0],
  to_finish: to[1],
  reason: 'crew',
  note,
  pushed_back_on: pushedBack ? '2026-10-15' : null,
  pushed_back_by: pushedBack ? 'user-pressed-it' : null,
  pushed_back_note: pushedBack,
  kept_on: null,
  created_at: '2026-10-14T12:00:00Z',
})

const schedule: TradeScheduleJob['schedule'] = {
  schedule: { version: 8, template_id: null, template_name: null, template_used_on: null },
  activities: BARS.map((b, i) => ({ id: b.id, kind: 'line', position: i, package_id: `p1-${b.pkg}`, start: b.start, finish: b.finish, not_before: null, must_finish_by: null, actual_start: null, actual_finish: null, place: null, label: null, passed_on: null, who: null, done_on: null })),
  // Each bar waits on the one before it.
  links: BARS.slice(1).map((b, i) => ({ from_activity_id: BARS[i]!.id, to_activity_id: b.id, gap: 0, created_at: '2026-09-20T12:00:00Z' })),
  baselines: [],
  baselineDates: [],
  moves: [
    // Rain held the grading two days, pushing Bedrock's footings and slab: told to Lone Grade and Bedrock.
    move('m-grading', 'p1-sS1', ['2026-10-01', '2026-10-05'], ['2026-10-01', '2026-10-07'], 'weather', 'Rain held the grading.'),
    // Frame Right's walls slipped, pushing Spark: told to them, never to Bedrock.
    move('m-walls', 'p1-sF1', ['2026-10-19', '2026-10-25'], ['2026-10-21', '2026-10-27'], 'crew', 'Our walls slip a week.'),
  ],
  pushes: [
    { move_id: 'm-grading', activity_id: 'p1-sC1', from_start: '2026-10-06', from_finish: '2026-10-11', to_start: '2026-10-08', to_finish: '2026-10-13' },
    { move_id: 'm-grading', activity_id: 'p1-sC2', from_start: '2026-10-12', from_finish: '2026-10-18', to_start: '2026-10-14', to_finish: '2026-10-20' },
    { move_id: 'm-walls', activity_id: 'p1-sE1', from_start: '2026-10-26', from_finish: '2026-11-01', to_start: '2026-10-28', to_finish: '2026-11-03' },
  ],
  tells: [
    { move_id: 'm-grading', company_id: 'lonegrade', told_on: '2026-10-14', created_at: '2026-10-14T13:00:00Z' },
    { move_id: 'm-grading', company_id: MINE, told_on: '2026-10-14', created_at: '2026-10-14T13:00:00Z' },
    { move_id: 'm-walls', company_id: 'frameright', told_on: '2026-10-14', created_at: '2026-10-14T13:00:00Z' },
    { move_id: 'm-walls', company_id: 'spark', told_on: '2026-10-14', created_at: '2026-10-14T13:00:00Z' },
  ],
  answers: [],
  lateNotices: [
    notice('n-slab', MINE, 'p1-sC2', ['2026-10-14', '2026-10-20'], ['2026-10-19', '2026-10-25'], 'Our pump truck is down.', 'The framing needs the slab on its day.'),
    notice('n-spark', 'spark', 'p1-sE1', ['2026-10-28', '2026-11-03'], ['2026-11-04', '2026-11-10'], 'Spark is slow on the panel', null),
  ] as ScheduleRows['lateNotices'],
  crewCounts: [
    { package_id: 'p1-kC', company_id: MINE, week_of: '2026-10-19', count: 4, said_on: '2026-10-15', created_at: '2026-10-15T12:00:00Z' },
    { package_id: 'p1-kE', company_id: 'spark', week_of: '2026-10-26', count: 47, said_on: '2026-10-15', created_at: '2026-10-15T12:00:00Z' },
  ],
  marks: [
    { activity_id: 'p1-sC1', week_of: '2026-10-05', done: false, reason: 'weather', marked_on: '2026-10-10', verified_on: null, verified_done: null, verified_reason: null, created_at: '2026-10-10T12:00:00Z' },
    { activity_id: 'p1-sE1', week_of: '2026-10-05', done: true, reason: null, marked_on: '2026-10-10', verified_on: '2026-10-12', verified_done: false, verified_reason: 'Spark left the site early.', created_at: '2026-10-10T12:00:00Z' },
  ],
}

function rowsOf(): TradeScheduleRows {
  return {
    jobs: [{ project, schedule }],
    invites: TRADES.map((t) => ({ id: `p1-i-${t.company}`, package_id: `p1-${t.id}`, company_id: t.company, status: 'bid', invited_on: '2026-09-01' })),
    companies: TRADES.map((t) => ({ id: t.company, name: t.name })),
    sows: [],
    sowLines: [],
    draws: { draws: [], drawLines: [], reports: [] },
  }
}

/** The same rows through `src`'s own builders, as the office reads them. */
function srcState() {
  const rows = rowsOf()
  const board: BoardRows = {
    today: TODAY,
    projects: [gcProjectFromRows(project)],
    boardDates: {},
    customers: [],
    companies: rows.companies.map((c) => ({ id: c.id, name: c.name, trades: [], contact_name: '', phone: '', email: '', address: '', max_miles: null, license: '', lang: 'en', vetting_status: null, vetting_limit: null, vetting_decided_on: null, vetting_decided_by: null, vetting_note: '' })),
    invites: rows.invites.map((i) => ({ ...i, declined_why: null, decline_reason: null, decline_note: '', declined_on: null, plugs: null, exclusion_covers: null, taken_alternates: null })),
    quotes: [],
    contacts: [],
    promises: [],
    promiseMoves: [],
    sows: [],
    sowLines: [],
  }
  const empty = { parts: [], milestones: [], failures: [], moves: [], pushes: [], tells: [], answers: [], walks: [], marks: [], lateNotices: [], waits: [], waitHolds: [], crewCounts: [], sends: [], whatIf: null, rough: null }
  return withScheduleRows({ state: withoutOthersSendBacks(boardStateFromRows(board), MINE), projectId: 'p1', rows: { ...empty, ...schedule } as ScheduleRows, templates: [], names: new Map() })!
}

describe('the trade’s side of the schedule (P5d-ii)', () => {
  const { work, todos } = portalScheduleWorkFromRows(rowsOf(), MINE, TODAY, 'en')
  const p1 = work.p1!

  it('gives the dates of a move that only pushed its bars, and none it was not told of (gc 4’s amendment)', () => {
    expect(p1.dates.map((d) => d.moveId)).toEqual(['m-grading'])
    const [dates] = p1.dates
    expect(dates!.subject).toBe('Your dates moved on Stone Oak Retail')
    expect(dates!.lines[0]).toBe('The schedule on Stone Oak Retail moved. Your work is now planned for these days.')
    expect(dates!.lines.some((l) => l.startsWith('Footings:'))).toBe(true)
    expect(dates!.lines.some((l) => l.startsWith('Slab:'))).toBe(true)
    expect(dates!.lines.some((l) => l.includes('Rain held the grading.'))).toBe(true)
  })

  it('reads the dates in Spanish for a company that reads Spanish', () => {
    const es = portalScheduleWorkFromRows(rowsOf(), MINE, TODAY, 'es').work.p1!.dates[0]!
    expect(es.subject).toBe('Sus fechas cambiaron en Stone Oak Retail')
  })

  it('puts a late door on each of its own bars, with our push back on the slab and never who pressed it', () => {
    expect(p1.late.map((l) => l.lineId)).toEqual(['p1-sC1', 'p1-sC2'])
    const slab = p1.late.find((l) => l.lineId === 'p1-sC2')!
    expect(slab).toMatchObject({ start: '2026-10-14', finish: '2026-10-20', started: false, day: '2026-10-14' })
    expect(slab.notice).toEqual({
      id: 'n-slab',
      state: 'pushedBack',
      on: '2026-10-14',
      toStart: '2026-10-19',
      toFinish: '2026-10-25',
      reason: 'crew',
      note: 'Our pump truck is down.',
      pushedBack: { on: '2026-10-15', note: 'The framing needs the slab on its day.' },
      keptOn: null,
    })
    expect(p1.late.find((l) => l.lineId === 'p1-sC1')!.notice).toBeNull()
  })

  it('gives the look-ahead and the crew asks the office’s kernels give on the same rows', () => {
    const read = srcState()
    expect(p1.lookAhead.map((w) => [w.weekOf, w.when, w.items.map((i) => [i.lineId, i.state, i.canMark, i.mark?.reason ?? null])])).toEqual(
      portalLookAhead(read.state, MINE, read.project).map((w) => [w.weekOf, w.when, w.items.map((i) => [i.row.activity.lineId, i.state, i.canMark, i.mark?.reason ?? null])]),
    )
    expect(p1.crew).toEqual(
      portalCrewAsks(read.state, MINE, read.project).map((w) => ({ weekOf: w.weekOf, trades: w.trades.map((t) => ({ packageId: t.packageId, trade: t.trade, count: t.now?.count ?? null })) })),
    )
    expect(p1.crew.find((w) => w.weekOf === '2026-10-19')?.trades[0]).toEqual({ packageId: 'p1-kC', trade: 'Concrete', count: 4 })
  })

  it('gives the home its schedule to-dos: the dates to answer and the push back', () => {
    expect(todos.map((t) => t.key)).toEqual(expect.arrayContaining(['dates:m-grading', 'late:p1:n-slab']))
    expect(todos.every((t) => t.projectId === 'p1')).toBe(true)
  })

  it('never carries another company’s move, notice, count or check, a dollar, or who of ours pressed (the never-sees test)', () => {
    const json = JSON.stringify({ work, todos })
    for (const never of NEVER) expect(json, never).not.toContain(never)
    // Its own words do reach it, so the test pins both sides.
    for (const own of ['Rain held the grading.', 'Our pump truck is down.', 'The framing needs the slab on its day.', '"count":4']) expect(json, own).toContain(own)
  })

  it('gives no work on a job not being built', () => {
    const rows = rowsOf()
    const buyout = { ...rows, jobs: [{ project: { ...project, gc: { ...project.gc, stage: 'buyout' } }, schedule }] }
    expect(portalScheduleWorkFromRows(buyout, MINE, TODAY, 'en')).toEqual({ work: {}, todos: [] })
  })
})

describe('the late door’s second look (P5d-ii, call 4)', () => {
  it('names the work waiting directly on its bar and how much later it would start, never a price', () => {
    // The slab has not started, so the day is a new start and the bar moves whole: Oct 24 to 30, and the walls after it.
    const waiting = lateWaitingFromRows(rowsOf(), MINE, TODAY, 'p1-sC2', '2026-10-24')
    expect(waiting).toEqual([{ work: 'Wall framing', company: 'Frame Right', start: '2026-10-31', days: 10 }])
  })

  it('answers nothing for a bar not its own, a day not after the door’s, or a day not a day', () => {
    expect(lateWaitingFromRows(rowsOf(), MINE, TODAY, 'p1-sF1', '2026-10-30')).toBeNull()
    expect(lateWaitingFromRows(rowsOf(), MINE, TODAY, 'p1-sC2', '2026-10-14')).toBeNull()
    expect(lateWaitingFromRows(rowsOf(), MINE, TODAY, 'p1-sC2', 'soon')).toBeNull()
  })
})
