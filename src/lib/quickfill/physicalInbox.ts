import { ageStateForDays, PHYSICAL_INBOX_PAPER_AGE, ymdAgeDays, type AgeState } from '../ageState'

/**
 * Quickfill → Physical inbox as a clarify deck (punch list #158, the owner's yes of
 * 2026-10-24): the tray on the assistant's desk, in GTD's shape. A paper that takes two
 * minutes is done and never typed. Anything else is typed once with the day it came and
 * leaves the deck on one press, GTD's own answers: Done · Trash · File it (where) · Task ·
 * Ask (dispatch or estimating) · Waiting for (whom, until when) · Someday · Comes back (a
 * repeating Checklist task, so the kind stops arriving in the tray). The station's count
 * is the undecided paper, with the oldest age; the Mark snapshots that count, and a short
 * auto-note says what was decided that day.
 *
 * Rows live in `office_inbox_papers` (migration 20261024040000). This file is the pure
 * side: the deck's rows and ages, the words line, the folds, the day's decisions and the
 * mark's note. Nothing here reads the database.
 */

export const PHYSICAL_INBOX_SECTION_ID = 'physical-inbox'

export type InboxPaperState = 'open' | 'waiting' | 'someday' | 'closed'
export type InboxPaperOutcome = 'done' | 'trash' | 'filed' | 'task' | 'request' | 'waiting' | 'someday' | 'routine'

export type InboxPaper = {
  id: string
  title: string
  detail: string | null
  /** The day the paper came, `YYYY-MM-DD` in the app's calendar. */
  came_on: string
  created_by: string | null
  created_by_name?: string | null
  created_at: string
  state: InboxPaperState
  outcome: InboxPaperOutcome | null
  /** Where it was filed, or whom it waits for. */
  outcome_detail: string | null
  /** A waiting paper's day to check on it. */
  follow_up_on: string | null
  outcome_at: string | null
  outcome_by: string | null
  checklist_item_id: string | null
  dispatch_request_id: string | null
  estimator_request_id: string | null
}

export const PAPER_TITLE_MAX_CHARS = 200
export const PAPER_DETAIL_MAX_CHARS = 2_000

