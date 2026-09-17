/**
 * The submittal robot's tasks as the office reads them (Submittals stage 6b): the task
 * rows on a bid, what each ready result asks the office to confirm, and the writes a
 * confirm makes. The reading rules live in the twin kernel `_shared/submittalRobot.ts`.
 */
import { asTaskKind, asTaskStatus, parseRedlineAnnotations, parseScheduleRows, parseSheetGuesses, SURE, type RedlineAnnotation, type ScheduleRow, type SheetGuess, type SubmittalTaskKind, type SubmittalTaskStatus } from '../../../supabase/functions/_shared/submittalRobot'

export type SubmittalTaskRow = {
  id: string
  bid_id: string
  submittal_id: string | null
  kind: string
  input: unknown
  result: unknown
  status: string
  requested_at: string
  claimed_at: string | null
  finished_at: string | null
  reviewed_at: string | null
  summary: string | null
}

export type TaskInput = { file_index?: number; path?: string; name?: string; pages?: number; person_name?: string; person_id?: string; reviewer_index?: number }

export function taskInput(t: Pick<SubmittalTaskRow, 'input'>): TaskInput {
  return t.input && typeof t.input === 'object' ? (t.input as TaskInput) : {}
}
export function taskKind(t: Pick<SubmittalTaskRow, 'kind'>): SubmittalTaskKind | null {
  return asTaskKind(t.kind)
}
export function taskStatus(t: Pick<SubmittalTaskRow, 'status'>): SubmittalTaskStatus {
  return asTaskStatus(t.status)
}

/** The live task (queued · working · ready · blocked) of a kind on a target, newest first — done and cancelled ones are history. */
export function liveTask(tasks: ReadonlyArray<SubmittalTaskRow>, kind: SubmittalTaskKind, match: (input: TaskInput, t: SubmittalTaskRow) => boolean = () => true): SubmittalTaskRow | null {
  const live = tasks.filter((t) => taskKind(t) === kind && ['queued', 'working', 'ready', 'blocked'].includes(taskStatus(t)) && match(taskInput(t), t))
  live.sort((a, b) => (a.requested_at < b.requested_at ? 1 : -1))
  return live[0] ?? null
}

/** A ready read_schedule task's rows, split sure / want a look. */
export function scheduleToConfirm(t: SubmittalTaskRow): { sure: ScheduleRow[]; look: ScheduleRow[] } | null {
  if (taskKind(t) !== 'read_schedule' || taskStatus(t) !== 'ready') return null
  const r = (t.result ?? {}) as { rows?: unknown }
  const p = parseScheduleRows(r.rows)
  if (!p.ok) return null
  return { sure: p.rows.filter((x) => x.confidence >= SURE), look: p.rows.filter((x) => x.confidence < SURE) }
}

/** A ready file_cut_sheets task's guesses for the strip: by page, with the tier. */
export function sheetGuessesToConfirm(t: SubmittalTaskRow, pageCount: number): { sure: SheetGuess[]; unsure: SheetGuess[]; skipped: number[] } | null {
  if (taskKind(t) !== 'file_cut_sheets' || taskStatus(t) !== 'ready') return null
  const p = parseSheetGuesses(t.result, pageCount)
  if (!p.ok) return null
  return { sure: p.value.guesses.filter((g) => g.confidence >= SURE), unsure: p.value.guesses.filter((g) => g.confidence < SURE), skipped: p.value.skipped }
}

/** A ready read_redlines task's marks: decisions (sure / unsure) and the questions for the thread. */
export function redlinesToConfirm(t: SubmittalTaskRow): { sure: RedlineAnnotation[]; unsure: RedlineAnnotation[]; questions: RedlineAnnotation[] } | null {
  if (taskKind(t) !== 'read_redlines' || taskStatus(t) !== 'ready') return null
  const r = (t.result ?? {}) as { annotations?: unknown }
  const p = parseRedlineAnnotations(r.annotations)
  if (!p.ok) return null
  const decisions = p.annotations.filter((a) => a.proposed !== 'question' && a.tag)
  return { sure: decisions.filter((a) => a.confidence >= SURE), unsure: decisions.filter((a) => a.confidence < SURE), questions: p.annotations.filter((a) => a.proposed === 'question' || !a.tag) }
}

/** The guess chips' tag per page for one file, from the sure and unsure guesses (unsure marked). */
export function guessByPage(g: { sure: SheetGuess[]; unsure: SheetGuess[] }): Map<number, { tag: string; sure: boolean }> {
  const m = new Map<number, { tag: string; sure: boolean }>()
  for (const x of g.sure) m.set(x.page, { tag: x.tag, sure: true })
  for (const x of g.unsure) m.set(x.page, { tag: x.tag, sure: false })
  return m
}

/** "Confirm 14 · pick 2" / "Confirm 18" / "" */
export function confirmLabel(sure: number, look: number, lookWord = 'pick'): string {
  if (sure === 0 && look === 0) return ''
  const parts: string[] = []
  if (sure) parts.push(`Confirm ${sure}`)
  if (look) parts.push(`${lookWord} ${look}`)
  return parts.join(' · ')
}
