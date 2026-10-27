/**
 * GC mode, the schedule builder (punch list #204, PR 1, `to-dos/schedule-builder/README.md`): a template of
 * phases and rows with no dates, put on the next job from a start day. The old shape (`TemplateLine`, G-44)
 * is a timing overlay on the lines a job already has; a template with rows draws every row, the ones the
 * job lacks too. Here: every template read as rows (`templateRows`), the shape of a built job as rows
 * (`templateRowsShape`), the draw from rows (`rowsDraft`), and the words before the draw (`rowsFit`).
 *
 * The calendar, the owner's call 4: a template counts its days Monday to Friday when it says so, a gap the
 * same way, and no row starts on a weekend; with the switch off, every day, as every template saved before.
 * The chart still works any day (the ruling of 2026-10-05 stands in `network.ts`): once drawn, a bar sits
 * where it was put, and every move is a move as today.
 *
 * `draft.ts`, `network.ts` and `schedule.ts` run on the edge too (`scripts/edge-kernels.mjs`), so they are
 * read here and not changed: the draw from rows places the rows itself and lets `scheduleDraft` draw the
 * job's lines no row covers, by the stage rules, around them.
 */
import { ADDED_WHO } from './addedActivity'
import { SCHEDULE_STAGES, lineStage, scheduleDraft } from './draft'
import { isWeekend } from './network'
import { cleanPlace, keptPlaces, placeProblem } from './places'
import { drawWeeks } from './rough'
import { daysBetween, scheduleLinesOf } from './schedule'
import type { ProjectSchedule, ScheduleActivity, ScheduleMilestone, ScheduleTemplate, TemplateLine, TemplatePhase, TemplateRow, TemplateWho } from './types'
import { addDays } from '../building'
import type { GcProject } from '../types'
import { weekdayDate } from '../words'

/** The two inspections the first draft draws, by name: an Office row of either name is that inspection on the job. */
export const ROUGH_IN_INSPECTION = 'Rough-in inspection'
export const FINAL_INSPECTION = 'Final inspection'

/** Who the job's own work from an Office row belongs to, as the chart shows it. */
export const OFFICE_WHO = 'Office'

