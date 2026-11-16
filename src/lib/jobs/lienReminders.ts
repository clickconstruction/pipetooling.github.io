import { COURTESY_FROM_DAY, type CourtesyStatus } from './lienCourtesyNotice'
import { LETTER_TWO_FROM_DAY, type LetterTwoStatus } from './lienLetterTwo'
import { LIEN_MONTH_RULE } from './lienMonthRhythm'

/**
 * The REMINDERS strip on the Lien desk's To do (punch list #262, Grace's ask of 2026-11-04): a
 * sent § 53.056 notice walks its own ladder of four between the notice's run and the affidavit —
 * 1 *Reminder due* (nothing since the packet, from day 7), 2 *Reminder sent* (the courtesy went,
 * waiting a week), 3 *Letter two* (counsel's certified second letter, drafted or sent, from day
 * 10), 4 *Closed* (paid, the GC authorized direct pay, the owner called, the affidavit is filed,
 * they answered, or no reminder may go). The strip is the small version of #235's reminders zone:
 * one rail in the shape the desk already draws, read from what the desk already knows per job.
 *
 * Pure. `lienReminderAt` reads one job's rung from its courtesy status (`courtesyStatus`, which
 * owns every rule of when a courtesy may go) and letter two's clock (`letterTwoStatus`);
 * `lienReminderLadderItems` writes that rung out for the card on a row's dots. The rail itself
 * gave its place to the Board in v2.7332, and its counts and step briefs left in v2.7451. Nothing
 * here reads, writes or changes a rule: a closer closes here only because `courtesyStatus` closed it.
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
  /** Step 1, not counted: past day 7, waiting for reminders week of the lien's month (punch list #235, PR 4). */
  | 'scheduled'
  /** Step 2: the one courtesy went; the desk waits a week for an answer, then the attorney’s letter leads (v2.6594: never a second courtesy). */
  | 'sent'
  /** Step 2: they are paying it down (PR 3 of #274) — a payment since the packet pauses the reminders until the promised day or a week; the row asks what they promised for the rest. */
  | 'paying'
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
  // Paying it down (PR 3 of #274): a payment since the packet is an answer; the notice stands on step 2 with no reminder leading until the promised day or a week.
  if (courtesy.state === 'paying') return at(2, 'paying', courtesy.words)
  if (courtesy.lastSentAt) {
    // One courtesy, then the attorney's letter (v2.6594): inside the week the desk waits; after it the letter leads when it is due.
    if (!courtesy.waitingForAnswer && two && (two.state === 'due' || two.state === 'overdue')) return at(3, 'two_due', `${two.words} · ${courtesy.words}`)
    return at(2, 'sent', courtesy.words)
  }
  if (courtesy.state === 'due') return at(1, 'due', courtesy.words)
  return at(1, (courtesy.day ?? 0) >= COURTESY_FROM_DAY && courtesy.reminderWindow ? 'scheduled' : 'waiting', courtesy.words, false)
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
            : at.state === 'scheduled'
              ? `${at.words}. The one reminder goes in reminders week of the lien’s month, days ${LIEN_MONTH_RULE.reminders.from} to ${LIEN_MONTH_RULE.reminders.to}; the footer sends it earlier by hand.`
            : `${at.words}. One press sends the email and the text: the notice stands, the lien's day, the pay link, your number.`,
    },
    {
      state: s(2),
      title: s(2) === 'now' && at.state === 'paying' ? 'Paying it down' : 'Reminder sent',
      detail:
        s(2) === 'done'
          ? 'The one reminder went and a week passed.'
          : s(2) === 'now'
            ? at.state === 'paying'
              ? `${at.words[0]?.toUpperCase() ?? ''}${at.words.slice(1)}. A partial payment is an answer: the desk stops reminding and asks what they promised for the rest.`
              : `${at.words}. One courtesy goes; after a week of silence the attorney’s letter leads.`
            : 'Then the desk waits a week for an answer.',
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
