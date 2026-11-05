/**
 * A checklist door on the Pipeline row (punch list #246, PR 1). The owner, 2026-11-02, on the board's screenshot:
 * "I would like an entry point to the checklist on jobs here where the office can see progress and manage." Until now
 * the row's only sign of a stage checklist was v2.6087's amber ☐ before a stage's name under the bar, the count in a
 * hover, and what the office did about it was three presses away on the job window's Documents tab.
 *
 * The door is one icon in the row's action strip under Edit, toned by the job's standing across its stages, and the
 * same line on the phone cards' ⋯ sheet: amber with the count while any stage has a question left, green once every
 * stage with a list is filled, grey while the stages take a checklist but have no question yet, and not drawn at all
 * on a job with no stage that takes one (a service call, a job of Ground and Final lines). The count is what is left
 * to answer: the answered and asked of the stages still open, added up, so one open stage reads its own *3/6*. The
 * title names every stage. This kernel reads the row's own line items against the marks the board already computed
 * (`stageChecklistMarks` over `useStageChecklistStates`), so the door costs the board no read. Pure.
 *
 * PR 2 (v2.6551) adds the board's chip: *Checklist left · N* in the search bar counts the jobs with a question left and,
 * pressed, narrows every section to them, the sections keeping their order.
 */
import { jobShortLabel } from '../plans/planSets'
import { STAGE_CHECKLIST_KIND_NAMES, stageChecklistKindOf, type StageChecklistState } from './stageChecklist'
import type { MarkFixture } from './stageChecklistMarks'

/** A row's line item as the door reads it: the mark's id and name, and the line's place when the row carries it. */
export type DoorFixture = MarkFixture & { sequence_order?: number | null }

/** The door's standing: no stage takes a checklist, no question yet, a question left, every list filled. */
export type ChecklistDoorKind = 'none' | 'empty' | 'open' | 'filled'
export type ChecklistDoorTone = 'amber' | 'green' | 'muted'

export interface PipelineChecklistDoor {
  kind: ChecklistDoorKind
  tone: ChecklistDoorTone
  /** Answered and asked across the stages with a question left; 0 and 0 otherwise. */
  answered: number
  asked: number
  /** The count beside the icon while a question is left, *3/6*; '' otherwise. */
  count: string
  /** The icon's title: *Checklists · Trim Set 3 of 6 · Rough In filled · Top Out filled*. */
  title: string
  /** The icon's accessible name. */
  aria: string
  /** The ⋯ sheet's badge beside *Checklists*: *3 of 6*, *filled*, *no questions yet*. */
  badge: string
}

const NONE: PipelineChecklistDoor = { kind: 'none', tone: 'muted', answered: 0, asked: 0, count: '', title: '', aria: '', badge: '' }

/** The stages that take a checklist, in the row's order, each with its standing or null for no questions yet. */
function stagesTakingChecklist(fixtures: ReadonlyArray<DoorFixture>, marks: ReadonlyMap<string, StageChecklistState> | null): Array<{ name: string; state: StageChecklistState | null }> {
  return [...fixtures]
    .map((f, i) => ({ f, i }))
    .sort((a, b) => (a.f.sequence_order ?? a.i) - (b.f.sequence_order ?? b.i) || a.i - b.i)
    .flatMap(({ f }) => {
      const kind = stageChecklistKindOf(f.name)
      if (!kind) return []
      const state = marks?.get(f.id) ?? null
      return [{ name: (f.name ?? '').trim() || STAGE_CHECKLIST_KIND_NAMES[kind], state: state && state.standing !== 'none' ? state : null }]
    })
}

