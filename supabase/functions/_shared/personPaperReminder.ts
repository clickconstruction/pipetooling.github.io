/**
 * Reminders by email for a staff or sub paper that waits on a signature (punch list #376). A job's contract has had
 * them since the Contract Desk (`remind-job-contracts`): three, three days apart. A person's paper gets the same.
 *
 * The rules, in one place for the send, the timed function and the line on Documents → Agreements:
 *
 * - **Which paper.** An agreement filed under a person, sent by email. A trade company's paper goes out with its trade
 *   email, an outside party's is the office's own chase, and an hours statement is never chased by a robot.
 * - **The switch.** One Settings switch for all, `app_settings` `person_paper_reminders_v1`, and it ships off. A send
 *   reads it: a paper sent while it is off is never reminded, so turning it on reaches no paper already out.
 * - **Per paper.** `reminders_enabled` on the paper's own row, which the line turns off and on.
 * - **A link handed over.** Copy the signing link emails nobody and ends the link before it. The office has taken the
 *   chase into its own hands, so that paper's reminders stop.
 * - **Each reminder carries a new link.** The link is kept only as a hash, so the one sent before cannot be sent
 *   again. A reminder makes a new link that works for 14 days, and that ends the link before it.
 *
 * Dependency-free: the app imports it straight from here.
 */
import { isCompanyPaperName } from './companyPaper.ts'
import { isPartyPaperName, signerEmailWord } from './paperSigner.ts'

/** The Settings switch for all: `'1'` is on, anything else is off. */
export const PERSON_PAPER_REMINDERS_KEY = 'person_paper_reminders_v1'
/** Days between a send and its first reminder, and between reminders: a job contract's. */
export const PERSON_PAPER_REMINDER_DAYS = 3
/** The most reminders one send gets: a job contract's. */
export const PERSON_PAPER_MAX_REMINDERS = 3
/** How long a reminder's new link works, in days: the send's. */
export const PERSON_PAPER_REMINDER_LINK_DAYS = 14

const DAY_MS = 86_400_000

/** Whether the Settings switch is on. */
export function paperRemindersOn(valueText: string | null | undefined): boolean {
  return (valueText ?? '').trim() === '1'
}

/** A paper as far as the reminder rules read it. */
export interface ReminderPaper {
  status?: string | null
  doc_type?: string | null
  person_name?: string | null
  signer_email?: string | null
  reminders_enabled?: boolean | null
  reminder_count?: number | null
  next_reminder_at?: string | null
}

/** Whether a paper is one a reminder may go out for: an agreement filed under a person. */
export function paperTakesReminders(row: Pick<ReminderPaper, 'doc_type' | 'person_name'>): boolean {
  if ((row.doc_type ?? 'agreement') !== 'agreement') return false
  const name = (row.person_name ?? '').trim()
  if (!name) return false
  return !isCompanyPaperName(name) && !isPartyPaperName(name)
}

