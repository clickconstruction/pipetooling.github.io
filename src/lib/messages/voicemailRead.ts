/**
 * Messages, residential R8 · 4: a voicemail read. Quo's transcript becomes the line's words, and the day a person said
 * in it is lifted out as a chip the office keeps or changes. The after state is card 4 of
 * `to-dos/gc-mode/messages/customer-messages-integrations-mockups.html` (branch spike/gc-mode, v0.2); the plan is
 * `RESIDENTIAL_BUILD_PLAN.md` → R8.
 *
 * Nothing here reads a day by a rule of its own: `readDay` (`owed.ts`, cut 2) reads every run of words, and the first
 * day said wins. It reads from the voicemail's own day, so "tomorrow" on a Tuesday voicemail is Wednesday whenever the
 * office plays it. Keep the day writes what cut 2 writes for any day heard, an offered `message_promises` row, with the
 * day in `dayKept`'s shape. The office then says what the day is a promise of on Follow up (`promises.ts`). A voicemail
 * from them is their move as a text is (`stateMoveOf`, cut 2). Pure: the transcript and the summary arrive on the line
 * (`quo/events.ts`, cut 5), and the reader's insert is the caller's.
 */
import { stateMoveOf } from '../followUp/queue'
import type { QuoLine } from '../quo/events'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { dayKept, dayLabel, readDay, type DayKept } from './owed'
import { callLength, type ThreadMessage } from './thread'

/** A voicemail as this file reads it: the thread's line, with cut 5's transcript and summary when Quo has sent them. */
export type VoicemailMessage = Pick<ThreadMessage, 'id' | 'contactId' | 'channel' | 'direction' | 'at' | 'durationSeconds'> &
  Partial<Pick<QuoLine, 'transcript' | 'summary'>>

// ---------- the line ----------

/** A voicemail's line: its words, the hover, its length, and the meta line under it. */
export interface VoicemailLine {
  /** The transcript in quotes, or "Voicemail · 0:41" while Quo has none. */
  words: string
  /** Quo's summary, on the hover. Null when it has sent none. */
  hover: string | null
  /** "0:41"; null when Quo gave no length. */
  length: string | null
  /** "0:41 · Quo’s transcript", or what to do while there is none. */
  meta: string
  /** Quo has sent the transcript. */
  transcribed: boolean
}

/** The words a voicemail with no transcript says it is: "Voicemail · 0:41", or "Voicemail" with no length. */
export const VOICEMAIL_WORD = 'Voicemail'

/** The meta line while Quo has not sent the transcript. */
export const NO_TRANSCRIPT_YET = 'No transcript yet. Hear it in Quo.'

function transcriptOf(m: Pick<VoicemailMessage, 'transcript'>): string | null {
  const t = (m.transcript ?? '').trim()
  return t || null
}

/** A voicemail's line: Quo's transcript as the words when it has one, the summary on the hover, the length beside it. */
export function voicemailLine(m: VoicemailMessage): VoicemailLine {
  const transcript = transcriptOf(m)
  const length = m.durationSeconds != null && m.durationSeconds >= 0 ? callLength(m.durationSeconds) : null
  const summary = (m.summary ?? '').trim() || null
  if (!transcript) {
    return { words: length ? `${VOICEMAIL_WORD} · ${length}` : VOICEMAIL_WORD, hover: summary, length, meta: NO_TRANSCRIPT_YET, transcribed: false }
  }
  const quoted = /^["“]/.test(transcript) ? transcript : `“${transcript}”`
  return { words: quoted, hover: summary, length, meta: [length, 'Quo’s transcript'].filter(Boolean).join(' · '), transcribed: true }
}

// ---------- the day heard ----------

/** The chip's two presses. */
export const KEEP_THE_DAY = 'Keep the day'
export const ANOTHER_DAY = 'Another day'

/**
 * What Keep the day writes: cut 2's offered `message_promises` row for the line, its kind still unsaid. The day is a
 * date or the words, never both (`message_promises_promise`), so a time heard stays on the chip. Another day writes
 * the same row with the day the office picks (`dayChips`, then `dayKept`).
 */
export interface HeardDayWrite {
  message_id: string
  state: 'offered'
  kind: null
  day: string | null
  day_words: string | null
}

/** The offered row for a line and a day kept. */
export function heardDayWrite(messageId: string, day: DayKept): HeardDayWrite {
  return { message_id: messageId, state: 'offered', kind: null, day: day.ymd, day_words: day.ymd ? null : day.words }
}

/** A day heard in a voicemail, as the chip under its line shows it. */
export interface HeardDayChip {
  /** The day, YYYY-MM-DD. */
  day: string
  /** The chip: "Thu Oct 8, after 2 PM". */
  words: string
  /** The words it was read from, as Quo wrote them: "Thursday". */
  said: string
  /** A time heard in the same sentence: "after 2 PM". Null when none was said. */
  time: string | null
  /** The day has gone by at `now`. */
  past: boolean
  presses: readonly [typeof KEEP_THE_DAY, typeof ANOTHER_DAY]
  /** What Keep the day writes. */
  keep: HeardDayWrite
}

/** The longest run of words tried as one day: "the Monday after next", "Fri Oct 16 2026". */
const MAX_DAY_WORDS = 5

/** A weekday cut to three letters, alone, is a word before it is a day: "I sat", "Wed" in a name. */
const BARE_SHORT_WEEKDAY = /^(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)$/

/** A word as `readDay` takes it: the marks around it gone, a date's slashes kept. */
function bare(word: string): string {
  return word.replace(/^[^\p{L}\p{N}/]+|[^\p{L}\p{N}/]+$/gu, '')
}

/** The sentences of a transcript, split after `.`, `?` or `!`. */
function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

interface DayFound {
  ymd: string
  label: string
  said: string
  sentence: string
}

/**
 * The first day said: every run of one to five words through `readDay`, from the voicemail's day, earliest first and
 * the longest run at a place first. Its own day ("calling today") stands only when no other day is said.
 */
function firstDay(text: string, fromYmd: string): DayFound | null {
  let sameDay: DayFound | null = null
  for (const sentence of sentencesOf(text)) {
    const words = sentence.split(/\s+/).filter(Boolean)
    const plain = words.map(bare)
    for (let i = 0; i < words.length; i++) {
      for (let n = Math.min(MAX_DAY_WORDS, words.length - i); n >= 1; n--) {
        const run = plain.slice(i, i + n)
        if (run.some((w) => !w)) continue
        if (n === 1 && BARE_SHORT_WEEKDAY.test(run[0]!.toLowerCase())) continue
        const read = readDay(run.join(' '), fromYmd)
        if (!read?.known || !read.ymd) continue
        const found = { ymd: read.ymd, label: read.label, said: words.slice(i, i + n).map(bare).join(' '), sentence }
        if (read.ymd !== fromYmd) return found
        sameDay ??= found
        break
      }
    }
  }
  return sameDay
}

const HOUR_WORDS: Readonly<Record<string, number>> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
}

