/**
 * The Job tab on a phone (punch list #355, PR B): the sections in the order a phone needs, Where · Photos · Who ·
 * What's happening · the thread · More on this job, each row a label, its answer and its act as blue words at the
 * end, the rest folded under counted headings the phone remembers. Pure: the rows' words and the folds; the screens
 * are `JobWindowPhoneSections.tsx` and `DetailJobModal` in pane mode.
 */
import { scheduleFormatDateLongNoWeekday, scheduleFormatWeekdayOnly, scheduleFormatWindow } from '../jobScheduleChicago'
import { daysAgo } from '../messages/thread'
import type { JobActivityMessage } from './jobActivityMessages'
import type { JobWindowVerb } from './jobWindowBar'
import type { SummaryLine } from './threadSummary'

// ---------------------------------------------------------------------------
// What's happening
// ---------------------------------------------------------------------------

/** A schedule block as the row needs it. */
export type NextOnSiteBlock = { work_date: string; time_start: string; time_end: string; users?: { name: string | null } | null }

export type NextOnSiteWords = {
  /** *Saturday, November 14, 2026* */
  day: string
  /** *8:00 AM–12:00 PM*, on a line of its own: the owner's rule, never joined to the day. */
  hours: string
  /** *Sample leader and one helper*, or '' with nobody on it. */
  who: string
}

/** The next block on or after today, the earliest first; null with none ahead. */
export function nextOnSite(blocks: readonly NextOnSiteBlock[], todayYmd: string): NextOnSiteWords | null {
  const ahead = blocks.filter((b) => b.work_date >= todayYmd).sort((a, b) => a.work_date.localeCompare(b.work_date) || a.time_start.localeCompare(b.time_start))
  const first = ahead[0]
  if (!first) return null
  const sameSlot = ahead.filter((b) => b.work_date === first.work_date && b.time_start === first.time_start && b.time_end === first.time_end)
  const names = [...new Set(sameSlot.map((b) => (b.users?.name ?? '').trim()).filter(Boolean))]
  const who = names.length === 0 ? '' : names.length <= 2 ? names.join(' and ') : `${names[0]} and ${names.length - 1} more`
  return { day: `${scheduleFormatWeekdayOnly(first.work_date)}, ${scheduleFormatDateLongNoWeekday(first.work_date)}`, hours: scheduleFormatWindow(first.time_start, first.time_end), who }
}

export const NOTHING_SCHEDULED = 'Nothing scheduled'
export const OPEN_THE_CALENDAR = 'Open the calendar'

export type WaitingOnWords = {
  /** *The office, to* */
  lead: string
  /** *bill it*: the verb inside the headline, the door when it is ours (the bar's verb). */
  verb: string
  /** Whether the verb is ours to press: the bar's verb does it. Theirs (the customer, to pay) ends in the nudge instead. */
  ours: boolean
  /** *Nothing has happened for 6 days.* or '' */
  quiet: string
  /** The act at the end when the move is not ours: *Mark paid*, or null. */
  act: string | null
}

/**
 * Who the job waits on and for what, from the bar's verb: the sentence and the press agree. The verb inside the
 * headline is the door when it is ours; when the move is theirs (the customer, to pay) the row ends in our act.
 */
export function waitingOnWords(input: { status: string | null; verb: JobWindowVerb | null; lastActivityIso: string | null; nowIso: string }): WaitingOnWords {
  const { status, verb } = input
  const days = input.lastActivityIso ? daysAgo(input.lastActivityIso, input.nowIso) : null
  const quiet = days != null && days >= 2 ? `Nothing has happened for ${days} days.` : ''
  if (status === 'paid' || !verb) return { lead: 'Nobody.', verb: status === 'paid' ? 'The job is paid.' : 'Nothing is next.', ours: false, quiet, act: null }
  switch (verb.label) {
    case 'Bill it':
      return { lead: 'The office, to', verb: 'bill it', ours: true, quiet, act: null }
    case 'Send bill…':
      return { lead: 'The office, to', verb: 'send the bill', ours: true, quiet, act: null }
    case 'Set % done':
      return { lead: 'The office, to', verb: 'set % done', ours: true, quiet, act: null }
    case 'Move to Working':
      return { lead: 'The office, to', verb: 'start it', ours: true, quiet, act: null }
    case 'Mark paid':
      return { lead: 'The customer, to', verb: 'pay', ours: false, quiet, act: 'Mark paid' }
    case 'Ready to bill':
      return { lead: 'The crew, to', verb: 'finish the work', ours: false, quiet, act: 'Ready to bill' }
    default:
      return { lead: 'The office, to', verb: verb.label.toLowerCase(), ours: true, quiet, act: null }
  }
}

