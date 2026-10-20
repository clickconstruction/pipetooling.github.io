/**
 * Messages, residential R8 · 3 (dispatch writes back): a tech's **Running late** text gives the customer a new window.
 * This kernel reads what else slides on the tech's day on the dispatch board, words the one ask on the send (**Move it**
 * or **Leave the board**), and builds the rows the move takes. Lifted from the Messages integrations mockups (branch
 * spike/gc-mode, `to-dos/gc-mode/messages/customer-messages-integrations-mockups.html` v0.2, card 3). Pure.
 *
 * Times are the board's wall clock on one `work_date`, in minutes past midnight, as `job_schedule_blocks.time_start`
 * and `time_end` store them. The board's day runs 4:00 AM to 8:00 PM (`job_schedule_blocks_time_bounds`), so a slide that
 * would end after 8:00 PM moves nothing.
 *
 * **Move it** is one `running_late_move` call (migration 20261014080000). It moves each block through
 * `self_move_schedule_block`, the tech's own, in one transaction, so a refusal anywhere moves nothing. That RPC is the
 * truth for two things this file only words: it takes the tech out of a linked crew block, and it posts its own note
 * on the job thread for a slid block dispatch made. The late block's job reads the reason as one `running_late` line
 * instead, and the dispatcher's note is a `dispatch_requests` row the caller pushes with `notify-dispatch-request`.
 */
import type { Database } from '../../types/database'
import { pgTimeToMinutes } from '../jobScheduleChicago'
import { clockTime } from '../messages/thread'

/** One of the tech's blocks on the day, as the board reads `job_schedule_blocks`. */
export interface DayBlock {
  id: string
  /** `work_date`, YYYY-MM-DD. */
  workDate: string
  /** `time_start` and `time_end`, Postgres `time`: "08:00:00". */
  timeStart: string
  timeEnd: string
  /** The job as the board names it: "1312". */
  jobLabel: string
  /** `job_id`, the Pipeline job. Null on a bid's block. */
  jobsLedgerId: string | null
  /** The job's customer: "Dana Whitfield". */
  customer: string | null
  /** `shared_block_group_id`: a linked crew block. Moving it takes the tech out of the group. */
  groupId: string | null
}

/** The new window a Running late text gave the customer, on the same day. */
export interface LateMove {
  blockId: string
  /** "09:30" or "09:30:00". */
  timeStart: string
  timeEnd: string
  /** Who it was said to, as the text named them: "Dana". */
  saidTo: string
}

/** A block's move, in minutes past midnight. */
export interface Slide {
  block: DayBlock
  fromStart: number
  fromEnd: number
  toStart: number
  toEnd: number
  /** How far it moved: later is more. */
  minutes: number
  /** The block is a linked crew block, and the move takes the tech out of it. */
  unlinks: boolean
}

export interface WhatSlides {
  /** The block the text moved. */
  moved: Slide
  /** The stops after it that must slide, in the day's order. */
  slides: Slide[]
  /** The first stop after them whose gap took the rest of the delay. Null: none after, or none left to take it. */
  holds: DayBlock | null
  /** A slide would end after 8:00 PM, the board's day end. Nothing moves. */
  pastDayEnd: boolean
  /** The move's reason: "said to Dana, 9:02 AM". */
  reason: string
}

/** The board's last minute, 8:00 PM: `job_schedule_blocks_time_bounds` holds every block to it. */
const DAY_END = 20 * 60

const slideOf = (block: DayBlock, toStart: number, toEnd: number): Slide => {
  const fromStart = pgTimeToMinutes(block.timeStart)
  return {
    block,
    fromStart,
    fromEnd: pgTimeToMinutes(block.timeEnd),
    toStart,
    toEnd,
    minutes: toStart - fromStart,
    unlinks: block.groupId !== null,
  }
}

/**
 * What slides when one block takes a new window. The stops after it in the day's order each start no earlier than the
 * one before ends, keeping their length, until the first gap that absorbs the delay. `nowIso` is when the text went.
 * Null when the block is not among the day's, or the new window ends before it starts.
 */
export function whatSlides(blocks: readonly DayBlock[], move: LateMove, nowIso: string): WhatSlides | null {
  const block = blocks.find((b) => b.id === move.blockId)
  const toStart = pgTimeToMinutes(move.timeStart)
  const toEnd = pgTimeToMinutes(move.timeEnd)
  if (!block || toEnd <= toStart) return null
  const day = blocks
    .filter((b) => b.workDate === block.workDate)
    .sort((a, b) => pgTimeToMinutes(a.timeStart) - pgTimeToMinutes(b.timeStart) || pgTimeToMinutes(a.timeEnd) - pgTimeToMinutes(b.timeEnd))
  const moved = slideOf(block, toStart, toEnd)
  const slides: Slide[] = []
  let holds: DayBlock | null = null
  let cursor = toEnd
  for (const next of day.slice(day.indexOf(block) + 1)) {
    const start = pgTimeToMinutes(next.timeStart)
    if (start >= cursor) {
      holds = next
      break
    }
    const shift = cursor - start
    const slide = slideOf(next, start + shift, pgTimeToMinutes(next.timeEnd) + shift)
    slides.push(slide)
    cursor = slide.toEnd
  }
  return {
    moved,
    slides,
    holds,
    pastDayEnd: moved.toEnd > DAY_END || slides.some((s) => s.toEnd > DAY_END),
    reason: `said to ${move.saidTo.trim()}, ${clockTime(nowIso)}`,
  }
}

