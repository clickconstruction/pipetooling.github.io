/**
 * The robot in one line (2026-10-05). A robot offer was a dashed box of four lines for one
 * button, and a stuck ask an amber box of five lines for one link — the biggest thing in step 1
 * for the smallest choice in it. Each is now a line: a chip that says the state in a few words,
 * the one thing to press beside it, and the full story in a card that opens on hover, on focus
 * and on a tap (`RobotNote`). The words did not change; this file says which of them are the
 * chip and which are the card.
 *
 * The chip carries the state, never just "Robot": a stuck ask is amber and names the day it was
 * asked, so nothing that matters waits for a hover.
 */
import { describeTask } from '../../../supabase/functions/_shared/submittalRobot'
import { robotOfferText, staleAsk, type RobotKind, type RobotSeatState } from './robotOffer'
import { scheduleToConfirm, taskStatus, type SubmittalTaskRow } from './robotTasks'

export type RobotNoteTone = 'plain' | 'warn' | 'good' | 'bad'

export type RobotNoteWords = {
  tone: RobotNoteTone
  /** The chip: the state in a few words. Null for an offer, whose button is the whole line. */
  chip: string | null
  /** The card's lines, the first one the headline. */
  lines: string[]
  /** The one thing to press, and whether it is held (the offer's need is not met). */
  button: { label: string; held: boolean } | null
  /** Beside a held button: why, in a few words. */
  heldWhy: string
  /** The card ends with the door to the guide's robot section. */
  guide: boolean
}

/** An offer: the ask button is the line; the card says what the robot does, what it needs, whether one is awake, and what you do after. Null while no seat is live. */
export function robotOfferNote(kind: RobotKind, seat: RobotSeatState, input: { hasPlans?: boolean } = {}): RobotNoteWords | null {
  if (!seat.live) return null
  const t = robotOfferText(kind, input)
  return {
    tone: t.needs.ok ? 'plain' : 'warn',
    chip: null,
    lines: [t.does, `${t.needs.text} · ${seat.line}`, t.after],
    button: { label: t.button, held: !t.needs.ok },
    heldWhy: t.needs.ok ? '' : 'needs the plans link on the bid',
    guide: true,
  }
}

const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** The schedule read once it is asked: queued, stuck, working, read, or blocked. */
export function robotScheduleNote(task: SubmittalTaskRow, seat: RobotSeatState, nowMs: number, /** "Sep 29" for an instant */ day: (iso: string) => string): RobotNoteWords {
  const st = taskStatus(task)
  const line = describeTask(task)
  const base = { heldWhy: '', guide: false }
  if (st === 'queued') {
    const stale = staleAsk('read_schedule', task.requested_at, seat, nowMs, day)
    if (stale) return { ...base, tone: 'warn', chip: upperFirst(stale.suffix), lines: [stale.head, stale.detail], button: { label: 'Take the ask back', held: false } }
    return { ...base, tone: 'plain', chip: 'Queued to read the plans', lines: ['The robot is queued to read the fixture schedule off the plans.', line], button: { label: 'Cancel', held: false } }
  }
  if (st === 'blocked') return { ...base, tone: 'bad', chip: 'Could not read the plans', lines: [task.summary || 'The robot could not read the plans.', line], button: { label: 'Dismiss', held: false } }
  if (st === 'ready') {
    const conf = scheduleToConfirm(task)
    const n = conf ? conf.sure.length + conf.look.length : 0
    return conf
      ? { ...base, tone: 'good', chip: `Read ${n} tag${n === 1 ? '' : 's'} · confirm below`, lines: ['The robot read the schedule. Confirm the tags below.', line], button: null }
      : { ...base, tone: 'plain', chip: 'Found no tags', lines: ['The robot read the schedule and found no tags.', line], button: null }
  }
  return { ...base, tone: 'plain', chip: 'Reading the plans now', lines: ['The robot is reading the fixture schedule off the plans.', line], button: null }
}

/**
 * Whether the robot's schedule read keeps step 1 open on its own. Only a read that is back and
 * waiting to be confirmed does: that is work for her, under the rows. Queued, stuck, working or
 * blocked fits on the folded step's one line (`robotScheduleNote(...).chip`), so a finished step
 * 1 folds like any other and still says what the robot is doing.
 */
export function scheduleReadHoldsStepOpen(task: SubmittalTaskRow | null | undefined): boolean {
  return task != null && taskStatus(task) === 'ready' && scheduleToConfirm(task) != null
}
