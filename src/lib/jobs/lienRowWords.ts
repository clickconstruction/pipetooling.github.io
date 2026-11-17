/**
 * What a To do row says under the job's name on a computer (v2.7372, punch list #362 step 3; Taunya's direction B of
 * 2026-11-15): the Board's bin name first, then the one thing to know, then where an affidavit's notice stands.
 *
 * The row used to carry one line of words that named the paper's kind and its state together (*Affidavit approved ·
 * ready to file*), cut off at a laptop's width, beside four dots that said the stage a second way. The chip already
 * says the kind and the Board already names the stage, so the line is the stage in the Board's words (`stage`, from
 * `lienBoardRowStage`) and then only what that does not say (`LienNextUpRow.detail`). A row with no bin of its own
 * (a reminder, retainage, a served copy) keeps its words as they were.
 *
 * Pure. The day leaves the row for the head when every row under the head shares it (`lienHeadDay`).
 */
import { formatYmdMonthDay } from './billedExpectedPay'
import { lienMonthDayWords } from './lienMonthLine'
import type { LienNextUpRow } from './lienNextUp'
import { lienAffidavitNoticeWaits, lienAffidavitNoticeWords, type LienAffidavitNoticeStanding } from './lienAffidavitNoticeStanding'

export type LienRowTag = { tone: 'ok' | 'none' | 'warn'; words: string }

export type LienRowLine = {
  /** The Board's bin, or null for a row with none. */
  stage: string | null
  /** What follows the stage; '' when the stage says it all. */
  detail: string
  tags: LienRowTag[]
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export function lienRowLine(row: Pick<LienNextUpRow, 'sub' | 'detail' | 'kind'>, facts: { stage: string | null; notice?: LienRowTag | null }): LienRowLine {
  const tags = row.kind === 'affidavit' && facts.notice ? [facts.notice] : []
  if (!facts.stage) return { stage: null, detail: row.sub, tags }
  const detail = row.detail ?? row.sub
  return { stage: facts.stage, detail: same(detail, facts.stage) ? '' : detail, tags }
}

const joinDays = (days: ReadonlyArray<string>) => (days.length === 1 ? days[0]! : `${days.slice(0, -1).join(', ')} and ${days[days.length - 1]}`)

/**
 * Where an affidavit's § 53.056 notice stands, for its row. A job contracted with the owner needs none, and says so,
 * so nobody reads a missing notice as a fault. A notice on record says the day it went (the last three, oldest
 * first). None on record on a job that needs one is the warning, and it says where that notice stands when the desk
 * knows (`standing`, `lienAffidavitNoticeStanding.ts`): approved and not mailed is not *No notice on record*.
 */
export function lienAffidavitNoticeTag(a: { isSub: boolean; noticed: boolean; sentOn: ReadonlyArray<string>; standing?: LienAffidavitNoticeStanding | null }): LienRowTag {
  if (!a.isSub) return { tone: 'none', words: 'No notice needed · contracted with the owner' }
  if (!a.noticed) return lienAffidavitNoticeWaits(a.standing) ? lienAffidavitNoticeWords(a.standing).tag : { tone: 'warn', words: 'No notice on record' }
  const days = [...new Set(a.sentOn.map((d) => d.slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort()
  if (days.length === 0) return { tone: 'ok', words: 'Notice on record' }
  const shown = days.slice(-3).map(formatYmdMonthDay)
  return { tone: 'ok', words: days.length > 3 ? `${days.length} notices sent · the last ${shown[shown.length - 1]}` : `Notice sent ${joinDays(shown)}` }
}

/** *1 day left*, *today*, *4 days late*: how far a day is, as the row and the head say it. */
export function lienDayLeftWords(daysLeft: number): string {
  if (daysLeft < 0) return `${-daysLeft} ${daysLeft === -1 ? 'day' : 'days'} late`
  if (daysLeft === 0) return 'today'
  return `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`
}

export type LienHeadDay = { dueOn: string; daysLeft: number | null; words: string }

/**
 * The day a head can carry for its rows: the one day every dated row under it shares. With two days among them, or
 * none dated, the head carries none and each row says its own. A row with no day of its own never blocks the head.
 */
export function lienHeadDay(rows: ReadonlyArray<Pick<LienNextUpRow, 'dueOn' | 'daysLeft'>>): LienHeadDay | null {
  const days = [...new Set(rows.map((r) => r.dueOn).filter((d): d is string => Boolean(d)))]
  if (days.length !== 1) return null
  const dueOn = days[0]!
  const daysLeft = rows.find((r) => r.dueOn === dueOn && r.daysLeft != null)?.daysLeft ?? null
  return { dueOn, daysLeft, words: `due ${lienMonthDayWords(dueOn)}${daysLeft == null ? '' : ` · ${lienDayLeftWords(daysLeft)}`}` }
}

/**
 * A notice row's deadline chip (out of `LienDesk.tsx`): *window closed* once the day is past, or with no day left
 * and months already missed; *due today*, *due tomorrow*, *due in Nd* inside two weeks; else *by* the day. Nothing
 * for a row with no deadline and nothing missed.
 */
export function lienDeskDeadlineWords(e: { daysLeft: number | null; earliestDeadline: string | null; missedMonths: ReadonlyArray<string> }): string {
  if (e.daysLeft == null || !e.earliestDeadline) return e.missedMonths.length ? 'window closed' : ''
  if (e.daysLeft < 0) return 'window closed'
  if (e.daysLeft === 0) return 'due today'
  if (e.daysLeft === 1) return 'due tomorrow'
  if (e.daysLeft <= 14) return `due in ${e.daysLeft}d`
  return `by ${formatYmdMonthDay(e.earliestDeadline)}`
}