/** The title as the deck keeps it: trimmed, one space between words, capped. `null` when nothing is left. */
export function normalizePaperTitle(raw: string | null | undefined): string | null {
  const t = (raw ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return null
  return t.length > PAPER_TITLE_MAX_CHARS ? t.slice(0, PAPER_TITLE_MAX_CHARS).trimEnd() : t
}

/** The press words on the deck, in the order GTD asks them. */
export const PAPER_PRESSES = ['done', 'trash', 'filed', 'task', 'request', 'waiting', 'someday', 'routine'] as const
export type PaperPress = (typeof PAPER_PRESSES)[number]

export const PAPER_PRESS_LABEL: Readonly<Record<PaperPress, string>> = {
  done: 'Done',
  trash: 'Trash',
  filed: 'File it',
  task: 'Task',
  request: 'Ask',
  waiting: 'Waiting for',
  someday: 'Someday',
  routine: 'Comes back',
}

/** Places a paper is usually filed; the box takes any other words. */
export const FILE_PLACE_SUGGESTIONS: ReadonlyArray<string> = [
  'The cabinet',
  'The Legal desk, the matter',
  'The Lien desk, the letter',
  'People → Vehicles, the truck',
  'The drawer',
]

export type DeckRow = {
  paper: InboxPaper
  ageDays: number
  ageState: AgeState
  /** `today` · `1 d · Oct 23` · `66 d · Aug 19`. */
  ageWords: string
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `Oct 23` from `2026-10-23`; the raw text when it is not a date. */
export function shortDay(ymd: string | null | undefined): string {
  if (!ymd) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return ymd
  const month = MONTH_SHORT[Number(m[2]) - 1]
  if (!month) return ymd
  return `${month} ${Number(m[3])}`
}

/** Whole days since the paper came, never negative, 0 when the day is unreadable. */
export function paperAgeDays(paper: Pick<InboxPaper, 'came_on'>, todayYmd: string): number {
  return ymdAgeDays(paper.came_on, todayYmd) ?? 0
}

export function paperAgeWords(ageDays: number, cameOn: string): string {
  if (ageDays <= 0) return 'today'
  return `${ageDays} d · ${shortDay(cameOn)}`
}

function byOldestFirst(a: InboxPaper, b: InboxPaper): number {
  if (a.came_on !== b.came_on) return a.came_on < b.came_on ? -1 : 1
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** The deck: the open papers, oldest first, each with its age. */
export function deckRows(papers: ReadonlyArray<InboxPaper>, todayYmd: string): DeckRow[] {
  return papers
    .filter((p) => p.state === 'open')
    .sort(byOldestFirst)
    .map((paper) => {
      const ageDays = paperAgeDays(paper, todayYmd)
      return { paper, ageDays, ageState: ageStateForDays(ageDays, PHYSICAL_INBOX_PAPER_AGE), ageWords: paperAgeWords(ageDays, paper.came_on) }
    })
}

export type UndecidedSummary = { count: number; oldestDays: number | null }

/** The station's metric: how many papers nobody has decided on, and the oldest one's age. */
export function undecidedSummary(papers: ReadonlyArray<InboxPaper>, todayYmd: string): UndecidedSummary {
  let count = 0
  let oldestDays: number | null = null
  for (const p of papers) {
    if (p.state !== 'open') continue
    count += 1
    const d = paperAgeDays(p, todayYmd)
    if (oldestDays == null || d > oldestDays) oldestDays = d
  }
  return { count, oldestDays }
}

/** `Nothing undecided` · `1 undecided · oldest today` · `5 undecided · oldest 66 d`. */
export function undecidedWords(summary: UndecidedSummary): string {
  if (summary.count === 0) return 'Nothing undecided'
  const oldest = summary.oldestDays == null || summary.oldestDays <= 0 ? 'today' : `${summary.oldestDays} d`
  return `${summary.count} undecided · oldest ${oldest}`
}

/** The round's and the Roller's Looked button for this station. */
export function lookedButtonWords(summary: UndecidedSummary): string {
  return summary.count === 0 ? 'Looked · tray clear · next →' : `Looked · ${summary.count} undecided · next →`
}

/** How far out the Waiting for form puts the day to check, until the person picks another. */
export const WAITING_DEFAULT_DAYS = 7

/** `YYYY-MM-DD` plus whole days, on the calendar (no time zone in it). */
export function ymdAddDays(ymd: string, days: number): string {
  const t = Date.parse(`${ymd.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(t)) return ymd
  return new Date(t + days * 86_400_000).toISOString().slice(0, 10)
}

export type WaitingRow = {
  paper: InboxPaper
  /** `waiting for Marcus · check Mon` · `waiting for the carrier · check today` · `waiting for Todd · 3 d past the check`. */
  words: string
  /** The check day has passed. */
  late: boolean
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function weekdayOf(ymd: string): string | null {
  const t = Date.parse(`${ymd.slice(0, 10)}T12:00:00Z`)
  if (Number.isNaN(t)) return null
  return WEEKDAY_SHORT[new Date(t).getUTCDay()] ?? null
}

/** The Waiting for fold: whom and when to check, soonest check first, the late ones on top. */
export function waitingRows(papers: ReadonlyArray<InboxPaper>, todayYmd: string): WaitingRow[] {
  return papers
    .filter((p) => p.state === 'waiting')
    .sort((a, b) => {
      const fa = a.follow_up_on ?? '9999-12-31'
      const fb = b.follow_up_on ?? '9999-12-31'
      if (fa !== fb) return fa < fb ? -1 : 1
      return byOldestFirst(a, b)
    })
    .map((paper) => {
      const whom = paper.outcome_detail?.trim() || 'someone'
      const f = paper.follow_up_on
      let when = 'no day to check'
      let late = false
      if (f) {
        const past = ymdAgeDays(f, todayYmd) ?? 0
        const ahead = ymdAgeDays(todayYmd, f) ?? 0
        if (f === todayYmd) when = 'check today'
        else if (past > 0 && f < todayYmd) {
          when = `${past} d past the check`
          late = true
        } else if (ahead > 0 && ahead < 7) when = `check ${weekdayOf(f) ?? shortDay(f)}`
        else when = `check ${shortDay(f)}`
      }
      return { paper, words: `waiting for ${whom} · ${when}`, late }
    })
}

/** The Someday fold: parked papers, newest park first. */
export function somedayRows(papers: ReadonlyArray<InboxPaper>): InboxPaper[] {
  return papers
    .filter((p) => p.state === 'someday')
    .sort((a, b) => {
      const oa = a.outcome_at ?? ''
      const ob = b.outcome_at ?? ''
      if (oa !== ob) return oa > ob ? -1 : 1
      return byOldestFirst(a, b)
    })
}

export type DecidedCounts = Readonly<Record<InboxPaperOutcome, number>>

const ZERO_DECIDED: DecidedCounts = { done: 0, trash: 0, filed: 0, task: 0, request: 0, waiting: 0, someday: 0, routine: 0 }

/**
 * What was decided on a day: every paper whose press landed that day, by press, a paper that
 * came back to the deck and left again counting once per press. `dayKeyOf` turns an ISO stamp
 * into the app's calendar day, so the kernel never guesses a time zone.
 */
export function decidedCounts(papers: ReadonlyArray<InboxPaper>, todayYmd: string, dayKeyOf: (iso: string) => string): DecidedCounts {
  const out: Record<InboxPaperOutcome, number> = { ...ZERO_DECIDED }
  for (const p of papers) {
    if (!p.outcome || !p.outcome_at) continue
    if (dayKeyOf(p.outcome_at) !== todayYmd) continue
    out[p.outcome] += 1
  }
  return out
}

const DECIDED_WORDS: ReadonlyArray<[InboxPaperOutcome, string, string]> = [
  ['task', 'task', 'tasks'],
  ['request', 'request', 'requests'],
  ['filed', 'filed', 'filed'],
  ['done', 'done', 'done'],
  ['trash', 'tossed', 'tossed'],
  ['waiting', 'waiting', 'waiting'],
  ['someday', 'someday', 'someday'],
  ['routine', 'routine', 'routines'],
]

/**
 * The note the Mark writes for this station, so the history reads the day without a typed
 * box: `0 undecided` · `2 undecided · oldest 4 d · 1 task · 1 filed`.
 */
export function markAutoNote(summary: UndecidedSummary, decided: DecidedCounts): string {
  const parts: string[] = []
  if (summary.count === 0) parts.push('0 undecided')
  else parts.push(`${summary.count} undecided`, `oldest ${summary.oldestDays == null || summary.oldestDays <= 0 ? 'today' : `${summary.oldestDays} d`}`)
  for (const [key, one, many] of DECIDED_WORDS) {
    const n = decided[key]
    if (n > 0) parts.push(`${n} ${n === 1 ? one : many}`)
  }
  return parts.join(' · ')
}

/** The line a decided paper leaves behind for a moment, with Undo beside it. */
export function outcomeWords(outcome: InboxPaperOutcome, detail: string | null | undefined): string {
  const d = detail?.trim()
  switch (outcome) {
    case 'done':
      return 'Done'
    case 'trash':
      return 'Tossed'
    case 'filed':
      return d ? `Filed · ${d}` : 'Filed'
    case 'task':
      return 'Task made'
    case 'request':
      return d ? `Asked ${d}` : 'Request sent'
    case 'waiting':
      return d ? `Waiting for ${d}` : 'Waiting'
    case 'someday':
      return 'Someday'
    case 'routine':
      return 'Routine made'
  }
}

/** The patch a press writes: the paper's new state, its press and its detail. */
export function pressPatch(
  press: PaperPress,
  detail: string | null,
  followUpOn: string | null,
  nowIso: string,
  byUserId: string | null,
): Pick<InboxPaper, 'state' | 'outcome' | 'outcome_detail' | 'follow_up_on' | 'outcome_at' | 'outcome_by'> {
  const state: InboxPaperState = press === 'waiting' ? 'waiting' : press === 'someday' ? 'someday' : 'closed'
  return {
    state,
    outcome: press,
    outcome_detail: detail?.trim() || null,
    follow_up_on: press === 'waiting' ? followUpOn : null,
    outcome_at: nowIso,
    outcome_by: byUserId,
  }
}

/** The patch Still here writes: back on the deck with no press. */
export const BACK_ON_DECK_PATCH: Pick<InboxPaper, 'state' | 'outcome' | 'outcome_detail' | 'follow_up_on' | 'outcome_at' | 'outcome_by'> = {
  state: 'open',
  outcome: null,
  outcome_detail: null,
  follow_up_on: null,
  outcome_at: null,
  outcome_by: null,
}
