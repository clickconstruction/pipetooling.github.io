/**
 * Bids → Submittals: the robot offers, one shape (v2.4136, punch list #59).
 *
 * Three chores can go to the robot — read the schedule off the plans (step 1), put a
 * PDF's pages on rows (step 3), read a reviewer's redlines (step 6). Every offer says the
 * same three things in the same order: what the robot does, what it needs and whether
 * this bid has it, what you do after; then whether a robot is awake. And no offer shows
 * at all while no robot seat is live — an offer that cannot answer is worse than none
 * (the owner's call, 2026-09-29).
 *
 * "Live" is read from `submittal_robot_liveness()` (the unrevoked twin seats and the
 * newest time any of them was used): a seat used inside the last seven days.
 */

export type RobotKind = 'read_schedule' | 'file_cut_sheets' | 'read_redlines'

/** What `submittal_robot_liveness()` answers. */
export type RobotSeatRow = { unrevoked_seats: number; last_used_at: string | null }

export type RobotSeatState = {
  /** A seat exists and was used inside `SEAT_LIVE_WINDOW_MS`; only then is any offer shown. */
  live: boolean
  /** The awake line under the offer: "A robot was working 12 min ago." */
  line: string
}

export const SEAT_LIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

export function robotSeatState(row: RobotSeatRow | null | undefined, nowMs: number): RobotSeatState {
  if (!row || !(row.unrevoked_seats > 0)) return { live: false, line: 'No robot seat exists.' }
  if (!row.last_used_at) return { live: false, line: 'No robot has run yet.' }
  const age = nowMs - new Date(row.last_used_at).getTime()
  if (!Number.isFinite(age) || age < 0) return { live: true, line: 'A robot is working now.' }
  if (age < HOUR) return { live: true, line: `A robot was working ${Math.max(1, Math.round(age / MIN))} min ago.` }
  if (age < DAY) return { live: true, line: `A robot last ran ${Math.round(age / HOUR)} h ago.` }
  const days = Math.round(age / DAY)
  if (age < SEAT_LIVE_WINDOW_MS) return { live: true, line: `A robot last ran ${days} day${days === 1 ? '' : 's'} ago.` }
  return { live: false, line: `No robot has run in ${days} days.` }
}

export type RobotOfferText = {
  /** What the robot does. */
  does: string
  /** What it needs, and whether this bid has it. */
  needs: { ok: boolean; text: string }
  /** What you do after. */
  after: string
  /** The button, always second to the human door. */
  button: string
}

export function robotOfferText(kind: RobotKind, input: { hasPlans?: boolean } = {}): RobotOfferText {
  switch (kind) {
    case 'read_schedule':
      return {
        does: 'The robot can read the fixture schedule off the plans.',
        needs: input.hasPlans ? { ok: true, text: 'Needs the plans on this bid ✓' } : { ok: false, text: 'Needs the plans on this bid ✗ Add the plans link on the bid first.' },
        after: 'Its tags land here in a few minutes. You tick the right ones. Nothing counts until you do.',
        button: 'Ask the robot to read the schedule',
      }
    case 'file_cut_sheets':
      return {
        does: 'The robot can put each page of this PDF on its row.',
        needs: { ok: true, text: 'Needs the PDF on this version ✓' },
        after: 'Its guesses show on the pages in a few minutes. You confirm each one.',
        button: 'Ask the robot to split this file',
      }
    case 'read_redlines':
      return {
        does: 'The robot can read the marks on this file into answers.',
        needs: { ok: true, text: 'Needs the reviewer’s file ✓' },
        after: 'Its answers land on the rows as proposed. You confirm each one.',
        button: 'Ask the robot to read the redlines',
      }
  }
}
