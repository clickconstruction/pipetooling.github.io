/**
 * Messages, cut 1 (the spine): the stamps. Their last word and ours, as the thread header's Them · Us block with its
 * (+6) mark, as a sentence for the folded header, and as the hover card's calendar of the weeks they wrote and we wrote.
 * Lifted from the Messages prototype (branch spike/gc-mode, `to-dos/gc-mode/messages/prototype.html` v1.178:
 * `stampShort`, `agoDays`, `stampFull`, `stampSentence`, `verbOf`, `stampCalendar`). The sentence is two sentences where
 * the prototype joined them with a semicolon, which the plain-words rule refuses.
 */
import { ymdAddDays, companyWeekStartSundayContaining } from '../../utils/dateUtils'
import { firstName, type ContactKind } from '../contacts/kernel'
import {
  channelWord,
  chicagoDay,
  clockTime,
  daysAgo,
  lastIn,
  lastOut,
  lineWhen,
  whenWords,
  type ThreadMessage,
} from './thread'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

const monthDay = (ymd: string) => {
  const [, m, d] = ymd.split('-').map(Number) as [number, number, number]
  return `${MONTHS[m - 1] ?? ''} ${d}`
}

/** The small mark after an older stamp, how many days ago: "(+6)". '' for today. */
export function agoMark(atIso: string, nowIso: string): string {
  const n = daysAgo(atIso, nowIso)
  return n <= 0 ? '' : `(+${n})`
}

/** A stamp's short when: today keeps its time ("today · 8:44 AM"), an older one is its date ("Sep 30"). */
export function stampShort(atIso: string, nowIso: string): string {
  const ymd = chicagoDay(atIso)
  if (ymd === chicagoDay(nowIso)) return `today · ${clockTime(atIso)}`
  return `${monthDay(ymd)}${ymd.slice(0, 4) === chicagoDay(nowIso).slice(0, 4) ? '' : `, ${ymd.slice(0, 4)}`}`
}

/** A stamp in full, for the hover card: "call · Sat, Sep 26 · 12:00 AM · 6 days ago". */
export function stampFull(m: Pick<ThreadMessage, 'channel' | 'at'>, nowIso: string): string {
  const n = daysAgo(m.at, nowIso)
  const ago = n <= 0 ? '' : n === 1 ? ' · yesterday' : ` · ${n} days ago`
  return `${channelWord(m).toLowerCase()} · ${lineWhen(m.at, nowIso)}${ago}`
}

export interface StampSide {
  message: ThreadMessage
  /** "text · Sep 30", "voicemail · today · 8:41 AM". */
  words: string
  /** "(+2)", or '' for today. */
  mark: string
  /** The hover card's line. */
  full: string
}

/** The header's Them · Us block: their last word and ours. Null on a side that has not written yet. */
export function stampPair(
  messages: readonly ThreadMessage[],
  contactId: string,
  nowIso: string,
): { them: StampSide | null; us: StampSide | null } {
  const side = (m: ThreadMessage | undefined): StampSide | null =>
    m
      ? {
          message: m,
          words: `${channelWord(m).toLowerCase()} · ${stampShort(m.at, nowIso)}`,
          mark: agoMark(m.at, nowIso),
          full: stampFull(m, nowIso),
        }
      : null
  return { them: side(lastIn(messages, contactId)), us: side(lastOut(messages, contactId)) }
}

const VERB: Partial<Record<ThreadMessage['channel'], string>> = {
  text: 'texted',
  email: 'emailed',
  call: 'called',
  voicemail: 'left a voicemail',
  missed: 'called',
}

/** "texted": the channel as the sentence's verb. */
export function verbOf(m: Pick<ThreadMessage, 'channel'>): string {
  return VERB[m.channel] ?? 'wrote'
}

