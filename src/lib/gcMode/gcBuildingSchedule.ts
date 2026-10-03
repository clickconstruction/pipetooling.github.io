/**
 * GC mode — design spike: the schedule (Building lane). The owner's shape (2026-10-02): several
 * activities per trade, which are the lines of its statement of work (or the stages our own crew
 * runs); we draw the dates and what waits on what; Start locks it as the baseline. Four measures
 * are read in Building: work done against the plan, spare days (the critical path), milestones hit
 * within a few days, and how often the look-ahead's activities get done as planned.
 *
 * Days are calendar days in the prototype. Import from `./gcModel`, which re-exports this file.
 */
import type { GcProject, GcState, LookAheadMark, LookAheadReason, ProjectSchedule, ScheduleActivity, ScheduleMilestone, TradePackage } from './gcTypes'
import { carriedAmount } from './gcBids'
import { scheduleDraft } from './gcNewProject'
import { partnerById } from './gcLookups'
import { addDays, crewStages, sentBackOpen } from './gcBuilding'
import { shortDate } from './gcWords'

/** How many weeks the look-ahead shows (owner, 2026-10-02: three). */
export const LOOKAHEAD_WEEKS = 3
/** A milestone counts as hit up to this many days after its planned day (owner: "a few days"; 3 is the default). */
export const MILESTONE_GRACE_DAYS = 3
/** How many past weeks the look-ahead's reliability is read over. My default. */
export const RELIABILITY_WEEKS = 4

function dayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000
}

/** Days from `a` to `b`: 0 on the same day, negative when `b` comes first. */
export function daysBetween(a: string, b: string): number {
  return Math.round(dayNumber(b) - dayNumber(a))
}

/** The Monday of the week `iso` falls in. */
export function mondayOf(iso: string): string {
  const dow = new Date(dayNumber(iso) * 86_400_000).getUTCDay()
  return addDays(iso, -((dow + 6) % 7))
}

/** How much of an activity a plan has done by `on`, straight across its days: 0 before, 100 after. */
export function plannedPct(start: string, finish: string, on: string): number {
  const days = daysBetween(start, finish) + 1
  const done = daysBetween(start, on) + 1
  if (done <= 0) return 0
  if (done >= days) return 100
  return (done / days) * 100
}

export interface ScheduleRow {
  activity: ScheduleActivity
  pkg: TradePackage
  trade: string
  label: string
  /** The company doing it, or "Our own crew". */
  company: string
  /** What the line is worth, in dollars. */
  worth: number
  /** Percent done: what the trade reported, or what we see on a line we sent back. */
  actual: number
  /** The plan the baseline locked at Start. The current plan when nothing is locked yet. */
  baseline: { start: string; finish: string }
  /** Percent the baseline planned by today. */
  plannedToday: number
  /** Days the current finish moved past the baseline's. */
  slipDays: number
}

/**
 * A line's name, worth and percent done, whether a hired trade's or our own crew's stage. Before a
 * trade has a statement of work (while buying out), its scope lines stand in, each an even share
 * of the number we carry. A schedule-of-values line keeps its scope line's id, so the two match.
 */
function lineOf(pkg: TradePackage, lineId: string): { label: string; worth: number; actual: number } | null {
  const self = pkg.selfPerform
  if (self) {
    const stage = crewStages(pkg).find((st) => st.lineId === lineId)
    if (!stage) return null
    return { label: stage.label, worth: (self.value * stage.weight) / 100, actual: self.pctByLine?.[lineId] ?? self.pctDone ?? 0 }
  }
  const sow = pkg.sow
  if (!sow) {
    const item = pkg.scope.find((l) => l.id === lineId)
    if (!item) return null
    return { label: item.label, worth: (carriedAmount(pkg) ?? pkg.budget) / Math.max(1, pkg.scope.length), actual: 0 }
  }
  const line = sow.sov.find((l) => l.id === lineId)
  if (!line) return null
  const weSee = sentBackOpen(sow)?.lines.find((l) => l.sovId === lineId)?.weSee
  return { label: line.label, worth: line.amount, actual: weSee ?? line.pctReported }
}

