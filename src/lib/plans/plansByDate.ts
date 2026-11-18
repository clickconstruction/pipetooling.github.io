/**
 * Plans by date: the Development page's Plans look as a chart over time, beside the parts table. One lane
 * for the site's bids, one for each part with a mark for every set on the date printed on its sheets, one
 * for the site's trips when it has any (punch list #379: each trip a bar over its days, coloured day by day), one
 * for the days crews were on site and one for the lines kept on History, with today's line across them all
 * and every mark again as a dated line under the chart. It reads only what the page already holds: the
 * parts and sets (`sitePlans.ts`), the bids' sent days, the clock's days on the site's jobs and the kept
 * History entries. No money is on it, so the overview door draws it too.
 *
 * Pure, in three steps: `buildPlansByDate` turns rows into lanes, marks, the list and the four figures;
 * `layoutPlansByDate` turns those into shapes at a width (desktop, phone or paper), names that fit and
 * all; `plansByDatePrintHtml` is the one landscape page. The screen draws the same shapes
 * (`DevelopmentPlansByDate.tsx`), so the chart and its print cannot drift.
 */
import { HISTORY_SOURCE, historyVerb, type HistorySource } from '../developments/history'
import { scheduleLengthWords, scheduleStanding } from '../bids/bidSchedule'
import { isDrawingSet, kindLabel, PLAN_SET_KINDS, sourceWords, type PlanPartRow, type PlanSetRow } from './planSets'

const DAY_MS = 86_400_000
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/

/** A civil day as a whole number of days, so a chart can subtract them; null when the words are not a day. */
export function dayOfYmd(ymd: string | null | undefined): number | null {
  const m = YMD.exec(ymd ?? '')
  if (!m) return null
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isFinite(ms) ? Math.round(ms / DAY_MS) : null
}

export function ymdOfDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10)
}