/** Minutes past midnight as the board says them: "9:30 AM". */
export function boardTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = Math.round(minutes % 60)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

/** How long, in words: "30 minutes", "1 hour", "1 hour 15 minutes". */
export function slideWords(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const hours = h ? `${h} ${h === 1 ? 'hour' : 'hours'}` : ''
  const mins = m ? `${m} ${m === 1 ? 'minute' : 'minutes'}` : ''
  return [hours, mins].filter(Boolean).join(' ') || '0 minutes'
}

/** "45, 30 and 15". */
const listWords = (words: readonly string[]): string =>
  words.length < 2 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`

/** "Luis’s", as the card writes it: ’s on every name, one ending in s too. */
const possessive = (name: string) => `${name}’s`

/** The one strip on the send. */
export interface MoveAsk {
  head: string
  lines: string[]
  /** Move it, then Leave the board. Only Leave the board when the slide would pass 8:00 PM. */
  presses: Array<{ id: 'move' | 'leave'; label: string }>
}

const MOVE_IT = { id: 'move', label: 'Move it' } as const
const LEAVE_IT = { id: 'leave', label: 'Leave the board' } as const

/** The moved job's sentence: "Job 1312 moves from 8:00 AM to 9:30 AM." */
const movedLine = (s: Slide) => `Job ${s.block.jobLabel} moves from ${boardTime(s.fromStart)} to ${boardTime(s.toStart)}.`

/** The slides after it: "Luis’s next stop slides 30 minutes." */
function slidesLine(tech: string, slides: readonly Slide[]): string {
  if (slides.length === 0) return `Nothing else on ${possessive(tech)} day moves.`
  if (slides.length === 1) return `${possessive(tech)} next stop slides ${slideWords(slides[0]!.minutes)}.`
  return `${possessive(tech)} next ${slides.length} stops slide ${listWords(slides.map((s) => slideWords(s.minutes)))}.`
}

/** The crew block the move takes the tech out of, if any. */
function unlinkLine(tech: string, read: WhatSlides): string | null {
  const n = [read.moved, ...read.slides].filter((s) => s.unlinks).length
  if (n === 0) return null
  return n === 1 ? `${tech} leaves the crew block.` : `${tech} leaves ${n} crew blocks.`
}

/** The ask on the send, in the tech's name: "Move the board too?" with Move it and Leave the board. */
export function moveAsk(read: WhatSlides, tech: string): MoveAsk {
  if (read.pastDayEnd) {
    return {
      head: 'Move the board too?',
      lines: [movedLine(read.moved), `That would run ${possessive(tech)} day past 8:00 PM.`, 'The board stays as it is.'],
      presses: [LEAVE_IT],
    }
  }
  const unlink = unlinkLine(tech, read)
  return {
    head: 'Move the board too?',
    lines: [movedLine(read.moved), slidesLine(tech, read.slides), ...(unlink ? [unlink] : [])],
    presses: [MOVE_IT, LEAVE_IT],
  }
}

/** One block's move inside the call, in `self_move_schedule_block`'s own shape. */
export type SelfMoveRow = Database['public']['Functions']['self_move_schedule_block']['Args']

/**
 * What **Move it** sends: the arguments of one `running_late_move` call. Typed here until the types regen after the
 * migration's push carries the function. The job and the bid come from the late block's row, never from the caller.
 */
export interface BoardWrite {
  /** One row per block, the last stop first and the late block last, so no block lands on one not yet moved. */
  p_moves: SelfMoveRow[]
  /** "said to Dana, 9:02 AM". */
  p_reason: string
  /** The late job's `running_late` event line. */
  p_job_line: string
  /** The dispatcher's note: the `dispatch_requests` title and summary. */
  p_note_title: string
  p_note_summary: string
}

const pgTime = (minutes: number) => {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
}

const rowOf = (s: Slide): SelfMoveRow => ({
  p_block_id: s.block.id,
  p_work_date: s.block.workDate,
  p_time_start: pgTime(s.toStart),
  p_time_end: pgTime(s.toEnd),
})

/** The one call **Move it** makes: the moves, the reason, the job's line and the dispatcher's note. Null when nothing may move. */
export function boardWrite(read: WhatSlides, tech: string): BoardWrite | null {
  if (read.pastDayEnd) return null
  const moved = read.moved
  const slid = read.slides.map((s) => {
    const who = s.block.customer ? ` for ${s.block.customer}` : ''
    return `Job ${s.block.jobLabel}${who} slides ${slideWords(s.minutes)}.`
  })
  const unlink = unlinkLine(tech, read)
  return {
    p_moves: [...read.slides].reverse().map(rowOf).concat(rowOf(moved)),
    p_reason: read.reason,
    p_job_line: `Running late. Moved from ${boardTime(moved.fromStart)} to ${boardTime(moved.toStart)}, ${read.reason}.`,
    p_note_title: `${tech} is running late on job ${moved.block.jobLabel}`,
    p_note_summary: [`${movedLine(moved).slice(0, -1)}, ${read.reason}.`, ...slid, ...(unlink ? [unlink] : [])].join(' '),
  }
}