/** A name as a wait matches it: trimmed, one space between words, whatever the case. */
function nameKey(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** "Sitework", "Us" or "Office": who a row is assigned to, in one word. */
export function whoWords(who: TemplateWho): string {
  return who.kind === 'trade' ? who.trade : who.kind === 'us' ? 'Us' : OFFICE_WHO
}

/** A row's name as a wait names it (`TemplateRow.after[].row`): its label, or "Who · label" when another row has the same label. */
export function rowRef(rows: TemplateRow[], row: TemplateRow): string {
  const shared = rows.some((r) => r !== row && nameKey(r.label) === nameKey(row.label))
  return shared ? `${whoWords(row.who)} · ${row.label}` : row.label
}

/**
 * The row a wait names: by "Who · label" first, then by label alone, whatever the case. When two rows
 * answer to the name, the one that is not a milestone, then the first as listed. Null: no row of that name.
 */
export function findRow(rows: TemplateRow[], ref: string): TemplateRow | null {
  const key = nameKey(ref)
  const pick = (matches: TemplateRow[]) => matches.find((r) => !r.milestone) ?? matches[0] ?? null
  const qualified = rows.filter((r) => nameKey(`${whoWords(r.who)} · ${r.label}`) === key)
  if (qualified.length > 0) return pick(qualified)
  return pick(rows.filter((r) => nameKey(r.label) === key))
}

// ---------------------------------------------------------------------------------------------
// Every template read as rows
// ---------------------------------------------------------------------------------------------

/** A template's phases and rows, and how it counts days: what every reader of a template takes. */
export interface TemplateRowsShape {
  phases: TemplatePhase[]
  rows: TemplateRow[]
  workingDays: boolean
}

/** The stage one of the first draft's inspections is drawn in. Null: not one of the two. */
function inspectionStage(label: string): string | null {
  const key = nameKey(label)
  return key === nameKey(ROUGH_IN_INSPECTION) ? 'roughIn' : key === nameKey(FINAL_INSPECTION) ? 'closeout' : null
}

/** The stages present among rows, in build order, as phases named by the stage. */
function stagePhases(rows: TemplateRow[]): TemplatePhase[] {
  return SCHEDULE_STAGES.filter((st) => rows.some((r) => r.phase === st.key)).map((st) => ({ key: st.key, name: st.label }))
}

/**
 * Every template read as rows: its own phases and rows when it has them, else its lines (G-44), each a
 * trade's row in its stage as the phase, the two inspections as Office rows, and its waits by name. A
 * template with no word on working days counts every day, as every template saved before did.
 */
export function templateRows(t: Pick<ScheduleTemplate, 'lines' | 'phases' | 'rows' | 'workingDays'>): TemplateRowsShape {
  const workingDays = t.workingDays ?? false
  if (t.rows) {
    const phases = t.phases ?? [...new Set(t.rows.map((r) => r.phase))].map((key) => ({ key, name: key }))
    return { phases, rows: t.rows, workingDays }
  }
  const rows: TemplateRow[] = t.lines.map((l) => ({
    phase: l.trade === '' ? (inspectionStage(l.label) ?? 'closeout') : l.stage || lineStage(l.trade, l.label),
    label: l.label,
    who: l.trade === '' ? { kind: 'office' } : { kind: 'trade', trade: l.trade },
    days: l.days,
    after: [],
    offset: l.offset,
    milestone: false,
    ...(l.place ? { place: l.place } : {}),
    ...(l.parts && l.parts.length > 0 ? { parts: l.parts.map((p) => ({ ...p })) } : {}),
  }))
  const rowOfLine = (trade: string, label: string) => {
    const i = t.lines.findIndex((l) => l.trade === trade && nameKey(l.label) === nameKey(label))
    return i >= 0 ? rows[i] : undefined
  }
  t.lines.forEach((l, i) => {
    const row = rows[i]
    if (!row) return
    row.after = l.after.flatMap((w) => {
      const r = rowOfLine(w.trade, w.label)
      return r ? [{ row: rowRef(rows, r), ...(w.gap !== undefined && w.gap !== 0 ? { gap: w.gap } : {}) }] : []
    })
  })
  return { phases: stagePhases(rows), rows, workingDays }
}

// ---------------------------------------------------------------------------------------------
// The calendar
// ---------------------------------------------------------------------------------------------

/** How a template counts days: `next` is the first day on or after a day a row may start, `add` counts n days on from there, back when n is under zero. */
interface Calendar {
  next(day: string): string
  add(day: string, n: number): string
}

const EVERY_DAY: Calendar = {
  next: (day) => day,
  add: (day, n) => addDays(day, n),
}

const nextWorkingDay = (day: string): string => {
  let at = day
  while (isWeekend(at)) at = addDays(at, 1)
  return at
}

const WORKING_DAYS: Calendar = {
  next: nextWorkingDay,
  add: (day, n) => {
    let at = nextWorkingDay(day)
    const step = n < 0 ? -1 : 1
    for (let i = 0; i < Math.abs(n); i++) {
      at = addDays(at, step)
      while (isWeekend(at)) at = addDays(at, step)
    }
    return at
  },
}

// ---------------------------------------------------------------------------------------------
// Where each row lands on the job
// ---------------------------------------------------------------------------------------------

/** Where a row lands: one of the job's lines, an inspection, the job's own work, or a date to meet. */
export type RowLanding =
  | { kind: 'line'; lineId: string; packageId: string; trade: string; label: string }
  | { kind: 'inspection'; lineId: string; label: string }
  | { kind: 'added'; lineId: string; packageId: string; who: string }
  | { kind: 'milestone'; id: string; packageId: string | null }

function slug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Where every row lands, in row order (call 7): a trade's row on the job's line of the same trade and
 * name, else as the job's own work on that trade's package, else with no package, which the job shows as
 * No company yet; a Us row on our own package, its line of the same name when there is one; an Office
 * row named an inspection as the city's inspection, the two the first draft draws by their own ids;
 * any other Office row as the job's own work with Office named; a milestone row as a date to meet on
 * its trade's package, ours, or the job's own.
 */
export function rowLandings(project: Pick<GcProject, 'id' | 'packages'>, rows: TemplateRow[]): RowLanding[] {
  const ownPackages = project.packages.filter((k) => k.selfPerform)
  const taken = new Set<string>()
  let own = 0
  let milestones = 0
  const lineOf = (packages: GcProject['packages'], label: string) => {
    for (const pkg of packages) {
      const line = scheduleLinesOf(pkg).find((l) => nameKey(l.label) === nameKey(label) && !taken.has(l.lineId))
      if (line) return { pkg, line }
    }
    return null
  }
  const added = (packageId: string, who: string): RowLanding => ({ kind: 'added', lineId: `${project.id}-own-${++own}`, packageId, who })
  return rows.map((row): RowLanding => {
    const who = row.who
    if (row.milestone) {
      const pkg = who.kind === 'trade' ? project.packages.find((k) => k.trade === who.trade) : who.kind === 'us' ? ownPackages[0] : undefined
      return { kind: 'milestone', id: `${project.id}-ms-${++milestones}`, packageId: pkg?.id ?? null }
    }
    if (who.kind === 'trade') {
      const packages = project.packages.filter((k) => k.trade === who.trade)
      const hit = lineOf(packages, row.label)
      if (hit) {
        taken.add(hit.line.lineId)
        return { kind: 'line', lineId: hit.line.lineId, packageId: hit.pkg.id, trade: hit.pkg.trade, label: hit.line.label }
      }
      return added(packages[0]?.id ?? '', who.trade)
    }
    if (who.kind === 'us') {
      const hit = lineOf(ownPackages, row.label)
      if (hit) {
        taken.add(hit.line.lineId)
        return { kind: 'line', lineId: hit.line.lineId, packageId: hit.pkg.id, trade: hit.pkg.trade, label: hit.line.label }
      }
      return added(ownPackages[0]?.id ?? '', ADDED_WHO[0])
    }
    if (/inspection/i.test(row.label)) {
      const stage = inspectionStage(row.label)
      const lineId = stage === 'roughIn' ? `${project.id}-insp-roughin` : stage === 'closeout' ? `${project.id}-insp-final` : `${project.id}-insp-${slug(row.label)}`
      return { kind: 'inspection', lineId, label: row.label }
    }
    return added('', OFFICE_WHO)
  })
}

// ---------------------------------------------------------------------------------------------
// The draw from rows
// ---------------------------------------------------------------------------------------------

interface Placed {
  row: TemplateRow
  index: number
  from: string
  finish: string
  waits: { placed: Placed; gap: number }[]
  lands: RowLanding
}

/** Rows in an order where each comes after what it waits on. Waits that loop: the first as listed goes, and the rest follow. */
function rowOrder(rows: TemplateRow[]): number[] {
  const waitsOf = rows.map((r) => r.after.flatMap((w) => {
    const hit = findRow(rows, w.row)
    const j = hit ? rows.indexOf(hit) : -1
    return j >= 0 && hit !== r ? [j] : []
  }))
  const left = rows.map((_, i) => i)
  const out: number[] = []
  const placed = new Set<number>()
  while (left.length > 0) {
    const ready = left.findIndex((i) => (waitsOf[i] ?? []).every((j) => placed.has(j) || !left.includes(j)))
    const [i] = left.splice(ready < 0 ? 0 : ready, 1)
    if (i === undefined) break
    placed.add(i)
    out.push(i)
  }
  return out
}

/** A milestone is a point at the start of its day: a row after it with no gap starts on that day. */
function waitEnd(p: Placed, cal: Calendar): string {
  return p.row.milestone ? cal.add(p.from, -1) : p.finish
}

/**
 * Every row placed from the start day: after the last of its waits by its offset (an offset under zero
 * starts it before that wait finishes, side by side, and a milestone's of minus one puts it on the day
 * its bar finishes), never before a gap set on one of them, or its offset after the start day with
 * nothing to wait on; its days counted on the template's calendar, and never from a weekend when it
 * counts working days. A pin holds a row to a day the job's own draw found later (an inspection after
 * rough-ins the template has no row for).
 */
function placeRows(project: Pick<GcProject, 'id' | 'packages'>, rows: TemplateRow[], start: string, cal: Calendar, pins: Map<number, string>): Placed[] {
  const landings = rowLandings(project, rows)
  const placed = new Map<number, Placed>()
  for (const i of rowOrder(rows)) {
    const row = rows[i]
    const lands = landings[i]
    if (!row || !lands) continue
    const waits = row.after.flatMap((w) => {
      const hit = findRow(rows, w.row)
      const p = hit && hit !== row ? placed.get(rows.indexOf(hit)) : undefined
      return p ? [{ placed: p, gap: w.gap ?? 0 }] : []
    })
    let from: string
    if (waits.length === 0) from = cal.add(start, Math.max(0, row.offset))
    else {
      const last = waits.reduce((m, w) => (waitEnd(w.placed, cal) > m ? waitEnd(w.placed, cal) : m), '')
      from = [cal.next(start), cal.add(last, 1 + row.offset), ...waits.filter((w) => w.gap !== 0).map((w) => cal.add(waitEnd(w.placed, cal), 1 + w.gap))].reduce((m, d) => (d > m ? d : m))
    }
    const pin = pins.get(i)
    if (pin && pin > from) from = pin
    const finish = row.milestone ? from : cal.add(from, Math.max(1, row.days) - 1)
    placed.set(i, { row, index: i, from, finish, waits, lands })
  }
  return rows.flatMap((_, i) => {
    const p = placed.get(i)
    return p ? [p] : []
  })
}

/** The rows that landed on the job's lines, and the two inspections, as lines the first draft pins to their days (`scheduleDraft`'s `like`). */
function likeOf(placed: Placed[], start: string): TemplateLine[] {
  return placed.flatMap((p): TemplateLine[] => {
    const days = daysBetween(p.from, p.finish) + 1
    if (p.lands.kind === 'line') {
      return [{
        trade: p.lands.trade,
        label: p.lands.label,
        stage: lineStage(p.lands.trade, p.lands.label),
        days,
        after: [],
        offset: daysBetween(start, p.from),
        ...(p.row.place ? { place: p.row.place } : {}),
        ...(p.row.parts && p.row.parts.length > 0 ? { parts: p.row.parts.map((x) => ({ ...x })) } : {}),
      }]
    }
    if (p.lands.kind === 'inspection' && inspectionStage(p.lands.label) === 'roughIn') return [{ trade: '', label: ROUGH_IN_INSPECTION, stage: '', days, after: [], offset: daysBetween(start, p.from) }]
    // The final inspection comes after all the work the draft draws, its offset after the last of it.
    if (p.lands.kind === 'inspection' && inspectionStage(p.lands.label) === 'closeout') return [{ trade: '', label: FINAL_INSPECTION, stage: '', days, after: [], offset: Math.max(0, p.row.offset) }]
    return []
  })
}

function idOf(lands: RowLanding): string {
  return lands.kind === 'milestone' ? lands.id : lands.lineId
}

/**
 * A template with rows drawn on a job from a start day (#204, D4): every row lands (`rowLandings`), on
 * the template's calendar, each activity and milestone carrying its phase by name. The job's scope lines
 * in no row take the stage days as today, drawn by `scheduleDraft` around the rows, and the first draft's
 * two inspections come where the template puts them or, with no row for one, where the draft does. A
 * milestone row is a date to meet on its day; with no milestone rows, the draft's three stand. A wait on
 * a milestone row counts for the day and reads on the bar as waits on what that milestone waits on, with
 * their gaps.
 */
export function rowsDraft(project: GcProject, start: string, t: TemplateRowsShape, stageDays?: Partial<Record<string, number>>): ProjectSchedule {
  const cal = t.workingDays ? WORKING_DAYS : EVERY_DAY
  const phaseName = (key: string) => t.phases.find((p) => p.key === key)?.name ?? key
  // The rows placed, then the job's own draw around them; an inspection the draw puts later pins the row there, until nothing moves.
  const pins = new Map<number, string>()
  let placed = placeRows(project, t.rows, start, cal, pins)
  let draft = scheduleDraft(project, start, stageDays, likeOf(placed, start))
  for (let round = 0; round < 4; round++) {
    let moved = false
    for (const p of placed) {
      const lands = p.lands
      if (lands.kind !== 'inspection') continue
      const b = draft.activities.find((a) => a.lineId === lands.lineId)
      if (b && b.start > p.from) {
        pins.set(p.index, b.start)
        moved = true
      }
    }
    if (!moved) break
    placed = placeRows(project, t.rows, start, cal, pins)
    draft = scheduleDraft(project, start, stageDays, likeOf(placed, start))
  }
  const drawn = new Map(draft.activities.map((a) => [a.lineId, a]))
  /** What a row waits on, as bars: a wait on a milestone row becomes waits on what it waits on. */
  const waitIds = (p: Placed, seen = new Set<number>()): { ids: string[]; lag: Record<string, number> } => {
    const ids: string[] = []
    const lag: Record<string, number> = {}
    for (const w of p.waits) {
      const lands = w.placed.lands
      if (lands.kind === 'milestone') {
        if (seen.has(w.placed.index)) continue
        seen.add(w.placed.index)
        const inner = waitIds(w.placed, seen)
        ids.push(...inner.ids)
        Object.assign(lag, inner.lag)
        continue
      }
      const id = lands.lineId
      if (!ids.includes(id)) ids.push(id)
      if (w.gap !== 0) lag[id] = w.gap
    }
    return { ids, lag }
  }
  const activities: ScheduleActivity[] = []
  for (const p of placed) {
    const { ids, lag } = waitIds(p)
    const phase = phaseName(p.row.phase)
    const lands = p.lands
    if (lands.kind === 'line') {
      const b = drawn.get(lands.lineId)
      activities.push({
        lineId: lands.lineId,
        packageId: lands.packageId,
        start: p.from,
        finish: p.finish,
        after: ids,
        ...(Object.keys(lag).length > 0 ? { lag } : {}),
        ...(b?.place ? { place: b.place } : {}),
        ...(b?.parts && b.parts.length > 0 ? { parts: b.parts } : {}),
        phase,
      })
    } else if (lands.kind === 'inspection') {
      const b = drawn.get(lands.lineId)
      const after = [...new Set([...(b?.after ?? []), ...ids])]
      const lagAll = { ...(b?.lag ?? {}), ...lag }
      activities.push({ lineId: lands.lineId, packageId: '', start: p.from, finish: p.finish, after, ...(Object.keys(lagAll).length > 0 ? { lag: lagAll } : {}), inspection: { label: lands.label }, phase })
    } else if (lands.kind === 'added') {
      activities.push({
        lineId: lands.lineId,
        packageId: lands.packageId,
        start: p.from,
        finish: p.finish,
        after: ids,
        ...(Object.keys(lag).length > 0 ? { lag } : {}),
        added: { label: p.row.label, who: lands.who, doneOn: null },
        ...(p.row.place ? { place: p.row.place } : {}),
        phase,
      })
    }
  }
  // The job's lines in no row, and an inspection the template has no row for, as the draft drew them.
  const rowed = new Set(placed.map((p) => idOf(p.lands)))
  for (const a of draft.activities) if (!rowed.has(a.lineId)) activities.push(a)
  const milestoneRows = placed.filter((p) => p.lands.kind === 'milestone')
  const roughIn = activities.find((a) => a.lineId === `${project.id}-insp-roughin`)
  const final = activities.find((a) => a.lineId === `${project.id}-insp-final`)
  const milestones: ScheduleMilestone[] =
    milestoneRows.length > 0
      ? milestoneRows.map((p) => ({ id: idOf(p.lands), label: p.row.label, planned: p.from, packageId: p.lands.kind === 'milestone' ? p.lands.packageId : null, metOn: null, phase: phaseName(p.row.phase) }))
      : draft.milestones.map((m) =>
          m.id === `${project.id}-substantial` && final ? { ...m, planned: addDays(final.finish, 3) } : m.id === `${project.id}-roughin` && roughIn ? { ...m, planned: roughIn.finish } : m,
        )
  return { activities, milestones, baseline: null, lookAhead: [] }
}

// ---------------------------------------------------------------------------------------------
// The shape of a built job as rows
// ---------------------------------------------------------------------------------------------

/**
 * A job's schedule as phases and rows, ready to save (#204; the old `lines` keep coming from
 * `templateShape`): every trade's line as a trade row, our own package's lines as Us rows, the job's own
 * work as Office rows, or Us when it was our own crew's, the inspections as Office rows, and the job's
 * milestones as milestone rows, each waiting on the kept bar that finished last on or before its day. The
 * stage of each is its phase, in build order: a line's from its name, the job's own work's from what it
 * waits on, else from the day it sits on. Days are the job's own, counted on the calendar, so the shape
 * counts every day. Null: nothing drawn.
 */
export function templateRowsShape(project: GcProject): TemplateRowsShape | null {
  const schedule = project.schedule
  const first = schedule?.activities[0]
  if (!schedule || !first) return null
  const own = new Set(project.packages.filter((k) => k.selfPerform).map((k) => k.id))
  const tradeOf = new Map(project.packages.map((k) => [k.id, k.trade]))
  const lines = new Map<string, { packageId: string; trade: string; label: string }>()
  for (const pkg of project.packages) for (const l of scheduleLinesOf(pkg)) lines.set(`${pkg.id}|${l.lineId}`, { packageId: pkg.id, trade: pkg.trade, label: l.label })
  type Named = { a: ScheduleActivity; who: TemplateWho; label: string; stage?: string }
  const named: Named[] = schedule.activities.flatMap((a): Named[] => {
    const line = lines.get(`${a.packageId}|${a.lineId}`)
    if (line) return [{ a, who: own.has(line.packageId) ? { kind: 'us' } : { kind: 'trade', trade: line.trade }, label: line.label, stage: lineStage(line.trade, line.label) }]
    if (a.inspection) return [{ a, who: { kind: 'office' }, label: a.inspection.label, ...(inspectionStage(a.inspection.label) ? { stage: inspectionStage(a.inspection.label) ?? '' } : {}) }]
    if (a.added) return [{ a, who: a.added.who === ADDED_WHO[0] ? { kind: 'us' } : { kind: 'office' }, label: a.added.label }]
    return []
  })
  const byId = new Map(named.map((n) => [n.a.lineId, n]))
  const firstDay = schedule.activities.reduce((m, a) => (a.start < m ? a.start : m), first.start)
  const order = new Map(SCHEDULE_STAGES.map((st, i) => [st.key, i]))
  // The stages of the lines, each with its span: the job's own work with nothing to wait on takes the stage of its day.
  const spans = SCHEDULE_STAGES.flatMap((st) => {
    const acts = named.filter((n) => n.stage === st.key && n.who.kind !== 'office').map((n) => n.a)
    const a0 = acts[0]
    if (!a0) return []
    return [{ key: st.key, start: acts.reduce((m, a) => (a.start < m ? a.start : m), a0.start), finish: acts.reduce((m, a) => (a.finish > m ? a.finish : m), a0.finish) }]
  })
  const stageOnDay = (day: string): string => {
    const holding = spans.filter((s) => s.start <= day && day <= s.finish).sort((x, y) => (y.start > x.start ? 1 : -1))[0]
    if (holding) return holding.key
    const last = spans[spans.length - 1]
    if (last && day > last.finish) return last.key
    return spans[0]?.key ?? SCHEDULE_STAGES[0]?.key ?? ''
  }
  const stageMemo = new Map<string, string>()
  const stageOf = (n: Named, seen = new Set<string>()): string => {
    if (n.stage) return n.stage
    const memo = stageMemo.get(n.a.lineId)
    if (memo) return memo
    seen.add(n.a.lineId)
    const waits = n.a.after
      .map((id) => byId.get(id))
      .filter((w): w is Named => !!w && !seen.has(w.a.lineId))
      .sort((x, y) => (y.a.finish > x.a.finish ? 1 : -1))
    const last = waits[0]
    const stage = last ? stageOf(last, seen) : stageOnDay(n.a.start)
    stageMemo.set(n.a.lineId, stage)
    return stage
  }
  const places = keptPlaces(project)
  const placeOf = (lineId: string) => {
    const place = cleanPlace(places.get(lineId) ?? '')
    return place && !placeProblem(place) ? place : null
  }
  const activityRows: { row: TemplateRow; a: ScheduleActivity; day: string }[] = named.map((n) => {
    const a = n.a
    const waits = a.after.flatMap((id) => {
      const w = byId.get(id)
      return w ? [{ w, gap: a.lag?.[id] ?? 0 }] : []
    })
    const last = waits.reduce((m, x) => (x.w.a.finish > m ? x.w.a.finish : m), '')
    const place = placeOf(a.lineId)
    const row: TemplateRow = {
      phase: stageOf(n),
      label: n.label,
      who: n.who,
      days: daysBetween(a.start, a.finish) + 1,
      after: [],
      offset: last ? daysBetween(last, a.start) - 1 : daysBetween(firstDay, a.start),
      milestone: false,
      ...(place ? { place } : {}),
      ...(a.parts && a.parts.length > 0 ? { parts: a.parts.map((x) => ({ name: x.name, from: x.from, days: x.days, share: x.share })) } : {}),
    }
    return { row, a, day: a.start }
  })
  const rowOfId = new Map(activityRows.map((r) => [r.a.lineId, r.row]))
  const milestoneRows: { row: TemplateRow; a: ScheduleActivity | null; day: string }[] = schedule.milestones.map((m) => {
    const trade = m.packageId ? tradeOf.get(m.packageId) : undefined
    const who: TemplateWho = m.packageId && own.has(m.packageId) ? { kind: 'us' } : trade ? { kind: 'trade', trade } : { kind: 'office' }
    // The kept bar that finished last on or before its day, its own trade's first.
    const before = named.filter((n) => n.a.finish <= m.planned)
    const ownFirst = m.packageId ? before.filter((n) => n.a.packageId === m.packageId) : []
    const pick = (ownFirst.length > 0 ? ownFirst : before).sort((x, y) => (y.a.finish > x.a.finish ? 1 : -1))[0] ?? null
    const row: TemplateRow = {
      phase: pick ? stageOf(pick) : stageOnDay(m.planned),
      label: m.label,
      who,
      days: 1,
      after: [],
      offset: pick ? daysBetween(pick.a.finish, m.planned) - 1 : daysBetween(firstDay, m.planned),
      milestone: true,
    }
    return { row, a: pick?.a ?? null, day: m.planned }
  })
  const all = [...activityRows, ...milestoneRows].sort((x, y) => (order.get(x.row.phase) ?? 0) - (order.get(y.row.phase) ?? 0) || x.day.localeCompare(y.day))
  const rows = all.map((r) => r.row)
  // Waits by name, once every row is there to name.
  for (const r of activityRows) {
    r.row.after = r.a.after.flatMap((id) => {
      const w = rowOfId.get(id)
      const gap = r.a.lag?.[id] ?? 0
      return w ? [{ row: rowRef(rows, w), ...(gap !== 0 ? { gap } : {}) }] : []
    })
  }
  for (const r of milestoneRows) {
    const w = r.a ? rowOfId.get(r.a.lineId) : undefined
    r.row.after = w ? [{ row: rowRef(rows, w) }] : []
  }
  return { phases: stagePhases(rows), rows, workingDays: false }
}

// ---------------------------------------------------------------------------------------------
// The words before the draw
// ---------------------------------------------------------------------------------------------

/** What a template's rows make of a job before anything is drawn (#204, D3). */
export interface RowsFit {
  rows: number
  phases: number
  weeks: number
  start: string
  finish: string
  /** Rows that land on this job's trades, by line or as the job's own work on the package, and how many trades. */
  onTrades: number
  trades: number
  /** The trades the job has no package for yet, each with its rows. They land with No company yet. */
  noPackage: { trade: string; rows: number }[]
  ours: number
  /** Our own package's trade here. Null: we have none on this job. */
  ourTrade: string | null
  office: number
  /** The dates to meet, by name, in row order. */
  milestones: string[]
  /** The job's scope lines in no row, by trade and name. They take the stage days. */
  notIn: { trade: string; label: string }[]
}

/** The fit of a template's rows on a job from a start day, counted. Null: nothing to draw. */
export function rowsFit(project: GcProject, start: string, t: TemplateRowsShape, stageDays?: Partial<Record<string, number>>): RowsFit | null {
  const w = drawWeeks(rowsDraft(project, start, t, stageDays))
  if (!w) return null
  const landings = rowLandings(project, t.rows)
  const tradeRows = t.rows.map((row, i) => ({ row, lands: landings[i] })).filter((x) => x.row.who.kind === 'trade')
  const onTrades = tradeRows.filter((x) => x.lands && (x.lands.kind === 'line' || x.lands.kind === 'milestone' ? x.lands.packageId !== null : x.lands.kind === 'added' ? x.lands.packageId !== '' : false))
  const none = tradeRows.filter((x) => !onTrades.includes(x))
  const noPackage = [...new Set(none.map((x) => (x.row.who.kind === 'trade' ? x.row.who.trade : '')))].map((trade) => ({ trade, rows: none.filter((x) => x.row.who.kind === 'trade' && x.row.who.trade === trade).length }))
  const landed = new Set(landings.flatMap((l) => (l.kind === 'line' ? [l.lineId] : [])))
  const notIn = project.packages.flatMap((pkg) => scheduleLinesOf(pkg).filter((l) => !landed.has(l.lineId)).map((l) => ({ trade: pkg.trade, label: l.label })))
  return {
    rows: t.rows.length,
    phases: t.phases.length,
    weeks: w.weeks,
    start: w.start,
    finish: w.finish,
    onTrades: onTrades.length,
    trades: new Set(onTrades.map((x) => (x.row.who.kind === 'trade' ? x.row.who.trade : ''))).size,
    noPackage,
    ours: t.rows.filter((r) => r.who.kind === 'us').length,
    ourTrade: project.packages.find((k) => k.selfPerform)?.trade ?? null,
    office: t.rows.filter((r) => r.who.kind === 'office').length,
    milestones: t.rows.filter((r) => r.milestone).map((r) => r.label),
    notIn,
  }
}

const PLAIN_WORDS_MAX = 20

function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

function andList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** A list said in sentences of at most twenty words: "Lead: a, b and c." then "Then d and e." */
function listSentences(lead: string, items: string[]): string[] {
  const out: string[] = []
  let current: string[] = []
  let head = `${lead}:`
  const render = (h: string, xs: string[]) => `${h} ${andList(xs)}.`
  for (const item of items) {
    const next = [...current, item]
    if (current.length > 0 && render(head, next).split(/\s+/).length > PLAIN_WORDS_MAX) {
      out.push(render(head, current))
      head = 'Then'
      current = [item]
    } else current = next
  }
  if (current.length > 0) out.push(render(head, current))
  return out
}

/** D3's lines, each a label and its words, in plain words (`src/lib/plainWords.ts`). */
export function rowsFitLines(fit: RowsFit): { label: string; words: string }[] {
  const rows = [`${count(fit.rows, 'row')} in ${count(fit.phases, 'phase')} ${fit.rows === 1 ? 'lands' : 'land'} on this job.`, `It makes ${count(fit.weeks, 'week')} to build, ${weekdayDate(fit.start)} to ${weekdayDate(fit.finish)}.`]
  const missing = fit.noPackage.reduce((m, x) => m + x.rows, 0)
  const trades = [
    fit.onTrades === 0 ? (missing === 0 ? 'No row names a trade.' : "No row lands on this job's trades.") : `${count(fit.onTrades, 'row')} ${fit.onTrades === 1 ? 'lands' : 'land'} on this job's ${count(fit.trades, 'trade')}.`,
    ...(missing === 0
      ? fit.onTrades === 0
        ? []
        : ['Every trade they name has a package here.']
      : [
          ...listSentences(`${count(missing, 'row')} ${missing === 1 ? 'names' : 'name'} a trade this job has no package for yet`, fit.noPackage.map((x) => x.trade)),
          `${missing === 1 ? 'It lands' : 'They land'} with No company yet.`,
        ]),
  ]
  const ours =
    fit.ours === 0
      ? ['No row is ours.']
      : [`${count(fit.ours, 'row')} ${fit.ours === 1 ? 'is' : 'are'} ours.`, fit.ourTrade ? `${fit.ours === 1 ? 'It lands' : 'They land'} on our ${fit.ourTrade} package.` : `We have no package on this job yet, so ${fit.ours === 1 ? 'it lands' : 'they land'} on none.`]
  const office = [fit.office === 0 ? "No row is the office's." : `${count(fit.office, 'row')} ${fit.office === 1 ? 'is' : 'are'} the office's own work.`]
  const milestones = fit.milestones.length === 0 ? ['No dates to meet.'] : listSentences(`${count(fit.milestones.length, 'date')} to meet`, fit.milestones)
  const notIn =
    fit.notIn.length === 0
      ? ["Every line of this job's scope book is in a row."]
      : [...listSentences(`${count(fit.notIn.length, 'line')} of this job's scope book ${fit.notIn.length === 1 ? 'is' : 'are'} in no row`, fit.notIn.map((x) => `${x.trade}'s ${x.label}`)), `${fit.notIn.length === 1 ? 'It takes' : 'They take'} the stage days.`]
  return [
    { label: 'Rows', words: rows.join(' ') },
    { label: 'Trades', words: trades.join(' ') },
    { label: 'Our crew', words: ours.join(' ') },
    { label: 'Office', words: office.join(' ') },
    { label: 'Milestones', words: milestones.join(' ') },
    { label: 'Not in it', words: notIn.join(' ') },
  ]
}

/** D3's lines as one text, for a log line or a test. */
export function rowsFitWords(fit: RowsFit): string {
  return rowsFitLines(fit)
    .map((l) => l.words)
    .join(' ')
}
