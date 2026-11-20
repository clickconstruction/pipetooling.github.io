/**
 * The colour of work on the Checklist's maps (v2.8045), and what a dot wears now that colour no
 * longer says who. For the screen alone.
 *
 * Kept out of `taskPlace.ts` on purpose: that kernel is copied to the edge (`npm run gen:edge-kernels`),
 * and a colour a screen draws would change every function that reads the copy. For the same reason
 * the palette this replaced (`TASK_PLACE_PERSON_COLORS`, `taskPlacePersonColor`,
 * `TASK_PLACE_SHARED_COLOR`) still sits there, read by no screen. It leaves with the next change
 * that kernel needs for its own sake.
 */
import { ORANGE_UNDER_WORDS } from '../orangeUnderWords'
import type { TaskPlaceTeamDot } from './taskPlace'

/**
 * The colour of work: the app's safety orange in the shade it wears under white words, the Clock In
 * bar's own (`orangeUnderWords.ts`). Every open task's dot is this colour on the person's map and on
 * the leader's, so work reads the same on both. The owner, on a walk of 2026-11-20: the icons for
 * work should not be dark blue but safety orange.
 */
export const TASK_PLACE_WORK_COLOR = ORANGE_UNDER_WORDS
/** A dot with a task that is late. Red means late on the Checklist (punch list #369), on the map too. */
export const TASK_PLACE_LATE_COLOR = '#dc2626'
/**
 * The ring every work dot wears: white, so the orange keeps its edge on a photograph of brown
 * ground, on a road map whose main roads are orange, and on the dark road map.
 */
export const TASK_PLACE_RING_COLOR = '#ffffff'

/**
 * A dot's colour on the person's own map: red when a task there is late, the work colour otherwise.
 * An older task that is not late draws as any open work does. Its amber sat a shade from the work
 * colour, and red is the one colour that has to stand apart.
 */
export function taskPlaceDotColor(dot: { overdue: boolean }): string {
  return dot.overdue ? TASK_PLACE_LATE_COLOR : TASK_PLACE_WORK_COLOR
}

/**
 * What a dot on the leader's map wears: the initials of the one person whose tasks are there, or the
 * count of tasks where people share the place. Letters are a person and a number is a crowd.
 * `initialsOf` is the board's own (`initialsFor`), so the dot reads as the mark beside the person's
 * name on the chips and below.
 */
export function taskPlaceTeamDotLabel(dot: Pick<TaskPlaceTeamDot, 'personIds' | 'tasks'>, initialsOf: (personId: string) => string): string {
  const only = dot.personIds.length === 1 ? dot.personIds[0] : undefined
  return only !== undefined ? initialsOf(only) : String(dot.tasks.length)
}
