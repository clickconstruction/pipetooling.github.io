import { daysBetweenYmd } from './billedExpectedPay'
import { filingDeadlineForMonth, LIEN_SUIT_COUNSEL_LEAD_DAYS, serveDueForFiling, suitDeadlineFor } from './lienDeadlines'

export { LIEN_SUIT_COUNSEL_LEAD_DAYS, suitDeadlineFor }
import { DATED_FROM_CREATION_WORDS } from './lienDesk'
import { workMonthShort } from './forecastWorkMonths'

/**
 * The lien timeline (v2.3761, punch list #37): one job's Chapter 53 path as
 * dated steps, in order, each with the state the desk already knows — and
 * one "next on the path" line. Pure: it reads, it never decides. Counsel's
 * memo (2026-09-22): "Timeline — run it separately on every job."
 *
 * Steps, in order:
 *   last_work  — the month the clock keys on (approved hours, or the job's
 *                creation month when it has none — v2.3747)
 *   notice     — one per work month, § 53.056: 15th of the 3rd month after
 *                (2nd residential); original contractors send none
 *   retainage  — § 53.057: 30 days after our contract on the job ends. Drawn
 *                undated until the contract-end date is recorded (#33 §1)
 *   affidavit  — § 53.052: 15th of the 4th month after the LAST month (3rd
 *                residential)
 *   serve      — § 53.055: a copy to owner and GC within 5 days of filing
 *   hold       — § 53.101: the owner's 10 % reserve runs 30 days past the
 *                original contract's completion. Undated until #33 §3
 *   suit       — § 53.158: a year from the last day the affidavit could file
 *   release    — the release of record once paid; it stops the clock
 *
 * What it must not do (owner rulings): re-date a missed month (v2.3681),
 * mark a miss without a person's name (v2.3679), guess a property kind
 * (v2.3670). An unknown kind shows commercial dates and says so.
 */

export type LienTimelineStepKind = 'last_work' | 'notice' | 'retainage' | 'affidavit' | 'serve' | 'hold' | 'suit' | 'release'

export type LienTimelineState = 'done' | 'due' | 'missed' | 'blocked' | 'undated' | 'later'

export interface LienTimelineStep {
  kind: LienTimelineStepKind
  /** Unique within a timeline — `notice:2026-07`. */
  key: string
  /** The statute cite, short — `§ 53.056`. */
  cite: string
  /** The node's name — `§ 53.056 · Jul`. */
  label: string
  /** 'YYYY-MM-DD' the step is dated on; '' when relative or undated. */
  date: string
  /** What prints under the node — `Oct 15`, `Aug 2026`, `+5 days`, `—`. */
  dateWords: string
  state: LienTimelineState
  /** The small line — `22 days · awaiting approval`. */
  words: string
  daysLeft: number | null
  /** The door a dashed step points at, when it has one. */
  door: 'contract_end' | 'contract_completion' | null
  monthKey?: string
}

export type LienTimelineNextKind = 'lien_gone' | 'release' | 'serve' | 'notice' | 'retainage' | 'affidavit' | 'suit' | 'none'

export interface LienTimelineNext {
  kind: LienTimelineNextKind
  words: string
  /** A second, quieter sentence; '' when none. */
  aside: string
  date: string
  daysLeft: number | null
  tone: 'red' | 'amber' | 'green' | 'quiet'
}

export interface LienTimeline {
  steps: LienTimelineStep[]
  next: LienTimelineNext
  /** Commercial dates shown on a property of unknown kind — say so. */
  kindUnknown: boolean
  /** A sub job whose every notice window closed with nothing sent: no affidavit can follow. */
  lienGone: boolean
  /** The suit date (or the affidavit's, unfiled) — the clock's far end, '' when none. */
  suitDate: string
  /** Steps before this index are past; the today marker sits at this boundary. */
  todayIndex: number
}

export type LienTimelineMonthOutcome = 'open' | 'sent' | 'skipped' | 'missed'

