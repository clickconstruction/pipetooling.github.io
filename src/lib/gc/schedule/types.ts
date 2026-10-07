/**
 * GC mode, the real build, the schedule's PR 1a: the schedule's own shapes, moved word for word from the
 * GC mode prototype (branch spike/gc-mode, `gcTypes.ts`), so its records fit them as they are. The
 * schedule, its activities and their parts, waits and limits, the dates to meet, baselines, the
 * look-ahead marks, moves with what they pushed and who was told, the weekly walks, a trade's late
 * notices, the what-if copy and the template a draft came from.
 */

/**
 * A line of a schedule template (G-44): one line of a trade, or one of the two inspections the first
 * draft draws, as it ran on the job it was saved from. No dates: its days, what it waits on and how
 * many days after them it started.
 */
export interface TemplateLine {
  /** "Roofing". Empty for one of the job's two inspections. */
  trade: string
  /** "TPO membrane", or "Rough-in inspection". Another job's line of the same trade and name takes it, whatever the case. */
  label: string
  /** The stage the first draft puts it in. */
  stage: string
  /** Its days, both ends counted. */
  days: number
  /** The lines it waits on, by trade and name, each with the office's gap on that wait (G-35) when one was set. */
  after: { trade: string; label: string; gap?: number }[]
  /** Days after the last of those finished that it started. With nothing to wait on: days after the job's first day. */
  offset: number
  /** Where the work is, as the office kept it on that job (G-83). The draw keeps it on the same line of the new job. Unset: none kept. */
  place?: string
  /** Its parts when the line was split (G-39): each name, its first day from the line's start, its days and its share. No percent. Unset: one bar. */
  parts?: { name: string; from: number; days: number; share: number }[]
}

/** The template a draw came from, by the name it had that day (G-44). */
export interface TemplateUse {
  id: string
  name: string
  on: string
}

/**
 * One activity on the schedule (owner, 2026-10-02: several per trade): a line of a trade's
 * statement of work, or a stage our own crew runs. The same line the trade reports and draws on.
 */
export interface ScheduleActivity {
  /** The schedule-of-values line id (a trade we hire) or the scope line id (our own crew). */
  lineId: string
  packageId: string
  /** Planned start and finish, YYYY-MM-DD, both days counted. */
  start: string
  finish: string
  /** The activities (line ids) it waits on: it starts after each one finishes. */
  after: string[]
  /** Days of gap after one it waits on finishes before it may start (the Gantt, G-35: cure time, a lead time), by that line's id. Unset: none. */
  lag?: Record<string, number>
  /** A day it cannot start before: a delivery, a permit (G-36). Unset: none. */
  notBefore?: string
  /** A day it must finish by: a date in the contract, an inspection booked (G-36). Unset: none. */
  mustFinishBy?: string
  /**
   * An inspection (owner, 2026-10-03): the job's own activity, not a trade's line, with no dollars.
   * Its packageId is '' and its lineId its own (`${projectId}-insp-roughin`). It counts on the
   * critical path, not in work done against the plan. Passed: the day it passed.
   */
  inspection?: { label: string; passedOn?: string; failed?: InspectionFailure[] }
  /**
   * An activity that is no line of a trade's statement of work (the Gantt, G-38): mobilize, cure
   * time, the customer's own work. Its packageId is '' and its lineId its own (`${projectId}-own-N`).
   * No dollars and nobody reports it: the office marks it done. It counts on the critical path.
   */
  added?: { label: string; who: string; doneOn: string | null }
  /** The day it really started, beside the planned one (the Gantt, G-55): set by the walk or the editor. Unset: not recorded. */
  actualStart?: string
  /** The day it really finished (G-55). Unset: not recorded. */
  actualFinish?: string
  /** Where on the job its work is, in the office's word: Roof, Inside, Level 2 (G-83). Unset: no place yet. A guess is never kept here until the office keeps it. */
  place?: string
  /** A line split into parts (G-39): first floor, second floor. The line's dates are their span, its percent their weighted sum. Unset: one bar. */
  parts?: ActivityPart[]
}

/**
 * One part of a split line (the Gantt, G-39): a floor or an area of the work, with its own dates
 * and percent. Its days are counted from the line's start, so every move of the line carries it:
 * a drag, a push, a pull, days got back, Undo, a what-if. The part that ends last ends with the
 * line, so a new finish on the line lands on it.
 */
export interface ActivityPart {
  /** `${lineId}-p1` */
  id: string
  /** "Sales floor", as the office named it. */
  name: string
  /** Its first day, in days from the line's start. 0: with the line. */
  from: number
  /** Its days. The part that ends last ends with the line, whatever this says. */
  days: number
  /** Its share of the line's work, in percent, set from the days at the split and kept. The shares add up to 100. */
  share: number
  /** Percent done, as its trade or our own crew reported it. */
  pct: number
  /** The day it really started and finished, set by its reports (G-55). Unset: not yet. */
  actualStart?: string
  actualFinish?: string
}