function countOf(row: Pick<ReminderPaper, 'reminder_count'>): number {
  const n = Number(row.reminder_count ?? 0)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/** When the next reminder is due, counted from now. */
export function nextReminderAt(nowMs: number): string {
  return new Date(nowMs + PERSON_PAPER_REMINDER_DAYS * DAY_MS).toISOString()
}

/**
 * The reminder columns one send writes, beside the signer's.
 *
 * An emailed send of a paper that takes reminders starts the count again. It sets the first reminder only when the
 * Settings switch is on, the paper's own switch is not off, and the link went to an address. A link handed over stops
 * the reminders and keeps the count. Any other paper writes nothing.
 */
export function reminderPatchOnSend(args: {
  mode: 'email' | 'link'
  switchOn: boolean
  row: Pick<ReminderPaper, 'doc_type' | 'person_name' | 'reminders_enabled'>
  signerEmail: string | null | undefined
  nowMs: number
}): { reminder_count?: number; next_reminder_at?: string | null } {
  if (!paperTakesReminders(args.row)) return {}
  if (args.mode === 'link') return { next_reminder_at: null }
  const armed = args.switchOn && args.row.reminders_enabled !== false && signerEmailWord(args.signerEmail) !== null
  return { reminder_count: 0, next_reminder_at: armed ? nextReminderAt(args.nowMs) : null }
}

/** Why a due paper gets no reminder, or null when one may go. Each reason stops that paper's reminders. */
export type ReminderHold = 'not_waiting' | 'kind' | 'off' | 'no_address' | 'all_sent'

/** The timed function's own check of one due row, whatever the query already narrowed. */
export function reminderHold(row: ReminderPaper): ReminderHold | null {
  if (row.status !== 'sent') return 'not_waiting'
  if (!paperTakesReminders(row)) return 'kind'
  if (row.reminders_enabled === false) return 'off'
  if (signerEmailWord(row.signer_email) === null) return 'no_address'
  if (countOf(row) >= PERSON_PAPER_MAX_REMINDERS) return 'all_sent'
  return null
}

/** A hold in words, for the function's answer. */
export function reminderHoldWords(hold: ReminderHold | 'left'): string {
  if (hold === 'not_waiting') return 'The paper is no longer waiting.'
  if (hold === 'kind') return 'This kind of paper gets no reminders.'
  if (hold === 'off') return 'Reminders are off for this paper.'
  if (hold === 'no_address') return 'The paper kept no address to remind.'
  if (hold === 'left') return 'The person has left the team.'
  return 'Every reminder has been sent.'
}

/** The columns written once a reminder has gone out. The last one clears the next. */
export function afterReminder(countBefore: number, nowMs: number): { reminder_count: number; next_reminder_at: string | null; last_reminded_at: string } {
  const count = Math.max(0, Math.floor(countBefore)) + 1
  return { reminder_count: count, next_reminder_at: count >= PERSON_PAPER_MAX_REMINDERS ? null : nextReminderAt(nowMs), last_reminded_at: new Date(nowMs).toISOString() }
}

/** The reminder's subject. */
export function reminderSubject(documentName: string, company: string): string {
  return `Reminder: please sign ${documentName.trim() || 'your agreement'} · ${company}`
}

/** The reminder's opening words. `nth` is which reminder this is, from 1. */
export function reminderIntro(nth: number): string {
  const first = 'A reminder that this agreement is waiting for your signature. It only takes a couple of minutes on your phone.'
  const link = 'This email carries a new link. The link in our earlier email no longer works.'
  const last = nth >= PERSON_PAPER_MAX_REMINDERS ? '\n\nThis is the last reminder we will send.' : ''
  return `${first}\n\n${link}${last}`
}

/** What a waiting paper's line says about its reminders, and the one press it offers. */
export type PaperReminderLine =
  | { kind: 'none' }
  | { kind: 'on'; sent: number; nextAt: string }
  | { kind: 'off'; sent: number; canTurnOn: boolean }
  | { kind: 'all_sent'; sent: number }

/**
 * The line's state. Nothing shows for a paper that takes no reminders, for one that is not waiting, and for one with
 * no reminder set or sent while the Settings switch is off: the office hears nothing about reminders until they exist.
 */
export function paperReminderLine(row: ReminderPaper, switchOn: boolean): PaperReminderLine {
  if (row.status !== 'sent' || !paperTakesReminders(row)) return { kind: 'none' }
  const sent = countOf(row)
  if (sent >= PERSON_PAPER_MAX_REMINDERS) return { kind: 'all_sent', sent }
  const next = (row.next_reminder_at ?? '').trim()
  if (next && row.reminders_enabled !== false) return switchOn || sent > 0 ? { kind: 'on', sent, nextAt: next } : { kind: 'none' }
  if (!switchOn && sent === 0) return { kind: 'none' }
  return { kind: 'off', sent, canTurnOn: switchOn && signerEmailWord(row.signer_email) !== null }
}

export const TURN_REMINDERS_OFF_LABEL = 'Turn reminders off'
export const TURN_REMINDERS_ON_LABEL = 'Turn reminders on'

/** The line's words. `dayLabel` writes a day as the page writes days. */
export function paperReminderWords(line: PaperReminderLine, dayLabel: (iso: string) => string): string {
  if (line.kind === 'none') return ''
  const max = PERSON_PAPER_MAX_REMINDERS
  if (line.kind === 'all_sent') return `All ${max} reminders sent`
  if (line.kind === 'off') return line.sent > 0 ? `Reminders off · ${line.sent} of ${max} sent` : 'Reminders off'
  return `${line.sent} of ${max} reminders sent · next ${dayLabel(line.nextAt)}`
}

/** What the line's press writes on the paper's row. Turning them on sets the next one three days out. */
export function reminderSwitchPatch(turnOn: boolean, nowMs: number): { reminders_enabled: boolean; next_reminder_at: string | null } {
  return turnOn ? { reminders_enabled: true, next_reminder_at: nextReminderAt(nowMs) } : { reminders_enabled: false, next_reminder_at: null }
}

/** The toast after the line's press. */
export function reminderSwitchWords(turnOn: boolean, who: string | null | undefined): string {
  const name = (who ?? '').trim() || 'this person'
  return turnOn ? `Reminders are on. ${name} gets the next one in ${PERSON_PAPER_REMINDER_DAYS} days.` : `Reminders are off for this paper. ${name} gets no more.`
}
