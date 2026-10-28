/**
 * Punch list #195 (v2.6012): a missed call gets a text back from the app. When nobody picks up a call to one of our
 * numbers, `quo-webhook` texts the caller back from that number with the office's words, through every gate the app's
 * texts already have, and the line is marked the app's (`messages.auto`), so it neither clears Needs a reply nor starts
 * Waiting on them. The owner picked this (B) over Quo's own auto-reply and over Sona on 2026-10-26, for the gates Quo
 * cannot see: the Send texts switch, a prospect's *May we text?* and one set of office hours. The two answers of
 * 2026-10-28: every number that is a phone gets the text, and the three lines below ship as the defaults.
 *
 * Pure, mirrored to the edge by `scripts/edge-kernels.mjs`. The webhook reads the call's line, the setting, the office
 * hours, the switch, the pause, the number's STOP, the prospect's say and our last text to the number, and asks
 * `planMissedReply` what to send or why nothing goes; `sendText` (`_shared/quoLines.ts`) sends it with the purpose
 * `missed`, which the switch gates and which marks the line `auto`. The card on Settings → Phone and texts → Missed
 * calls (PR 2) edits the setting through `parseMissedReply` / `serializeMissedReply` and reads the claims back.
 */
import { officeOpen, type OfficeHours } from '../messages/hasRule'
import { clockTime } from '../messages/thread'
import { textRefusal, type OkToTextRow } from '../prospects/textingRule'
import { TEXTS_PAUSED } from './paused'

/** The `app_settings` key, as `APP_SETTINGS_KEY_MESSAGES_MISSED_CALL_REPLY_V1` names it for the app. */
export const MISSED_REPLY_KEY = 'messages_missed_call_reply_v1'

/** A number we texted this recently gets no text back: a caller who rings five times gets one text. */
export const MISSED_REPLY_HOLD_MS = 3 * 60 * 60 * 1000

/** The card's switch and the three lines, as the row keeps them. */
export interface MissedReplySettings {
  /** Off as it ships. */
  on: boolean
  /** Nobody answered, in office hours. */
  inHours: string
  /** Nobody answered, after hours. */
  afterHours: string
  /** They left a voicemail. */
  voicemail: string
}

/** The owner's defaults (2026-10-28), and what an empty line on the card falls back to. */
export const MISSED_REPLY_DEFAULTS: MissedReplySettings = {
  on: false,
  inHours: 'Sorry we missed your call. This is Click Plumbing. Text us here and we answer shortly.',
  afterHours: 'Sorry we missed your call. The office opens at 7 AM. Text us here and we answer then.',
  voicemail: 'We got your voicemail and will call you back.',
}

const lineOf = (v: unknown, fallback: string): string => (typeof v === 'string' && v.trim() ? v.trim() : fallback)

/**
 * The setting from the row's `value_text`: `{"on":false,"inHours":"…","afterHours":"…","voicemail":"…"}`. No row, no
 * JSON or a field it cannot read takes the default, so a bad row never texts an empty line; `on` is read only as the
 * boolean `true`, so a bad row never turns the text back on.
 */
export function parseMissedReply(valueText: string | null | undefined): MissedReplySettings {
  if (!valueText?.trim()) return { ...MISSED_REPLY_DEFAULTS }
  let parsed: unknown
  try {
    parsed = JSON.parse(valueText)
  } catch {
    return { ...MISSED_REPLY_DEFAULTS }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...MISSED_REPLY_DEFAULTS }
  const o = parsed as Record<string, unknown>
  return {
    on: o.on === true,
    inHours: lineOf(o.inHours, MISSED_REPLY_DEFAULTS.inHours),
    afterHours: lineOf(o.afterHours, MISSED_REPLY_DEFAULTS.afterHours),
    voicemail: lineOf(o.voicemail, MISSED_REPLY_DEFAULTS.voicemail),
  }
}

/** The row's words, as the card writes them: the switch, the three lines trimmed, and when the card saved. */
export function serializeMissedReply(settings: MissedReplySettings, savedAtIso?: string): string {
  return JSON.stringify({
    on: settings.on,
    inHours: settings.inHours.trim(),
    afterHours: settings.afterHours.trim(),
    voicemail: settings.voicemail.trim(),
    ...(savedAtIso ? { savedAt: savedAtIso } : {}),
  })
}

/** Which of the three lines a call gets. */
export type MissedLine = 'in_hours' | 'after_hours' | 'voicemail'

