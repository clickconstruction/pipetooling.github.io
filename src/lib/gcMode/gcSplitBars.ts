/**
 * GC mode design spike: one line as several bars, the Gantt's G-39 (`to-dos/gc-mode/mockups/G-39.md`).
 * A line of a statement of work is one bar, but in the field it is often two jobs: the sales floor,
 * then the back of house. Split, each part has a name, its own dates and its own percent. The line
 * stays the line: its dates are its parts' span, and its percent is their percents weighted by
 * their share, stored on the line as today. So the pay application, the list, the paper, the
 * forecast, the export, the portals and the customer read it exactly as before.
 *
 * A part's days are counted from the line's start, so every move of the line carries its parts with
 * no change: a drag, a push, a pull, days got back, Undo, a what-if. The part that ends last ends
 * with the line. Each part's share of the work is set from its days at the split and then kept: a
 * slip does not make the work bigger, so it must not move the line's percent, and with it the bill,
 * without a report.
 *
 * Its own file, out of the barrel: the reducer, the chart, the portal and the walk read it.
 */
import type { ActivityPart, GcProject, ScheduleActivity, ScheduleMove } from './gcTypes'
import { addDays } from './gcBuilding'
import { daysBetween, plannedPct, scheduleLinesOf } from './gcBuildingSchedule'
import { shortDate, weekdayDate } from './gcWords'

/** A part behind its own plan by this many points or more reads "behind": the chart's own rule for a bar (`BEHIND_POINTS`). */
export const PART_BEHIND_POINTS = 5

type Span = { start: string; finish: string }

/** A part with its dates. */
export interface PartSpan {
  part: ActivityPart
  start: string
  finish: string
  days: number
}

const days = (d: number) => `${d} ${d === 1 ? 'day' : 'days'}`

/** The parts with their dates: counted from the line's start, inside the line, the one that ends last ending with it. Empty: one bar. */
export function partSpans(a: Pick<ScheduleActivity, 'start' | 'finish' | 'parts'>): PartSpan[] {
  const parts = a.parts ?? []
  if (parts.length === 0) return []
  const ends = parts.map((p) => p.from + p.days)
  const last = ends.lastIndexOf(Math.max(...ends))
  return parts.map((p, i) => {
    const start = (() => {
      const s = addDays(a.start, Math.max(0, p.from))
      return s > a.finish ? a.finish : s
    })()
    const end = i === last ? a.finish : addDays(start, Math.max(1, p.days) - 1)
    const finish = end > a.finish ? a.finish : end < start ? start : end
    return { part: p, start, finish, days: daysBetween(start, finish) + 1 }
  })
}

/** The line's percent: its parts' percents weighted by their share, to the whole percent. */
export function linePctOf(parts: ActivityPart[]): number {
  return Math.round(parts.reduce((s, p) => s + p.pct * p.share, 0) / 100)
}

/** Shares of 100 by days, the largest remainders rounded up, so they add up to exactly 100. */
function sharesByDays(lengths: number[]): number[] {
  const total = lengths.reduce((s, d) => s + d, 0)
  const raw = lengths.map((d) => (d * 100) / total)
  const shares = raw.map((r) => Math.floor(r))
  let left = 100 - shares.reduce((s, x) => s + x, 0)
  const order = raw.map((r, i) => ({ i, rest: r - Math.floor(r) })).sort((x, y) => y.rest - x.rest || x.i - y.i)
  for (const { i } of order) {
    if (left <= 0) break
    shares[i] = (shares[i] ?? 0) + 1
    left -= 1
  }
  return shares
}

/**
 * The parts a split makes (G-39): each with its name and dates, a share from its days, and the
 * line's percent to start from, so the line keeps its percent. Refused, with why, unless there are
 * two parts or more, each named once, each with its days, the first starting and the last ending
 * with the line.
 */
export function splitParts(a: ScheduleActivity, drafts: { name: string; start: string; finish: string }[], linePct: number): { parts: ActivityPart[] } | { problem: string } {
  if (drafts.length < 2) return { problem: 'Split it into two parts or more.' }
  const names = drafts.map((d) => d.name.trim())
  if (names.some((n) => !n)) return { problem: 'Give each part a name.' }
  if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) return { problem: 'Give each part its own name.' }
  if (drafts.some((d) => !d.start || !d.finish || d.finish < d.start)) return { problem: 'Each part has to finish on or after it starts.' }
  const first = drafts.reduce((m, d) => (d.start < m ? d.start : m), drafts[0]?.start ?? a.start)
  const last = drafts.reduce((m, d) => (d.finish > m ? d.finish : m), drafts[0]?.finish ?? a.finish)
  if (first !== a.start || last !== a.finish || drafts.some((d) => d.start < a.start || d.finish > a.finish)) {
    return { problem: `The first part starts ${weekdayDate(a.start)} and the last ends ${weekdayDate(a.finish)}, as the line does. Move a part after the split to change that.` }
  }
  const lengths = drafts.map((d) => daysBetween(d.start, d.finish) + 1)
  const shares = sharesByDays(lengths)
  return {
    parts: drafts.map((d, i) => ({ id: `${a.lineId}-p${i + 1}`, name: names[i] ?? d.name, from: daysBetween(a.start, d.start), days: lengths[i] ?? 1, share: shares[i] ?? 0, pct: linePct })),
  }
}