// ---------------------------------------------------------------------------
// The thread
// ---------------------------------------------------------------------------

export type ThreadRowWords = {
  key: SummaryLine['key']
  /** *Last word*, *They promised*, *We owe them* */
  label: string
  /** The first sentence: *Theirs, a text last Saturday.* */
  value: string
  /** The rest: *The job is Working at 34%.* */
  sub: string
  /** The blue words at the end: Reply, Write it down, Change it, Mark it. */
  act: string
  /** Where the act goes: the line's own href, or the thread. */
  door: 'line' | 'thread'
  href: string | null
}

/** The phone's labels for the summary's three lines. */
export const THREAD_ROW_LABELS: Record<SummaryLine['key'], string> = { stands: 'Last word', theirs: 'They promised', ours: 'We owe them' }

/** A line's text as the row draws it: the first sentence as the value, the rest under it. */
export function splitFirstSentence(text: string): { value: string; sub: string } {
  const m = /^(.*?[.!?])\s+(.*)$/s.exec(text.trim())
  if (!m) return { value: text.trim(), sub: '' }
  return { value: m[1] ?? text, sub: m[2] ?? '' }
}

/**
 * The three rows from the summary's lines (punch list #355, PR B): a plain label, the first sentence as the answer,
 * the rest under it, and the door as blue words at the end. The last word's *Reply* opens the thread at the line;
 * a promise or a debt not written down yet opens the thread's reply box, where Messages writes them.
 */
export function threadRows(lines: readonly SummaryLine[]): ThreadRowWords[] {
  return lines.map((l) => {
    const { value, sub } = splitFirstSentence(l.text)
    if (l.key === 'stands') return { key: l.key, label: THREAD_ROW_LABELS.stands, value, sub, act: l.href ? 'Reply' : 'Open the thread', door: l.href ? 'line' : 'thread', href: l.href }
    const written = l.href !== null || (l.key === 'ours' && !l.text.startsWith('Nothing open'))
    const act = written ? 'Change it' : l.key === 'theirs' ? 'Write it down' : 'Mark it'
    return { key: l.key, label: THREAD_ROW_LABELS[l.key], value, sub, act, door: l.href ? 'line' : 'thread', href: l.href }
  })
}

/** The newest lines with the customer, theirs and ours, for the bubbles under the rows: calls, texts, emails. */
export function newestCustomerLines(lines: readonly JobActivityMessage[] | null | undefined, count = 2): JobActivityMessage[] {
  if (!lines) return []
  return [...lines]
    .filter((m) => m.contact.kind === 'customer' && m.channel !== 'event' && m.channel !== 'note' && (m.direction === 'in' || m.direction === 'out'))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, count)
    .reverse()
}

/** *Open the thread · 56 ›* */
export function openThreadWords(lineCount: number): string {
  return lineCount > 0 ? `Open the thread · ${lineCount} ›` : 'Open the thread ›'
}

// ---------------------------------------------------------------------------
// More on this job: the folds, remembered per device
// ---------------------------------------------------------------------------

export type PhoneFoldKey = 'questions' | 'activity' | 'work' | 'plans' | 'money' | 'journey'

export const PHONE_FOLDS: ReadonlyArray<{ key: PhoneFoldKey; title: string }> = [
  { key: 'questions', title: 'Questions on this job' },
  { key: 'activity', title: 'Activity' },
  { key: 'money', title: 'Money' },
  { key: 'plans', title: 'Plans and papers' },
  { key: 'work', title: 'Work and time' },
  { key: 'journey', title: 'Their journey' },
]

export const PHONE_FOLDS_KEY = 'job_window_phone_folds_open'

/** Which folds this phone keeps open; none until someone opens one. */
export function readPhoneFolds(storage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): Set<PhoneFoldKey> {
  try {
    const raw = storage?.getItem(PHONE_FOLDS_KEY)
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    const keys = new Set(PHONE_FOLDS.map((f) => f.key))
    return new Set(parsed.filter((k): k is PhoneFoldKey => typeof k === 'string' && keys.has(k as PhoneFoldKey)))
  } catch {
    return new Set()
  }
}

export function keepPhoneFolds(open: ReadonlySet<PhoneFoldKey>, storage: Pick<Storage, 'setItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): void {
  try {
    storage?.setItem(PHONE_FOLDS_KEY, JSON.stringify([...open]))
  } catch {
    // A browser that refuses storage forgets the folds on the next open; nothing else changes.
  }
}

/** The quiet count at a fold's right: *6 answered*, *56*, or '' */
export function foldCountWords(count: number | null, word?: string): string {
  if (count == null) return ''
  return word ? `${count} ${word}` : String(count)
}