/** *Rough In, Top Out and Trim Set*: the names joined as a sentence. */
function namesAsWords(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** One stage's words in the title: *Trim Set 3 of 6*, *Rough In filled*, *Top Out has no questions yet*. */
function stageTitleWords(stage: { name: string; state: StageChecklistState | null }): string {
  if (!stage.state) return `${stage.name} has no questions yet`
  if (stage.state.standing === 'ready') return `${stage.name} filled`
  return `${stage.name} ${stage.state.answered} of ${stage.state.asked}`
}

/** The door for one row, from its line items and the board's marks. */
export function pipelineChecklistDoor(fixtures: ReadonlyArray<DoorFixture>, marks: ReadonlyMap<string, StageChecklistState> | null): PipelineChecklistDoor {
  const stages = stagesTakingChecklist(fixtures, marks)
  if (stages.length === 0) return NONE
  const withList = stages.filter((s) => s.state != null)
  if (withList.length === 0) {
    const names = namesAsWords(stages.map((s) => s.name))
    return {
      kind: 'empty',
      tone: 'muted',
      answered: 0,
      asked: 0,
      count: '',
      title: `Checklists · ${names} ${stages.length === 1 ? 'has' : 'have'} no questions yet · press to add the first`,
      aria: 'Checklists on this job · no questions yet',
      badge: 'no questions yet',
    }
  }
  const open = withList.filter((s) => s.state!.standing === 'not_ready')
  if (open.length === 0) {
    return {
      kind: 'filled',
      tone: 'green',
      answered: 0,
      asked: 0,
      count: '',
      title: `Checklists · every stage filled · ${withList.map((s) => `${s.name} ${s.state!.answered} of ${s.state!.asked}`).join(' · ')}`,
      aria: 'Checklists on this job · every stage filled',
      badge: 'filled',
    }
  }
  const answered = open.reduce((n, s) => n + s.state!.answered, 0)
  const asked = open.reduce((n, s) => n + s.state!.asked, 0)
  // The open stages first, so the hover reads what is left before what is done.
  const ordered = [...open, ...stages.filter((s) => s.state == null || s.state.standing === 'ready')]
  return {
    kind: 'open',
    tone: 'amber',
    answered,
    asked,
    count: `${answered}/${asked}`,
    title: `Checklists · ${ordered.map(stageTitleWords).join(' · ')}`,
    aria: `Checklists on this job · ${answered} of ${asked} answered`,
    badge: `${answered} of ${asked}`,
  }
}

// ── The board's chip (PR 2, v2.6551) ────────────────────────────────────────

/** A job with a question left on any of its stages: the chip counts these, and the filter keeps only them. */
export function jobHasChecklistLeft(fixtures: ReadonlyArray<DoorFixture>, marks: ReadonlyMap<string, StageChecklistState> | null): boolean {
  return pipelineChecklistDoor(fixtures, marks).kind === 'open'
}

type JobWithFixtures = { fixtures?: ReadonlyArray<DoorFixture> | null }
type MarksFor<T> = (job: T) => ReadonlyMap<string, StageChecklistState> | null

/** How many of the board's jobs have a question left, read before the chip's own filter so the number holds while it is on. */
export function countJobsWithChecklistLeft<T extends JobWithFixtures>(jobs: readonly T[], marksFor: MarksFor<T>): number {
  return jobs.reduce((n, j) => n + (jobHasChecklistLeft(j.fixtures ?? [], marksFor(j)) ? 1 : 0), 0)
}

/** The jobs with a question left while the chip is on; every job while it is off. The sections keep their order. */
export function filterJobsByChecklistLeft<T extends JobWithFixtures>(jobs: readonly T[], on: boolean, marksFor: MarksFor<T>): T[] {
  if (!on) return [...jobs]
  return jobs.filter((j) => jobHasChecklistLeft(j.fixtures ?? [], marksFor(j)))
}

export interface ChecklistLeftChip {
  count: number
  on: boolean
  /** *Checklist left · 4*. */
  label: string
  title: string
  aria: string
}

/**
 * The chip in the board's search bar, beside the hidden-groups chip: drawn while any job on the board has a question
 * left, and while the filter is on so it can be cleared; null otherwise, so a board with nothing left shows no chip.
 */
export function checklistLeftChip(count: number, on: boolean): ChecklistLeftChip | null {
  if (count === 0 && !on) return null
  const jobs = `${count} job${count === 1 ? '' : 's'}`
  return {
    count,
    on,
    label: `Checklist left · ${count}`,
    title: on
      ? `Showing only the ${jobs} with a question left on a stage checklist — tap to show every job`
      : `${jobs} ${count === 1 ? 'has' : 'have'} a question left on a stage checklist — tap to show only ${count === 1 ? 'it' : 'them'}`,
    aria: on ? `Clear the checklist filter: showing only the ${jobs} with a question left` : `Show only the ${jobs} with a question left on a stage checklist`,
  }
}

// ── The sheet's words ────────────────────────────────────────────────────────

/** The sheet's title: *Checklists on JP1088 · Riders Walk*; the number alone when the job has no name, the name alone when it has no number. */
export function doorJobLabel(job: { click_number?: string | null; hcp_number?: string | null; job_name?: string | null }): string {
  const short = jobShortLabel(job)
  const name = (job.job_name ?? '').trim()
  return name && short !== name ? `${short} · ${name}` : short
}

export function doorSheetTitle(label: string): string {
  return `Checklists on ${label}`
}

export const DOOR_SHEET_WORDS = {
  /** The foot's line: what a press here does. */
  foot: 'Each press saves by itself, under your name.',
  /** The foot's door to the window's Documents tab, for the rest: the skipped line, the company's list. */
  openOnJob: 'Open on the job',
  close: 'Close',
  /** Under a folded stage. */
  folded: 'Press the name to open the rows.',
  loading: 'Loading…',
  /** The ⋯ sheet's line on the phone cards. */
  cardLine: 'Checklists',
  /** A read that failed: the panel's words before the reason. */
  readFailed: 'The stage checklists did not read.',
} as const

/** The empty state when none of the job's stages takes a checklist: the Bill tab is where a stage line is added. */
export function doorEmptyWords(): { main: string; tail: string } {
  return { main: 'No stages take a checklist on this job.', tail: 'and add a stage line named Rough In, Top Out or Trim Set on the Bill tab.' }
}
