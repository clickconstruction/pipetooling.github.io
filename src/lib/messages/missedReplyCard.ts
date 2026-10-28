/**
 * Punch list #195 PR 2 (v2.6018): Settings → Phone and texts → **Missed calls**, the card that writes the setting
 * `quo-webhook` reads before it texts a caller back (`app_settings` `messages_missed_call_reply_v1`,
 * `quo/missedReply.ts`): the switch, the three lines, what the gates are in plain words, and the last ten texts back
 * with what went or why nothing did (`missed_call_replies`). Pure: the words, the draft the card edits, what is wrong
 * with a draft, the JSON a save writes, and the list's rows. The reads and the two writes are `missedReplyCardIo.ts`.
 */
import type { UserRole } from '../../hooks/useAuth'
import { isOwnerOrDev } from '../gc/access'
import { MISSED_LINE_WORDS, parseMissedReply, serializeMissedReply, type MissedLine, type MissedReplySettings } from '../quo/missedReply'
import { lineWhen } from './thread'

/** The most a line carries: a text and its opt-out line stay well inside one message's 1,600 characters. */
export const MISSED_LINE_MAX = 320

/** How many texts back the card lists. */
export const MISSED_CLAIMS_SHOWN = 10

export const MISSED_REPLY_WORDS = {
  title: 'Missed calls',
  note: 'When nobody picks up, the app texts the caller back from the company number. One text a number every three hours.',
  /** The switch row. */
  switch: 'Text back a missed call',
  on: 'On. A missed call gets a text back within a minute.',
  off: 'Off. A missed call gets no text.',
  lines: MISSED_LINE_WORDS,
  gates: 'Goes only while Send texts is on. Never to a number that sent STOP. Never to a prospect who has not said yes to texts. Never to our own numbers. Never to a number we texted in the last three hours. Uses the Office hours above.',
  lastHead: 'Last texts back',
  empty: 'No texts back yet. The next missed call fills this list.',
  save: 'Save the lines',
  putBack: 'Put them back',
  notAllowed: 'The owner or a dev sets the lines.',
  emptyLine: 'Write all three lines.',
  longLine: `A line is at most ${MISSED_LINE_MAX} characters.`,
  saved: 'The missed call lines are saved.',
  notSaved: 'The lines did not change. Only the owner or a dev can set them.',
  onToast: 'The text back is on. A missed call gets a text within a minute.',
  offToast: 'The text back is off. A missed call gets no text.',
  confirm: {
    title: 'Turn on the text back?',
    message: 'When nobody picks up a call to the company number, the app texts the caller back. Each one is a real text to their phone.',
    confirmLabel: 'Turn it on',
  },
  loading: 'Reading the lines…',
} as const

/** Who may turn it on or edit the lines: the owner and a dev, as the row's UPDATE policy allows. */
export function canSetMissedReply(role: UserRole | null | undefined): boolean {
  return isOwnerOrDev(role)
}

/** What the card edits: the three lines. The switch is saved on its own press. */
export type MissedReplyDraft = Pick<MissedReplySettings, 'inHours' | 'afterHours' | 'voicemail'>

export const LINE_KEYS: readonly MissedLine[] = ['in_hours', 'after_hours', 'voicemail']

/** The draft's field for a line. */
export const LINE_FIELD: Readonly<Record<MissedLine, keyof MissedReplyDraft>> = { in_hours: 'inHours', after_hours: 'afterHours', voicemail: 'voicemail' }

/** The draft the card starts from: the lines as they are. */
export function draftFrom(settings: MissedReplySettings): MissedReplyDraft {
  return { inHours: settings.inHours, afterHours: settings.afterHours, voicemail: settings.voicemail }
}

/** Whether two drafts say the same lines, so Save knows nothing changed. */
export function sameDraft(a: MissedReplyDraft, b: MissedReplyDraft): boolean {
  return a.inHours.trim() === b.inHours.trim() && a.afterHours.trim() === b.afterHours.trim() && a.voicemail.trim() === b.voicemail.trim()
}

/** What stops a save, in the card's words, or null when the draft is good. */
export function draftProblem(draft: MissedReplyDraft): string | null {
  const lines = [draft.inHours, draft.afterHours, draft.voicemail]
  if (lines.some((l) => !l.trim())) return MISSED_REPLY_WORDS.emptyLine
  if (lines.some((l) => l.trim().length > MISSED_LINE_MAX)) return MISSED_REPLY_WORDS.longLine
  return null
}

