/**
 * GC mode, the real build, the schedule's PR 9d: the id of a move just saved. `gc_schedule_move` answers with the
 * schedule's new version, not the move's id, and the walk keeps the ids of the moves it made (G-52,
 * `gc_schedule_walks.move_ids`). So the move is found among those the schedule read after the save has and the read
 * before did not, by its bar, its new days and its note: a save someone else made between the two never matches ours
 * (the plan, to-dos/gc-mode/mockups/schedule-pr9.md on branch spike/gc-mode, "The walk's move ids").
 */
import type { ProjectSchedule, ScheduleMove } from './types'

/** The saved move's id in the schedule read after the save. Null: none matches, so the walk leaves it out of its record. */
export function savedMoveId(before: Pick<ProjectSchedule, 'moves'> | null | undefined, after: Pick<ProjectSchedule, 'moves'> | null | undefined, move: Pick<ScheduleMove, 'lineId' | 'to' | 'note'>): string | null {
  const had = new Set((before?.moves ?? []).map((m) => m.id))
  const note = move.note.trim()
  const found = (after?.moves ?? []).find(
    (m) => !had.has(m.id) && !m.undoneOn && m.lineId === move.lineId && m.to.start === move.to.start && m.to.finish === move.to.finish && m.note.trim() === note,
  )
  return found?.id ?? null
}