/** *Nov 16, 2026*, or *Nov 16* with no year. */
export function dayWords(ymd: string, withYear = true): string {
  const m = YMD.exec(ymd)
  if (!m) return ymd
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}${withYear ? `, ${m[1]}` : ''}`
}

/** The first day of the month `n` months after the month a day is in. */
function monthStartAfter(day: number, n: number): number {
  const ymd = ymdOfDay(day)
  return Math.round(Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1 + n, 1) / DAY_MS)
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
export const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s)

/** *J1050, J1051 and 2 more*: the jobs of a bar, three named. */
export function jobsWords(labels: ReadonlyArray<string>): string {
  if (labels.length <= 3) return labels.join(', ')
  return `${labels.slice(0, 3).join(', ')} and ${labels.length - 3} more`
}

export type ToYmd = (raw: string | null | undefined) => string | null

export type PlansByDateBid = { id: string; label: string; sent: string | null; plansDated: string | null; outcome: string | null; outcomeAt: string | null; /** The bid's project name, for its card. */ name?: string | null; /** The bid's promised schedule (`bidSchedule.ts`): a start a person typed, and an end or no end date. No start, no schedule. */ scheduleStart?: string | null; scheduleEnd?: string | null; scheduleNoEnd?: boolean }

/** A job's days on site: the clock's days when the reader has them, and the job's own first and last work day. */
export type PlansByDateJob = { id: string; label: string; days: ReadonlyArray<string> | null; firstWorkDay: string | null; lastWorkDay: string | null; /** The job's name and the part it builds from, for the cards. */ name?: string | null; partId?: string | null }

export type PlansByDateHistory = { id: string; happenedAt: string; source: HistorySource; body: string; /** Who kept it, what it is about and the whole body's length when `body` is only its head, for its card. */ byName?: string | null; about?: string | null; bodyChars?: number }

/** A trip day's kind, as `lib/trips/tripDays.ts` names it. */
export type PbdTripKind = 'site' | 'road' | 'ready'

/**
 * A trip to the site (punch list #379), as `lib/trips/tripLane.ts` makes it from a kept trip: its days in
 * order with the trip's kind on each (null on a day nobody was on it), whether it is still ahead, and its words.
 */
export type PlansByDateTrip = {
  id: string
  days: ReadonlyArray<{ ymd: string; kind: PbdTripKind | null }>
  /** A trip whose first day is ahead: drawn faint, with a dashed edge. */
  planned: boolean
  /** *Oct 23 to Nov 4*. */
  when: string
  /** The trip by name, as its card's title and its bar's tip lead with it: *Trip 5 · Oct 23 to Nov 4*, or *Trip Oct 23 to Nov 4* for a trip made before numbers. */
  title: string
  /** *Trip 5*, for the dated list's line; null for a trip made before numbers. */
  number: string | null
  /** The press on its card that opens it in the Trips look: *Open Trip 5*, or *Open this trip*. */
  door: string
  /** *Back · 8 days at the site*, or *Planned*. */
  standing: string
  /** *Luis, Priya*. */
  who: string
  /** What the trip was for; empty when nobody wrote it. */
  why: string
}

/** How the clock's days came: read, still reading, failed, or closed to this reader (an estimator, a leader without payroll). */
export type PlansByDateClock = 'read' | 'reading' | 'failed' | 'closed'

export type PlansByDateInput = {
  parts: ReadonlyArray<Pick<PlanPartRow, 'id' | 'name' | 'position' | 'created_at' | 'current_set_id'>>
  sets: ReadonlyArray<Pick<PlanSetRow, 'id' | 'part_id' | 'name' | 'kind' | 'source' | 'dated' | 'came_at' | 'replaces_set_id'> & Partial<Pick<PlanSetRow, 'memo' | 'changes' | 'link' | 'created_by' | 'sheet_count'>>>
  bids: ReadonlyArray<PlansByDateBid>
  jobs: ReadonlyArray<PlansByDateJob>
  history: ReadonlyArray<PlansByDateHistory>
  /** The site's trips. Left out or empty, the chart has no Trips lane, so a site with no trip is unchanged. */
  trips?: ReadonlyArray<PlansByDateTrip>
  /** The people's names by user id, for *Added by* on a set's card. */
  names?: Readonly<Record<string, string>>
  clock: PlansByDateClock
  /** Today as a civil day in the app's time zone. */
  today: string
  /** A stamp or a civil date as a civil day in the app's time zone. */
  toYmd: ToYmd
}

/** What a mark is, which is also its shape: identity never rests on colour alone. */
export type PbdGlyph = 'set' | 'current' | 'undated' | 'ours' | 'bid' | 'bidPlans' | 'schedule' | 'scheduleOver' | 'trip' | 'crew' | 'crewOpen' | 'tick' | 'letter' | 'today' | 'cluster'

export type PbdMark = { key: string; glyph: PbdGlyph; day: number; label: string | null; strong: boolean; priority: number; tip: string }
/** A run of a trip's days of one kind, both ends in; `off` is a day in the trip's middle nobody was on it. */
export type PbdTripRun = { from: number; to: number; kind: PbdTripKind | 'off' }

export type PbdSpan = { key: string; glyph: 'crew' | 'crewOpen' | 'schedule' | 'scheduleOver' | 'trip'; from: number; to: number; tip: string; /** A schedule with no end date: its bar runs off the chart as an arrow. */ open?: boolean; /** Words inside a schedule's bar, at its start and at its end. */ startWords?: string; endWords?: string; /** A trip's bar, day by day: its runs of one kind. */ runs?: PbdTripRun[]; /** A planned trip: drawn faint. */ faint?: boolean }
export type PbdLane = {
  key: string
  kind: 'bids' | 'schedule' | 'part' | 'trips' | 'crew' | 'history'
  label: string
  sub: string
  marks: PbdMark[]
  spans: PbdSpan[]
  /** Dotted joins inside the lane: the plans a bid was priced from to the day it was sent. */
  joins: Array<{ from: number; to: number }>
  /** A part's line begins on the day of its first set. */
  lifeFrom: number | null
}

/** A line of the dated list under the chart. */
export type PbdRow = { key: string; day: number; ymd: string; lane: string; glyph: PbdGlyph; text: string; soft: string; bid: boolean; today: boolean }

export type PbdFigure = { key: 'first' | 'schedule' | 'since' | 'newest' | 'crew' | 'sheets'; label: string; value: string; sub: string; /** Past the schedule's end: the one figure drawn in red. */ over?: boolean; /** The bid whose schedule the figure reads. */ bidId?: string }

export type PlansByDateModel = {
  lanes: PbdLane[]
  /** The day one design became two parts: a set on one part that replaces a set on another. */
  links: Array<{ from: string; to: string; day: number }>
  rows: PbdRow[]
  figures: PbdFigure[]
  legend: Array<{ glyph: PbdGlyph; words: string }>
  /** The axis: whole months around everything drawn. */
  start: number
  end: number
  today: number
  /** The bids with no sent day, which have nowhere to stand. */
  unsentBids: string[]
  /** True when nothing but today has a date. */
  empty: boolean
}

/** A new bar starts when this many days pass with nobody on site: a weekend never breaks a bar, a week off does. */
export const CREW_RUN_GAP_DAYS = 7

export type CrewRun = { from: number; to: number; days: number; jobs: string[]; /** Each job on the bar with its own days in it, most days first. */ byJob: Array<{ label: string; days: number }> }

/** The clock's days on the site's jobs, joined into bars. A day two jobs share counts once. */
export function crewRuns(jobs: ReadonlyArray<{ label: string; days: ReadonlyArray<string> | null }>, gap = CREW_RUN_GAP_DAYS): CrewRun[] {
  const byDay = new Map<number, Set<string>>()
  for (const j of jobs) {
    for (const ymd of j.days ?? []) {
      const d = dayOfYmd(ymd)
      if (d == null) continue
      const set = byDay.get(d)
      if (set) set.add(j.label)
      else byDay.set(d, new Set([j.label]))
    }
  }
  const days = [...byDay.keys()].sort((a, b) => a - b)
  const runs: CrewRun[] = []
  let run: CrewRun | null = null
  let counts = new Map<string, number>()
  for (const d of days) {
    if (run && d - run.to <= gap) {
      run.to = d
      run.days += 1
    } else {
      counts = new Map<string, number>()
      run = { from: d, to: d, days: 1, jobs: [], byJob: [] }
      runs.push(run)
    }
    for (const l of byDay.get(d) ?? []) counts.set(l, (counts.get(l) ?? 0) + 1)
    run.jobs = [...counts.keys()].sort((x, y) => x.localeCompare(y, undefined, { numeric: true }))
    run.byJob = run.jobs.map((label) => ({ label, days: counts.get(label) ?? 0 })).sort((x, y) => y.days - x.days)
  }
  return runs
}

/**
 * A trip's days as runs of one kind, for its bar (punch list #379): consecutive days of the same kind join,
 * a day in the middle nobody was on is `off`, and a day that is not a day is dropped. Days are read in date
 * order whatever order they come in; a hole in the days starts a new run and is not drawn.
 */
export function tripRuns(days: ReadonlyArray<{ ymd: string; kind: PbdTripKind | null }>): PbdTripRun[] {
  const dated = days
    .map((d) => ({ day: dayOfYmd(d.ymd), kind: d.kind ?? ('off' as const) }))
    .filter((d): d is { day: number; kind: PbdTripKind | 'off' } => d.day != null)
    .sort((a, b) => a.day - b.day)
  const runs: PbdTripRun[] = []
  for (const d of dated) {
    const last = runs[runs.length - 1]
    if (last && last.kind === d.kind && d.day === last.to + 1) last.to = d.day
    else if (!last || d.day > last.to) runs.push({ from: d.day, to: d.day, kind: d.kind })
  }
  // A trip begins and ends on a day somebody was on it.
  while (runs.length && runs[0]?.kind === 'off') runs.shift()
  while (runs.length && runs[runs.length - 1]?.kind === 'off') runs.pop()
  return runs
}

/** A set we made ourselves: an as-built or an assembled set. It is not something we were issued, so the counts leave it out. */
export function isOurs(s: Pick<PlanSetRow, 'kind' | 'source'>): boolean {
  return s.source === 'ours' || PLAN_SET_KINDS.some((k) => k.kind === s.kind && k.ours)
}

export const isWon = (outcome: string | null) => {
  const o = (outcome ?? '').toLowerCase()
  return o === 'won' || o === 'started_or_complete'
}

/** *3 days ago*, *yesterday*, *today*. */
export function agoWords(days: number): string {
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

const GLYPH_WORDS: Record<Exclude<PbdGlyph, 'today' | 'cluster'>, string> = {
  set: 'a set, on the date on its sheets',
  current: 'the set a part builds from',
  undated: 'no date on the sheets, placed on the day it came',
  ours: 'ours, an as-built',
  bid: 'a bid sent',
  bidPlans: 'the plans a bid was priced from',
  schedule: 'a bid’s schedule, start to end',
  scheduleOver: 'past the schedule’s end',
  trip: 'a trip by day: ready, road, site, faint when planned',
  crew: 'crews on site',
  crewOpen: 'first to last work day',
  tick: 'a History line',
  letter: 'a letter',
}
const LEGEND_ORDER: ReadonlyArray<Exclude<PbdGlyph, 'today' | 'cluster'>> = ['set', 'current', 'undated', 'ours', 'bid', 'bidPlans', 'schedule', 'scheduleOver', 'trip', 'crew', 'crewOpen', 'tick', 'letter']

export function buildPlansByDate(input: PlansByDateInput): PlansByDateModel {
  const today = dayOfYmd(input.today) ?? 0
  const lanes: PbdLane[] = []
  const rows: PbdRow[] = []
  const links: PlansByDateModel['links'] = []
  const used = new Set<PbdGlyph>()
  const row = (r: Omit<PbdRow, 'ymd' | 'bid' | 'today'> & { bid?: boolean }) => rows.push({ ...r, ymd: ymdOfDay(r.day), bid: r.bid ?? false, today: false })

  // The bids, each on the day it was sent. "The bid" for the count is the first one won, else the first sent.
  const sentBids = input.bids
    .map((b) => ({ ...b, sentYmd: input.toYmd(b.sent), sentDay: dayOfYmd(input.toYmd(b.sent)) }))
    .filter((b): b is typeof b & { sentYmd: string; sentDay: number } => b.sentDay != null)
    .sort((a, b) => a.sentDay - b.sentDay || a.label.localeCompare(b.label, undefined, { numeric: true }))
  const anchor = sentBids.find((b) => isWon(b.outcome)) ?? sentBids[0] ?? null
  const bidLane: PbdLane = { key: 'bids', kind: 'bids', label: 'Bids', sub: sentBids.length ? `${sentBids.length} sent` : 'none sent yet', marks: [], spans: [], joins: [], lifeFrom: null }
  for (const b of sentBids) {
    const plansYmd = input.toYmd(b.plansDated)
    const plansDay = dayOfYmd(plansYmd)
    const outcomeYmd = input.toYmd(b.outcomeAt)
    const outcomeDay = dayOfYmd(outcomeYmd)
    const outcomeWord = isWon(b.outcome) ? 'won' : (b.outcome ?? '').toLowerCase() === 'lost' ? 'lost' : null
    const bits = [`${b.label} sent ${dayWords(b.sentYmd)}`]
    if (plansYmd && plansDay != null) bits.push(`priced from plans dated ${dayWords(plansYmd)}`)
    if (outcomeWord && outcomeYmd && outcomeDay != null) bits.push(`${outcomeWord} ${dayWords(outcomeYmd)}`)
    if (plansYmd && plansDay != null && plansDay < b.sentDay) {
      bidLane.joins.push({ from: plansDay, to: b.sentDay })
      bidLane.marks.push({ key: `bidplans-${b.id}`, glyph: 'bidPlans', day: plansDay, label: null, strong: false, priority: 0, tip: `${b.label} was priced from plans dated ${dayWords(plansYmd)}` })
      used.add('bidPlans')
    }
    bidLane.marks.push({ key: `bid-${b.id}`, glyph: 'bid', day: b.sentDay, label: b.label, strong: false, priority: (b === anchor ? 2 : 1) + b.sentDay / 1e6, tip: bits.join(' · ') })
    used.add('bid')
    row({ key: `bid-${b.id}`, day: b.sentDay, lane: 'Bids', glyph: 'bid', text: `${b.label} sent`, soft: plansYmd && plansDay != null ? `priced from plans dated ${dayWords(plansYmd)}` : '', bid: true })
    if (outcomeWord && outcomeDay != null) row({ key: `bidout-${b.id}`, day: outcomeDay, lane: 'Bids', glyph: 'bid', text: `${b.label} ${outcomeWord}`, soft: '' })
  }
  lanes.push(bidLane)

  // A bid's promised schedule: its own lane, from the start a person typed to the end, or off the chart with no end date.
  let scheduleFigure: PbdFigure | null = null
  const byStart = input.bids
    .map((b) => ({ ...b, startYmd: input.toYmd(b.scheduleStart), startDay: dayOfYmd(input.toYmd(b.scheduleStart)) }))
    .filter((b): b is typeof b & { startYmd: string; startDay: number } => b.startDay != null)
    .sort((a, b) => a.startDay - b.startDay)
  for (const b of byStart) {
    const endYmd = b.scheduleNoEnd ? null : input.toYmd(b.scheduleEnd)
    const endDay = dayOfYmd(endYmd)
    const end = endYmd && endDay != null && endDay >= b.startDay ? { ymd: endYmd, day: endDay } : null
    const standing = scheduleStanding({ start: b.startYmd, end: end?.ymd ?? null }, input.today)
    const range = `${dayWords(b.startYmd)} to ${end ? dayWords(end.ymd) : 'no end date'}`
    const lane: PbdLane = { key: `sched-${b.id}`, kind: 'schedule', label: 'Schedule', sub: `${b.label} · ${standing.words}`, marks: [], spans: [], joins: [], lifeFrom: null }
    lane.spans.push({ key: `sched-${b.id}`, glyph: 'schedule', from: b.startDay, to: end ? end.day : Math.max(today, b.startDay), open: !end, tip: `${b.label}’s schedule · ${range}${end ? ` · ${standing.words}` : ''}`, startWords: `starts ${dayWords(b.startYmd)}`, endWords: end ? `ends ${dayWords(end.ymd)}` : 'no end date' })
    used.add('schedule')
    if (end && standing.over) {
      lane.spans.push({ key: `schedover-${b.id}`, glyph: 'scheduleOver', from: end.day, to: today, tip: `${b.label}’s schedule ended ${dayWords(end.ymd)} · ${standing.words}`, endWords: standing.words })
      used.add('scheduleOver')
    }
    lanes.push(lane)
    row({ key: `schedstart-${b.id}`, day: b.startDay, lane: 'Schedule', glyph: 'schedule', text: `${b.label}’s schedule starts`, soft: end ? `ends ${dayWords(end.ymd)}` : 'no end date' })
    if (end) row({ key: `schedend-${b.id}`, day: end.day, lane: 'Schedule', glyph: standing.over ? 'scheduleOver' : 'schedule', text: `${b.label}’s schedule ends`, soft: `started ${dayWords(b.startYmd)}` })
    // The figure is the schedule of "the bid" when it has one, else the first to start.
    if (!scheduleFigure || b.id === anchor?.id) {
      const length = end ? scheduleLengthWords(b.startYmd, end.ymd) : ''
      scheduleFigure = end
        ? { key: 'schedule', label: 'Schedule ends', value: dayWords(end.ymd), sub: [standing.words, length, b.label].filter(Boolean).join(' · '), over: standing.over, bidId: b.id }
        : { key: 'schedule', label: 'Schedule', value: 'No end date', sub: `started ${dayWords(b.startYmd)} · ${b.label}`, bidId: b.id }
    }
  }
  const unsentBids = input.bids.filter((b) => dayOfYmd(input.toYmd(b.sent)) == null).map((b) => b.label)

  // One lane a part, in the parts table's order; papers are not drawings and are left out.
  const parts = [...input.parts].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
  const partById = new Map(parts.map((p) => [p.id, p]))
  const setById = new Map(input.sets.map((s) => [s.id, s]))
  type Dated = PlansByDateInput['sets'][number] & { day: number; ymd: string; partName: string }
  const issued: Dated[] = []
  for (const p of parts) {
    const mine: Dated[] = []
    for (const s of input.sets) {
      if (s.part_id !== p.id || !isDrawingSet(s)) continue
      const ymd = s.dated && dayOfYmd(s.dated) != null ? s.dated : input.toYmd(s.came_at)
      const day = dayOfYmd(ymd)
      if (ymd && day != null) mine.push({ ...s, day, ymd, partName: p.name })
    }
    mine.sort((a, b) => a.day - b.day || a.came_at.localeCompare(b.came_at))
    const lane: PbdLane = { key: p.id, kind: 'part', label: p.name, sub: mine.length ? plural(mine.length, 'set', 'sets') : 'no set yet', marks: [], spans: [], joins: [], lifeFrom: mine[0]?.day ?? null }
    for (const s of mine) {
      const ours = isOurs(s)
      const hasDate = s.dated != null && dayOfYmd(s.dated) != null
      const current = p.current_set_id === s.id
      const cameYmd = input.toYmd(s.came_at)
      const name = s.name.trim() || kindLabel(s.kind)
      const parent = s.replaces_set_id ? setById.get(s.replaces_set_id) : undefined
      const from = parent && parent.part_id !== p.id ? partById.get(parent.part_id) : undefined
      if (from) links.push({ from: from.id, to: p.id, day: s.day })
      const when = hasDate ? `dated ${dayWords(s.ymd)}${cameYmd && cameYmd !== s.ymd ? ` · came ${dayWords(cameYmd, cameYmd.slice(0, 4) !== s.ymd.slice(0, 4))}` : ''}` : `no date on the sheets · came ${dayWords(s.ymd)}`
      const glyph: PbdGlyph = ours ? 'ours' : !hasDate ? 'undated' : current ? 'current' : 'set'
      used.add(glyph)
      lane.marks.push({
        key: `set-${s.id}`,
        glyph,
        day: s.day,
        label: name,
        strong: current,
        // The set a part builds from keeps its name first; after it the newest, since that is the one a person looks for.
        priority: (current ? 2 : 1) + s.day / 1e6,
        tip: [name === kindLabel(s.kind) ? name : `${name} (${kindLabel(s.kind)})`, sourceWords(s.source), when, current ? `${p.name} builds from it` : '', from ? `the day ${p.name} split from ${from.name}` : ''].filter(Boolean).join(' · '),
      })
      row({ key: `set-${s.id}`, day: s.day, lane: p.name, glyph, text: current ? `${name}, the set it builds from` : name, soft: [sourceWords(s.source), hasDate ? '' : 'no date on the sheets, placed on the day it came', from ? `split from ${from.name}` : ''].filter(Boolean).join(' · ') })
      if (!ours) issued.push(s)
    }
    lanes.push(lane)
  }
  issued.sort((a, b) => a.day - b.day)

  // Trips (punch list #379), under the sets: each trip a bar over its days, coloured day by day by its kind, a planned
  // one faint. The lane is here only when the site has a trip, so every other site's chart is unchanged.
  const tripBars = (input.trips ?? [])
    .map((t) => ({ trip: t, runs: tripRuns(t.days) }))
    .filter((t) => t.runs.length > 0)
    .sort((a, b) => (a.runs[0]?.from ?? 0) - (b.runs[0]?.from ?? 0) || a.trip.id.localeCompare(b.trip.id))
  if (tripBars.length) {
    const plannedCount = tripBars.filter((t) => t.trip.planned).length
    const goneCount = tripBars.length - plannedCount
    const tripLane: PbdLane = { key: 'trips', kind: 'trips', label: 'Trips', sub: [goneCount ? plural(goneCount, 'trip', 'trips') : '', plannedCount ? `${plannedCount} planned` : ''].filter(Boolean).join(' · '), marks: [], spans: [], joins: [], lifeFrom: null }
    for (const { trip: t, runs } of tripBars) {
      const from = runs[0]?.from ?? 0
      const to = runs[runs.length - 1]?.to ?? from
      tripLane.spans.push({ key: `trip-${t.id}`, glyph: 'trip', from, to, runs, faint: t.planned, tip: [t.title, t.standing, t.who, t.why].filter(Boolean).join(' · ') })
      used.add('trip')
      row({ key: `trip-${t.id}`, day: from, lane: 'Trips', glyph: 'trip', text: `${t.planned ? `Planned ${t.number ?? 'trip'}` : (t.number ?? 'Trip')} ${from === to ? 'for the day' : `until ${dayWords(ymdOfDay(to), false)}`}`, soft: [t.who, t.why].filter(Boolean).join(' · ') })
    }
    lanes.push(tripLane)
  }

  // Crews on site: the clock's days joined into bars; a job the clock has no day for draws its first work day to its last.
  const clockJobs = input.clock === 'read' ? input.jobs.filter((j) => (j.days ?? []).length > 0) : []
  const runs = crewRuns(clockJobs)
  const clockDays = runs.reduce((n, r) => n + r.days, 0)
  const crewLane: PbdLane = { key: 'crew', kind: 'crew', label: 'Crews on site', sub: '', marks: [], spans: [], joins: [], lifeFrom: null }
  for (const r of runs) {
    const fromYmd = ymdOfDay(r.from)
    const toYmdWords = ymdOfDay(r.to)
    const range = r.from === r.to ? dayWords(fromYmd) : `${dayWords(fromYmd, fromYmd.slice(0, 4) !== toYmdWords.slice(0, 4))} to ${dayWords(toYmdWords)}`
    crewLane.spans.push({ key: `crew-${r.from}`, glyph: 'crew', from: r.from, to: r.to, tip: `Crews on site ${range} · ${plural(r.days, 'day', 'days')} · ${jobsWords(r.jobs)}` })
    used.add('crew')
    row({ key: `crew-${r.from}`, day: r.from, lane: 'Crews on site', glyph: 'crew', text: r.from === r.to ? 'On site for the day' : `On site until ${dayWords(toYmdWords, false)}, ${plural(r.days, 'day', 'days')}`, soft: jobsWords(r.jobs) })
  }
  const clockIds = new Set(clockJobs.map((j) => j.id))
  let lastOnSite: { day: number; label: string } | null = null
  for (const j of input.jobs) {
    const lastYmd = input.toYmd(j.lastWorkDay)
    const last = dayOfYmd(lastYmd)
    if (last != null && (!lastOnSite || last > lastOnSite.day)) lastOnSite = { day: last, label: j.label }
    // While the clock is still out nothing is drawn, so a bar never changes shape under the reader.
    if (clockIds.has(j.id) || input.clock === 'reading') continue
    const firstYmd = input.toYmd(j.firstWorkDay)
    const first = dayOfYmd(firstYmd)
    const from = first ?? last
    const to = last ?? first
    if (from == null || to == null) continue
    const lo = Math.min(from, to)
    const hi = Math.max(from, to)
    const one = lo === hi
    const tip = one ? `${j.label} · ${first != null && last == null ? 'first' : 'last'} work day ${dayWords(ymdOfDay(lo))}` : `${j.label} · first work day to last, ${dayWords(ymdOfDay(lo), ymdOfDay(lo).slice(0, 4) !== ymdOfDay(hi).slice(0, 4))} to ${dayWords(ymdOfDay(hi))} · the days between are not on the clock`
    crewLane.spans.push({ key: `job-${j.id}`, glyph: 'crewOpen', from: lo, to: hi, tip })
    used.add('crewOpen')
    row({ key: `job-${j.id}`, day: lo, lane: 'Crews on site', glyph: 'crewOpen', text: one ? `${first != null && last == null ? 'First' : 'Last'} work day` : `First work day, last on ${dayWords(ymdOfDay(hi), false)}`, soft: j.label })
  }
  crewLane.spans.sort((a, b) => a.from - b.from)
  crewLane.sub =
    input.clock === 'reading'
      ? 'reading the clock…'
      : input.clock === 'failed'
        ? 'the clock did not read'
        : input.clock === 'closed'
          ? crewLane.spans.length ? 'each job’s work days' : 'no work day yet'
          : clockDays ? `${plural(clockDays, 'day', 'days')} by the clock` : crewLane.spans.length ? 'each job’s work days' : 'no day on site yet'
  lanes.push(crewLane)

  // The lines kept on History: a tick each, and a flag for paper.
  const kept = input.history
    .map((h) => ({ ...h, ymd: input.toYmd(h.happenedAt), day: dayOfYmd(input.toYmd(h.happenedAt)) }))
    .filter((h): h is typeof h & { ymd: string; day: number } => h.day != null)
    .sort((a, b) => a.day - b.day)
  const histLane: PbdLane = { key: 'history', kind: 'history', label: 'History', sub: kept.length ? `${plural(kept.length, 'line', 'lines')} kept` : 'no line kept yet', marks: [], spans: [], joins: [], lifeFrom: null }
  for (const h of kept) {
    const letter = h.source === 'letter'
    const verb = HISTORY_SOURCE[h.source] ? historyVerb(h.source) : 'Note'
    const body = h.body.replace(/\s+/g, ' ').trim()
    const glyph: PbdGlyph = letter ? 'letter' : 'tick'
    used.add(glyph)
    histLane.marks.push({ key: `hist-${h.id}`, glyph, day: h.day, label: letter ? 'Letter' : null, strong: false, priority: 1 + h.day / 1e6, tip: `${verb} · ${dayWords(h.ymd)} · ${clip(body, 160)}` })
    row({ key: `hist-${h.id}`, day: h.day, lane: 'History', glyph, text: clip(body, 200), soft: verb })
  }
  lanes.push(histLane)

  const empty = lanes.every((l) => l.marks.length === 0 && l.spans.length === 0)
  rows.push({ key: 'today', day: today, ymd: ymdOfDay(today), lane: '', glyph: 'today', text: 'Today', soft: '', bid: false, today: true })
  // Oldest first, so the list reads as the story it is; the sort keeps the lanes' own order within a day.
  rows.sort((a, b) => a.day - b.day)

  const all = [today]
  for (const l of lanes) {
    for (const m of l.marks) all.push(m.day)
    for (const s of l.spans) all.push(s.from, s.to)
  }
  const start = monthStartAfter(Math.min(...all) - 6, 0)
  const end = monthStartAfter(Math.max(...all) + 12, 1)

  // The four figures.
  const figures: PbdFigure[] = []
  const first = issued[0]
  if (scheduleFigure) figures.push(scheduleFigure)
  else figures.push(first ? { key: 'first', label: 'First drawings', value: dayWords(first.ymd), sub: first.dated ? 'the oldest date on any sheet' : 'the day the first set came' } : { key: 'first', label: 'First drawings', value: 'None yet', sub: 'no set on any part' })
  if (anchor) {
    const since = issued.filter((s) => s.day > anchor.sentDay).length
    figures.push({ key: 'since', label: 'Sets since the bid', value: String(since), sub: `of ${issued.length}, since ${anchor.label} was sent ${dayWords(anchor.sentYmd)}` })
  } else {
    figures.push({ key: 'since', label: 'Sets', value: String(issued.length), sub: `on ${plural(parts.length, 'part', 'parts')} · no bid sent yet` })
  }
  const newest = issued[issued.length - 1]
  figures.push(newest ? { key: 'newest', label: 'Newest set', value: dayWords(newest.ymd), sub: `${newest.partName} · ${newest.dated ? '' : 'came '}${agoWords(today - newest.day)}` } : { key: 'newest', label: 'Newest set', value: 'None yet', sub: 'no set on any part' })
  const firstRun = runs[0]
  if (input.clock === 'read' && firstRun) figures.push({ key: 'crew', label: 'Days on site', value: String(clockDays), sub: `by the clock, first on ${dayWords(ymdOfDay(firstRun.from))}` })
  else if (lastOnSite) figures.push({ key: 'crew', label: 'Last on site', value: dayWords(ymdOfDay(lastOnSite.day)), sub: `${lastOnSite.label} · ${agoWords(today - lastOnSite.day)}` })
  else figures.push({ key: 'crew', label: 'Days on site', value: input.clock === 'reading' ? '…' : 'None yet', sub: input.clock === 'reading' ? 'reading the clock' : input.clock === 'failed' ? 'the clock did not read' : 'no work day on any job' })

  // Sheets in hand: the sheets of the sets being built from, against the sheets we held when the bid was sent.
  // The figure is drawn only once someone has counted a set, and it says how many sets are still uncounted.
  const sheets = plansByDateSheets(issued, parts, anchor ? anchor.sentDay : null)
  if (sheets) figures.push({ key: 'sheets', label: 'Sheets in hand', value: sheets.now.toLocaleString('en-US'), sub: [anchor ? `${sheets.atBid.toLocaleString('en-US')} at the bid` : 'in the sets being built from', sheets.uncounted ? `${sheets.uncounted} ${sheets.uncounted === 1 ? 'set' : 'sets'} not counted` : ''].filter(Boolean).join(' · ') })

  const legend = LEGEND_ORDER.filter((g) => used.has(g)).map((glyph) => ({ glyph, words: GLYPH_WORDS[glyph] }))
  return { lanes, links, rows, figures, legend, start, end, today, unsentBids, empty }
}

/**
 * The sheets in hand: `now` adds the sheet counts of the sets the parts build from; `atBid` adds, part by part,
 * the newest set we held on the day the bid was sent; `uncounted` is how many of the sets being built from
 * nobody has counted. Null until some set on the site has a count.
 */
export function plansByDateSheets(
  issued: ReadonlyArray<{ id: string; part_id: string; day: number; sheet_count?: number | null }>,
  parts: ReadonlyArray<{ id: string; current_set_id: string | null }>,
  bidDay: number | null,
): { now: number; atBid: number; uncounted: number } | null {
  if (!issued.some((s) => s.sheet_count != null)) return null
  let now = 0
  let atBid = 0
  let uncounted = 0
  for (const p of parts) {
    const mine = issued.filter((s) => s.part_id === p.id)
    const current = mine.find((s) => s.id === p.current_set_id)
    if (current) {
      if (current.sheet_count != null) now += current.sheet_count
      else uncounted += 1
    }
    if (bidDay != null) {
      const held = mine.filter((s) => s.day <= bidDay).sort((a, b) => b.day - a.day)[0]
      if (held?.sheet_count != null) atBid += held.sheet_count
    }
  }
  return { now, atBid, uncounted }
}

/** The lines of the list that are a drawing or a bid: what the owner's chart listed under it, *every issue*. */
const ISSUE_GLYPHS: ReadonlySet<PbdGlyph> = new Set(['set', 'current', 'undated', 'ours', 'bid', 'schedule', 'scheduleOver'])

export type PlansByDateList = {
  rows: PbdRow[]
  /** The drawing and bid lines on the site. */
  issues: number
  /** The crew and History lines left out of `rows`; 0 when they are in. */
  hidden: number
  /** True when `rows` is the drawings and the bids alone. */
  issuesOnly: boolean
}

/**
 * The lines the list under the chart shows (punch list #367, from the first look at a real site, where most of the
 * lines were kept emails and the drawing issues were buried among them). It opens on the drawings and the bids,
 * as the owner's hand chart did; `withLog` adds the crews' days and the History lines. Today's line is always in.
 * A site with no drawing or bid line lists everything, since there is nothing else to show.
 */
export function plansByDateListRows(rows: ReadonlyArray<PbdRow>, withLog: boolean): PlansByDateList {
  const issues = rows.filter((r) => ISSUE_GLYPHS.has(r.glyph)).length
  const issuesOnly = !withLog && issues > 0
  if (!issuesOnly) return { rows: [...rows], issues, hidden: 0, issuesOnly }
  const kept = rows.filter((r) => r.today || ISSUE_GLYPHS.has(r.glyph))
  return { rows: kept, issues, hidden: rows.length - kept.length, issuesOnly }
}

/** The list's head: *The drawings and the bids · 18 lines*, or *Every dated line on the chart · 64 lines*. Today's line is not counted. */
export function plansByDateListHead(list: Pick<PlansByDateList, 'rows' | 'issuesOnly'>): { title: string; count: string } {
  const n = list.rows.filter((r) => !r.today).length
  return { title: list.issuesOnly ? 'The drawings and the bids' : 'Every dated line on the chart', count: plural(n, 'line', 'lines') }
}

/** The print's line under the list when it leaves the log out. */
export const PLANS_BY_DATE_PRINT_LIST_NOTE = 'The list shows the drawings and the bids. The crews’ days and the History lines are on the chart.'
/** The same line on a site with a Trips lane. */
export const PLANS_BY_DATE_PRINT_LIST_NOTE_TRIPS = 'The list shows the drawings and the bids. The trips, the crews’ days and the History lines are on the chart.'

/** What the list leaves out until asked, in the press's words: *crew and History*, or *trip, crew and History* on a site with trips. */
export function plansByDateLogWords(model: Pick<PlansByDateModel, 'lanes'>): string {
  return model.lanes.some((l) => l.kind === 'trips') ? 'trip, crew and History' : 'crew and History'
}

/** The same press's hover line: what it adds to the list, the trips named on a site that has them. */
export function plansByDateLogTitle(model: Pick<PlansByDateModel, 'lanes'>): string {
  return model.lanes.some((l) => l.kind === 'trips') ? 'Lists the trips, the crews’ days and the lines kept on History too' : 'Lists the crews’ days and the lines kept on History too'
}

/** *2 bids have no sent day, so they are not on the chart: B12, B14.* Null when every bid has one. */
export function plansByDateUnsentWords(labels: ReadonlyArray<string>): string | null {
  if (labels.length === 0) return null
  return `${labels.length === 1 ? '1 bid has' : `${labels.length} bids have`} no sent day, so ${labels.length === 1 ? 'it is' : 'they are'} not on the chart: ${jobsWords(labels)}.`
}

/** The words under the chart about the crew lane, when it is not the clock's days. Null when it is. */
export function plansByDateCrewNote(clock: PlansByDateClock): string | null {
  if (clock === 'closed') return 'The clock’s days read for the office. This lane shows each job’s own work days.'
  if (clock === 'failed') return 'The clock did not read, so the crew lane shows each job’s own work days.'
  if (clock === 'reading') return 'Reading the clock’s days…'
  return null
}

// ── The axis ──────────────────────────────────────────────────────────────────

export type PbdTick = { day: number; month: number; year: string; labelled: boolean; first: boolean }

/** A tick a month; a label every 1, 2, 3, 6 or 12 months, whichever keeps the labels apart at this width. */
export function plansByDateTicks(start: number, end: number, plotWidth: number): PbdTick[] {
  const days: number[] = []
  for (let d = monthStartAfter(start, 0); d <= end && days.length < 600; d = monthStartAfter(d, 1)) days.push(d)
  const perMonth = plotWidth / Math.max(1, days.length - 1)
  const step = [1, 2, 3, 6, 12].find((s) => s * perMonth >= 34) ?? 12
  return days.map((day, i) => {
    const ymd = ymdOfDay(day)
    const month = Number(ymd.slice(5, 7))
    return { day, month, year: ymd.slice(0, 4), labelled: (month - 1) % step === 0, first: i === 0 }
  })
}

// ── Names that fit ────────────────────────────────────────────────────────────

export type PbdLabelSpot = { cx: number; slot: 'above' | 'below'; /** The name's left and right edges. */ l: number; r: number }

/**
 * Which marks get their name drawn, and where: the highest priority first, above its mark, else below it,
 * else left to the hover and the list. A name is nudged inside the plot's edges, never clipped by them.
 */
export function placePlansByDateLabels<T extends { x: number; label: string; strong: boolean; priority: number }>(
  items: ReadonlyArray<T>,
  x0: number,
  x1: number,
  /** Names already drawn in the gap above this lane, under the lane before it: an *above* name may not stand on them. */
  takenAbove: ReadonlyArray<{ l: number; r: number }> = [],
): Map<T, PbdLabelSpot> {
  const taken: Array<{ l: number; r: number; slot: 'above' | 'below' }> = takenAbove.map((t) => ({ l: t.l, r: t.r, slot: 'above' as const }))
  const out = new Map<T, PbdLabelSpot>()
  for (const it of [...items].sort((a, b) => b.priority - a.priority)) {
    const w = it.label.length * (it.strong ? 6.2 : 5.6) + 6
    if (w > x1 - x0) continue
    const cx = Math.min(Math.max(it.x, x0 + w / 2), x1 - w / 2)
    for (const slot of ['above', 'below'] as const) {
      const l = cx - w / 2
      const r = cx + w / 2
      if (taken.some((t) => t.slot === slot && t.l < r + 4 && l < t.r + 4)) continue
      taken.push({ l, r, slot })
      out.set(it, { cx, slot, l, r })
      break
    }
  }
  return out
}

// ── The shapes ────────────────────────────────────────────────────────────────

/** What a shape is, for its paint: the screen maps each to a theme token, the paper to a literal. */
export type PbdClass =
  | 'tickWord' | 'yearWord' | 'laneWord' | 'subWord' | 'markWord' | 'markWordStrong' | 'todayWord'
  | 'grid' | 'gridYear' | 'rule' | 'base' | 'life' | 'link' | 'bidJoin' | 'today' | 'todayPill'
  | 'set' | 'setOpen' | 'ring' | 'bid' | 'bidOpen' | 'schedule' | 'scheduleOver' | 'barWord' | 'crew' | 'crewOpen' | 'history' | 'letter' | 'letterPole' | 'hit'
  | 'tripSite' | 'tripRoad' | 'tripReady' | 'tripOff' | 'tripPlanned'

export type PbdPrim =
  | { t: 'line'; cls: PbdClass; x1: number; y1: number; x2: number; y2: number }
  | { t: 'rect'; cls: PbdClass; x: number; y: number; w: number; h: number; rx: number; turn?: boolean; /** Drawn faint: a planned trip's days. */ faint?: boolean }
  | { t: 'circle'; cls: PbdClass; cx: number; cy: number; r: number }
  | { t: 'path'; cls: PbdClass; d: string }
  | { t: 'text'; cls: PbdClass; x: number; y: number; anchor: 'start' | 'middle' | 'end'; text: string; tail?: string }

/** One mark with its hover line; `cx` and `top` say where the hover line stands. */
export type PbdMarkShape = { key: string; tip: string; prims: PbdPrim[]; hit: PbdPrim; cx: number; top: number; /** The marks a burst bar stands for. */ members?: string[] }

export type PlansByDateLayout = { width: number; height: number; back: PbdPrim[]; marks: PbdMarkShape[]; labels: PbdPrim[]; summary: string; /** How many bursts of sets were drawn as one bar at this width, for the key. */ clusters: number; /** Where a lane's name is, so it can take a pointer; `today` is the pill. */ nameHits: Array<{ key: string; label: string; x: number; y: number; w: number; h: number }> }

export type PlansByDateVariant = 'desktop' | 'phone' | 'paper'

const r1 = (n: number) => Math.round(n * 10) / 10

/** The width each shape is drawn at when the screen has not measured its own yet; paper is always this wide. */
export const PLANS_BY_DATE_WIDTH: Record<PlansByDateVariant, number> = { desktop: 980, phone: 358, paper: 980 }
export const PLANS_BY_DATE_MIN_WIDTH = 280
export const PLANS_BY_DATE_MAX_WIDTH = 1600
/** Narrower than this the lanes are named over themselves, as on a phone: a gutter would leave the marks no room. */
export const PLANS_BY_DATE_NARROW = 620
/** Sets closer than this many pixels, three or more in a row, are drawn as one bar with their count. */
export const PLANS_BY_DATE_CLUSTER_GAP = 7
export const PLANS_BY_DATE_CLUSTER_MIN = 3
/** A lane with more letters than this drops the word *Letter* from each flag. */
export const PLANS_BY_DATE_LETTER_WORDS = 3
/** The longest a set's name is drawn on the chart, in characters; the card, the list and the hover line keep the whole name. */
export const PLANS_BY_DATE_NAME_MAX = 32
export const PLANS_BY_DATE_NAME_MAX_PHONE = 24
const SET_GLYPHS: ReadonlySet<PbdGlyph> = new Set(['set', 'current', 'undated', 'ours'])

const SEPARATORS = /[\s\-–—,:;/|·]+$/
/** What a cut name may not end on before its ellipsis: a separator, or the stop of an abbreviation (*Const.…*). */
const CUT_END = /[\s\-–—,:;/|·.]+$/
/**
 * A set's name as the chart draws it beside its mark (punch list #367, from the first look at a real site, where
 * names ran 32 to 65 characters and the longest, the set a part builds from, did not fit a phone at all). The date
 * the mark stands on comes off, since the axis already says it: *Tower B - 44 Construction - 2026-09-14* reads
 * *Tower B - 44 Construction*, and *(2026-03-02, ours)* reads *(ours)*. A date that differs from the mark's stays.
 * Then a name longer than `max` is cut at the last whole word that fits, with an ellipsis, and never ends on a
 * separator. A name that was only its date stays whole.
 */
export function plansByDateChartName(name: string, ymd: string, max: number): string {
  const whole = name.replace(/\s+/g, ' ').trim()
  let short = whole
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    const d = ymd.replace(/-/g, '\\-')
    short = short
      .replace(new RegExp(`\\(\\s*${d}\\s*\\)|\\[\\s*${d}\\s*\\]`, 'g'), ' ')
      .replace(new RegExp(`([(\\[])\\s*${d}\\s*[,;]\\s*`, 'g'), '$1')
      .replace(new RegExp(`\\s*[,;]\\s*${d}\\s*([)\\]])`, 'g'), '$1')
      .replace(new RegExp(`\\s*(?:[-–—:|/·]\\s*)?${d}(?=\\s|$|[\\[(])`, 'g'), ' ')
      .replace(/\s+/g, ' ')
      .replace(SEPARATORS, '')
      .trim()
    if (!short) short = whole
  }
  if (short.length <= max) return short
  const room = short.slice(0, max)
  const space = room.lastIndexOf(' ')
  const cut = (space >= Math.floor(max / 2) ? room.slice(0, space) : short.slice(0, max - 1)).replace(CUT_END, '')
  return `${cut}…`
}

/** The key's words for a burst of sets drawn as one bar. */
export const PLANS_BY_DATE_CLUSTER_WORDS = 'several sets close together'

/** How faint a planned trip's days are drawn, on the screen and on paper. */
export const PLANS_BY_DATE_FAINT = 0.45
/** The narrowest a trip's bar is drawn, so a one-day trip on a long axis is still a mark. */
export const PLANS_BY_DATE_TRIP_MIN_WIDTH = 5

const TRIP_CLASS: Record<PbdTripRun['kind'], PbdClass> = { site: 'tripSite', road: 'tripRoad', ready: 'tripReady', off: 'tripOff' }

/**
 * A trip's bar (punch list #379): one rectangle for each run of days of one kind, a day wide for each day,
 * so the bar is coloured day by day on the chart's own axis. A bar too narrow to split is one rectangle in
 * the kind that leads the trip: At the site when any day was, else On the road, else Getting ready. A
 * planned trip is drawn faint inside a dashed edge, so it never rests on faintness alone.
 */
export function tripBarShape(s: Pick<PbdSpan, 'key' | 'tip' | 'from' | 'to' | 'runs' | 'faint'>, x: (day: number) => number, y: number): PbdMarkShape {
  const x1 = x(s.from)
  const natural = x(s.to + 1) - x1
  const w = r1(Math.max(PLANS_BY_DATE_TRIP_MIN_WIDTH, natural))
  const runs = s.runs ?? []
  const lead = (['site', 'road', 'ready'] as const).find((k) => runs.some((r) => r.kind === k)) ?? 'off'
  const prims: PbdPrim[] =
    natural >= PLANS_BY_DATE_TRIP_MIN_WIDTH && runs.length > 1
      ? runs.map((r): PbdPrim => {
          const rx1 = x(r.from)
          return { t: 'rect', cls: TRIP_CLASS[r.kind], x: rx1, y: y - 6, w: r1(Math.max(1, x(r.to + 1) - rx1)), h: 12, rx: 0, faint: s.faint }
        })
      : [{ t: 'rect', cls: TRIP_CLASS[runs.length === 1 ? (runs[0]?.kind ?? lead) : lead], x: x1, y: y - 6, w, h: 12, rx: 2, faint: s.faint }]
  if (s.faint) prims.push({ t: 'rect', cls: 'tripPlanned', x: r1(x1 - 1), y: y - 7, w: r1(w + 2), h: 14, rx: 2 })
  return { key: s.key, tip: s.tip, cx: r1(x1 + w / 2), top: y - 10, prims, hit: { t: 'rect', cls: 'hit', x: r1(x1 - 2), y: y - 13, w: r1(w + 4), h: 26, rx: 0 } }
}

/**
 * The chart as shapes at a width. On a desktop and on paper the lanes are named in a gutter at the left; on a
 * phone each lane's name sits over it and only the bids, the letters and the set each part builds from keep
 * their names, since the list under the chart has the rest. The screen hands in the width it has
 * (`measured`), so a word is drawn at its true size at any width and the names that fit are worked out for
 * the room there really is; paper is always its own width.
 */
export function layoutPlansByDate(model: PlansByDateModel, variant: PlansByDateVariant, measured?: number): PlansByDateLayout {
  const phone = variant === 'phone'
  const width = variant === 'paper' || !measured || !Number.isFinite(measured) ? PLANS_BY_DATE_WIDTH[variant] : Math.round(Math.min(Math.max(measured, PLANS_BY_DATE_MIN_WIDTH), PLANS_BY_DATE_MAX_WIDTH))
  const gutter = phone ? 6 : 150
  const right = phone ? 8 : 18
  const laneH = phone ? 70 : variant === 'paper' ? 43 : 50
  const axisH = 46
  // On a phone the lane's name has the first line to itself, so a mark's name never runs into it.
  const baseOff = phone ? 45 : variant === 'paper' ? 24 : 27
  const span = Math.max(1, model.end - model.start)
  const x = (day: number) => r1(gutter + ((day - model.start) / span) * (width - gutter - right))
  const height = axisH + model.lanes.length * laneH + 6
  const baseY = (i: number) => axisH + i * laneH + baseOff
  const back: PbdPrim[] = []
  const marks: PbdMarkShape[] = []
  const labels: PbdPrim[] = []
  const nameHits: PlansByDateLayout['nameHits'] = []

  for (const t of plansByDateTicks(model.start, model.end, width - gutter - right)) {
    const tx = x(t.day)
    if (t.labelled || t.month === 1) back.push({ t: 'line', cls: t.month === 1 ? 'gridYear' : 'grid', x1: tx, x2: tx, y1: axisH - 4, y2: height - 6 })
    // A month's or a year's word is drawn only where the whole of it fits inside the chart.
    if (t.labelled && tx + 3 + 3 * 6.4 <= width) back.push({ t: 'text', cls: 'tickWord', x: tx + 3, y: axisH - 22, anchor: 'start', text: MONTHS[t.month - 1] ?? '' })
    if ((t.month === 1 || t.first) && tx + 3 + 4 * 6.6 <= width) back.push({ t: 'text', cls: 'yearWord', x: tx + 3, y: axisH - 9, anchor: 'start', text: t.year })
  }

  model.lanes.forEach((lane, i) => {
    const y = baseY(i)
    const top = axisH + i * laneH
    if (i > 0) back.push({ t: 'line', cls: 'rule', x1: 0, x2: width, y1: top, y2: top })
    nameHits.push(phone ? { key: `lane-${lane.key}`, label: lane.label, x: 0, y: top + 1, w: width, h: 17 } : { key: `lane-${lane.key}`, label: lane.label, x: 0, y: top + 4, w: gutter - 4, h: laneH - 8 })
    if (phone) back.push({ t: 'text', cls: 'laneWord', x: gutter, y: top + 13, anchor: 'start', text: clip(lane.label, 30), tail: lane.sub })
    else {
      back.push({ t: 'text', cls: 'laneWord', x: 4, y: y - 1, anchor: 'start', text: clip(lane.label, 21) })
      back.push({ t: 'text', cls: 'subWord', x: 4, y: y + 13, anchor: 'start', text: clip(lane.sub, 26) })
    }
    back.push({ t: 'line', cls: 'base', x1: gutter, x2: width - right, y1: y, y2: y })
    if (lane.lifeFrom != null) back.push({ t: 'line', cls: 'life', x1: x(lane.lifeFrom), x2: Math.max(x(lane.lifeFrom), x(model.today)), y1: y, y2: y })
    for (const j of lane.joins) back.push({ t: 'line', cls: 'bidJoin', x1: x(j.from), x2: x(j.to), y1: y, y2: y })
    for (const s of lane.spans) {
      const x1 = x(s.from)
      if (s.glyph === 'schedule' || s.glyph === 'scheduleOver') {
        // A schedule with no end date runs to the chart's right edge and ends in an arrow.
        const x2 = s.open ? width - right : x(s.to)
        const w = r1(Math.max(4, x2 - x1))
        const over = s.glyph === 'scheduleOver'
        const cls: PbdClass = over ? 'scheduleOver' : 'schedule'
        const body: PbdPrim = s.open ? { t: 'path', cls, d: `M${x1} ${y - 8} H${r1(x1 + w - 9)} L${r1(x1 + w)} ${y} L${r1(x1 + w - 9)} ${y + 8} H${x1} Z` } : { t: 'rect', cls, x: x1, y: y - 8, w, h: 16, rx: 3 }
        marks.push({ key: s.key, tip: s.tip, cx: r1(x1 + w / 2), top: y - 10, prims: [body], hit: { t: 'rect', cls: 'hit', x: x1 - 2, y: y - 13, w: w + 4, h: 26, rx: 0 } })
        // The words inside the bar are drawn only where the bar has room for them; the card and the list have them either way.
        if (!phone) {
          const startW = (s.startWords?.length ?? 0) * 6.2 + 12
          const endW = (s.endWords?.length ?? 0) * 6.2 + (s.open ? 22 : 12)
          if (s.endWords && w >= endW) labels.push({ t: 'text', cls: 'barWord', x: r1(x1 + w - (s.open ? 15 : 6)), y: y + 3.5, anchor: 'end', text: s.endWords })
          if (s.startWords && w >= startW + endW + 10) labels.push({ t: 'text', cls: 'barWord', x: x1 + 6, y: y + 3.5, anchor: 'start', text: s.startWords })
        }
        continue
      }
      if (s.glyph === 'trip') {
        marks.push(tripBarShape(s, x, y))
        continue
      }
      const open = s.glyph === 'crewOpen'
      const w = r1(Math.max(open ? 6 : 3, x(s.to) - x1))
      marks.push({ key: s.key, tip: s.tip, cx: r1(x1 + w / 2), top: y - 9, prims: [{ t: 'rect', cls: open ? 'crewOpen' : 'crew', x: x1, y: y - 5, w, h: 10, rx: 4 }], hit: { t: 'rect', cls: 'hit', x: x1 - 2, y: y - 13, w: w + 4, h: 26, rx: 0 } })
    }
  })

  const laneIndex = new Map(model.lanes.map((l, i) => [l.key, i]))
  for (const k of model.links) {
    const a = laneIndex.get(k.from)
    const b = laneIndex.get(k.to)
    if (a == null || b == null) continue
    back.push({ t: 'line', cls: 'link', x1: x(k.day), x2: x(k.day), y1: baseY(a), y2: baseY(b) })
  }

  const tx = x(model.today)
  const todayWords = `Today · ${dayWords(ymdOfDay(model.today), false)}`
  const pillW = 86
  const px = r1(Math.min(Math.max(tx - pillW / 2, gutter), width - pillW - 1))
  back.push({ t: 'line', cls: 'today', x1: tx, x2: tx, y1: 15, y2: height - 6 })
  back.push({ t: 'rect', cls: 'todayPill', x: px, y: 0, w: pillW, h: 15, rx: 7.5 })
  back.push({ t: 'text', cls: 'todayWord', x: px + pillW / 2, y: 11, anchor: 'middle', text: todayWords })
  nameHits.push({ key: 'today', label: todayWords, x: px, y: 0, w: pillW, h: 15 })

  let clusters = 0
  // The gap between two lanes holds one row of names: the names drawn under one lane stand in the way of the next lane's names above.
  let belowLastLane: Array<{ l: number; r: number }> = []
  model.lanes.forEach((lane, i) => {
    const y = baseY(i)
    const xs = lane.marks.map((m) => x(m.day))
    const inCluster = new Set<PbdMark>()
    const clusterNames: Array<{ x: number; label: string; strong: boolean; priority: number; glyph: PbdGlyph }> = []
    // A burst of sets too close to tell apart is drawn as one bar with its count; its line names them.
    for (let a = 0; a < lane.marks.length; ) {
      let b = a
      while (lane.marks[b]?.glyph === 'set' && lane.marks[b + 1]?.glyph === 'set' && (xs[b + 1] ?? 0) - (xs[b] ?? 0) < PLANS_BY_DATE_CLUSTER_GAP) b += 1
      const run = lane.marks.slice(a, b + 1)
      const first = run[0]
      const last = run[run.length - 1]
      if (first && last && run.length >= PLANS_BY_DATE_CLUSTER_MIN) {
        const x1 = xs[a] ?? 0
        const x2 = xs[b] ?? x1
        for (const m of run) inCluster.add(m)
        clusters += 1
        const names = run.map((m) => m.label ?? '').filter(Boolean)
        const tip = `${run.length} sets · ${dayWords(ymdOfDay(first.day), ymdOfDay(first.day).slice(0, 4) !== ymdOfDay(last.day).slice(0, 4))} to ${dayWords(ymdOfDay(last.day))} · ${jobsWords(names)}`
        marks.push({ key: `cluster-${first.key}`, tip, cx: r1((x1 + x2) / 2), top: y - 8, members: run.map((m) => m.key), prims: [{ t: 'rect', cls: 'set', x: x1 - 5, y: y - 5, w: r1(x2 - x1 + 10), h: 10, rx: 5 }], hit: { t: 'rect', cls: 'hit', x: x1 - 7, y: y - 13, w: r1(x2 - x1 + 14), h: 26, rx: 0 } })
        clusterNames.push({ x: r1((x1 + x2) / 2), label: `${run.length} sets`, strong: false, priority: 1.9, glyph: 'set' })
      }
      a = b + 1
    }
    for (const m of lane.marks) {
      if (inCluster.has(m)) continue
      const mx = x(m.day)
      let prims: PbdPrim[]
      let top = y - 8
      if (m.glyph === 'current') {
        prims = [{ t: 'circle', cls: 'ring', cx: mx, cy: y, r: 9.5 }, { t: 'circle', cls: 'set', cx: mx, cy: y, r: 6 }]
        top = y - 12
      } else if (m.glyph === 'set') prims = [{ t: 'circle', cls: 'set', cx: mx, cy: y, r: 5 }]
      else if (m.glyph === 'undated') prims = [{ t: 'circle', cls: 'setOpen', cx: mx, cy: y, r: 4.5 }]
      else if (m.glyph === 'ours') prims = [{ t: 'rect', cls: 'set', x: mx - 5, y: y - 5, w: 10, h: 10, rx: 1.5 }]
      else if (m.glyph === 'bid') prims = [{ t: 'rect', cls: 'bid', x: mx - 5.5, y: y - 5.5, w: 11, h: 11, rx: 1.5, turn: true }]
      else if (m.glyph === 'bidPlans') prims = [{ t: 'rect', cls: 'bidOpen', x: mx - 3.5, y: y - 3.5, w: 7, h: 7, rx: 1, turn: true }]
      else if (m.glyph === 'letter') {
        prims = [{ t: 'line', cls: 'letterPole', x1: mx, x2: mx, y1: y - 11, y2: y + 6 }, { t: 'path', cls: 'letter', d: `M${mx} ${y - 12} l10 4 l-10 4 z` }]
        top = y - 14
      } else prims = [{ t: 'line', cls: 'history', x1: mx, x2: mx, y1: y - 6, y2: y + 6 }]
      marks.push({ key: m.key, tip: m.tip, prims, cx: mx, top, hit: { t: 'circle', cls: 'hit', cx: mx, cy: y, r: 12 } })
    }
    // A few letters each keep their word; past that the flag and the key say it, and the word would only crowd.
    const letters = lane.marks.filter((m) => m.glyph === 'letter').length
    const named = [
      ...lane.marks
        .filter((m): m is PbdMark & { label: string } => m.label != null && !inCluster.has(m) && (m.glyph !== 'letter' || letters <= PLANS_BY_DATE_LETTER_WORDS) && (!phone || m.glyph === 'current' || m.glyph === 'bid' || m.glyph === 'letter'))
        // A set's name is drawn short: its own date comes off (the axis says it) and a long name is cut at a word.
        .map((m) => ({ x: x(m.day), label: SET_GLYPHS.has(m.glyph) ? plansByDateChartName(m.label, ymdOfDay(m.day), phone ? PLANS_BY_DATE_NAME_MAX_PHONE : PLANS_BY_DATE_NAME_MAX) : m.label, strong: m.strong, priority: m.priority, glyph: m.glyph })),
      ...clusterNames,
    ]
    const spots = placePlansByDateLabels(named, gutter, width - right, belowLastLane)
    belowLastLane = [...spots.values()].filter((sp) => sp.slot === 'below').map((sp) => ({ l: sp.l, r: sp.r }))
    for (const [it, spot] of spots) {
      labels.push({ t: 'text', cls: it.strong ? 'markWordStrong' : 'markWord', x: r1(spot.cx), y: spot.slot === 'above' ? y - (it.glyph === 'letter' ? 16 : 13) : y + 21, anchor: 'middle', text: it.label })
    }
  })

  const summary = `Plans by date: ${plural(model.lanes.length, 'lane', 'lanes')} from ${dayWords(ymdOfDay(model.start))} to ${dayWords(ymdOfDay(model.end))}. The list under the chart says the same in words.`
  return { width, height, back, marks, labels, summary, clusters, nameHits }
}

// ── The paint ─────────────────────────────────────────────────────────────────

/** The colours a shape can wear, by name: the screen gives each a theme token, the paper a literal. */
export type PbdInk = 'set' | 'bid' | 'bidWash' | 'over' | 'overWash' | 'crew' | 'tripSite' | 'tripRoad' | 'tripReady' | 'strong' | 'text' | 'muted' | 'surface' | 'border' | 'borderStrong'

export type PbdPaint = { fill?: PbdInk | 'none' | 'transparent'; stroke?: PbdInk; strokeWidth?: number; dash?: string; opacity?: number; fontSize?: number; fontWeight?: number; round?: boolean; /** A word that can cross a line: it wears a thin edge in the surface's colour, so the line never runs through its letters. */ halo?: boolean }

/** One paint table for the screen and the paper, so a mark means the same on both. */
export const PBD_PAINT: Record<PbdClass, PbdPaint> = {
  tickWord: { fill: 'muted', fontSize: 10.5 },
  yearWord: { fill: 'text', fontSize: 10.5, fontWeight: 700 },
  laneWord: { fill: 'strong', fontSize: 12, fontWeight: 600, halo: true },
  subWord: { fill: 'muted', fontSize: 10.5, halo: true },
  markWord: { fill: 'text', fontSize: 10.5, halo: true },
  markWordStrong: { fill: 'strong', fontSize: 10.5, fontWeight: 700, halo: true },
  todayWord: { fill: 'surface', fontSize: 10.5, fontWeight: 700 },
  grid: { stroke: 'border', strokeWidth: 1, opacity: 0.55 },
  gridYear: { stroke: 'borderStrong', strokeWidth: 1, opacity: 0.9 },
  rule: { stroke: 'border', strokeWidth: 1, opacity: 0.6 },
  base: { stroke: 'border', strokeWidth: 1 },
  life: { stroke: 'borderStrong', strokeWidth: 2, round: true },
  link: { fill: 'none', stroke: 'set', strokeWidth: 1.5, dash: '3 3' },
  bidJoin: { stroke: 'bid', strokeWidth: 1.5, dash: '2 3' },
  today: { stroke: 'strong', strokeWidth: 1, dash: '4 3' },
  todayPill: { fill: 'strong' },
  set: { fill: 'set', stroke: 'surface', strokeWidth: 2 },
  setOpen: { fill: 'surface', stroke: 'set', strokeWidth: 2 },
  ring: { fill: 'none', stroke: 'set', strokeWidth: 1.5 },
  bid: { fill: 'bid', stroke: 'surface', strokeWidth: 2 },
  bidOpen: { fill: 'surface', stroke: 'bid', strokeWidth: 1.5 },
  crew: { fill: 'crew' },
  crewOpen: { fill: 'none', stroke: 'crew', strokeWidth: 1.5, dash: '4 3' },
  history: { stroke: 'muted', strokeWidth: 1.5 },
  letter: { fill: 'strong', stroke: 'surface', strokeWidth: 1.5 },
  letterPole: { stroke: 'strong', strokeWidth: 1.5 },
  schedule: { fill: 'bidWash', stroke: 'bid', strokeWidth: 1 },
  scheduleOver: { fill: 'overWash', stroke: 'over', strokeWidth: 1 },
  barWord: { fill: 'strong', fontSize: 10.5, fontWeight: 600 },
  tripSite: { fill: 'tripSite' },
  tripRoad: { fill: 'tripRoad' },
  tripReady: { fill: 'tripReady' },
  tripOff: { fill: 'borderStrong' },
  tripPlanned: { fill: 'none', stroke: 'text', strokeWidth: 1, dash: '3 2' },
  hit: { fill: 'transparent' },
}

/** Paper has no theme, so its colours are literal, as on the other print documents. */
/** A trip day's colour by its kind on paper: the hexes of `TRIP_KIND_COLOR` (`components/trips/TripDayBits.tsx`), which the screen draws; a test holds the two together. */
export const PBD_TRIP_INK: Readonly<Record<PbdTripKind, string>> = { site: '#16a34a', road: '#2563eb', ready: '#d97706' }
const PAPER_INK: Record<PbdInk, string> = { set: '#eb6834', bid: '#7c3aed', bidWash: '#eadffc', over: '#b91c1c', overWash: '#fee2e2', crew: '#0f9a8a', tripSite: PBD_TRIP_INK.site, tripRoad: PBD_TRIP_INK.road, tripReady: PBD_TRIP_INK.ready, strong: '#111827', text: '#374151', muted: '#6b7280', surface: '#ffffff', border: '#cfd4db', borderStrong: '#aab2bd' }

/** A glyph for a legend entry or a list row, as shapes in a small box centred on 0,0. */
export function plansByDateGlyph(glyph: PbdGlyph): { width: number; height: number; prims: PbdPrim[] } {
  switch (glyph) {
    case 'set':
      return { width: 12, height: 12, prims: [{ t: 'circle', cls: 'set', cx: 0, cy: 0, r: 4.5 }] }
    case 'current':
      return { width: 16, height: 16, prims: [{ t: 'circle', cls: 'ring', cx: 0, cy: 0, r: 7 }, { t: 'circle', cls: 'set', cx: 0, cy: 0, r: 4.5 }] }
    case 'undated':
      return { width: 12, height: 12, prims: [{ t: 'circle', cls: 'setOpen', cx: 0, cy: 0, r: 4 }] }
    case 'ours':
      return { width: 12, height: 12, prims: [{ t: 'rect', cls: 'set', x: -4.5, y: -4.5, w: 9, h: 9, rx: 1.5 }] }
    case 'bid':
      return { width: 14, height: 14, prims: [{ t: 'rect', cls: 'bid', x: -4.5, y: -4.5, w: 9, h: 9, rx: 1.5, turn: true }] }
    case 'bidPlans':
      return { width: 12, height: 12, prims: [{ t: 'rect', cls: 'bidOpen', x: -3, y: -3, w: 6, h: 6, rx: 1, turn: true }] }
    case 'crew':
      return { width: 22, height: 12, prims: [{ t: 'rect', cls: 'crew', x: -11, y: -4, w: 22, h: 8, rx: 4 }] }
    case 'crewOpen':
      return { width: 22, height: 12, prims: [{ t: 'rect', cls: 'crewOpen', x: -10, y: -4, w: 20, h: 8, rx: 4 }] }
    case 'letter':
      return { width: 14, height: 14, prims: [{ t: 'line', cls: 'letterPole', x1: -4, x2: -4, y1: -6, y2: 6 }, { t: 'path', cls: 'letter', d: 'M-4 -6 l9 3.5 l-9 3.5 z' }] }
    case 'schedule':
      return { width: 22, height: 12, prims: [{ t: 'rect', cls: 'schedule', x: -10.5, y: -5, w: 21, h: 10, rx: 3 }] }
    case 'scheduleOver':
      return { width: 22, height: 12, prims: [{ t: 'rect', cls: 'scheduleOver', x: -10.5, y: -5, w: 21, h: 10, rx: 3 }] }
    case 'trip':
      return { width: 24, height: 12, prims: [{ t: 'rect', cls: 'tripReady', x: -11, y: -4, w: 5, h: 8, rx: 0 }, { t: 'rect', cls: 'tripRoad', x: -6, y: -4, w: 5, h: 8, rx: 0 }, { t: 'rect', cls: 'tripSite', x: -1, y: -4, w: 12, h: 8, rx: 0 }] }
    case 'cluster':
      return { width: 22, height: 12, prims: [{ t: 'rect', cls: 'set', x: -10, y: -4.5, w: 20, h: 9, rx: 4.5 }] }
    case 'today':
      return { width: 8, height: 12, prims: [{ t: 'line', cls: 'today', x1: 0, x2: 0, y1: -6, y2: 6 }] }
    default:
      return { width: 8, height: 12, prims: [{ t: 'line', cls: 'history', x1: 0, x2: 0, y1: -5, y2: 5 }] }
  }
}

// ── The paper ─────────────────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;'))

function paperAttrs(cls: PbdClass): string {
  const p = PBD_PAINT[cls]
  const a: string[] = []
  if (p.fill) a.push(`fill="${p.fill === 'none' || p.fill === 'transparent' ? 'none' : PAPER_INK[p.fill]}"`)
  if (p.stroke) a.push(`stroke="${PAPER_INK[p.stroke]}"`)
  if (p.strokeWidth != null) a.push(`stroke-width="${p.strokeWidth}"`)
  if (p.dash) a.push(`stroke-dasharray="${p.dash}"`)
  if (p.opacity != null) a.push(`opacity="${p.opacity}"`)
  if (p.round) a.push('stroke-linecap="round"')
  if (p.fontSize != null) a.push(`font-size="${p.fontSize}"`)
  if (p.fontWeight != null) a.push(`font-weight="${p.fontWeight}"`)
  if (p.halo) a.push(`paint-order="stroke" stroke="${PAPER_INK.surface}" stroke-width="3" stroke-linejoin="round"`)
  return a.join(' ')
}

function paperPrim(p: PbdPrim): string {
  const a = paperAttrs(p.cls)
  if (p.t === 'line') return `<line ${a} x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}"/>`
  if (p.t === 'circle') return `<circle ${a} cx="${p.cx}" cy="${p.cy}" r="${p.r}"/>`
  if (p.t === 'path') return `<path ${a} d="${p.d}"/>`
  if (p.t === 'rect') return `<rect ${a} x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${p.rx}"${p.faint ? ` opacity="${PLANS_BY_DATE_FAINT}"` : ''}${p.turn ? ` transform="rotate(45 ${r1(p.x + p.w / 2)} ${r1(p.y + p.h / 2)})"` : ''}/>`
  return `<text ${a} x="${p.x}" y="${p.y}" text-anchor="${p.anchor}">${esc(p.text)}${p.tail ? `<tspan ${paperAttrs('subWord')} font-weight="400" dx="6">${esc(p.tail)}</tspan>` : ''}</text>`
}

