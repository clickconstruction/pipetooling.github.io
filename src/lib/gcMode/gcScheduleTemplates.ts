/**
 * GC mode design spike: schedule templates, the Gantt's G-44 (the mock-up and plan are
 * `to-dos/gc-mode/mockups/G-44.md`). A job being built can be saved as a template: its shape with no
 * dates. Each line of each trade, and the two inspections the first draft draws, keeps its days, the
 * lines it waits on and its offset, how many days after the last of them it started.
 *
 * The next job like it starts from one: the rough while bidding (G-45) and the first draft both draw
 * through the first draft's own kernel, `scheduleDraft`, with the template's lines as its `like`
 * argument. So there is one path. A line of the same trade and name runs as it ran there, and every
 * other line is the first draft's own. Days alone would not do: the first draft runs every stage one
 * after another, and Fair Oaks D ran its work side by side, so its days alone draw a twin job at 42
 * weeks, not the 23 it took.
 *
 * A draw takes a copy and records the template it came from, by the name it had that day. Renaming a
 * template or setting it aside never touches a job. Nothing here reaches the trades or the customer.
 * Its own file, out of the barrel.
 */
import type { GcProject, GcState, ScheduleTemplate, TemplateLine, TemplateUse } from './gcTypes'
import { daysBetween, scheduleLinesOf, scheduleSummary } from './gcBuildingSchedule'
import { SCHEDULE_STAGES, lineStage, scheduleDraft, templateKey } from './gcNewProject'
import { drawWeeks } from './gcRoughSchedule'
import { weekdayDate } from './gcWords'

/** The two inspections the first draft draws, by their names: a template keeps these and no other. */
export const DRAFT_INSPECTIONS = ['Rough-in inspection', 'Final inspection']

/** The longest a template's name may be. */
export const TEMPLATE_NAME_MAX = 60

function weeksWords(n: number): string {
  return `${n} ${n === 1 ? 'week' : 'weeks'}`
}

/** A name as it is kept: trimmed, one space between words. */
export function cleanTemplateName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

/** What is wrong with a template's name: blank, too long, or another template's. Null: it can go. */
export function templateNameProblem(state: GcState, name: string, exceptId?: string): string | null {
  const n = cleanTemplateName(name)
  if (!n) return 'Give it a name.'
  if (n.length > TEMPLATE_NAME_MAX) return `Keep the name to ${TEMPLATE_NAME_MAX} letters.`
  if ((state.scheduleTemplates ?? []).some((t) => t.id !== exceptId && t.name.toLowerCase() === n.toLowerCase())) return 'Another template has that name.'
  return null
}

/**
 * The shape of a job's schedule, ready to save. Its trades' lines and the first draft's two
 * inspections, each with its days, its waits among them, the gaps set on those waits, and its offset
 * after the last of them, or after the job's first day. Its stages' spans and its weeks, for the card.
 * No dates, companies, percents or moves. Null: nothing drawn.
 */