export interface LienTimelineMonth {
  key: string
  deadline: string
  fromCreation: boolean
  outcome: LienTimelineMonthOutcome
  /** sent: the send date-time; skipped: when; missed: when it was noted ('' = nobody has). */
  at: string
  /** True when the reader cannot know whether a miss was noted (the Lien window has no desk items) — the words say *window closed* and nothing more. */
  noteUnknown?: boolean
}

export type LienTimelineNoticeState = '' | 'needs_owner' | 'to_draft' | 'awaiting' | 'ready' | 'held' | 'sent'

export interface LienTimelineInput {
  todayYmd: string
  isSub: boolean
  propertyKind: string
  /** 'YYYY-MM' — the last month worked, or the creation month; '' unknown. */
  lastMonth: string
  lastMonthFromCreation: boolean
  months: ReadonlyArray<LienTimelineMonth>
  /** Where the job's live notice sits on the desk, for the due node's words. */
  noticeState: LienTimelineNoticeState
  holdUntil?: string | null
  /** The § 53.057 clock: null until the job carries the fact (#33 §1). */
  retainage: { contractEndedOn: string | null; deadline: string | null; noticed: boolean } | null
  affidavit: {
    deadline: string
    filedAt: string | null
    recordingNumber: string
    county: string
    servedAt: string | null
    serveDue: string | null
    /** Gate labels still failing, short — `legal description`. */
    missingGates: string[]
  } | null
  /** The § 53.101 clock: null until the job carries the fact (#33 §3). */
  originalContractCompletedOn: string | null
  releasedAt: string | null
  paid: boolean
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `Oct 15`, or `Oct 15, 2027` when the year is not this one. */
export function lienDateWords(ymd: string, todayYmd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd ?? '')
  if (!m) return ''
  const words = `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}`
  return m[1] === todayYmd.slice(0, 4) ? words : `${words}, ${m[1]}`
}

function ymdAddDays(ymd: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return ''
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days, 12)).toISOString().slice(0, 10)
}

function rollWeekendYmd(ymd: string): string {
  let d = ymd
  for (let i = 0; i < 3; i += 1) {
    const dow = new Date(d + 'T12:00:00Z').getUTCDay()
    if (dow !== 0 && dow !== 6) return d
    d = ymdAddDays(d, 1)
  }
  return d
}

/** A 30-day statutory clock from a date (§ 53.057 after our contract ends, § 53.101 after the original contract completes), weekend-rolled. '' when the date is unknown. */
export function lienThirtyDayClock(fromYmd: string | null | undefined): string {
  const d = (fromYmd ?? '').trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return ''
  return rollWeekendYmd(ymdAddDays(d, 30))
}

function days(todayYmd: string, ymd: string): number | null {
  return ymd ? daysBetweenYmd(todayYmd, ymd) : null
}

function daysWords(n: number | null): string {
  if (n == null) return ''
  if (n < 0) return 'past'
  if (n === 0) return 'today'
  if (n === 1) return 'tomorrow'
  return `${n} days`
}

function noticeStateWords(state: LienTimelineNoticeState, holdUntil: string | null | undefined, todayYmd: string): string {
  switch (state) {
    case 'needs_owner':
      return 'owner of record missing'
    case 'to_draft':
      return 'to draft'
    case 'awaiting':
      return 'awaiting approval'
    case 'ready':
      return 'ready to send'
    case 'held':
      return holdUntil ? `held · re-asks ${lienDateWords(holdUntil, todayYmd)}` : 'held'
    default:
      return ''
  }
}

function noticeVerb(state: LienTimelineNoticeState): string {
  switch (state) {
    case 'needs_owner':
      return 'Find the owner, then send'
    case 'awaiting':
      return 'Approve'
    case 'ready':
      return 'Send'
    case 'held':
      return 'Held —'
    default:
      return 'Draft'
  }
}

function monthsPhrase(keys: ReadonlyArray<string>): string {
  return keys.map(workMonthShort).join(' + ')
}

