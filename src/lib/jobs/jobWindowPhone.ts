/**
 * The job window on a phone (punch list #355, PR A): the name first with ⋯ and ✕ stacked at the right, one tab
 * strip that scrolls sideways, the header scrolling away with the page and coming back with a ✕ at the strip's right
 * on a scroll up (v2.7300), every door
 * of the old icon row as a named row in the ⋯ sheet, and the money tiles and the job accounts as one line each
 * ending in their act. Pure: the rows, the words and the scroll rule; the screens are `JobWindowModal` and
 * `DetailJobModal` in pane mode.
 */
import type { EditJobBillingBar } from './editJobBillingBar'
import { formatCurrencyNoCents } from './jobFormatting'
import type { JobWindowVerb } from './jobWindowBar'

// ---------------------------------------------------------------------------
// The header on scroll
// ---------------------------------------------------------------------------

export type HeaderScrollState = {
  /** The title row and the strip have scrolled off the top: no ✕ is drawn until the strip is pinned again. */
  headGone: boolean
  /** The reader is scrolling back up with the strip off screen: the strip is drawn again at the top, the ✕ at its right. */
  stripPinned: boolean
}

/**
 * What the header does at a scroll position. `headBottom` is where the strip ends in the body's own scroll; a
 * scroll past it hides the header, and a scroll back up while past it brings the strip back without the title.
 * A scroll of under 4 px is noise (a touch settling) and keeps the last direction.
 */
export function headerScrollState(input: { top: number; lastTop: number; headBottom: number; wasPinned: boolean }): HeaderScrollState {
  const { top, lastTop, headBottom, wasPinned } = input
  const headGone = top > headBottom
  if (!headGone) return { headGone: false, stripPinned: false }
  const delta = top - lastTop
  if (delta <= -4) return { headGone, stripPinned: true }
  if (delta >= 4) return { headGone, stripPinned: false }
  return { headGone, stripPinned: wasPinned }
}

// ---------------------------------------------------------------------------
// The ⋯ sheet
// ---------------------------------------------------------------------------

export type JobWindowSheetKey = 'share' | 'calendar' | 'account' | 'money' | 'paid' | 'task' | 'change' | 'legend'

export type JobWindowSheetRow = {
  key: JobWindowSheetKey
  label: string
  /** The quiet word at the row's right: the next block, the house and the day. */
  quiet: string | null
  /** A row drawn but not pressable, with its reason as the quiet word. */
  dead: boolean
}

/** What the pane can open from the sheet: each door on only while its press would land. */
export type JobWindowSheetDoors = {
  share: boolean
  calendar: boolean
  /** The next scheduled block's words for the calendar row, or null. */
  nextBlock: string | null
  account: boolean
  /** *none yet*, or *Ferguson · Nov 3* once a packet has gone out. */
  accountQuiet: string | null
  money: boolean
  paid: boolean
  task: boolean
  /** Send as a task waits for the job to load. */
  taskReady: boolean
  change: boolean
}

export const SHEET_LABELS: Record<JobWindowSheetKey, string> = {
  share: 'Share the job',
  calendar: 'Open the calendar',
  account: 'Add job account',
  money: 'Money story',
  paid: 'Email the paid-in-full report',
  task: 'Send as a task',
  change: 'Make change order',
  legend: 'What this window holds',
}

/**
 * The sheet's rows, in the order the press count set: Share and Calendar first, since they are the two anyone
 * pressed, the ? card last. A door the role lacks is not drawn; Send as a task before the job loads is drawn dead.
 */
export function jobWindowSheetRows(doors: JobWindowSheetDoors): JobWindowSheetRow[] {
  const rows: JobWindowSheetRow[] = []
  if (doors.share) rows.push({ key: 'share', label: SHEET_LABELS.share, quiet: null, dead: false })
  if (doors.calendar) rows.push({ key: 'calendar', label: SHEET_LABELS.calendar, quiet: doors.nextBlock, dead: false })
  if (doors.account) rows.push({ key: 'account', label: SHEET_LABELS.account, quiet: doors.accountQuiet, dead: false })
  if (doors.money) rows.push({ key: 'money', label: SHEET_LABELS.money, quiet: null, dead: false })
  if (doors.paid) rows.push({ key: 'paid', label: SHEET_LABELS.paid, quiet: null, dead: false })
  if (doors.task) rows.push({ key: 'task', label: SHEET_LABELS.task, quiet: doors.taskReady ? null : 'loading…', dead: !doors.taskReady })
  if (doors.change) rows.push({ key: 'change', label: SHEET_LABELS.change, quiet: null, dead: false })
  rows.push({ key: 'legend', label: SHEET_LABELS.legend, quiet: null, dead: false })
  return rows
}

