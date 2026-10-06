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

/**
 * A queued ask that nobody is coming for (2026-10-03, the tab review's finding 9). BP375 read
 * "The robot is queued to read the fixture schedule off the plans" for days: no date, and no word
 * that no robot was on shift. The ask is stale when no seat is live, or when it has waited more
 * than a day. Then the line says the day it was asked, what the seats are doing, and what to do
 * by hand. null while the wait is ordinary: the page keeps its usual words.
 */
export const ASK_STALE_AFTER_MS = DAY

/** v2.4690 · past a week the ask is old: the line says how many days, and the button reads Withdraw the ask. */
export const ASK_OLD_AFTER_DAYS = 7

export type StaleAsk = {
  /** Whole days since the ask. */
  daysWaited: number
  /** "You asked the robot on Sep 29. No robot has run in 12 days." */
  head: string
  /** What to do by hand, for the chore asked. */
  detail: string
  /** "asked Sep 29 · no robot has run in 12 days": the short form, after a task's own line. */
  suffix: string
}

const BY_HAND: Record<RobotKind, string> = {
  read_schedule: 'Nobody is reading the plans. Type the schedule yourself, or leave the ask in place.',
  file_cut_sheets: 'Nobody is reading this file. Put its pages on the rows yourself, or leave the ask in place.',
  read_redlines: 'Nobody is reading this file. Type their answers yourself, or leave the ask in place.',
}

export function staleAsk(kind: RobotKind, requestedAt: string | null | undefined, seat: RobotSeatState, nowMs: number, /** "Sep 29" for an instant */ day: (iso: string) => string): StaleAsk | null {
  const asked = requestedAt ? new Date(requestedAt).getTime() : NaN
  if (!Number.isFinite(asked)) return null
  const waited = nowMs - asked
  if (seat.live && waited < ASK_STALE_AFTER_MS) return null
  const when = day(requestedAt as string)
  const daysWaited = Math.max(0, Math.floor(waited / DAY))
  // v2.4690 · a week on, the day it was asked matters less than how long it has sat: say the days, and that nobody came.
  if (daysWaited >= ASK_OLD_AFTER_DAYS) {
    return { daysWaited, head: `You asked the robot ${daysWaited} days ago. Nobody has picked it up.`, detail: BY_HAND[kind], suffix: `asked ${daysWaited} days ago · nobody picked it up` }
  }
  // A live seat that has not taken it in a day: say so in place of the seat's own line, which would read as hope.
  const seatWords = seat.live ? `${seat.line} It has not picked this up.` : seat.line
  return {
    daysWaited,
    head: `You asked the robot${when ? ` on ${when}` : ''}. ${seatWords}`,
    detail: BY_HAND[kind],
    suffix: `${when ? `asked ${when} · ` : ''}${seat.live ? 'not picked up yet' : seat.line.replace(/\.$/, '').replace(/^No /, 'no ').replace(/^A /, 'a ')}`,
  }
}