/** The JSON a save of the lines writes: the switch as it is, the draft's lines, and when the card saved. */
export function serializeLines(current: MissedReplySettings, draft: MissedReplyDraft, savedAtIso: string): string {
  return serializeMissedReply({ on: current.on, ...draft }, savedAtIso)
}

/** The JSON the switch's press writes: the lines as saved, the switch flipped. */
export function serializeSwitch(current: MissedReplySettings, on: boolean, savedAtIso: string): string {
  return serializeMissedReply({ ...current, on }, savedAtIso)
}

/** What the row will read after a save, so the card starts its next draft from it. */
export function settingsAfterSave(json: string): MissedReplySettings {
  return parseMissedReply(json)
}

/** A record a contact's name may come from, as the io embeds it (v2.6036): the name, or null. */
export type NamedRecord = { name: string | null } | null

/**
 * A claim as the io reads it: one call nobody answered, with the caller's contact and the records their name lives on.
 * A customer's name sits on the customer record, a trade partner's on the company, a lead's on the prospect; the
 * contact row's own `name` is set only for a person a record has no room for, or a number nobody has named.
 */
export interface ClaimRow {
  call_quo_id: string
  called_at: string
  outcome: string
  line: string | null
  reason: string | null
  words: string
  decided_at: string | null
  contact: {
    name: string | null
    goes_by?: string | null
    customer?: NamedRecord
    person?: NamedRecord
    company?: { name: string | null; contact_name: string | null } | null
    gc_person?: NamedRecord
    roster?: NamedRecord
    prospect?: { contact_name: string | null; company_name: string | null } | null
  } | null
  /** The number they called from, when the claim kept it. */
  number?: { value: string | null } | null
}

const trimmed = (v: string | null | undefined): string => (v ?? '').trim()

/**
 * Who called, as the thread names them (`contacts/load.ts`'s rule, v2.6036): the contact's own name, else the record's
 * (the person at a customer, the customer, the person at a trade partner, the partner's contact or the partner, the
 * roster, the lead's person or company), else the number, else "Someone".
 */
export function claimWho(row: Pick<ClaimRow, 'contact' | 'number'>): string {
  const c = row.contact
  const name =
    trimmed(c?.name) ||
    trimmed(c?.person?.name) ||
    trimmed(c?.customer?.name) ||
    trimmed(c?.gc_person?.name) ||
    trimmed(c?.company?.contact_name) ||
    trimmed(c?.company?.name) ||
    trimmed(c?.roster?.name) ||
    trimmed(c?.prospect?.contact_name) ||
    trimmed(c?.prospect?.company_name) ||
    trimmed(row.number?.value)
  return name || 'Someone'
}

/** One row of *Last texts back*: when they called, who, and what the app did. */
export interface ClaimLine {
  key: string
  /** "today · 4:12 PM", "Mon, Oct 26 · 2:05 PM". */
  when: string
  /** Their name, or the number nobody has named. */
  who: string
  /** "Sent, in office hours.", "Not sent. They sent STOP.", "The app did not finish." */
  words: string
  tone: 'green' | 'amber' | 'muted'
}

const lineName = (line: string | null): string => (line && line in MISSED_LINE_WORDS ? MISSED_LINE_WORDS[line as MissedLine].toLowerCase() : '')

/** The list's rows, newest call first, at most `MISSED_CLAIMS_SHOWN`. */
export function claimLines(rows: readonly ClaimRow[], nowIso: string): ClaimLine[] {
  return [...rows]
    .sort((a, b) => Date.parse(b.called_at) - Date.parse(a.called_at))
    .slice(0, MISSED_CLAIMS_SHOWN)
    .map((r) => {
      const name = lineName(r.line)
      const words =
        r.outcome === 'sent'
          ? `Sent${name ? `, ${name}` : ''}.`
          : r.outcome === 'not_sent'
            ? `Not sent. ${r.words.trim() || 'The reason was not kept.'}`
            : 'The app did not finish.'
      return {
        key: r.call_quo_id,
        when: lineWhen(r.called_at, nowIso),
        who: claimWho(r),
        words,
        tone: r.outcome === 'sent' ? 'green' : r.outcome === 'not_sent' ? 'amber' : 'muted',
      }
    })
}
