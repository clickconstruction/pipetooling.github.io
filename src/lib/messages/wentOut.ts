/**
 * Went out (v2.5686, punch list #133 PR 3; the last 7 days under day headers since v2.5699; Quo's delivery answer on
 * each row since v2.5703; the emails we sent beside the texts since v2.5707): the lane on `/messages` that shows every
 * text and email we sent — the sheet's, the reply box's, Today's sends' presses, the morning run's and the estimate
 * and bill emails — newest first, each row opening the thread. The queues above it are all inbound, so without this a
 * send the office just pressed shows nowhere (Taunya, 2026-10-20); today only, it emptied at midnight with the owner
 * looking at it (2026-10-21); a text Quo could not deliver read "texted" like any other until the mark; and the
 * emails lived in threads but not here. An estimate email's row carries what the customer did with it, from the
 * thread's own event lines (v2.5705). Pure; the reads are `wentOutIo.ts`, the section
 * `components/messages/WentOutToday.tsx`.
 */
import type { ContactKind } from '../contacts/kernel'
import { unnamedOnLine } from '../contacts/names'
import { weekdayDate } from '../gc/words'
import { telHrefFor } from '../phoneContact'
import { clockHm } from '../tellCustomer/tellCustomer'
import { calendarYmdInAppTzFromIso, todayYmdInAppTz, ymdAddDays } from '../../utils/dateUtils'
import { inPill, type KindPill } from './kindPills'
import { deliveryMark, type DeliveryMark, type QuoDeliveryWord } from './thread'

/** How far back the lane reads, today included. */
export const WENT_OUT_DAYS = 7

export type WentOutChannel = 'text' | 'email'
/** The lane's own narrowing (v2.5707): both doors, the texts alone, the emails alone. */
export type WentOutFilter = 'both' | 'texts' | 'emails'

/** One outbound line as the io reads it. */
export interface WentOutLine {
  id: string
  contactId: string
  /** Their name; null on a number or an address nobody has named, and on a customer's own thread (the app keeps that contact's name null). */
  name: string | null
  /** The customer the thread belongs to (v2.5696): a customer's own thread reads their customer record's name. */
  customerName?: string | null
  kind: ContactKind | null
  /** A text unless the io says email (v2.5707). */
  channel?: WentOutChannel
  /** An email's subject: the row's words. */
  subject?: string | null
  body: string
  atMs: number
  /** Who pressed it: the person's name, or the morning run's words. */
  who: string
  /** Quo's answer on a text (v2.5703); null before it answers. */
  delivery?: QuoDeliveryWord | null
  /** The number a text went to, for the call a failed text asks for. */
  number?: string | null
  /** What the customer did with the estimate an email carried (v2.5707, from v2.5705's thread lines). */
  estimate?: { number: number; opened: boolean; accepted: boolean } | null
}

/** One row of the lane. */
export interface WentOutRow {
  id: string
  contactId: string
  name: string
  channel: WentOutChannel
  /** The words' first line, or an email's subject, trimmed for the row. */
  words: string
  /** "1:31 PM · Taunya" */
  when: string
  /** Quo's answer beside a text's time (v2.5703); null while it has not answered, and on an email. */
  mark: DeliveryMark | null
  /** The dial for a text that did not reach them; null when it did, or with no number. */
  tel: string | null
  /** An estimate email's "opened", "accepted" or "opened · accepted"; null otherwise. */
  chip: string | null
}

/** One day of the lane, newest day first: its header and its rows. */
export interface WentOutDay {
  ymd: string
  /** "Today", "Yesterday", then the weekday and date: "Mon Oct 19". */
  label: string
  rows: WentOutRow[]
}

const WORDS_MAX = 110

const channelOf = (l: WentOutLine): WentOutChannel => l.channel ?? 'text'

/** The lines under a pill and the lane's own filter, newest first. A number nobody has named shows under All alone, as the queues do. */
function inLane(lines: readonly WentOutLine[], pill: KindPill, filter: WentOutFilter): WentOutLine[] {
  return lines
    .filter((l) => pill === 'all' || (l.kind !== null && inPill(l.kind, pill)))
    .filter((l) => filter === 'both' || (filter === 'texts' ? channelOf(l) === 'text' : channelOf(l) === 'email'))
    .sort((a, b) => b.atMs - a.atMs)
}

function rowOf(l: WentOutLine): WentOutRow {
  const channel = channelOf(l)
  const raw = channel === 'email' ? l.subject?.trim() || l.body.split('\n')[0]?.trim() || '' : (l.body.split('\n')[0]?.trim() ?? '')
  const mark = channel === 'text' ? deliveryMark({ direction: 'out', channel: 'text', delivery: l.delivery ?? null }) : null
  const did = l.estimate ? [l.estimate.opened ? 'opened' : null, l.estimate.accepted ? 'accepted' : null].filter(Boolean) : []
  return {
    id: l.id,
    contactId: l.contactId,
    // A sender nobody has named is named by the way this line went (v2.5994): an address on an email, a number on a text.
    name: l.name?.trim() || l.customerName?.trim() || unnamedOnLine(channel),
    channel,
    words: raw.length > WORDS_MAX ? `${raw.slice(0, WORDS_MAX).trimEnd()}…` : raw,
    when: l.who.trim() ? `${clockHm(l.atMs)} · ${l.who.trim()}` : clockHm(l.atMs),
    mark,
    tel: mark?.bad && l.number?.trim() ? telHrefFor(l.number) : null,
    chip: did.length ? did.join(' · ') : null,
  }
}

/** The rows under a pill, newest first. */
export function wentOutRows(lines: readonly WentOutLine[], pill: KindPill, filter: WentOutFilter = 'both'): WentOutRow[] {
  return inLane(lines, pill, filter).map(rowOf)
}

/** The day a line went, in the company calendar. */
export const wentOutYmd = (atMs: number) => calendarYmdInAppTzFromIso(new Date(atMs).toISOString())

/** The rows grouped under their day, newest day first (v2.5699). */
export function wentOutDays(lines: readonly WentOutLine[], pill: KindPill, now: Date = new Date(), filter: WentOutFilter = 'both'): WentOutDay[] {
  const today = todayYmdInAppTz(now)
  const yesterday = ymdAddDays(today, -1)
  const days: WentOutDay[] = []
  for (const l of inLane(lines, pill, filter)) {
    const ymd = wentOutYmd(l.atMs)
    let day = days[days.length - 1]
    if (!day || day.ymd !== ymd) {
      day = { ymd, label: ymd === today ? 'Today' : ymd === yesterday ? 'Yesterday' : weekdayDate(ymd), rows: [] }
      days.push(day)
    }
    day.rows.push(rowOf(l))
  }
  return days
}

export const WENT_OUT_FILTERS: ReadonlyArray<{ key: WentOutFilter; label: string }> = [
  { key: 'both', label: 'Both' },
  { key: 'texts', label: 'Texts' },
  { key: 'emails', label: 'Emails' },
]

export const WENT_OUT_WORDS = {
  title: (n: number) => `Went out (${n})`,
  note: `Every text and email we sent in the last ${WENT_OUT_DAYS} days, newest first. A row opens the thread.`,
  empty: `Nothing has gone out in the last ${WENT_OUT_DAYS} days.`,
  problem: 'What went out could not be read.',
  call: 'Call them',
  filters: 'Which sends to show',
}