export function templateShape(state: GcState, project: GcProject): Pick<ScheduleTemplate, 'from' | 'lines' | 'stages' | 'weeks'> | null {
  const schedule = project.schedule
  const first = schedule?.activities[0]
  if (!schedule || !first) return null
  // What each kept activity is called on the next job: a trade's line by its trade and name, an inspection by its own.
  const named = new Map<string, { trade: string; label: string; stage: string }>()
  for (const pkg of project.packages) for (const l of scheduleLinesOf(pkg)) named.set(l.lineId, { trade: pkg.trade, label: l.label, stage: lineStage(pkg.trade, l.label) })
  for (const a of schedule.activities) if (a.inspection && DRAFT_INSPECTIONS.includes(a.inspection.label)) named.set(a.lineId, { trade: '', label: a.inspection.label, stage: '' })
  const kept = schedule.activities.filter((a) => named.has(a.lineId))
  const byId = new Map(kept.map((a) => [a.lineId, a]))
  const firstDay = schedule.activities.reduce((m, a) => (a.start < m ? a.start : m), first.start)
  const lines: TemplateLine[] = kept.map((a) => {
    const n = named.get(a.lineId) ?? { trade: '', label: '', stage: '' }
    // Its waits among the kept lines: an inspection only that job had, or an activity the office added, stays with its job.
    const waits = a.after.flatMap((id) => {
      const w = byId.get(id)
      const wn = named.get(id)
      return w && wn ? [{ w, wn, gap: a.lag?.[id] ?? 0 }] : []
    })
    const last = waits.reduce((m, x) => (x.w.finish > m ? x.w.finish : m), '')
    return {
      trade: n.trade,
      label: n.label,
      stage: n.stage,
      days: daysBetween(a.start, a.finish) + 1,
      after: waits.map((x) => ({ trade: x.wn.trade, label: x.wn.label, ...(x.gap !== 0 ? { gap: x.gap } : {}) })),
      offset: last ? daysBetween(last, a.start) - 1 : daysBetween(firstDay, a.start),
    }
  })
  const stages = SCHEDULE_STAGES.flatMap((st) => {
    const acts = kept.filter((a) => named.get(a.lineId)?.stage === st.key)
    const a0 = acts[0]
    if (!a0) return []
    const from = acts.reduce((m, a) => (a.start < m ? a.start : m), a0.start)
    const to = acts.reduce((m, a) => (a.finish > m ? a.finish : m), a0.finish)
    return [{ key: st.key, days: daysBetween(from, to) + 1 }]
  })
  const donePct = Math.round(scheduleSummary(project, state.today)?.donePct ?? 0)
  return { from: { projectId: project.id, name: project.name, donePct }, lines, stages, weeks: drawWeeks(schedule)?.weeks ?? 0 }
}

/** The templates offered for a new draw: not set aside, the newest first. */
export function templatesOffered(state: GcState): ScheduleTemplate[] {
  return [...(state.scheduleTemplates ?? [])].filter((t) => !t.asideOn).reverse()
}

/** How many of a job's trade lines a template covers, by trade and name. */
export function templateCovers(lines: TemplateLine[], project: GcProject): { covered: number; total: number } {
  const keys = new Set(lines.filter((t) => t.trade !== '').map((t) => templateKey(t.trade, t.label)))
  const all = project.packages.flatMap((pkg) => scheduleLinesOf(pkg).map((l) => templateKey(pkg.trade, l.label)))
  return { covered: all.filter((k) => keys.has(k)).length, total: all.length }
}

/** The stages of a job whose every line a template covers: on the rough their days come from the template, not a box. */
export function stagesCovered(lines: TemplateLine[], project: GcProject): Set<string> {
  const keys = new Set(lines.filter((t) => t.trade !== '').map((t) => templateKey(t.trade, t.label)))
  const all = new Map<string, boolean>()
  for (const pkg of project.packages)
    for (const l of scheduleLinesOf(pkg)) {
      const st = lineStage(pkg.trade, l.label)
      all.set(st, (all.get(st) ?? true) && keys.has(templateKey(pkg.trade, l.label)))
    }
  return new Set([...all].filter(([, every]) => every).map(([st]) => st))
}

/** The weeks a draw from a template makes on this job, and without it, from the same start and stage days. Null: nothing to draw. */
export function templateWeeks(project: GcProject, start: string, lines: TemplateLine[], stageDays?: Partial<Record<string, number>>): { weeks: number; finish: string; without: number } | null {
  const like = drawWeeks(scheduleDraft(project, start, stageDays, lines))
  const without = drawWeeks(scheduleDraft(project, start, stageDays))
  return like && without ? { weeks: like.weeks, finish: like.finish, without: without.weeks } : null
}