/**
 * One part moved (G-39): the line's span becomes its parts' span, and every part's days are
 * counted again from the line's new start, each part keeping its dates but the one moved. Null:
 * no such part, or a finish before its start.
 */
export function movedParts(a: ScheduleActivity, partId: string, start: string, finish: string): { parts: ActivityPart[]; start: string; finish: string } | null {
  const spans = partSpans(a)
  if (!start || !finish || finish < start || !spans.some((s) => s.part.id === partId)) return null
  const dated = spans.map((s) => (s.part.id === partId ? { part: s.part, start, finish } : { part: s.part, start: s.start, finish: s.finish }))
  const lineStart = dated.reduce((m, s) => (s.start < m ? s.start : m), dated[0]?.start ?? start)
  const lineFinish = dated.reduce((m, s) => (s.finish > m ? s.finish : m), dated[0]?.finish ?? finish)
  return { parts: dated.map((s) => ({ ...s.part, from: daysBetween(lineStart, s.start), days: daysBetween(s.start, s.finish) + 1 })), start: lineStart, finish: lineFinish }
}

/**
 * A part reported (G-39): its percent, and its real days the way a line's report sets them (G-55):
 * the first report over 0% is its start, 100% its finish. The line's real start is its first part's,
 * and its real finish waits for every part.
 */
export function withPartReport(a: ScheduleActivity, partId: string, pct: number, today: string): ScheduleActivity {
  const parts = (a.parts ?? []).map((p) => {
    if (p.id !== partId) return p
    return { ...p, pct, ...(pct > 0 && !p.actualStart ? { actualStart: today } : {}), ...(pct >= 100 && !p.actualFinish ? { actualFinish: today } : {}) }
  })
  const started = parts.flatMap((p) => (p.actualStart ? [p.actualStart] : []))
  const allDone = parts.length > 0 && parts.every((p) => p.actualFinish)
  const finished = allDone ? parts.reduce((m, p) => ((p.actualFinish ?? '') > m ? (p.actualFinish ?? '') : m), '') : ''
  return {
    ...a,
    parts,
    ...(!a.actualStart && started.length > 0 ? { actualStart: started.reduce((m, d) => (d < m ? d : m)) } : {}),
    ...(!a.actualFinish && finished ? { actualFinish: finished } : {}),
  }
}

/** The parts with their days from the line's start set back or forward to a move's own (G-39): Undo and Redo of a part's move. Their percents and real days stay. */
export function withPartDays(a: ScheduleActivity, move: ScheduleMove, which: 'was' | 'now'): ScheduleActivity {
  if (!move.parts || a.lineId !== move.lineId || !a.parts) return a
  const days = new Map(move.parts[which].map((d) => [d.id, d]))
  return { ...a, parts: a.parts.map((p) => ({ ...p, ...(days.has(p.id) ? { from: days.get(p.id)?.from ?? p.from, days: days.get(p.id)?.days ?? p.days } : {}) })) }
}

/** A part's move, its own dates before and after (for its row and Tell the trades). Null: the line moved whole. */
export function partMoveSpans(move: ScheduleMove): { from: Span; to: Span } | null {
  const pm = move.parts
  if (!pm) return null
  const asParts = (list: { id: string; from: number; days: number }[]): ActivityPart[] => list.map((d) => ({ id: d.id, name: '', from: d.from, days: d.days, share: 0, pct: 0 }))
  const was = partSpans({ start: move.from.start, finish: move.from.finish, parts: asParts(pm.was) }).find((s) => s.part.id === pm.id)
  const now = partSpans({ start: move.to.start, finish: move.to.finish, parts: asParts(pm.now) }).find((s) => s.part.id === pm.id)
  return was && now ? { from: { start: was.start, finish: was.finish }, to: { start: now.start, finish: now.finish } } : null
}

/** Where a part stands by its own dates: its pill and tone, the chart's words. */
export function partStanding(span: Span, pct: number, today: string): { words: string; tone: 'green' | 'amber' | 'red' | 'grey' | 'blue' } {
  if (pct >= 100) return { words: 'done', tone: 'green' }
  if (today > span.finish) {
    const late = daysBetween(span.finish, today)
    return { words: `${days(late)} late`, tone: 'red' }
  }
  if (today === span.finish) return { words: 'due today', tone: 'amber' }
  if (span.start > today) return { words: `starts ${shortDate(span.start)}`, tone: 'grey' }
  const plan = plannedPct(span.start, span.finish, today)
  if (plan - pct >= PART_BEHIND_POINTS) return { words: 'behind', tone: 'amber' }
  return { words: 'on track', tone: 'blue' }
}