/** The lines a trade's activities are drawn from: its schedule of values, or its scope before one. */
export function scheduleLinesOf(pkg: TradePackage): { lineId: string; label: string }[] {
  if (pkg.sow && !pkg.selfPerform) return pkg.sow.sov.map((l) => ({ lineId: l.id, label: l.label }))
  return pkg.scope.map((l) => ({ lineId: l.id, label: l.label }))
}

/**
 * The first draft to draw from: the New Project lane's draft from the stages of the job
 * (`scheduleDraft` in gcNewProject.ts: the rough-ins side by side after framing, close-in after
 * the inspection, the trims after the finishes). The Draw a first draft button calls this.
 */
export function draftSchedule(project: GcProject, start: string): ProjectSchedule {
  return scheduleDraft(project, start)
}

/**
 * The plan at Start, kept as the baseline (owner: Start locks it). The Board lane's Start does not
 * touch the schedule, so the first change after Start keeps the plan as it stood: until a change,
 * the plan is the plan at Start.
 */
export function withBaselineKept(project: GcProject, schedule: ProjectSchedule): ProjectSchedule {
  if (!project.startedOn || schedule.baseline) return schedule
  return {
    ...schedule,
    baseline: { lockedOn: project.startedOn, activities: Object.fromEntries(schedule.activities.map((a) => [a.lineId, { start: a.start, finish: a.finish }])) },
  }
}

function companyOf(state: GcState, pkg: TradePackage): string {
  if (pkg.selfPerform) return 'Our own crew'
  const invite = pkg.invites.find((i) => i.id === pkg.awardedInviteId)
  return (invite ? partnerById(state, invite.partnerId)?.company : undefined) ?? pkg.trade
}

/** Every activity on the schedule with its trade, worth, percent done and what the baseline planned by today. */
export function scheduleRows(state: GcState, project: GcProject): ScheduleRow[] {
  const schedule = project.schedule
  if (!schedule) return []
  return schedule.activities.flatMap((activity) => {
    const pkg = project.packages.find((k) => k.id === activity.packageId)
    const line = pkg ? lineOf(pkg, activity.lineId) : null
    if (!pkg || !line) return []
    const baseline = schedule.baseline?.activities[activity.lineId] ?? { start: activity.start, finish: activity.finish }
    return [
      {
        activity,
        pkg,
        trade: pkg.trade,
        label: line.label,
        company: companyOf(state, pkg),
        worth: line.worth,
        actual: line.actual,
        baseline,
        plannedToday: plannedPct(baseline.start, baseline.finish, state.today),
        slipDays: daysBetween(baseline.finish, activity.finish),
      },
    ]
  })
}

/**
 * Work done against the plan, weighted by dollars the way the Building ring weighs work. Days
 * behind: how long ago the baseline planned to have this much done (negative: ahead).
 */
export function workVsPlan(rows: ScheduleRow[], today: string): { donePct: number; plannedPct: number; daysBehind: number } {
  const total = rows.reduce((s, r) => s + r.worth, 0)
  if (total === 0) return { donePct: 0, plannedPct: 0, daysBehind: 0 }
  const done = rows.reduce((s, r) => s + (r.worth * r.actual) / 100, 0)
  const plannedOn = (on: string) => rows.reduce((s, r) => s + (r.worth * plannedPct(r.baseline.start, r.baseline.finish, on)) / 100, 0)
  const first = rows.reduce((m, r) => (r.baseline.start < m ? r.baseline.start : m), rows[0]?.baseline.start ?? today)
  const last = rows.reduce((m, r) => (r.baseline.finish > m ? r.baseline.finish : m), rows[0]?.baseline.finish ?? today)
  // The first day the baseline had this much done. Done is never above everything, so one is found.
  let when = last
  for (let on = first; on <= last; on = addDays(on, 1)) {
    if (plannedOn(on) >= done - 0.5) {
      when = on
      break
    }
  }
  return { donePct: (done / total) * 100, plannedPct: (plannedOn(today) / total) * 100, daysBehind: daysBetween(when, today) }
}

/**
 * Spare days for each activity on the current plan: how long it could slip before it moves the
 * job's last finish. Zero is the critical path. An activity starts on its planned day or the day
 * after everything it waits on finishes, whichever is later.
 */
