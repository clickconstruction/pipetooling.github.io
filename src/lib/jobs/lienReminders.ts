import { COURTESY_AFFIDAVIT_MARGIN_DAYS, COURTESY_AGAIN_DAYS, COURTESY_FROM_DAY, type CourtesyStatus } from './lienCourtesyNotice'
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

export const LIEN_REMINDER_STEPS: readonly [string, string, string, string] = ['Reminder due', 'Reminder sent', 'Attorney’s letter', 'Closed']
/** The phone's tiles (v2.4881's shape). */
export const LIEN_REMINDER_SHORT: readonly [string, string, string, string] = ['Due', 'Sent', 'Attorney’s letter', 'Closed']

export type LienReminderState =
  /** Step 1: from day 7, nothing since the packet. */
  | 'due'
  /** Step 1, not counted: before day 7. */
  | 'waiting'
  /** Step 2: the one courtesy went; the desk waits a week for an answer, then the attorney’s letter leads (v2.6594: never a second courtesy). */
  | 'sent'
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
  /** Step 4: no reminder may go — the lien cannot go on (a homestead, no work month, the window closed). */
  | 'held'
  /** Step 4: the affidavit's week (v2.6594) — the desk recommends the affidavit; the courtesy press stays on the footer. */
  | 'affidavit_week'

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
  if (courtesy.state === 'held' || courtesy.state === 'affidavit_week') {
    // The live desk on 2026-11-04: seven notices at day 21 with the courtesy held and the attorney's letter live — a press is never Closed.
    if (two && (two.state === 'due' || two.state === 'overdue')) return at(3, 'two_due', `${two.words} · ${courtesy.words}`)
    return at(4, courtesy.state, courtesy.words)
  }
  if (courtesy.lastSentAt) {
    // One courtesy, then the attorney's letter (v2.6594): inside the week the desk waits; after it the letter leads when it is due.
    if (!courtesy.waitingForAnswer && two && (two.state === 'due' || two.state === 'overdue')) return at(3, 'two_due', `${two.words} · ${courtesy.words}`)
    return at(2, 'sent', courtesy.words)
  }
  if (courtesy.state === 'due') return at(1, 'due', courtesy.words)
  return at(1, 'waiting', courtesy.words, false)
}

export type LienReminderRow = LienReminderAt & { jobId: string; title: string; /** Why this notice is on its rung, in the courtesy's or the letter's own words (PR 2 of #274): the step brief counts the step's notices by it. */ why?: string }

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

/** Why a notice stands on its rung, short enough for a chip: the hold's reason, the letter's state, the courtesy's. */
export function lienReminderWhy(courtesy: CourtesyStatus, two: LetterTwoStatus | null | undefined, at: LienReminderAt): string {
  if (courtesy.state === 'closed') return courtesy.reason || 'closed'
  if (courtesy.state === 'held') return courtesy.reason.replace(/\s—.*$/, '')
  if (courtesy.state === 'affidavit_week') return 'the affidavit’s week'
  if (two && two.state === 'in_flight') return 'the attorney’s letter is drafted'
  if (two && two.state === 'sent') return 'the attorney’s letter went'
  if (at.step === 3) return 'the courtesy went and a week passed'
  if (courtesy.state === 'sent') return courtesy.waitingForAnswer ? 'the courtesy went this week' : 'the courtesy went, nothing since'
  if (courtesy.state === 'waiting') return 'before day 7'
  return 'nothing since the packet'
}

export function buildLienReminders(input: LienRemindersInput): LienReminders {
  const rows: LienReminderRow[] = []
  for (const [jobId, courtesy] of Object.entries(input.courtesyByJob)) {
    const two = input.letterTwoByJob[jobId]
    const at = lienReminderAt(courtesy, two)
    if (at) rows.push({ ...at, jobId, title: input.jobTitle(jobId), why: lienReminderWhy(courtesy, two, at) })
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
      detail: s(2) === 'done' ? 'The one reminder went and a week passed.' : s(2) === 'now' ? `${at.words}. One courtesy goes; after a week of silence the attorney’s letter leads.` : 'Then the desk waits a week for an answer.',
    },
    {
      state: s(3),
      title: 'Attorney’s letter',
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
      return { when: 'the one courtesy notice went', press: `none for ${COURTESY_AGAIN_DAYS} days; then Send the attorney’s letter`, who: 'office', movesOn: 'the attorney’s letter is drafted, or something closes it' }
    case 3:
      return { when: `the attorney’s letter is due from day ${LETTER_TWO_FROM_DAY} and overdue from day ${LETTER_TWO_BY_DAY} while the courtesy is held, or an attorney’s letter is drafting, awaiting the leader, in the run or sent`, press: 'Send the attorney’s letter, counsel’s certified second letter, drafted on the notice and approved and run like any notice', who: 'leader', movesOn: 'something closes it, or the affidavit is filed' }
    default:
      return { when: 'paid, the GC authorized direct pay, the owner called, they answered, the affidavit is filed, or no reminder may go', press: 'none; the notice reads under Sent', who: 'office', movesOn: 'nothing; this is the end of the ladder' }
  }
}

/** One move a brief names: the press as the row or the pane reads it, and what it means in a first-week employee's words. */
export type LienBriefMove = { press: string; means: string }

