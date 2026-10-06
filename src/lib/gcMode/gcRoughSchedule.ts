/**
 * GC mode design spike: a rough schedule while we bid, the Gantt's G-45 (mock-up and plan
 * `to-dos/gc-mode/mockups/G-45.md`). A customer comparing bids asks how much and how long, and Our
 * number answered only the first. The rough is drawn by the first draft's own kernel
 * (`scheduleDraft`) from the trades' scope lines, with this job's stage lengths, so the bid's weeks
 * to build come from a chart, not a guess.
 *
 * It is kept on the job as the record of the weeks we bid and never copied into the schedule: once
 * we win, each trade's statement of work brings the lines its bars must be on, and the first draft
 * starts from the rough's start day and stage lengths. Nothing here reaches the trades or the
 * customer, whose views read `GcProject.schedule` only.
 *
 * One count (`roughWeeks`), worked out on the draw while we bid and kept as it went when the bid
 * goes in, so the record cannot drift from the proposal. Its own file, out of the barrel.
 */
import type { GcProject, ProjectSchedule, RoughSchedule } from './gcTypes'
import { daysBetween, scheduleLinesOf } from './gcBuildingSchedule'
import { SCHEDULE_STAGES, lineStage, scheduleDraft } from './gcNewProject'
import { weekdayDate } from './gcWords'

function weeksWords(n: number): string {
  return `${n} ${n === 1 ? 'week' : 'weeks'}`
}

/** The rough's draw: the first draft's kernel on the trades' lines, from the rough's start, with the job's stage days, and its copy of a template's lines when it was drawn from one (G-44). Null: none drawn. */
export function roughDraw(project: GcProject): ProjectSchedule | null {
  const r = project.rough
  return r ? scheduleDraft(project, r.start, r.days, r.like) : null
}

/** A draw's length: its first day of work to substantial completion (else its last day), rounded up to whole weeks. Null: nothing drawn. */
export function drawWeeks(schedule: ProjectSchedule): { weeks: number; days: number; start: string; finish: string } | null {
  const first = schedule.activities[0]
  if (!first) return null
  const start = schedule.activities.reduce((m, a) => (a.start < m ? a.start : m), first.start)
  const last = schedule.activities.reduce((m, a) => (a.finish > m ? a.finish : m), first.finish)
  const finish = schedule.milestones.find((m) => /substantial completion/i.test(m.label))?.planned ?? last
  const days = daysBetween(start, finish) + 1
  return { weeks: Math.ceil(days / 7), days, start, finish }
}

/** The weeks to build on the rough, and whether they are kept as they went with the bid. */
export interface RoughWeeks {
  weeks: number
  start: string
  finish: string
  /** Kept as they went: when our bid went in, or at award. Null: still counted on the draw. */
  kept: RoughSchedule['kept'] | null
}

/** Weeks to build on the rough: kept as they went once the bid went in, else counted on the draw. Null: none drawn. */
export function roughWeeks(project: GcProject): RoughWeeks | null {
  const r = project.rough
  if (!r) return null
  if (r.kept) return { weeks: r.kept.weeks, start: r.start, finish: r.kept.finish, kept: r.kept }
  const draw = roughDraw(project)
  const w = draw ? drawWeeks(draw) : null
  return w ? { weeks: w.weeks, start: w.start, finish: w.finish, kept: null } : null
}

/** The rough as it goes with our bid, or at award: its weeks and finish kept. Unchanged when already kept, or when nothing is drawn. */
export function keepRough(project: GcProject, today: string, at: 'bid' | 'award'): RoughSchedule | undefined {
  const r = project.rough
  if (!r || r.kept) return r
  const w = roughWeeks(project)
  return w ? { ...r, kept: { on: today, weeks: w.weeks, finish: w.finish, at } } : r
}

/** One stage on the rough: the days it is drawn with (the job's, else the usual) and the span the draw makes of them. */
export interface RoughStageRow {
  key: string
  label: string
  days: number
  usual: number
  start: string
  finish: string
}

/**
 * The stages the job has on the rough, in build order, with its inspections and its dates to meet.
 * A stage's days are its planned length; its span is what the draw makes of them (a trade with
 * several lines in one stage runs them one after another).
 */