export function scheduleFloat(activities: ScheduleActivity[]): Map<string, number> {
  const byId = new Map(activities.map((a) => [a.lineId, a]))
  const duration = (a: ScheduleActivity) => daysBetween(a.start, a.finish) + 1
  // Work in an order where every activity comes after what it waits on. A loop falls back to the drawn order.
  const order: ScheduleActivity[] = []
  const placed = new Set<string>()
  const place = (a: ScheduleActivity, seen: Set<string>) => {
    if (placed.has(a.lineId) || seen.has(a.lineId)) return
    seen.add(a.lineId)
    for (const id of a.after) {
      const before = byId.get(id)
      if (before) place(before, seen)
    }
    placed.add(a.lineId)
    order.push(a)
  }
  for (const a of activities) place(a, new Set())
  const earlyFinish = new Map<string, number>()
  for (const a of order) {
    const waits = a.after.map((id) => earlyFinish.get(id)).filter((n): n is number => n !== undefined)
    const start = Math.max(dayNumber(a.start), ...waits.map((n) => n + 1))
    earlyFinish.set(a.lineId, start + duration(a) - 1)
  }
  const end = Math.max(...earlyFinish.values())
  const lateFinish = new Map<string, number>()
  for (const a of [...order].reverse()) {
    const next = activities.filter((x) => x.after.includes(a.lineId))
    const lateStarts = next.map((x) => (lateFinish.get(x.lineId) ?? end) - duration(x) + 1)
    lateFinish.set(a.lineId, lateStarts.length > 0 ? Math.min(...lateStarts) - 1 : end)
  }
  return new Map(activities.map((a) => [a.lineId, Math.round((lateFinish.get(a.lineId) ?? end) - (earlyFinish.get(a.lineId) ?? end))]))
}

export type MilestoneState = 'hit' | 'missed' | 'late' | 'due'

export interface MilestoneRow {
  milestone: ScheduleMilestone
  state: MilestoneState
  /** The company it belongs to, through its trade. Null: the job's own. */
  company: string | null
  /** Days past the planned day: when met, or by today when not. */
  daysLate: number
}

/**
 * Each milestone: hit when met within the grace days, missed when met later, late when the grace
 * passed and it is not met, due otherwise.
 */
export function milestoneRows(state: GcState, project: GcProject): MilestoneRow[] {
  return (project.schedule?.milestones ?? []).map((milestone) => {
    const pkg = milestone.packageId ? project.packages.find((k) => k.id === milestone.packageId) : undefined
    const company = pkg ? companyOf(state, pkg) : null
    const daysLate = daysBetween(milestone.planned, milestone.metOn ?? state.today)
    const stateOf: MilestoneState = milestone.metOn
      ? daysLate <= MILESTONE_GRACE_DAYS
        ? 'hit'
        : 'missed'
      : daysLate > MILESTONE_GRACE_DAYS
        ? 'late'
        : 'due'
    return { milestone, state: stateOf, company, daysLate }
  })
}

/** Hit out of every milestone already decided (hit, missed, or late with the grace passed). */
export function milestoneHitRate(rows: MilestoneRow[]): { hit: number; of: number } {
  const decided = rows.filter((r) => r.state !== 'due')
  return { hit: decided.filter((r) => r.state === 'hit').length, of: decided.length }
}

export type LookAheadState = 'done' | 'not' | 'waiting' | 'unmarked'

/** A look-ahead mark as it counts: the superintendent's mark once verified, else waiting. */
export function markState(mark: LookAheadMark | null): LookAheadState {
  if (!mark) return 'unmarked'
  if (!mark.verifiedOn) return 'waiting'
  return (mark.verifiedDone ?? mark.done) ? 'done' : 'not'
}

export interface LookAheadWeek {
  weekOf: string
  items: { row: ScheduleRow; mark: LookAheadMark | null; state: LookAheadState }[]
}

/**
 * The look-ahead: this week and the next two (LOOKAHEAD_WEEKS), each listing the activities the
 * current plan has running that week and not finished, with the week's mark when there is one.
 */