/**
 * An inspection that did not pass (owner, 2026-10-03): the day, what failed, whose work it was,
 * and the day it is inspected again. The activity moves to that day; what waits on it moves out.
 */
export interface InspectionFailure {
  on: string
  note: string
  /** The trades whose work failed. Empty: not known. */
  packageIds: string[]
  reinspectOn: string
}

/** A date the schedule must meet: dry-in, the rough-in inspection, substantial completion. */
export interface ScheduleMilestone {
  id: string
  label: string
  planned: string
  /** The trade it belongs to. Null: the job's own. */
  packageId: string | null
  /** The day it was met. Null: not yet. */
  metOn: string | null
}

export type LookAheadReason = 'weather' | 'trade before' | 'materials' | 'crew' | 'other'

/**
 * A week's look-ahead mark (owner, 2026-10-02): the trade marks an activity done or not in its
 * portal; our superintendent verifies the mark or corrects it. Only a verified mark counts.
 */
export interface LookAheadMark {
  /** The Monday of the week. */
  weekOf: string
  lineId: string
  packageId: string
  /** The trade's mark. */
  done: boolean
  /** Why not, when not done. */
  reason?: LookAheadReason
  markedOn: string
  /** The day our superintendent verified it. Null: waiting on them. */
  verifiedOn: string | null
  /** The superintendent's mark, when it differs from the trade's. */
  verifiedDone?: boolean
  /** Why not, in the superintendent's words, when they corrected a "done" to not done. */
  verifiedReason?: LookAheadReason
}

export interface ProjectSchedule {
  activities: ScheduleActivity[]
  milestones: ScheduleMilestone[]
  /** Locked at Start, or set anew after a signed change order (G-41): each activity's planned start and finish then, by line id. Null: not locked yet. */
  baseline: ScheduleBaseline | null
  /** The baselines retired by a new one (G-41), oldest first, each kept and named. Unset: only the one at Start. */
  baselines?: ScheduleBaseline[]
  lookAhead: LookAheadMark[]
  /** Every move made with an explanation, newest first (the owner, 2026-10-05; the Gantt, Phase 2). Unset: none yet. */
  moves?: ScheduleMove[]
  /** Every weekly walk of the schedule, newest first (the owner, 2026-10-05: "build the weekly walk"). Unset: never walked. */
  walks?: ScheduleWalk[]
  /** Every late notice a trade sent from its portal, newest first (the Gantt, G-117). Unset: none yet. */
  lateNotices?: LateNotice[]
  /** The template its first draft was drawn from (G-44). Unset: none. */
  template?: TemplateUse
}

/** A plan the schedule is measured against (G-41): the one locked at Start, or one set after a signed change order, named. */
export interface ScheduleBaseline {
  lockedOn: string
  activities: Record<string, { start: string; finish: string }>
  /** "At Start", "After change order 2". Unset: the one at Start. */
  name?: string
  by?: string
  why?: string
}

/**
 * One weekly walk of the schedule (the Gantt, G-52): someone went through every bar that should
 * have moved, kept it as drawn or moved it with an explanation. It is what makes the chart true on
 * a given day, so the day and the person are kept, with what was kept and what was moved.
 */
export interface ScheduleWalk {
  id: string
  on: string
  by: string
  /** The activities looked at and left as drawn. */
  kept: string[]
  /** The moves made during the walk, by id (`schedule.moves`). */
  moveIds: string[]
  /** How many bars the walk listed and nobody looked at. */
  skipped: number
  /** The early finishes the walk answered with Keep the dates (G-37): no work is pulled in after them. Unset: none. */
  keptEarly?: string[]
}

/** Why a bar moved: the look-ahead's reasons, and the ones a move adds. */
export type ScheduleMoveReason = 'weather' | 'trade before' | 'materials' | 'crew' | 'customer' | 'plans' | 'inspection' | 'us' | 'change order' | 'other' | 'early' | 'recovery'

/**
 * One move on the schedule (the owner, 2026-10-05: "anyone on our team may move a bar, when a bar
 * is moved an explanation should be given and recorded"). Who, when, which activity, its dates
 * before and after, the reason picked and their own words, and what it pushed. Kept for good: an
 * undone move stays on the record with the day it was undone.
 */