/** The chart as an SVG string in paper's colours: the desktop shapes with no hover layer. */
export function plansByDatePaperSvg(layout: PlansByDateLayout): string {
  const body = [...layout.back, ...layout.marks.flatMap((m) => m.prims), ...layout.labels].map(paperPrim).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-label="${esc(layout.summary)}" font-family="-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif">${body}</svg>`
}

function paperGlyph(glyph: PbdGlyph): string {
  const g = plansByDateGlyph(glyph)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${g.width}" height="${g.height}" viewBox="${-g.width / 2} ${-g.height / 2} ${g.width} ${g.height}">${g.prims.map(paperPrim).join('')}</svg>`
}

/**
 * The print page: one landscape sheet with the site, the four figures, the chart, the key and the dated list in
 * three columns; a long list runs onto a second page. Pure; `openHtmlPrintWindow` opens it.
 */
export function plansByDatePrintHtml(input: { siteName: string; customerName: string | null; model: PlansByDateModel; notes: ReadonlyArray<string>; printedAt: string; printedBy: string | null; /** The list as the screen shows it: the crews' days and the History lines too, or not. Left out, the drawings and the bids alone, so the page stays one page. */ withLog?: boolean }): string {
  const { model } = input
  const layout = layoutPlansByDate(model, 'paper')
  const svg = plansByDatePaperSvg(layout)
  const stamp = `Printed ${input.printedAt}${input.printedBy ? ` by ${input.printedBy}` : ''}`
  const figures = model.figures.map((f) => `<div class="fig"><div class="k">${esc(f.label)}</div><div class="v"${f.over ? ' style="color:#b91c1c"' : ''}>${esc(f.value)}</div><div class="s">${esc(f.sub)}</div></div>`).join('')
  const keyItems = layout.clusters > 0 ? [...model.legend, { glyph: 'cluster' as const, words: PLANS_BY_DATE_CLUSTER_WORDS }] : model.legend
  const key = keyItems.map((l) => `<span>${paperGlyph(l.glyph)}${esc(l.words)}</span>`).join('')
  const listed = plansByDateListRows(model.rows, input.withLog === true)
  const notes = listed.hidden > 0 ? [...input.notes, model.lanes.some((l) => l.kind === 'trips') ? PLANS_BY_DATE_PRINT_LIST_NOTE_TRIPS : PLANS_BY_DATE_PRINT_LIST_NOTE] : input.notes
  const list = listed.rows
    .filter((r) => !r.today)
    .map((r) => `<div><span class="d">${esc(dayWords(r.ymd))}</span><span>${r.lane ? `${esc(r.lane)}: ` : ''}${esc(r.text)}${r.soft ? ` <em>· ${esc(r.soft)}</em>` : ''}</span></div>`)
    .join('\n')
  return `<!doctype html>
<html lang="en" data-theme="light"><head><meta charset="utf-8"><title>${esc(input.siteName)} · plans by date</title>
<style>
@page { size: landscape; margin: 10mm; }
body { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; color: #111827; margin: 0; padding: 12px; background: #ffffff; }
.head { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1.5px solid #111827; padding-bottom: 4px; margin-bottom: 8px; }
h1 { font-size: 17px; margin: 0; }
.head span { font-size: 12px; color: #4b5563; }
.figs { display: grid; grid-template-columns: repeat(${model.figures.length}, 1fr); gap: 8px; margin-bottom: 6px; }
.fig { border: 1px solid #cfd4db; border-radius: 6px; padding: 3px 8px; }
.fig .k { font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
.fig .v { font-size: 15px; font-weight: 700; }
.fig .s { font-size: 9.5px; color: #6b7280; }
.chart svg { width: 100%; height: auto; display: block; }
.key { display: flex; flex-wrap: wrap; gap: 2px 12px; font-size: 9.5px; color: #374151; margin: 4px 0 6px; }
.key span { display: inline-flex; align-items: center; gap: 4px; }
.note { font-size: 9.5px; color: #6b7280; margin: 0 0 4px; }
.list { columns: 3; column-gap: 18px; font-size: 9.5px; line-height: 1.4; color: #374151; }
.list div { break-inside: avoid; display: flex; gap: 6px; }
.list .d { flex: none; width: 66px; white-space: nowrap; color: #111827; font-variant-numeric: tabular-nums; }
.list em { font-style: normal; color: #6b7280; }
.stamp { font-size: 9px; color: #6b7280; margin-top: 8px; }
</style></head><body>
<div class="head"><h1>${esc(input.siteName)} · plans by date</h1><span>${esc(input.customerName ?? '')}</span></div>
<div class="figs">${figures}</div>
<div class="chart">${svg}</div>
<div class="key">${key}</div>
${notes.map((n) => `<p class="note">${esc(n)}</p>`).join('\n')}
<div class="list">
${list}
</div>
<p class="stamp">${esc(stamp)}</p>
</body></html>`
}