export function lookAheadWeeks(project: GcProject, rows: ScheduleRow[], today: string): LookAheadWeek[] {
  const marks = project.schedule?.lookAhead ?? []
  const first = mondayOf(today)
  return Array.from({ length: LOOKAHEAD_WEEKS }, (_, i) => {
    const weekOf = addDays(first, i * 7)
    const weekEnd = addDays(weekOf, 6)
    const items = rows
      .filter((r) => {
        const mark = marks.find((m) => m.weekOf === weekOf && m.lineId === r.activity.lineId)
        const running = r.activity.start <= weekEnd && r.activity.finish >= weekOf
        return mark !== undefined || (running && r.actual < 100)
      })
      .map((row) => {
        const mark = marks.find((m) => m.weekOf === weekOf && m.lineId === row.activity.lineId) ?? null
        return { row, mark, state: markState(mark) }
      })
    return { weekOf, items }
  })
}

/** Why not, as it counts: the superintendent's reason when they corrected the mark, else the trade's. */
export function markReason(mark: LookAheadMark): LookAheadReason | null {
  return mark.verifiedReason ?? mark.reason ?? null
}

export interface VerifyItem {
  mark: LookAheadMark
  row: ScheduleRow
}

/**
 * The superintendent's verify list (owner, 2026-10-02): every trade mark not verified yet, oldest
 * week first, with its activity. And our own crew's activities in this week's look-ahead with no
 * mark yet: we mark those ourselves, and our mark counts as verified.
 */
export function verifyList(project: GcProject, rows: ScheduleRow[], today: string): { waiting: VerifyItem[]; ourCrew: ScheduleRow[] } {
  const marks = project.schedule?.lookAhead ?? []
  const byLine = new Map(rows.map((r) => [r.activity.lineId, r]))
  const waiting = marks
    .filter((m) => !m.verifiedOn)
    .flatMap((mark) => {
      const row = byLine.get(mark.lineId)
      return row ? [{ mark, row }] : []
    })
    .sort((a, b) => (a.mark.weekOf < b.mark.weekOf ? -1 : a.mark.weekOf > b.mark.weekOf ? 1 : 0))
  const thisWeek = lookAheadWeeks(project, rows, today)[0]
  const ourCrew = (thisWeek?.items ?? []).filter((i) => i.row.pkg.selfPerform && !i.mark).map((i) => i.row)
  return { waiting, ourCrew }
}

/**
 * How reliable the look-ahead has been: of the verified marks in the last weeks (RELIABILITY_WEEKS,
 * this week counted once its marks are verified), how many were done as planned. Per company too.
 * Marks not yet verified are counted apart.
 */
export function lookAheadReliability(
  state: GcState,
  project: GcProject,
): { done: number; of: number; waiting: number; byCompany: { company: string; done: number; of: number }[] } {
  const marks = project.schedule?.lookAhead ?? []
  const thisWeek = mondayOf(state.today)
  const from = addDays(thisWeek, -7 * (RELIABILITY_WEEKS - 1))
  const counted = marks.filter((m) => m.weekOf <= thisWeek && m.weekOf >= from && m.verifiedOn)
  const companies = new Map<string, { done: number; of: number }>()
  for (const m of counted) {
    const pkg = project.packages.find((k) => k.id === m.packageId)
    const company = pkg ? companyOf(state, pkg) : m.packageId
    const c = companies.get(company) ?? { done: 0, of: 0 }
    c.of += 1
    if (markState(m) === 'done') c.done += 1
    companies.set(company, c)
  }
  return {
    done: counted.filter((m) => markState(m) === 'done').length,
    of: counted.length,
    waiting: marks.filter((m) => !m.verifiedOn).length,
    byCompany: [...companies].map(([company, c]) => ({ company, ...c })),
  }
}

/** Everything the Schedule tab reads, in one place. */
export function scheduleMeasures(state: GcState, project: GcProject) {
  const rows = scheduleRows(state, project)
  const float = scheduleFloat(project.schedule?.activities ?? [])
  const milestones = milestoneRows(state, project)
  return {
    rows,
    float,
    work: workVsPlan(rows, state.today),
    critical: rows.filter((r) => float.get(r.activity.lineId) === 0 && r.actual < 100),
    milestones,
    hitRate: milestoneHitRate(milestones),
    lookAhead: lookAheadWeeks(project, rows, state.today),
    reliability: lookAheadReliability(state, project),
  }
}

