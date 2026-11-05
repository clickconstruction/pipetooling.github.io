import { COURTESY_AGAIN_DAYS, COURTESY_FROM_DAY, type CourtesyStatus } from './lienCourtesyNotice'
import { LETTER_TWO_BY_DAY, LETTER_TWO_FROM_DAY, type LetterTwoStatus } from './lienLetterTwo'

/**
 * The REMINDERS strip on the Lien desk's Do now (punch list #262, Grace's ask of 2026-11-04): a
 * sent § 53.056 notice walks its own ladder of four between the notice's run and the affidavit —
 * 1 *Reminder due* (nothing since the packet, from day 7), 2 *Reminder sent* (the courtesy went,
 * waiting a week), 3 *Letter two* (counsel's certified second letter, drafted or sent, from day
 * 10), 4 *Closed* (paid, the GC authorized direct pay, the owner called, the affidavit is filed,
 * they answered, or no reminder may go). The strip is the small version of #235's reminders zone:
 * one rail in the shape the desk already draws, read from what the desk already knows per job.
 *
 * Pure. `lienReminderAt` reads one job's rung from its courtesy status (`courtesyStatus`, which
 * owns every rule of when a courtesy may go) and letter two's clock (`letterTwoStatus`);
 * `buildLienReminders` adds the desk's jobs up per rung with the names behind each. Nothing here
 * reads, writes or changes a rule: a closer closes here only because `courtesyStatus` closed it.
 */

export type LienReminderStep = 1 | 2 | 3 | 4

export const LIEN_REMINDER_STEPS: readonly [string, string, string, string] = ['Reminder due', 'Reminder sent', 'Letter two', 'Closed']
/** The phone's tiles (v2.4881's shape). */
export const LIEN_REMINDER_SHORT: readonly [string, string, string, string] = ['Due', 'Sent', 'Letter two', 'Closed']

export type LienReminderState =
  /** Step 1: from day 7, nothing since the packet. */
  | 'due'
  /** Step 1, not counted: before day 7. */
  | 'waiting'
  /** Step 2: the courtesy went inside the last week. */
  | 'sent'
  /** Step 2: a week since the courtesy and nothing came; another may go, and letter two leads from day 10. */
  | 'again'
  /** Step 3: letter two is due or overdue and the courtesy is held (no reminder may go, counsel's letter still does) — the row's press is letter two's. */
  | 'two_due'
  /** Step 3: a letter two is on the desk — drafting, awaiting the leader, in the run, or held. */
  | 'two_drafting'
  | 'two_awaiting'
  | 'two_in_run'
  | 'two_held'
  /** Step 3: letter two went out. */
  | 'two_sent'
  /** Step 4, each with its closer. */
  | 'paid'
  | 'gc_authorized'
  | 'owner_called'
  | 'filed'
  | 'answered'
  /** Step 4: no reminder may go — the affidavit is inside a week, or the lien cannot go on (a homestead, no work month, the window closed). */
  | 'held'

export type LienReminderAt = {
  step: LienReminderStep
  state: LienReminderState
  /** The row's words: the courtesy's, letter two's, or the closer's. */
  words: string
  /** Letter two's day count — whole days since the packet; null when the clock has none. */
  day: number | null
  /** On the rung's count. A notice before day 7 stands on step 1 uncounted. */
  counted: boolean
}

function closedState(courtesy: CourtesyStatus, two: LetterTwoStatus | null | undefined): LienReminderState {
  const r = courtesy.reason
  if (r === 'paid' || two?.state === 'paid') return 'paid'
  if (two?.gcAuthorized || r.startsWith('the GC authorized')) return 'gc_authorized'
  if (two?.ownerCalledAt || two?.state === 'owner_called' || r.startsWith('owner called') || r === 'the owner called') return 'owner_called'
  if (r.startsWith('the affidavit is filed')) return 'filed'
  return 'answered'
}