export function roughStages(project: GcProject): { rows: RoughStageRow[]; inspections: { start: string; finish: string } | null; milestones: { label: string; on: string }[] } | null {
  const r = project.rough
  const draw = roughDraw(project)
  if (!r || !draw) return null
  const stageOf = new Map<string, string>()
  for (const pkg of project.packages) for (const l of scheduleLinesOf(pkg)) stageOf.set(l.lineId, lineStage(pkg.trade, l.label))
  const span = (acts: { start: string; finish: string }[]) => ({
    start: acts.reduce((m, a) => (a.start < m ? a.start : m), acts[0]?.start ?? ''),
    finish: acts.reduce((m, a) => (a.finish > m ? a.finish : m), acts[0]?.finish ?? ''),
  })
  const rows = SCHEDULE_STAGES.flatMap((st): RoughStageRow[] => {
    const acts = draw.activities.filter((a) => !a.inspection && stageOf.get(a.lineId) === st.key)
    return acts.length === 0 ? [] : [{ key: st.key, label: st.label, days: r.days[st.key] ?? st.days, usual: st.days, ...span(acts) }]
  })
  const inspections = draw.activities.filter((a) => a.inspection)
  return { rows, inspections: inspections.length > 0 ? span(inspections) : null, milestones: draw.milestones.map((m) => ({ label: m.label, on: m.planned })) }
}

/** The rough card's sentence: the finish and the weeks, or, once kept, the weeks as they went. */
export function roughWeeksWords(project: GcProject): string | null {
  const w = roughWeeks(project)
  if (!w) return null
  if (w.kept?.at === 'bid') return `Our bid went in ${weekdayDate(w.kept.on)} with ${weeksWords(w.weeks)} to build. The rough stays as it went.`
  if (w.kept) return `We won it with ${weeksWords(w.weeks)} to build on the rough. The rough stays as it was.`
  return `If work starts ${weekdayDate(w.start)}, substantial completion is ${weekdayDate(w.finish)}. That is ${weeksWords(w.weeks)}.`
}

/** For the proposal the office sends: "We will build Boerne Retail Shell in 14 weeks from the day work starts." */
export function proposalWeeksWords(project: GcProject): string | null {
  const w = roughWeeks(project)
  return w ? `We will build ${project.name} in ${weeksWords(w.weeks)} from the day work starts.` : null
}

/** The log's line when the rough is drawn. */
export function roughDrawnWords(project: GcProject): string | null {
  const w = roughWeeks(project)
  return w ? `Drew a rough schedule for our bid on ${project.name}. It takes ${weeksWords(w.weeks)} if work starts ${weekdayDate(w.start)}.` : null
}

/** Added to We sent our bid's log line: "It takes 14 weeks to build, by the rough schedule." */
export function bidSentWeeksWords(project: GcProject): string | null {
  const w = roughWeeks(project)
  return w ? `It takes ${weeksWords(w.weeks)} to build, by the rough schedule.` : null
}

/** The first-draft card's line in buyout: the weeks we bid, and what the first draft starts from. */
export function roughFirstDraftWords(project: GcProject): string | null {
  const w = roughWeeks(project)
  if (!w) return null
  // A rough drawn from a template (G-44): the first draft draws the same way.
  if (project.rough?.template) return `We bid ${weeksWords(w.weeks)}, from the rough schedule drawn from a template. The first draft starts from it the same way.`
  return `We bid ${weeksWords(w.weeks)}, from the rough schedule. The first draft starts from its start day and its stage lengths.`
}

/** Once the first draft is drawn, against the bid: "The first draft runs 15 weeks. We bid 14." Null: no rough, or no first draft. */
export function firstDraftAgainstBid(project: GcProject): string | null {
  const bid = roughWeeks(project)
  const draft = project.schedule ? drawWeeks(project.schedule) : null
  if (!bid || !draft) return null
  return draft.weeks === bid.weeks ? `The first draft runs the ${weeksWords(bid.weeks)} we bid.` : `The first draft runs ${weeksWords(draft.weeks)}. We bid ${bid.weeks}.`
}
