/**
 * Went out (v2.5686, punch list #133 PR 3; the last 7 days under day headers since v2.5699; Quo's delivery answer on
 * each row since v2.5703): the lane on `/messages` that shows every text we sent — the sheet's, the reply box's,
 * Today's sends' presses and the morning run's — newest first, each row opening the thread. The queues above it are
 * all inbound, so without this a send the office just pressed shows nowhere (Taunya, 2026-10-20); today only, it
 * emptied at midnight with the owner looking at it (2026-10-21); and a text Quo could not deliver read "texted" like
 * any other until the mark. Pure; the reads are `wentOutIo.ts`, the section `components/messages/WentOutToday.tsx`.
 */
import type { ContactKind } from '../contacts/kernel'
import { weekdayDate } from '../gc/words'
import { telHrefFor } from '../phoneContact'
import { clockHm } from '../tellCustomer/tellCustomer'
import { calendarYmdInAppTzFromIso, todayYmdInAppTz, ymdAddDays } from '../../utils/dateUtils'
import { inPill, type KindPill } from './kindPills'
import { deliveryMark, type DeliveryMark, type QuoDeliveryWord } from './thread'

/** How far back the lane reads, today included. */
export const WENT_OUT_DAYS = 7

/** One outbound text as the io reads it. */
export interface WentOutLine {
  id: string
  contactId: string
  /** Their name; null on a number nobody has named, and on a customer's own thread (the app keeps that contact's name null). */
  name: string | null
  /** The customer the thread belongs to (v2.5696): a customer's own thread reads their customer record's name. */
  customerName?: string | null
  kind: ContactKind | null
  body: string
  atMs: number
  /** Who pressed it: the person's name, or the morning run's words. */
  who: string
  /** Quo's answer (v2.5703); null before it answers. */
  delivery?: QuoDeliveryWord | null
  /** The number it went to, for the call a failed text asks for. */
  number?: string | null
}

/** One row of the lane. */
export interface WentOutRow {
  id: string
  contactId: string
  name: string
  /** The words' first line, trimmed for the row. */
  words: string
  /** "1:31 PM · Taunya" */
  when: string
  /** Quo's answer beside the time (v2.5703); null while it has not answered. */
  mark: DeliveryMark | null
  /** The dial for a text that did not reach them; null when it did, or with no number. */
  tel: string | null
}

/** One day of the lane, newest day first: its header and its rows. */
export interface WentOutDay {
  ymd: string
  /** "Today", "Yesterday", then the weekday and date: "Mon Oct 19". */
  label: string
  rows: WentOutRow[]
}

/** One day of the lane, newest day first: its header and its rows. */
export interface WentOutDay {
  ymd: string
  /** "Today", "Yesterday", then the weekday and date: "Mon Oct 19". */
  label: string
  rows: WentOutRow[]
}

const WORDS_MAX = 110

/** The lines under a pill, newest first. A number nobody has named shows under All alone, as the queues do. */
function inLane(lines: readonly WentOutLine[], pill: KindPill): WentOutLine[] {
  return lines.filter((l) => pill === 'all' || (l.kind !== null && inPill(l.kind, pill))).sort((a, b) => b.atMs - a.atMs)
}

function rowOf(l: WentOutLine): WentOutRow {
  const firstLine = l.body.split('\n')[0]?.trim() ?? ''
  const mark = deliveryMark({ direction: 'out', channel: 'text', delivery: l.delivery ?? null })
  return {
    id: l.id,
    contactId: l.contactId,
    name: l.name?.trim() || l.customerName?.trim() || 'A number nobody has named',
    words: firstLine.length > WORDS_MAX ? `${firstLine.slice(0, WORDS_MAX).trimEnd()}…` : firstLine,
    when: l.who.trim() ? `${clockHm(l.atMs)} · ${l.who.trim()}` : clockHm(l.atMs),
    mark,
    tel: mark?.bad && l.number?.trim() ? telHrefFor(l.number) : null,
  }
}

/** The rows under a pill, newest first. */
export function wentOutRows(lines: readonly WentOutLine[], pill: KindPill): WentOutRow[] {
  return inLane(lines, pill).map(rowOf)
}

/** The day a line went, in the company calendar. */
export const wentOutYmd = (atMs: number) => calendarYmdInAppTzFromIso(new Date(atMs).toISOString())

/** The rows grouped under their day, newest day first (v2.5699). */
export function wentOutDays(lines: readonly WentOutLine[], pill: KindPill, now: Date = new Date()): WentOutDay[] {
  const today = todayYmdInAppTz(now)
  const yesterday = ymdAddDays(today, -1)
  const days: WentOutDay[] = []
  for (const l of inLane(lines, pill)) {
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

export const WENT_OUT_WORDS = {
  title: (n: number) => `Went out (${n})`,
  note: `Every text we sent in the last ${WENT_OUT_DAYS} days, newest first. A row opens the thread.`,
  empty: `Nothing has gone out in the last ${WENT_OUT_DAYS} days.`,
  problem: 'What went out could not be read.',
  call: 'Call them',
}