function twoState(two: LetterTwoStatus): LienReminderState {
  if (two.state === 'sent') return 'two_sent'
  switch (two.letterTwo?.status) {
    case 'awaiting_approval':
      return 'two_awaiting'
    case 'approved':
    case 'printed':
      return 'two_in_run'
    case 'held':
      return 'two_held'
    default:
      return 'two_drafting'
  }
}

/**
 * The rung one sent notice stands on. Read in this order: nothing out (null); closed by a payment,
 * the GC's okay, the owner's call, the filed affidavit or a reply (4); a letter two on the desk or
 * sent (3); held, since no reminder may go — letter two due meanwhile keeps it on 3, else 4; a
 * courtesy went (2); due from day 7 (1); before day 7 (1, uncounted).
 */
export function lienReminderAt(courtesy: CourtesyStatus | null | undefined, two: LetterTwoStatus | null | undefined): LienReminderAt | null {
  if (!courtesy || courtesy.state === 'none') return null
  const day = courtesy.day ?? two?.day ?? null
  const at = (step: LienReminderStep, state: LienReminderState, words: string, counted = true): LienReminderAt => ({ step, state, words, day, counted })
  if (courtesy.state === 'closed') return at(4, closedState(courtesy, two), courtesy.words)
  if (two && (two.state === 'in_flight' || two.state === 'sent')) return at(3, twoState(two), courtesy.lastSentAt ? `${two.words} · ${courtesy.words}` : two.words)
  if (courtesy.state === 'held') {
    // The live desk on 2026-11-04: seven notices at day 21 with the courtesy held and *Send letter two* live — a press is never Closed.
    if (two && (two.state === 'due' || two.state === 'overdue')) return at(3, 'two_due', `${two.words} · ${courtesy.words}`)
    return at(4, 'held', courtesy.words)
  }
  if (courtesy.lastSentAt) return at(2, courtesy.state === 'sent' ? 'sent' : 'again', courtesy.words)
  if (courtesy.state === 'due') return at(1, 'due', courtesy.words)
  return at(1, 'waiting', courtesy.words, false)
}

export type LienReminderRow = LienReminderAt & { jobId: string; title: string }

export type LienRemindersInput = {
  courtesyByJob: Readonly<Record<string, CourtesyStatus>>
  letterTwoByJob: Readonly<Record<string, LetterTwoStatus>>
  jobTitle: (jobId: string) => string
}

export type LienReminders = {
  /** Every job on the ladder, by rung, the longest-waiting first within a rung. */
  rows: LienReminderRow[]
  /** Per rung: the counted rows. */
  counts: [number, number, number, number]
  /** Sent notices before day 7 — on step 1 but not in its count. */
  waiting: number
}

export const LIEN_REMINDERS_EMPTY: LienReminders = { rows: [], counts: [0, 0, 0, 0], waiting: 0 }

export function buildLienReminders(input: LienRemindersInput): LienReminders {
  const rows: LienReminderRow[] = []
  for (const [jobId, courtesy] of Object.entries(input.courtesyByJob)) {
    const at = lienReminderAt(courtesy, input.letterTwoByJob[jobId])
    if (at) rows.push({ ...at, jobId, title: input.jobTitle(jobId) })
  }
  rows.sort((a, b) => a.step - b.step || (b.day ?? -1) - (a.day ?? -1) || a.title.localeCompare(b.title))
  const counts: [number, number, number, number] = [0, 0, 0, 0]
  let waiting = 0
  for (const r of rows) {
    if (r.counted) counts[r.step - 1] = (counts[r.step - 1] ?? 0) + 1
    else waiting += 1
  }
  return { rows, counts, waiting }
}

/** The grey words after a rung's count: step 1's uncounted notices before day 7. */
export function lienReminderRungWords(step: LienReminderStep, waiting: number): string {
  if (step !== 1 || waiting <= 0) return ''
  return ` · ${waiting} before day ${COURTESY_FROM_DAY}`
}

/** Whose press the rung is — every rung of this ladder is the office's; the leader approves letter two as he approves any notice. */
export function lienReminderStepWho(step: LienReminderStep): 'office' | 'leader' {
  return step === 3 ? 'leader' : 'office'
}

export type LienReminderCardItem = { state: 'done' | 'now' | 'todo'; title: string; detail: string }