/** A milestone's state on `today`: hit, missed, late, or still due (MILESTONE_GRACE_DAYS of grace). */
function milestoneStateOn(m: ScheduleMilestone, today: string): { state: MilestoneState; daysLate: number } {
  const daysLate = daysBetween(m.planned, m.metOn ?? today)
  const state: MilestoneState = m.metOn ? (daysLate <= MILESTONE_GRACE_DAYS ? 'hit' : 'missed') : daysLate > MILESTONE_GRACE_DAYS ? 'late' : 'due'
  return { state, daysLate }
}

export interface ScheduleSummary {
  /** Days behind the baseline (negative: ahead). */
  daysBehind: number
  donePct: number
  plannedPct: number
  milestones: { hit: number; of: number; late: { label: string; daysLate: number }[]; next: { label: string; planned: string } | null }
  lookAhead: { done: number; of: number; waiting: number }
}

/**
 * The schedule in a few words, for a won job's board row and the ring's card (owner, 2026-10-03:
 * the row shows the schedule's measures on Building). It reads only the project and today, so
 * the row can draw it. Null: no schedule drawn.
 */
export function scheduleSummary(project: GcProject, today: string): ScheduleSummary | null {
  const schedule = project.schedule
  if (!schedule || schedule.activities.length === 0) return null
  const rows: ScheduleRow[] = schedule.activities.flatMap((activity) => {
    const pkg = project.packages.find((k) => k.id === activity.packageId)
    const line = pkg ? lineOf(pkg, activity.lineId) : null
    if (!pkg || !line) return []
    const baseline = schedule.baseline?.activities[activity.lineId] ?? { start: activity.start, finish: activity.finish }
    return [{ activity, pkg, trade: pkg.trade, label: line.label, company: '', worth: line.worth, actual: line.actual, baseline, plannedToday: plannedPct(baseline.start, baseline.finish, today), slipDays: daysBetween(baseline.finish, activity.finish) }]
  })
  const work = workVsPlan(rows, today)
  const states = schedule.milestones.map((m) => ({ m, ...milestoneStateOn(m, today) }))
  const decided = states.filter((x) => x.state !== 'due')
  const next = states.filter((x) => x.state === 'due').sort((a, b) => (a.m.planned < b.m.planned ? -1 : 1))[0]
  const thisWeek = mondayOf(today)
  const from = addDays(thisWeek, -7 * (RELIABILITY_WEEKS - 1))
  const counted = schedule.lookAhead.filter((m) => m.weekOf <= thisWeek && m.weekOf >= from && m.verifiedOn)
  return {
    daysBehind: work.daysBehind,
    donePct: work.donePct,
    plannedPct: work.plannedPct,
    milestones: {
      hit: decided.filter((x) => x.state === 'hit').length,
      of: decided.length,
      late: states.filter((x) => x.state === 'late' || x.state === 'missed').map((x) => ({ label: x.m.label, daysLate: x.daysLate })),
      next: next ? { label: next.m.label, planned: next.m.planned } : null,
    },
    lookAhead: {
      done: counted.filter((m) => markState(m) === 'done').length,
      of: counted.length,
      waiting: schedule.lookAhead.filter((m) => !m.verifiedOn).length,
    },
  }
}

/** The summary as sentences: the board row's hover and the ring's card. */
export function scheduleSummaryWords(sum: ScheduleSummary): string {
  const d = sum.daysBehind
  const pace = d > 0 ? `${d} ${d === 1 ? 'day' : 'days'} behind the plan` : d < 0 ? `${-d} ${d === -1 ? 'day' : 'days'} ahead of the plan` : 'on plan'
  const parts = [`The schedule: ${pace}, ${Math.round(sum.donePct)}% done where ${Math.round(sum.plannedPct)}% was planned.`]
  for (const l of sum.milestones.late) parts.push(`${l.label} is ${l.daysLate} days late.`)
  if (sum.milestones.next) parts.push(`Next: ${sum.milestones.next.label}, ${shortDate(sum.milestones.next.planned)}.`)
  if (sum.lookAhead.waiting > 0) parts.push(`${sum.lookAhead.waiting} look-ahead ${sum.lookAhead.waiting === 1 ? 'mark waits' : 'marks wait'} on our superintendent.`)
  return parts.join(' ')
}