/** Every job drawn from a template, read from the jobs' own records, the oldest first. */
export function templateUses(state: GcState, templateId: string): { projectId: string; name: string; what: 'rough' | 'firstDraft'; on: string }[] {
  return state.projects
    .flatMap((p) => [
      ...(p.rough?.template?.id === templateId ? [{ projectId: p.id, name: p.name, what: 'rough' as const, on: p.rough.template.on }] : []),
      ...(p.schedule?.template?.id === templateId ? [{ projectId: p.id, name: p.name, what: 'firstDraft' as const, on: p.schedule.template.on }] : []),
    ])
    .sort((a, b) => a.on.localeCompare(b.on))
}

// ---------------------------------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------------------------------

/** "Saved Tue Oct 6 from Fair Oaks Shops, Building D, with 72% of the work done." */
export function templateSavedWords(t: ScheduleTemplate): string {
  return `Saved ${weekdayDate(t.on)} from ${t.from.name}, with ${t.from.donePct}% of the work done.`
}

/** "27 lines of 7 trades and its 2 inspections. 23 weeks to build there." */
export function templateSizeWords(t: ScheduleTemplate): string {
  const work = t.lines.filter((l) => l.trade !== '')
  const trades = new Set(work.map((l) => l.trade)).size
  const checks = t.lines.length - work.length
  const and = checks === 0 ? '' : checks === 1 ? ' and its inspection' : ` and its ${checks} inspections`
  return `${work.length} ${work.length === 1 ? 'line' : 'lines'} of ${trades} ${trades === 1 ? 'trade' : 'trades'}${and}. ${weeksWords(t.weeks)} to build there.`
}

/** The jobs drawn from a template, a line each: "Boerne Retail Shell's rough schedule, Tue Oct 6." */
export function templateUsedLines(state: GcState, t: ScheduleTemplate): string[] {
  return templateUses(state, t.id).map((u) => `${u.name}'s ${u.what === 'rough' ? 'rough schedule' : 'first draft'}, ${weekdayDate(u.on)}.`)
}

/** "Set aside Tue Oct 6. New jobs are not offered it. The jobs drawn from it keep what they drew." Null: offered. */
export function templateAsideWords(t: ScheduleTemplate): string | null {
  return t.asideOn ? `Set aside ${weekdayDate(t.asideOn)}. New jobs are not offered it. The jobs drawn from it keep what they drew.` : null
}

/**
 * The fit, before anything is drawn: what the template covers here and the weeks it makes, against
 * the draw without it. "The template Fair Oaks Shops, Building D covers 27 of the 31 lines here. Those
 * run as they ran there. The other 4 take the stage days. It makes 23 weeks to build. Without it, 14
 * weeks."
 */
export function templateFitWords(t: Pick<ScheduleTemplate, 'name' | 'lines'>, project: GcProject, start: string, stageDays?: Partial<Record<string, number>>): string {
  const { covered, total } = templateCovers(t.lines, project)
  const other = total - covered
  const cover =
    covered === 0
      ? [`The template ${t.name} covers none of the lines here.`, 'Every line takes the stage days.']
      : other === 0
        ? [`The template ${t.name} covers all ${total} lines here.`, 'They run as they ran there.']
        : [`The template ${t.name} covers ${covered} of the ${total} lines here.`, 'Those run as they ran there.', other === 1 ? 'The other one takes the stage days.' : `The other ${other} take the stage days.`]
  const w = templateWeeks(project, start, t.lines, stageDays)
  return [...cover, ...(w ? [`It makes ${weeksWords(w.weeks)} to build.`, `Without it, ${weeksWords(w.without)}.`] : [])].join(' ')
}

/** "Drawn from the template Fair Oaks Shops, Building D, Tue Oct 6." */
export function drawnFromWords(use: TemplateUse): string {
  return `Drawn from the template ${use.name}, ${weekdayDate(use.on)}.`
}

/** The rough's line once drawn from a template: "Drawn from the template Fair Oaks Shops, Building D. It covers 27 of the 31 lines here." Null: none. */
export function roughTemplateWords(project: GcProject): string | null {
  const r = project.rough
  if (!r?.template || !r.like) return null
  const { covered, total } = templateCovers(r.like, project)
  return `Drawn from the template ${r.template.name}. It covers ${covered} of the ${total} lines here.`
}