/** The quiet word on Add job account: *none yet*, or the newest packet's house and day. */
export function accountQuietWords(shares: ReadonlyArray<{ house: string; day: string }>): string {
  const s = shares[0]
  if (!s) return 'none yet'
  return `${s.house} · ${s.day}`
}

// ---------------------------------------------------------------------------
// The money line and the job accounts line
// ---------------------------------------------------------------------------

export type JobWindowLine = {
  /** *Job total $56,000 · nothing billed yet* */
  text: string
  /** The act in blue words at the end, or null when nothing is ready. */
  act: string | null
}

/**
 * The three tiles as one line: the total, then what is billed and paid, *nothing billed yet* while no bill is out.
 * The act is the bar's own money verb when it is one: Bill it, Send bill…, Mark paid; a status move or a %-done
 * ask is not a money act, so the line ends plain.
 */
export function jobWindowMoneyLine(bar: EditJobBillingBar, verb: JobWindowVerb | null): JobWindowLine {
  const f = (n: number) => `$${formatCurrencyNoCents(n)}`
  const parts = [bar.total > 0 ? `Job total ${f(bar.total)}` : 'No job total yet']
  const billed = bar.paid + bar.billedUnpaid
  if (billed > 0) {
    parts.push(`billed ${f(billed)}`)
    parts.push(bar.paid > 0 ? `paid ${f(bar.paid)}` : 'nothing paid yet')
  } else parts.push('nothing billed yet')
  const act = verb && (verb.target === 'bill' || verb.label === 'Mark paid') ? verb.label : null
  return { text: parts.join(' · '), act }
}

/** One line for the job accounts: the houses and their states, or *None yet*; the act adds one. */
export function jobAccountsLine(entries: ReadonlyArray<{ houseName: string; stateWord: string }>, canAdd: boolean): JobWindowLine {
  const text = entries.length ? entries.map((e) => `${e.houseName} ${e.stateWord}`).join(' · ') : 'None yet'
  return { text, act: canAdd ? (entries.length ? 'Add another' : 'Add job account') : null }
}

// ---------------------------------------------------------------------------
// The hit-area pad (v2.7309)
// ---------------------------------------------------------------------------

/** The square a thumb lands on, and the size under which a press gets a pad. */
export const PRESS_TARGET = 44
export const PRESS_SMALL = 40

export type PressPad = { x: number; y: number }

/**
 * How far a press's hit area grows on each side so a thumb's square covers it: nothing on a side already 40 px or
 * more, else half the way to 44, rounded up. A press 20 px tall gets 12 px above and below; a 23 px square gets
 * 11 px all round. Null when the press is a thumb's size both ways, or not drawn at all.
 */
export function pressPad(size: { width: number; height: number }): PressPad | null {
  if (size.width <= 0 || size.height <= 0) return null
  const grow = (n: number) => (n >= PRESS_SMALL ? 0 : Math.ceil((PRESS_TARGET - n) / 2))
  const pad = { x: grow(size.width), y: grow(size.height) }
  return pad.x || pad.y ? pad : null
}

/**
 * The pad as its stylesheet draws it (finding 340, measured 2026-11-27 on the Lien desk's band press and a site's
 * materials screen). `pressPad` sizes the pad from the press's own edge, its border box. The pad is drawn as a placed
 * `::after`, and a placed child is measured from inside the border. So on a press with a 1 px border the pad landed
 * 1 px short over and 1 px under: a tap of 42 where 44 was meant.
 *
 * This adds the border back on each side that grows. `border` is the wider of the two borders on that axis, so a tap
 * is never under the 44 it was sized for. A side that does not grow takes nothing.
 */
export function pressPadFromInside(pad: PressPad, border: { x: number; y: number }): PressPad {
  const wide = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0)
  return { x: pad.x ? pad.x + wide(border.x) : 0, y: pad.y ? pad.y + wide(border.y) : 0 }
}