export interface ScheduleMove {
  id: string
  /** The day it was made. */
  on: string
  by: string
  lineId: string
  from: { start: string; finish: string }
  to: { start: string; finish: string }
  reason: ScheduleMoveReason
  /** The explanation, in their own words. Never empty. */
  note: string
  /** What it waits on changed with it. */
  linksChanged?: boolean
  /** What comes after it that moved out with it, each with its dates before and after. */
  pushed: { lineId: string; from: { start: string; finish: string }; to: { start: string; finish: string } }[]
  /** The job's last finish before and after: how many days the move cost or gave back. */
  finishFrom: string
  finishTo: string
  /** The day it was undone, and who undid it. Unset: it stands. */
  undoneOn?: string
  undoneBy?: string
  /** The day the companies whose dates it changed were told, and which (the Gantt, Phase 3: Tell the trades). Unset: not told yet. */
  toldOn?: string
  toldTo?: string[]
  /** Each company's answer from its portal: the dates work, or it needs another day. */
  answers?: { partnerId: string; on: string; ok: boolean; day?: string; note?: string }[]
  /** The signed change order whose days this move put on the schedule (the Gantt, G-76). Unset: an ordinary move. */
  changeOrderId?: string
  /** The trade's late notice this move took (the Gantt, G-117). Unset: an ordinary move. */
  lateNoticeId?: string
  /**
   * A pull (G-37): these lines finished early and their plans caught up (the move's own line is the
   * first); everything else in `pushed` came in after them, not out. Tell the trades skips the
   * finished lines: their work is done. Unset: an ordinary move.
   */
  pull?: { finished: string[] }
  /**
   * Days got back (G-82): side by side, the line now starts before the work it waits on (`after`)
   * finishes, its gap there changed from `gapWas` to `gap`, which Undo and Redo put back too; or a
   * second crew on it. Everything in `pushed` came in behind it. Unset: an ordinary move.
   */
  recovery?: { how: 'side' | 'crew'; after?: string; gapWas?: number; gap?: number }
  /** Tried in a what-if copy with no reason yet (G-81): its reason and words are a stand-in, and Keep asks for real ones. Never on a real move. */
  noWhy?: boolean
  /** Kept from a what-if copy made on this day (G-81): tried there first, then put on the real schedule with its reason. Unset: an ordinary move. */
  fromWhatIf?: string
  /** A part of a split line moved (G-39): which, and every part's days from the line's start before and after, so Undo and Redo put them back. Unset: the line moved whole, its parts with it. */
  parts?: { id: string; was: { id: string; from: number; days: number }[]; now: { id: string; from: number; days: number }[] }
}

/** One activity's planned dates and waits, as a what-if copy saw them on the real schedule (G-81). */
export interface WhatIfBase {
  start: string
  finish: string
  after: string[]
  lag?: Record<string, number>
  notBefore?: string
  mustFinishBy?: string
  /** A split line's parts (G-39): their days from its start. */
  parts?: { id: string; from: number; days: number }[]
}

/**
 * A what-if copy of the schedule (the Gantt, G-81): the real schedule when it was made, with moves
 * of its own tried on it, kept onto the real one as real moves or thrown away. It is never walked,
 * told, sent or baselined, and nothing outside the Schedule tab reads it.
 */
export interface ScheduleWhatIf {
  /** The copy, with its own history of moves tried. */
  schedule: ProjectSchedule
  /** Each activity's planned dates and waits on the real schedule when the copy was made. Keep is safe only while the real one still has them. */
  base: Record<string, WhatIfBase>
  on: string
  by: string
}

/**
 * A trade's word from its portal that it will be late (the Gantt, G-117): the new day, why, and
 * the office's answer. Nothing moves until the office takes it as a move (`ScheduleMove.lateNoticeId`)
 * or pushes back. Where it stands is read each time (`lateNoticeState` in gcLateNotices.ts).
 */
export interface LateNotice {
  /** `late-1`, `late-2`, … kept newest first. */
  id: string
  partnerId: string
  lineId: string
  /** The day it was sent. */
  on: string
  /** Who at the company sent it: its contact. */
  by: string
  /** Under way: the day asked for is a new finish. Not started: a new start, the bar moving whole. */
  started: boolean
  /** The bar's dates when it was sent. */
  was: { start: string; finish: string }
  /** The dates it asks for. */
  to: { start: string; finish: string }
  reason: LookAheadReason
  /** What happened, in their words. Never empty. */
  note: string
  /** The office needs the day as drawn, and said why. */
  pushedBack?: { on: string; by: string; note: string }
  /** After a push back, the company said it will make the day. */
  kept?: { on: string }
}

/**
 * A trade's own word on how many people a day it will have on site in a week (G-142), from its
 * portal's look-ahead. Kept newest first: the newest for a trade and week is the one that counts,
 * and the ones before it say when a count was cut.
 */
export interface CrewCount {
  packageId: string
  partnerId: string
  /** The Monday of the week it is for. */
  weekOf: string
  /** About how many people a day, a whole number. 0: nobody that week. */
  count: number
  /** The day they said it. */
  on: string
}