export type LienReminderBrief = {
  title: string
  /** Whose step it is: the usual move's owner. */
  who: 'office' | 'leader'
  /** In plain words: what this thing is, before any rule. */
  plain: string
  /** Why a notice stands here. */
  why: string
  /** What to do now: the usual press and what happens when it is pressed; null on Closed. */
  usual: LienBriefMove | null
  /** If that is not right: the other moves the row or the notice's footer offers, each with its meaning — named, never invented. */
  instead: LienBriefMove[]
  /** What moves a notice off this step with no press at all; '' on Closed. */
  closes: string
  /** If nobody acts: what the calendar does to this notice. */
  ifNobody: string
}

const CLOSERS = 'the bill is paid, the GC okays direct pay in writing, the owner’s call is recorded, they answer, or the affidavit is filed'
const OWNER_CALL: LienBriefMove = { press: 'Record the owner’s call', means: 'the owner phoned about it; that ends the reminders' }
const GC_OKAY: LienBriefMove = { press: 'The GC authorized direct pay', means: 'the GC told the owner in writing to pay us' }

/**
 * The step brief a pressed rung opens on Do now (v2.6574; rewritten v2.6594 for a first-week employee,
 * punch list #274). Six parts, always in this order: in plain words · why a notice is here · what to do
 * now and what the press does · if that is not right, each other move with its meaning · what ends the
 * step on its own · what happens if nobody acts. The days are the clocks' own constants. The other moves
 * are the presses a sent notice's footer offers: *Record the owner’s call…*, *The GC authorized direct
 * pay…*, *Send a courtesy notice ▸* (again, by hand), *Send the attorney’s letter ▸* while unpaid.
 */
export function lienReminderBrief(step: LienReminderStep): LienReminderBrief {
  switch (step) {
    case 1:
      return {
        title: LIEN_REMINDER_STEPS[0],
        who: 'office',
        plain: `We mailed the lien notice a week or more ago and heard nothing. A courtesy reminder is a plain email and text that says the notice stands. It is not a legal paper, and we send it once.`,
        why: `The packet went, nothing came back, and it is day ${COURTESY_FROM_DAY} or later.`,
        usual: { press: 'Send a courtesy notice', means: 'sends the email and the text in one press; it takes a minute' },
        instead: [{ press: 'Send the attorney’s letter', means: 'skip the light step; counsel’s certified letter goes now' }, OWNER_CALL, GC_OKAY],
        closes: CLOSERS,
        ifNobody: `Nothing goes out. From day ${LETTER_TWO_FROM_DAY} the attorney’s letter is due, from day ${LETTER_TWO_BY_DAY} it is late, and the lien’s day keeps coming.`,
      }
    case 2:
      return {
        title: LIEN_REMINDER_STEPS[1],
        who: 'office',
        plain: `We sent the one reminder. Give them a week to answer. If nothing comes, the next step is the attorney’s letter, not another reminder.`,
        why: `A courtesy notice went inside the last ${COURTESY_AGAIN_DAYS} days.`,
        usual: { press: 'Send the attorney’s letter', means: `after ${COURTESY_AGAIN_DAYS} days of silence; counsel’s certified letter, the leader approves it` },
        instead: [{ press: 'Send a courtesy notice again', means: 'only by hand, when an email or a text bounced' }, OWNER_CALL, GC_OKAY],
        closes: CLOSERS,
        ifNobody: `After the week this notice moves to the attorney’s letter by itself. The lien’s day keeps coming.`,
      }
    case 3:
      return {
        title: LIEN_REMINDER_STEPS[2],
        who: 'leader',
        plain: `Nobody paid or answered. The attorney’s letter is the stronger letter our attorney wrote for exactly this. It goes by certified mail, like the first notice.`,
        why: `The attorney’s letter is due from day ${LETTER_TWO_FROM_DAY} and late from day ${LETTER_TWO_BY_DAY}: the courtesy went and a week passed, or it could not go. A notice is also here while the letter is drafting, awaiting the leader, in the run or sent.`,
        usual: { press: 'Send the attorney’s letter', means: 'you pick one of the attorney’s two letters, the leader approves, it goes in the next certified run' },
        instead: [{ press: 'Send a courtesy notice', means: 'the plain email and text, by hand, once its hold has cleared' }, OWNER_CALL, GC_OKAY, { press: 'Open the notice', means: 'read the notice and its record under Sent' }],
        closes: CLOSERS,
        ifNobody: `Inside the ${COURTESY_AFFIDAVIT_MARGIN_DAYS} days before the lien’s day the desk asks for the affidavit instead. On the lien’s day the affidavit must be on file at the county or the right to it is lost.`,
      }
    default:
      return {
        title: LIEN_REMINDER_STEPS[3],
        who: 'office',
        plain: `This one is over: they paid, called, answered, the GC okayed paying us, or the lien is filed. Nothing is left to send. The notice stays under Sent as a record.`,
        why: `Paid, the GC authorized direct pay, the owner called, they answered, the affidavit is filed, or the lien cannot go on.`,
        usual: null,
        instead: [{ press: 'Open the notice', means: 'see what ended it, under Sent' }, { press: 'Not what I said', means: 'pulls back a notice sent on your word or a GC’s rule while it has not gone out' }],
        closes: '',
        ifNobody: `Nothing. A closed notice needs nobody.`,
      }
  }
}