/** The row's ladder written out for the card on its dots: what went, what is being done now, what is still to come. */
export function lienReminderLadderItems(at: LienReminderAt): LienReminderCardItem[] {
  const s = (n: LienReminderStep): LienReminderCardItem['state'] => (n < at.step ? 'done' : n === at.step ? 'now' : 'todo')
  const dayWords = at.day != null ? ` · day ${at.day}` : ''
  return [
    {
      state: s(1),
      title: s(1) === 'done' ? 'Reminder went' : 'Reminder due',
      detail:
        s(1) === 'done'
          ? 'A courtesy notice went by email and text.'
          : at.state === 'waiting'
            ? `${at.words}. The desk offers the press from day ${COURTESY_FROM_DAY} after the packet.`
            : `${at.words}. One press sends the email and the text: the notice stands, the lien's day, the pay link, your number.`,
    },
    {
      state: s(2),
      title: s(2) === 'done' ? 'Reminder sent' : 'Reminder sent',
      detail: s(2) === 'done' ? 'The reminder went and a week passed.' : s(2) === 'now' ? `${at.words}${at.state === 'again' ? '. Another may go, or letter two from day ' + LETTER_TWO_FROM_DAY : '. Another may go in a week if nothing comes'}.` : 'Then the desk waits a week for an answer.',
    },
    {
      state: s(3),
      title: 'Letter two',
      detail: s(3) === 'done' ? 'Counsel’s certified second letter went, or was not needed.' : s(3) === 'now' ? `${at.words}${dayWords}. Drafted on the notice, approved and run like any notice.` : `Counsel’s certified second letter, from day ${LETTER_TWO_FROM_DAY}.`,
    },
    {
      state: s(4),
      title: 'Closed',
      detail: s(4) === 'now' ? `${at.words[0]?.toUpperCase() ?? ''}${at.words.slice(1)}.` : 'Paid, the GC authorized direct pay, the owner called, they answered, or the affidavit is filed.',
    },
  ]
}

export type LienReminderRungRule = { when: string; press: string; who: 'office' | 'leader'; movesOn: string }

/**
 * A rung's rule in words, for the list under the rail when the rung is pressed (v2.6522): when a
 * sent notice stands here, what the row's press is, whose it is and what moves it on. The days are
 * the clocks' own constants, so the words follow a rule when it changes.
 */
export function lienReminderRungRule(step: LienReminderStep): LienReminderRungRule {
  switch (step) {
    case 1:
      return { when: `the packet went, nothing came back, and it is day ${COURTESY_FROM_DAY} or later`, press: 'Send a courtesy notice, one email and one text from the notice’s own facts, never certified mail', who: 'office', movesOn: 'the courtesy goes' }
    case 2:
      return { when: 'a courtesy notice went', press: `none for ${COURTESY_AGAIN_DAYS} days, then Send a courtesy notice again, with Send letter two leading from day ${LETTER_TWO_FROM_DAY}`, who: 'office', movesOn: 'letter two is drafted, or something closes it' }
    case 3:
      return { when: `letter two is due from day ${LETTER_TWO_FROM_DAY} and overdue from day ${LETTER_TWO_BY_DAY} while the courtesy is held, or a letter two is drafting, awaiting the leader, in the run or sent`, press: 'Send letter two, counsel’s certified second letter, drafted on the notice and approved and run like any notice', who: 'leader', movesOn: 'something closes it, or the affidavit is filed' }
    default:
      return { when: 'paid, the GC authorized direct pay, the owner called, they answered, the affidavit is filed, or no reminder may go', press: 'none; the notice reads under Sent', who: 'office', movesOn: 'nothing; this is the end of the ladder' }
  }
}

/** The rule as one line the list under the rail reads. */
export function lienReminderRungRuleWords(step: LienReminderStep): string {
  const r = lienReminderRungRule(step)
  return `Stands here when ${r.when}. The press: ${r.press}. ${r.who === 'leader' ? 'The leader' : 'The office'} presses it. Moves on when ${r.movesOn}.`
}