/** What the work waits on from outside the trades (G-73 to G-75): a long-lead delivery, a decision the customer owes, a permit, the utility's work. */
export type WaitKind = 'delivery' | 'decision' | 'permit' | 'utility'

/**
 * One thing the work waits on that is not a trade's work (the Gantt, Phase 4): a long-lead item
 * on order, a decision the customer owes us, a permit the city owes us, the utility's part. It
 * holds the activities that need it until it is in, and it is drawn on the chart as a row of its
 * own, so the day it is expected reads beside the day the work needs it.
 */
export interface ScheduleWait {
  id: string
  kind: WaitKind
  /** "Rooftop units", "Restroom tile", "Electrical service permit", "The transformer". */
  title: string
  /** The trade whose work needs it. Null: the job's own. */
  packageId: string | null
  /** Who we wait on, by name: the supplier, the customer, the city, the utility. */
  who: string
  /** The activities (line ids) that cannot start until it is in. */
  lineIds: string[]
  /** The day it was ordered, asked for, applied for or requested. Null: not yet. */
  askedOn: string | null
  /** The day it is expected: the supplier's date, the day the customer said, the city's turnaround. */
  expectedOn: string
  /** A delivery only: the day it shipped. Null: not yet. */
  shippedOn?: string | null
  /** The day it came: on site, decided, issued, done. Null: still waiting. */
  doneOn: string | null
  /** Who said the expected day, or what is holding it up. */
  note?: string
}

/**
 * A rough schedule drawn while we bid (the Gantt's G-45): the start day and the stage lengths it is
 * drawn from, by the first draft's own kernel. Never the schedule itself: the trades' and the
 * customer's views read `GcProject.schedule`, and this stays out of it.
 */
export interface RoughSchedule {
  /** The day work would start, as the office assumes it while bidding. */
  start: string
  /** This job's stage lengths in days, by stage key. A stage not named takes its usual days. */
  days: Record<string, number>
  by: string
  on: string
  /** The weeks to build and the finish as they went with our bid: kept when the bid went in, or at award if it was never marked sent. */
  kept?: { on: string; weeks: number; finish: string; at: 'bid' | 'award' }
  /** The template it was drawn from (G-44). Unset: the stage days alone. */
  template?: TemplateUse
  /** A copy of that template's lines, so every redraw reads the copy and no edit to the template reaches the rough (G-44). */
  like?: TemplateLine[]
}

/** A job's schedule shape kept to start the next job like it (G-44). Never dates, companies, percents or moves. */
export interface ScheduleTemplate {
  id: string
  name: string
  /** The job it was saved from, by its name then, and how much of its work was done. */
  from: { projectId: string; name: string; donePct: number }
  on: string
  by: string
  lines: TemplateLine[]
  /** Each stage's span on that job in days, first start to last finish, in build order: what the card shows. */
  stages: { key: string; days: number }[]
  /** From the job's first day to substantial completion, in whole weeks. */
  weeks: number
  /** Set aside: not offered for new jobs. The jobs drawn from it keep what they drew. */
  asideOn?: string
}

/** The customer's schedule sent on its own, dated and kept as sent (G-94). */
export interface ScheduleSend {
  id: string
  on: string
  by: string
  /** Who it went to: the customer's contact and company. */
  to: string
  subject: string
  /** The letter, one paragraph a line. */
  lines: string[]
}

/** Where a row of a schedule someone handed us lands (G-137): one of our lines, an inspection, or the job's own. */
export type ScheduleImportPlace =
  | { kind: 'line'; lineId: string }
  | { kind: 'roughInInspection' }
  | { kind: 'finalInspection' }
  | { kind: 'inspection' }
  | { kind: 'added'; who: string }

/** One activity of theirs the office kept, and where it lands (G-137). */
export interface ScheduleImportRow {
  /** The file's own key for it: its task's number, or its line in the spreadsheet. */
  key: string
  name: string
  start: string
  finish: string
  place: ScheduleImportPlace
  /** What it waits on in their file, by key, with the days of gap. */
  after: { key: string; gap: number }[]
  notBefore?: string
  mustFinishBy?: string
  /** Shorter than a working day in their file: it never becomes a part of a split line (G-137 after G-39). */
  underADay?: boolean
  /** Where its work is, from our own file's Place (G-83): kept on the line it lands on. Unset: none in the file. */
  workPlace?: string
}

/** A schedule a customer or the architect handed us, as the office kept it (G-137). Never kept on the job: the schedule it makes is. */
export interface ScheduleImport {
  /** The file's name and who handed it, for the log. */
  file: string
  from: string
  /** The day our lines not in the file are drawn from, when nothing they wait on comes later. */
  workStarts: string
  rows: ScheduleImportRow[]
  /** Their dates to meet, as ticked. */
  dates: { name: string; on: string }[]
}
