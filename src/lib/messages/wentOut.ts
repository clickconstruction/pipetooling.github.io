/**
 * Went out today (v2.5686, punch list #133 PR 3): the lane on `/messages` that shows every text we sent today —
 * the sheet's, the reply box's, Today's sends' presses and the morning run's — newest first, each row opening the
 * thread. The queues above it are all inbound, so without this a send the office just pressed shows nowhere
 * (Taunya, 2026-10-20). Pure; the reads are `wentOutIo.ts`, the section `components/messages/WentOutToday.tsx`.
 */
import type { ContactKind } from '../contacts/kernel'
import { clockHm } from '../tellCustomer/tellCustomer'
import { inPill, type KindPill } from './kindPills'

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
}

const WORDS_MAX = 110

/** The rows under a pill, newest first. A number nobody has named shows under All alone, as the queues do. */
export function wentOutRows(lines: readonly WentOutLine[], pill: KindPill): WentOutRow[] {
  return lines
    .filter((l) => pill === 'all' || (l.kind !== null && inPill(l.kind, pill)))
    .sort((a, b) => b.atMs - a.atMs)
    .map((l) => {
      const firstLine = l.body.split('\n')[0]?.trim() ?? ''
      return {
        id: l.id,
        contactId: l.contactId,
        name: l.name?.trim() || l.customerName?.trim() || 'A number nobody has named',
        words: firstLine.length > WORDS_MAX ? `${firstLine.slice(0, WORDS_MAX).trimEnd()}…` : firstLine,
        when: l.who.trim() ? `${clockHm(l.atMs)} · ${l.who.trim()}` : clockHm(l.atMs),
      }
    })
}

export const WENT_OUT_WORDS = {
  title: (n: number) => `Went out today (${n})`,
  note: 'Every text we sent today, newest first. A row opens the thread.',
  empty: 'Nothing has gone out today.',
  problem: 'What went out could not be read.',
}