/** Each line's name on the card. */
export const MISSED_LINE_WORDS: Readonly<Record<MissedLine, string>> = { in_hours: 'In office hours', after_hours: 'After hours', voicemail: 'With a voicemail' }

/** Why nothing goes, in a word: the claim's `reason`. */
export type MissedHold = 'off' | 'not-missed' | 'texts-off' | 'own-number' | 'stopped' | 'no-texts' | 'not-asked' | 'recent-text' | 'paused'

/** A call's line as the webhook wrote it, enough to say whether nobody answered. */
export interface CallLineFacts {
  channel: string
  direction: string
}

/** Whether a call's line is one nobody answered: a missed call or a voicemail from them. Ours out, and a call someone took, are not. */
export function missedCall(line: CallLineFacts): boolean {
  return line.direction === 'in' && (line.channel === 'missed' || line.channel === 'voicemail')
}

export interface MissedReplyInput {
  /** The call's line as the webhook wrote it. */
  line: CallLineFacts
  settings: MissedReplySettings
  hours: OfficeHours
  /** Settings → Phone and texts → Send texts. */
  textsOn: boolean
  /** The number sent STOP to the box the text would go from. */
  optedOut: boolean
  /** The number is one of ours (both boxes', `ownChannels`). */
  ownNumber: boolean
  /** A prospect's *May we text?* row, or null when the caller is not a prospect alone. */
  prospect: OkToTextRow | null
  /** Our newest text to this number from this box (ms), or null when we never texted it. */
  lastOurTextAt: number | null
  /** Since when texts are paused for the balance (ISO), or null when they go. */
  pausedSince: string | null
  /** When the text would go, ISO. */
  nowIso: string
}

export type MissedReplyPlan = { send: true; line: MissedLine; body: string } | { send: false; hold: MissedHold; words: string }

/** The reason in words, as the card's list says it. */
export function holdWords(hold: MissedHold, facts: { prospect?: OkToTextRow | null; lastOurTextAt?: number | null } = {}): string {
  switch (hold) {
    case 'off':
      return 'The text back is off.'
    case 'not-missed':
      return 'Someone answered the call.'
    case 'texts-off':
      return 'Send texts is off.'
    case 'own-number':
      return 'The number is one of ours.'
    case 'stopped':
      return 'They sent STOP.'
    case 'no-texts':
    case 'not-asked':
      return textRefusal(facts.prospect ?? null)?.words ?? 'They have not said we may text.'
    case 'recent-text':
      return facts.lastOurTextAt != null ? `We texted this number at ${clockTime(new Date(facts.lastOurTextAt).toISOString())}.` : 'We texted this number in the last three hours.'
    case 'paused':
      return TEXTS_PAUSED
  }
}

/**
 * What the app texts back, or why nothing goes. The gates in their order: the card's switch, a call someone answered,
 * Send texts, our own number, the number's STOP, a prospect's *May we text?*, a text of ours in the last three hours,
 * and the pause. The voicemail line when they left one; else the office hours say in or after.
 */
export function planMissedReply(input: MissedReplyInput): MissedReplyPlan {
  const hold = (h: MissedHold): MissedReplyPlan => ({ send: false, hold: h, words: holdWords(h, input) })
  if (!input.settings.on) return hold('off')
  if (!missedCall(input.line)) return hold('not-missed')
  if (!input.textsOn) return hold('texts-off')
  if (input.ownNumber) return hold('own-number')
  if (input.optedOut) return hold('stopped')
  const say = textRefusal(input.prospect)
  if (say) return hold(say.refused === 'noTexts' ? 'no-texts' : 'not-asked')
  const now = Date.parse(input.nowIso)
  if (input.lastOurTextAt != null && now - input.lastOurTextAt < MISSED_REPLY_HOLD_MS) return hold('recent-text')
  if (input.pausedSince) return hold('paused')
  const line: MissedLine = input.line.channel === 'voicemail' ? 'voicemail' : officeOpen(input.nowIso, input.hours) ? 'in_hours' : 'after_hours'
  const body = line === 'voicemail' ? input.settings.voicemail : line === 'in_hours' ? input.settings.inHours : input.settings.afterHours
  return { send: true, line, body }
}

/** The thread line's who on the text back: "The app texted back · from the company number" (`sentWho` in `send.ts`). */
export const TEXTED_BACK_WHO = 'The app texted back'

/** The New lane row's quiet line under the call: "The app texted back at 4:12 PM. The row still waits on you." */
export function textedBackLine(atIso: string): string {
  return `${TEXTED_BACK_WHO} at ${clockTime(atIso)}. The row still waits on you.`
}