/** A piece of a stamp sentence. The when is strong, so the screen sets it in bold. */
export interface StampPart {
  text: string
  strong?: true
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * The folded header's stamps as two sentences, the newer side first, the channel as the verb and the when in words:
 * "Dr. Raman texted last Saturday. We emailed two weeks ago." The person is named, never a guessed pronoun; a number
 * nobody has named reads "they".
 */
export function stampSentence(
  contact: { name: string; goesBy?: string | null; kind: ContactKind },
  messages: readonly ThreadMessage[],
  contactId: string,
  nowIso: string,
): { sentences: StampPart[][]; text: string } {
  const unknown = contact.kind === 'unknown'
  const who = unknown ? 'they' : firstName(contact)
  const i = lastIn(messages, contactId)
  const o = lastOut(messages, contactId)
  const said = (subject: string, m: ThreadMessage): StampPart[] => [
    { text: `${capital(subject)} ${verbOf(m)} ` },
    { text: whenWords(m.at, nowIso), strong: true },
    { text: m.channel === 'missed' ? ', no voicemail.' : '.' },
  ]
  const them: StampPart[] = i ? said(who, i) : [{ text: `${capital(who)} ${unknown ? 'have' : 'has'} not written yet.` }]
  const us: StampPart[] = o ? said('we', o) : [{ text: 'We have not written yet.' }]
  const themFirst = !o || Boolean(i && Date.parse(i.at) > Date.parse(o.at))
  const sentences = themFirst ? [them, us] : [us, them]
  return { sentences, text: sentences.map((s) => s.map((p) => p.text).join('')).join(' ') }
}

// ---------- the calendar on the stamps' hover card ----------

export interface CalendarDay {
  ymd: string
  /** Who wrote that day: us, them, both, or nobody. */
  tone: 'us' | 'them' | 'both' | null
  /** A team note was written that day. */
  note: boolean
  today: boolean
  future: boolean
  /** Their lines and ours that day. The card prints it when it is over one. */
  count: number
}

export interface CalendarWeek {
  /** "Sep 27 – Oct 3 · this week", "Sep 20 – 26". */
  label: string
  thisWeek: boolean
  /** Sunday to Saturday. */
  days: CalendarDay[]
}

/**
 * The weeks of the thread, Sunday to Saturday, from their first line or six weeks back, whichever is later, to the end
 * of this week. Null when there is nothing to draw.
 */
export function stampCalendar(messages: readonly ThreadMessage[], contactId: string, nowIso: string): CalendarWeek[] | null {
  const mine = messages.filter((m) => m.contactId === contactId && m.channel !== 'event')
  if (mine.length === 0) return null
  const byDay = new Map<string, { inN: number; outN: number; note: number }>()
  for (const m of mine) {
    const ymd = chicagoDay(m.at)
    const d = byDay.get(ymd) ?? { inN: 0, outN: 0, note: 0 }
    if (m.direction === 'in') d.inN++
    else if (m.direction === 'out') d.outN++
    else d.note++
    byDay.set(ymd, d)
  }
  const today = chicagoDay(nowIso)
  const first = [...byDay.keys()].sort()[0]!
  const sixWeeksBack = ymdAddDays(today, -41)
  const start = companyWeekStartSundayContaining(first > sixWeeksBack ? first : sixWeeksBack) ?? today
  const end = ymdAddDays(companyWeekStartSundayContaining(today) ?? today, 6)
  const weeks: CalendarWeek[] = []
  for (let w = start; w <= end; w = ymdAddDays(w, 7)) {
    const last = ymdAddDays(w, 6)
    const thisWeek = today >= w && today <= last
    const lastWords = last.slice(5, 7) === w.slice(5, 7) ? String(Number(last.slice(8))) : monthDay(last)
    const days: CalendarDay[] = []
    for (let i = 0; i < 7; i++) {
      const ymd = ymdAddDays(w, i)
      const v = byDay.get(ymd)
      days.push({
        ymd,
        tone: v ? (v.inN && v.outN ? 'both' : v.inN ? 'them' : v.outN ? 'us' : null) : null,
        note: Boolean(v?.note),
        today: ymd === today,
        future: ymd > today,
        count: v ? v.inN + v.outN : 0,
      })
    }
    weeks.push({ label: `${monthDay(w)} – ${lastWords}${thisWeek ? ' · this week' : ''}`, thisWeek, days })
  }
  return weeks
}