export function buildLienTimeline(input: LienTimelineInput): LienTimeline {
  const { todayYmd } = input
  const kindUnknown = !(input.propertyKind ?? '').trim()
  const steps: LienTimelineStep[] = []

  // 1 · last work
  if (input.lastMonth) {
    steps.push({
      kind: 'last_work',
      key: 'last_work',
      cite: '',
      label: 'Last work',
      date: `${input.lastMonth}-01`,
      dateWords: `${workMonthShort(input.lastMonth)} ${input.lastMonth.slice(0, 4)}`,
      state: 'done',
      words: input.lastMonthFromCreation ? DATED_FROM_CREATION_WORDS : 'clock hours',
      daysLeft: null,
      door: null,
    })
  }

  // 2 · one notice per month (sub jobs only)
  const months = [...input.months].sort((a, b) => a.key.localeCompare(b.key))
  const openMonths = months.filter((m) => m.outcome === 'open' && m.deadline >= todayYmd)
  const unnotedMisses = months.filter((m) => m.outcome === 'missed' && !m.at && !m.noteUnknown)
  const anySent = months.some((m) => m.outcome === 'sent')
  const earliestOpen = openMonths[0] ?? null
  if (input.isSub) {
    for (const m of months) {
      const label = `§ 53.056 · ${workMonthShort(m.key)}`
      const base = { kind: 'notice' as const, key: `notice:${m.key}`, cite: '§ 53.056', label, monthKey: m.key, door: null, date: m.deadline, dateWords: lienDateWords(m.deadline, todayYmd) }
      const creation = m.fromCreation ? ' · dated from creation' : ''
      if (m.outcome === 'sent') {
        steps.push({ ...base, state: 'done', words: (m.at ? `sent ${lienDateWords(m.at.slice(0, 10), todayYmd)}` : 'sent') + creation, daysLeft: null, dateWords: m.at ? lienDateWords(m.at.slice(0, 10), todayYmd) : base.dateWords })
      } else if (m.outcome === 'skipped') {
        steps.push({ ...base, state: 'missed', words: 'skipped on purpose' + creation, daysLeft: null })
      } else if (m.outcome === 'missed' || m.deadline < todayYmd) {
        steps.push({ ...base, state: 'missed', words: (m.noteUnknown ? 'window closed' : `window closed · ${m.at ? 'noted' : 'not noted'}`) + creation, daysLeft: days(todayYmd, m.deadline) })
      } else {
        const left = days(todayYmd, m.deadline)
        const stateWords = m === earliestOpen ? noticeStateWords(input.noticeState, input.holdUntil, todayYmd) : openMonths.length > 1 ? 'on the same notice' : ''
        steps.push({ ...base, state: 'due', words: [daysWords(left), stateWords].filter(Boolean).join(' · ') + creation, daysLeft: left })
      }
    }
    if (months.length === 0) {
      steps.push({ kind: 'notice', key: 'notice', cite: '§ 53.056', label: '§ 53.056 notice', date: '', dateWords: '—', state: 'undated', words: 'no work month yet', daysLeft: null, door: null })
    }
  } else {
    steps.push({ kind: 'notice', key: 'notice', cite: '§ 53.056', label: '§ 53.056 notice', date: '', dateWords: 'none', state: 'done', words: 'not required · contracted with the owner', daysLeft: null, door: null })
  }

  const lienGone = input.isSub && months.length > 0 && openMonths.length === 0 && !anySent && !input.affidavit?.filedAt

  // 3 · affidavit facts, needed by the retainage/hold choice
  const filingDeadline = input.affidavit?.deadline || (input.lastMonth ? filingDeadlineForMonth(`${input.lastMonth}-01`, input.propertyKind) : '')
  const filedAt = input.affidavit?.filedAt ? input.affidavit.filedAt.slice(0, 10) : ''
  const releasedAt = input.releasedAt ? input.releasedAt.slice(0, 10) : ''

  // 4 · § 53.057 retainage — before the affidavit; drawn undated until the contract-end date exists
  if (!filedAt) {
    const r = input.retainage
    if (r?.contractEndedOn && r.deadline) {
      const left = days(todayYmd, r.deadline)
      const state: LienTimelineState = r.noticed ? 'done' : left != null && left < 0 ? 'missed' : 'due'
      steps.push({ kind: 'retainage', key: 'retainage', cite: '§ 53.057', label: '§ 53.057 retainage', date: r.deadline, dateWords: lienDateWords(r.deadline, todayYmd), state, words: r.noticed ? 'sent' : state === 'missed' ? 'window closed' : `${daysWords(left)} · contract ended ${lienDateWords(r.contractEndedOn, todayYmd)}`, daysLeft: left, door: null })
    } else {
      steps.push({ kind: 'retainage', key: 'retainage', cite: '§ 53.057', label: '§ 53.057 retainage', date: '', dateWords: '—', state: 'undated', words: '30 days after our contract ends', daysLeft: null, door: 'contract_end' })
    }
  }

  // 5 · § 53.052 affidavit
  {
    const left = days(todayYmd, filingDeadline)
    const missing = input.affidavit?.missingGates ?? []
    let state: LienTimelineState
    let words: string
    let dateWords = lienDateWords(filingDeadline, todayYmd)
    if (filedAt) {
      state = 'done'
      dateWords = `filed ${lienDateWords(filedAt, todayYmd)}`
      words = [input.affidavit?.recordingNumber ? `#${input.affidavit.recordingNumber}` : '', input.affidavit?.county ? `${input.affidavit.county} County` : ''].filter(Boolean).join(' · ') || 'on record'
    } else if (lienGone) {
      state = 'blocked'
      words = 'blocked · no notice on record'
    } else if (!filingDeadline) {
      state = 'undated'
      dateWords = '—'
      words = 'no work month yet'
    } else if (left != null && left < 0) {
      state = 'missed'
      words = 'window closed with nothing filed'
    } else {
      state = openMonths.length ? 'later' : 'due'
      words = [daysWords(left), missing.length ? `${missing.join(', ')} missing` : ''].filter(Boolean).join(' · ')
    }
    steps.push({ kind: 'affidavit', key: 'affidavit', cite: '§ 53.052', label: '§ 53.052 affidavit', date: filingDeadline, dateWords, state, words, daysLeft: left, door: null })
  }

  // 6 · § 53.055 serve
  {
    if (filedAt) {
      const servedAt = input.affidavit?.servedAt ? input.affidavit.servedAt.slice(0, 10) : ''
      const due = input.affidavit?.serveDue || serveDueForFiling(filedAt)
      if (servedAt) {
        const took = daysBetweenYmd(filedAt, servedAt)
        steps.push({ kind: 'serve', key: 'serve', cite: '§ 53.055', label: '§ 53.055 serve', date: servedAt, dateWords: `served ${lienDateWords(servedAt, todayYmd)}`, state: 'done', words: took == null ? '' : took === 0 ? 'same day' : `${took} ${took === 1 ? 'day' : 'days'}`, daysLeft: null, door: null })
      } else {
        const left = days(todayYmd, due)
        steps.push({ kind: 'serve', key: 'serve', cite: '§ 53.055', label: '§ 53.055 serve', date: due, dateWords: lienDateWords(due, todayYmd), state: left != null && left < 0 ? 'missed' : 'due', words: left != null && left < 0 ? 'overdue · serve it now' : `${daysWords(left)} · copy to owner and GC`, daysLeft: left, door: null })
      }
    } else if (lienGone) {
      steps.push({ kind: 'serve', key: 'serve', cite: '§ 53.055', label: '§ 53.055 serve', date: '', dateWords: '—', state: 'blocked', words: '', daysLeft: null, door: null })
    } else {
      steps.push({ kind: 'serve', key: 'serve', cite: '§ 53.055', label: '§ 53.055 serve', date: '', dateWords: '+5 days', state: 'later', words: 'after filing', daysLeft: null, door: null })
    }
  }

  // 7 · § 53.101 hold — after filing; undated until the original contract's completion is recorded
  if (filedAt) {
    const c = input.originalContractCompletedOn
    if (c) {
      const ends = lienThirtyDayClock(c)
      const left = days(todayYmd, ends)
      steps.push({ kind: 'hold', key: 'hold', cite: '§ 53.101', label: '§ 53.101 hold ends', date: ends, dateWords: lienDateWords(ends, todayYmd), state: left != null && left < 0 ? 'done' : 'later', words: left != null && left < 0 ? 'the owner’s 10 % was due to be held until then' : `${daysWords(left)} · the owner holds 10 %`, daysLeft: left, door: null })
    } else {
      steps.push({ kind: 'hold', key: 'hold', cite: '§ 53.101', label: '§ 53.101 hold ends', date: '', dateWords: '—', state: 'undated', words: '30 days after the original contract completes', daysLeft: null, door: 'contract_completion' })
    }
  }

  // 8 · § 53.158 suit
  const suitDate = filingDeadline ? suitDeadlineFor(filingDeadline) : ''
  {
    const left = days(todayYmd, suitDate)
    if (releasedAt) {
      steps.push({ kind: 'suit', key: 'suit', cite: '§ 53.158', label: '§ 53.158 suit', date: suitDate, dateWords: lienDateWords(suitDate, todayYmd), state: 'done', words: 'not needed · released', daysLeft: null, door: null })
    } else if (lienGone || !suitDate) {
      steps.push({ kind: 'suit', key: 'suit', cite: '§ 53.158', label: '§ 53.158 suit', date: '', dateWords: '—', state: lienGone ? 'blocked' : 'undated', words: '', daysLeft: null, door: null })
    } else if (filedAt) {
      const counselBy = ymdAddDays(suitDate, -LIEN_SUIT_COUNSEL_LEAD_DAYS)
      const state: LienTimelineState = left != null && left < 0 ? 'missed' : left != null && left <= LIEN_SUIT_COUNSEL_LEAD_DAYS ? 'due' : 'later'
      steps.push({ kind: 'suit', key: 'suit', cite: '§ 53.158', label: '§ 53.158 suit', date: suitDate, dateWords: lienDateWords(suitDate, todayYmd), state, words: state === 'missed' ? 'the year ran out' : state === 'due' ? `${daysWords(left)} · counsel now` : `${daysWords(left)} · counsel by ${lienDateWords(counselBy, todayYmd)}`, daysLeft: left, door: null })
    } else {
      steps.push({ kind: 'suit', key: 'suit', cite: '§ 53.158', label: '§ 53.158 suit', date: suitDate, dateWords: lienDateWords(suitDate, todayYmd), state: 'later', words: 'or a release when paid', daysLeft: left, door: null })
    }
  }

  // 9 · release — only once something is on record
  if (filedAt) {
    if (releasedAt) {
      steps.push({ kind: 'release', key: 'release', cite: '', label: 'Release', date: releasedAt, dateWords: `released ${lienDateWords(releasedAt, todayYmd)}`, state: 'done', words: 'the clock stopped', daysLeft: null, door: null })
    } else if (input.paid) {
      steps.push({ kind: 'release', key: 'release', cite: '', label: 'Release', date: '', dateWords: 'now', state: 'due', words: 'paid · file the release of record', daysLeft: 0, door: null })
    } else {
      steps.push({ kind: 'release', key: 'release', cite: '', label: 'Release', date: '', dateWords: 'when paid', state: 'later', words: 'release of record', daysLeft: null, door: null })
    }
  }

  // The today marker: after the leading run of dated, past steps.
  let todayIndex = 0
  for (const s of steps) {
    if (s.date && s.date < todayYmd) todayIndex += 1
    else break
  }

  // Next on the path.
  let next: LienTimelineNext
  const openKeys = openMonths.map((m) => m.key)
  if (releasedAt) {
    next = { kind: 'none', words: `Released ${lienDateWords(releasedAt, todayYmd)} — the clock stopped.`, aside: '', date: releasedAt, daysLeft: null, tone: 'green' }
  } else if (lienGone) {
    next = { kind: 'lien_gone', words: 'Lien: gone. Money: still owed — chase it in Collections.', aside: unnotedMisses.length ? 'Write the closed window down with your name so the Dashboard stops naming it.' : '', date: '', daysLeft: null, tone: 'red' }
  } else if (filedAt && input.paid) {
    next = { kind: 'release', words: 'Paid — file the release of record.', aside: 'The owner is waiting for the paper; promise it the day funds clear.', date: '', daysLeft: 0, tone: 'green' }
  } else if (filedAt && !input.affidavit?.servedAt) {
    const s = steps.find((x) => x.kind === 'serve')!
    next = { kind: 'serve', words: `Serve the filed affidavit — ${s.state === 'missed' ? 'overdue' : `by ${s.dateWords}`}.`, aside: 'A copy to the owner and the GC within five days of filing (§ 53.055).', date: s.date, daysLeft: s.daysLeft, tone: s.state === 'missed' || (s.daysLeft ?? 9) <= 2 ? 'red' : 'amber' }
  } else if (earliestOpen) {
    const left = days(todayYmd, earliestOpen.deadline)
    const verb = noticeVerb(input.noticeState)
    const held = input.noticeState === 'held'
    next = {
      kind: 'notice',
      words: held ? `Held — the ${monthsPhrase(openKeys)} notice re-asks ${input.holdUntil ? lienDateWords(input.holdUntil, todayYmd) : 'before the window closes'}; mail by ${lienDateWords(earliestOpen.deadline, todayYmd)}.` : `${verb} the ${monthsPhrase(openKeys)} notice — ${daysWords(left)}.`,
      aside: unnotedMisses.length ? `${monthsPhrase(unnotedMisses.map((m) => m.key))}’s lien is gone; its dollars ride on this notice’s letter, not its form.` : '',
      date: earliestOpen.deadline,
      daysLeft: left,
      tone: left != null && left <= 7 ? 'red' : left != null && left <= 14 ? 'amber' : 'quiet',
    }
  } else {
    const r = steps.find((x) => x.kind === 'retainage' && x.state === 'due')
    const a = steps.find((x) => x.kind === 'affidavit')!
    if (r) {
      next = { kind: 'retainage', words: `Send the § 53.057 retainage notice — ${daysWords(r.daysLeft)}.`, aside: '', date: r.date, daysLeft: r.daysLeft, tone: (r.daysLeft ?? 99) <= 7 ? 'red' : 'amber' }
    } else if (!filedAt && a.state === 'due') {
      next = { kind: 'affidavit', words: `File the affidavit — ${daysWords(a.daysLeft)}${input.affidavit?.missingGates.length ? ` · ${input.affidavit.missingGates.join(', ')} missing` : ''}.`, aside: '', date: a.date, daysLeft: a.daysLeft, tone: (a.daysLeft ?? 99) <= 7 ? 'red' : (a.daysLeft ?? 99) <= 14 ? 'amber' : 'quiet' }
    } else if (!filedAt && a.state === 'missed') {
      next = { kind: 'lien_gone', words: 'The affidavit window closed with nothing filed — the lien is gone; the money is still owed.', aside: 'The Legal desk, or Collections.', date: a.date, daysLeft: a.daysLeft, tone: 'red' }
    } else if (filedAt) {
      const s = steps.find((x) => x.kind === 'suit')!
      const counselBy = suitDate ? ymdAddDays(suitDate, -LIEN_SUIT_COUNSEL_LEAD_DAYS) : ''
      next = s.state === 'missed'
        ? { kind: 'suit', words: 'The year to sue has run — talk to counsel.', aside: '', date: suitDate, daysLeft: s.daysLeft, tone: 'red' }
        : { kind: 'suit', words: `Nothing due. Paid → file the release. Unpaid by ${lienDateWords(counselBy, todayYmd)} → counsel on the suit.`, aside: `The lien lapses ${lienDateWords(suitDate, todayYmd)} (§ 53.158).`, date: suitDate, daysLeft: s.daysLeft, tone: s.state === 'due' ? 'amber' : 'quiet' }
    } else {
      next = { kind: 'none', words: 'Nothing due yet.', aside: a.date ? `The affidavit window opens later; file by ${a.dateWords}.` : '', date: a.date, daysLeft: a.daysLeft, tone: 'quiet' }
    }
  }

  return { steps, next, kindUnknown, lienGone, suitDate, todayIndex }
}

/** The one-line form for a sticky strip or a list row: `Next on the path · Approve the Aug notice — 22 days`. */
export function lienTimelineNextLine(t: LienTimeline): string {
  return t.next.words
}
