/**
 * Task cards: % done instead of a tick (punch list #273, PR 1, v2.6592). The pure rules under the ring every card
 * draws from PR 3 on: which cards take the ring, what the ring reads, the chips on the % sheet, the words a progress
 * line carries, when a photo is offered or required, and how a stage's bar adds the fractions. The rows come from
 * `checklist_instances.percent_complete`, `task_criteria` and `task_criteria_checks` (migration 20261106230000);
 * nothing here reads the database, so the screens' tests run over plain objects.
 *
 * The rule on one number: a done row is 100 whatever is stored; a card with live Done when… lines reads the ticks
 * (2 of 3 is 67); a card without lines reads the hand's number. Never two numbers.
 */

/** The three chips on the % sheet. Done is its own press; 0 is an empty ring, never a chip. */
export const PERCENT_CHIPS = [25, 50, 75] as const

/** The longest *what is left* line the sheet takes. */
export const WHAT_IS_LEFT_MAX_CHARS = 140

export type TaskCardShape = {
  /** `checklist_items.repeat_type`: `once`, `daily`, `weekly`, `days_after_completion`. */
  repeatType: string | null | undefined
  /** Set on a card the roadmap sync made; such a card is always a one-off. */
  roadmapTaskId?: string | null
}

/** One-off cards and roadmap cards take the ring. A repeating card keeps the tick: 40% of *Grease the skid steer* each Sunday means nothing. */
export function takesRing(card: TaskCardShape): boolean {
  if (card.roadmapTaskId) return true
  return (card.repeatType ?? 'once') === 'once'
}

/** A percent as the database holds it: a whole number 0 to 100; anything else reads 0. */
export function clampPercent(n: unknown): number {
  const v = typeof n === 'number' ? n : typeof n === 'string' ? Number(n) : NaN
  if (!Number.isFinite(v)) return 0
  return Math.min(100, Math.max(0, Math.round(v)))
}

/** 2 of 3 is 67, 1 of 3 is 33, 3 of 3 is 100; no lines is 0. */
export function percentFromTicks(ticked: number, lines: number): number {
  if (lines <= 0) return 0
  return clampPercent((100 * Math.min(ticked, lines)) / lines)
}

export type RingInput = {
  completedAt: string | null | undefined
  percentComplete: number | null | undefined
  /** Live Done when… lines on the card, and how many are ticked on this day row. */
  lines: number
  ticked: number
}

export type RingState = {
  /** 0 to 100, the one number. */
  percent: number
  done: boolean
  /** The number came from the ticks, not the hand. */
  derived: boolean
  lines: number
  ticked: number
  /** Nothing has moved: the ring draws empty with no digits. */
  untouched: boolean
}

export function ringState(i: RingInput): RingState {
  const lines = Math.max(0, i.lines)
  const ticked = Math.max(0, Math.min(i.ticked, lines))
  const done = Boolean(i.completedAt)
  const derived = lines > 0
  const percent = done ? 100 : derived ? percentFromTicks(ticked, lines) : clampPercent(i.percentComplete)
  return { percent, done, derived, lines, ticked, untouched: !done && percent === 0 && ticked === 0 }
}

/** The ring's words for a reader who cannot see it. */
export function ringWords(s: RingState): string {
  if (s.done) return 'Done'
  if (s.untouched) return s.derived ? `Not started, 0 of ${s.lines} lines` : 'Not started'
  if (s.derived) return `${s.percent}% done, ${s.ticked} of ${s.lines} lines`
  return `${s.percent}% done`
}

/** *2 of 3 done when…*, the line under a card's title while it has lines. */
export function linesWords(ticked: number, lines: number): string {
  return `${Math.min(ticked, lines)} of ${lines} done when…`
}

export type PhotoMoment = 'percent' | 'finish'
export type PhotoAsk = 'offered' | 'required' | 'none'

/** A photo is offered at every new %. The finish holds for one only on a card that asks. */
export function photoAsk(card: { asksForPhoto: boolean }, moment: PhotoMoment): PhotoAsk {
  if (moment === 'percent') return 'offered'
  return card.asksForPhoto ? 'required' : 'none'
}

/** The dialogs flip the switch on the moment a line is written; a card with no lines ships with it off. */
export function asksForPhotoDefault(lines: number): boolean {
  return lines > 0
}

/** A card reads its own switch or its roadmap task's. */
export function cardAsksForPhoto(item: { asksForPhoto?: boolean | null }, task?: { asksForPhoto?: boolean | null } | null): boolean {
  return Boolean(item.asksForPhoto) || Boolean(task?.asksForPhoto)
}

export type FinishRule = {
  /** The press may go. */
  ok: boolean
  /** The press's words: *Done · 100%* when it may go, *Photo first* while the card holds. */
  pressWords: string
  /** The card holds for a photo and has neither a photo nor a reason. */
  holds: boolean
}

/** The finishing sheet's rule: a card that asks for a photo holds until a photo is in or a reason is typed. */
export function finishRule(card: { asksForPhoto: boolean }, photoIn: boolean, reason: string): FinishRule {
  const ask = photoAsk(card, 'finish')
  if (ask !== 'required' || photoIn || reason.trim().length > 0) return { ok: true, pressWords: 'Done · 100%', holds: false }
  return { ok: false, pressWords: 'Photo first', holds: true }
}

/** The *what is left* words as the thread keeps them: trimmed, one line, at most the sheet's length. */
export function whatIsLeftWords(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, WHAT_IS_LEFT_MAX_CHARS)
}

export type ProgressLineInput = {
  name: string
  percent: number
  /** The *what is left* words, or empty. */
  words: string
  /** The event's time as the strip shows it, already formatted. */
  when: string
}

/** *Mateo · 75% · Wed 2:05 PM · "puddy and the glue, Thursday"*: the thread's progress line. */
export function progressLine(a: ProgressLineInput): string {
  const parts = [a.name.trim() || 'Someone', `${clampPercent(a.percent)}%`, a.when]
  const words = whatIsLeftWords(a.words)
  if (words) parts.push(`"${words}"`)
  return parts.join(' · ')
}

export type StageTaskShape = { completedAt: string | null | undefined; percentComplete: number | null | undefined }

export type StageFraction = { done: number; total: number; words: string }

/** A stage's bar adds the fractions: two done and one at 50 of six reads *2.5 of 6 done*. */
export function stageFraction(tasks: StageTaskShape[]): StageFraction {
  const total = tasks.length
  let sum = 0
  for (const t of tasks) sum += t.completedAt ? 100 : clampPercent(t.percentComplete)
  const done = Math.round(sum / 10) / 10
  return { done, total, words: `${fractionWords(done)} of ${total} done` }
}

/** 2 reads *2*, 2.5 reads *2.5*, 2.67 rounds to one place. */
export function fractionWords(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

/** A slot's fill on the stage bar: 100 for a done task, its percent otherwise. */
export function slotFill(t: StageTaskShape): number {
  return t.completedAt ? 100 : clampPercent(t.percentComplete)
}