/**
 * The walk's line for each part: "Sales floor: 60%, plan 73%. Started Mon Sep 14." · "Back of house:
 * not started, Sat Oct 10." A part not yet at its dates has no plan to stand against: a split gives
 * it the line's percent, so it reads "Back of house: 40%, starts Sat Oct 10."
 */
export function partFacts(a: ScheduleActivity, today: string): string[] {
  return partSpans(a).map(({ part: p, start, finish }) => {
    if (p.pct >= 100) return `${p.name}: done${p.actualFinish ? ` ${weekdayDate(p.actualFinish)}` : ''}.`
    if (p.pct <= 0 && start > today) return `${p.name}: not started, ${weekdayDate(start)}.`
    if (start > today) return `${p.name}: ${p.pct}%, starts ${weekdayDate(start)}.`
    const plan = Math.round(plannedPct(start, finish, today))
    return `${p.name}: ${p.pct}%, plan ${plan}%.${p.actualStart ? ` Started ${weekdayDate(p.actualStart)}.` : ''}`
  })
}

/** The card's sentence on a split line: "Lighting is 39% done, the parts by their share." · on one bar, the way to split it. */
export function partsSummary(label: string, a: ScheduleActivity): string {
  if (!a.parts || a.parts.length === 0) return `${label} is one bar. Split it when the work goes in parts, a floor or an area at a time.`
  return `${label} is ${linePctOf(a.parts)}% done, the parts by their share.`
}

/** The split window's shares as the person types: each part's share of 100 by its days. Null: a part with no days yet. */
export function draftShares(drafts: { start: string; finish: string }[]): (number | null)[] {
  const lengths = drafts.map((d) => (d.start && d.finish && d.finish >= d.start ? daysBetween(d.start, d.finish) + 1 : null))
  const known = lengths.flatMap((n) => (n === null ? [] : [n]))
  if (known.length === 0) return lengths.map(() => null)
  const shares = sharesByDays(known)
  let i = 0
  return lengths.map((n) => (n === null ? null : (shares[i++] ?? 0)))
}

/** The percents a part can be reported at (G-39): every ten, and its own, none taking the line under what is billed. */
export function partPcts(a: Pick<ScheduleActivity, 'parts'>, partId: string, billed: number): number[] {
  const parts = a.parts ?? []
  const own = parts.find((p) => p.id === partId)?.pct
  const steps = [...new Set([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, ...(own === undefined ? [] : [own])])].sort((x, y) => x - y)
  return steps.filter((pct) => pct === own || linePctOf(parts.map((p) => (p.id === partId ? { ...p, pct } : p))) >= billed)
}

/** A line's activity when it is split (G-39): the portal and the crew card show its parts. Undefined: one bar. */
export function splitActivityOf(project: GcProject, lineId: string): ScheduleActivity | undefined {
  return project.schedule?.activities.find((a) => a.lineId === lineId && (a.parts ?? []).length > 0)
}

/** A part given new dates, as the move window takes it (G-39): its line's new span, and the part's dates before and after. Null: nothing moves. */
export function partMoveOf(a: ScheduleActivity, partId: string, start: string, finish: string): { lineId: string; start: string; finish: string; after: string[]; part: { id: string; name: string; from: Span; start: string; finish: string } } | null {
  const was = partSpans(a).find((p) => p.part.id === partId)
  const moved = movedParts(a, partId, start, finish)
  if (!was || !moved || (was.start === start && was.finish === finish)) return null
  return { lineId: a.lineId, start: moved.start, finish: moved.finish, after: a.after, part: { id: partId, name: was.part.name, from: { start: was.start, finish: was.finish }, start, finish } }
}

/** A line's own name without its trade, "Lighting": the parts' words read it. */
export function lineLabel(project: GcProject, lineId: string): string {
  const a = project.schedule?.activities.find((x) => x.lineId === lineId)
  const pkg = a ? project.packages.find((k) => k.id === a.packageId) : undefined
  return (pkg ? scheduleLinesOf(pkg).find((l) => l.lineId === lineId)?.label : undefined) ?? lineId
}

/** The split window's first two parts: the line's days in halves, named Part 1 and Part 2. */
export function splitDrafts(a: ScheduleActivity): { name: string; start: string; finish: string }[] {
  const total = daysBetween(a.start, a.finish) + 1
  if (total < 2) return [{ name: 'Part 1', start: a.start, finish: a.finish }, { name: 'Part 2', start: a.start, finish: a.finish }]
  const firstEnd = addDays(a.start, Math.ceil(total / 2) - 1)
  return [
    { name: 'Part 1', start: a.start, finish: firstEnd },
    { name: 'Part 2', start: addDays(firstEnd, 1), finish: a.finish },
  ]
}