/** Words after an hour that make it a count, not a time: "at one point", "by two weeks". */
const NOT_A_TIME_AFTER = new Set(['point', 'of', 'least', 'all', 'times', 'weeks', 'week', 'days', 'day', 'hours', 'hour', 'minutes', 'more', 'or', 'people', 'things', 'guys'])

/**
 * A time said after `after`, `before`, `by`, `around`, `about` or `at`: "after two" is "after 2 PM". An hour with no
 * AM or PM is read as a working day's: one to six is PM, seven to eleven is AM, twelve is noon.
 */
export function heardTime(sentence: string): string | null {
  const re = /\b(after|before|by|around|about|at)\s+(noon|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d{1,2})(?::(\d{2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?|o['’]?clock)?(?![\p{L}\p{N}])/giu
  for (const hit of sentence.matchAll(re)) {
    const rest = sentence.slice((hit.index ?? 0) + hit[0].length)
    const next = bare(rest.trim().split(/\s+/)[0] ?? '').toLowerCase()
    if (next && NOT_A_TIME_AFTER.has(next)) continue
    const prep = hit[1]!.toLowerCase()
    const said = hit[2]!.toLowerCase()
    if (said === 'noon') return `${prep} noon`
    let hour = HOUR_WORDS[said] ?? Number(said)
    const minutes = hit[3] ? Number(hit[3]) : 0
    if (!Number.isInteger(hour) || hour < 1 || hour > 23 || minutes > 59) continue
    const mark = (hit[4] ?? '').toLowerCase().replace(/[^ap]/g, '')
    let pm: boolean
    if (hour > 12) {
      hour -= 12
      pm = true
    } else if (mark === 'a' || mark === 'p') pm = mark === 'p'
    else pm = hour <= 6 || hour === 12
    if (hour === 12 && !minutes && !mark) return `${prep} noon`
    return `${prep} ${hour}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''} ${pm ? 'PM' : 'AM'}`
  }
  return null
}

/**
 * The day heard in a voicemail from them, as a chip with its two presses, or null: no transcript yet, or no day said.
 * The day reads from the voicemail's own day; `now` only says whether that day has gone by.
 */
export function heardDay(m: VoicemailMessage, now: Date): HeardDayChip | null {
  if (m.channel !== 'voicemail' || m.direction !== 'in') return null
  const transcript = transcriptOf(m)
  const fromYmd = calendarYmdInAppTzFromIso(m.at)
  if (!transcript || !fromYmd) return null
  const found = firstDay(transcript, fromYmd)
  if (!found) return null
  const time = heardTime(found.sentence)
  const todayYmd = calendarYmdInAppTzFromIso(now.toISOString())
  return {
    day: found.ymd,
    words: time ? `${dayLabel(found.ymd)}, ${time}` : dayLabel(found.ymd),
    said: found.said,
    time,
    past: Boolean(todayYmd) && found.ymd < todayYmd,
    presses: [KEEP_THE_DAY, ANOTHER_DAY],
    keep: heardDayWrite(m.id, dayKept({ label: found.label, ymd: found.ymd, known: true })),
  }
}

// ---------- Follow up ----------

/** A voicemail from them is their move on Follow up, as a text is: it opens the conversation (`stateMoveOf`). */
export function voicemailNeedsReply(m: Pick<VoicemailMessage, 'channel' | 'direction'>): boolean {
  return m.channel === 'voicemail' && stateMoveOf(m) === 'inbound'
}
