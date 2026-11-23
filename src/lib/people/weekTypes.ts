/**
 * The types a person's week is written in, on their own so a kernel that runs on the edge can name them: the copy
 * (`scripts/edge-kernels.mjs`) takes types only from a file that runs no code. `weekAvailability.ts` and
 * `utilization.ts` hand them on under the names every reader already imports.
 */

/** Minutes from midnight on the company clock, end exclusive. */
export type Segment = [start: number, end: number]
/** Seven days, Sunday first. */
export type WeekDays = Segment[][]

/** One answer: the hours a person can work in a week, from a day on. Append-only; the newest in force wins. */
export type AvailableHoursAnswer = {
  user_id: string
  hours_per_week: number
  /** The week as drawn, seven days Sunday first, each a list of [start, end] minutes; null when only a number was given. */
  days?: WeekDays | null
  /** YYYY-MM-DD; the answer holds from this Sunday's week on. */
  effective_from: string
  set_by: string | null
  set_at: string
  note?: string | null
  /**
   * `set` is the person's working hours, written by a dev or the controller through `set_working_hours`; it wins
   * over any answer, and `days` null takes the hours off again. Missing or `answer` is the week a person can work.
   */
  kind?: 'answer' | 'set'
}
