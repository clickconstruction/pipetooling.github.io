/**
 * Waiting on them (v2.5704, punch list #139 PR 12, the second of the six additions): the lane on `/messages` for the
 * people who went quiet after our send — every thread where our line is the last word, `WAIT_DAYS` or more ago,
 * longest quiet first. Needs a reply is who waits on us; the thread's header already says *Their move · 10 h* per
 * person; nothing listed them. Each row offers the nudge (the thread, where the office writes it) and the call. Pure;
 * the read is `waitingOnThemIo.ts`, the section `components/messages/WaitingOnThem.tsx`.
 */
import type { ContactKind } from '../contacts/kernel'
import { telHrefFor } from '../phoneContact'
import { clockDay } from '../tellCustomer/tellCustomer'
import { inPill, type KindPill } from './kindPills'

/** How long our last word stands unanswered before the person is waiting on us to notice. */
export const WAIT_DAYS = 2
const DAY_MS = 86_400_000

/** One line either way, as the io reads it: a text, an email or a call, theirs or ours. */
export interface WaitLine {
  id: string
  contactId: string
  name: string | null
  customerName?: string | null
  kind: ContactKind | null
  direction: 'in' | 'out'
  body: string
  atMs: number
  /** The number our line went to, for the call. */
  number?: string | null
}

export interface WaitingRow {
  contactId: string
  name: string
  /** Whole days since our last word. */
  days: number
  /** "Their move · 6 d" */
  chip: string
  /** Our last line's first words. */
  words: string
  /** The day our last word went: "Mon, Oct 19". */
  when: string
  tel: string | null
  atMs: number
}

const WORDS_MAX = 110

/** The rows under a pill, longest quiet first: each person whose newest line is ours and `WAIT_DAYS` old or more. */
export function waitingOnThem(lines: readonly WaitLine[], pill: KindPill, now: Date = new Date()): WaitingRow[] {
  const newest = new Map<string, WaitLine>()
  for (const l of lines) {
    const have = newest.get(l.contactId)
    if (!have || l.atMs > have.atMs) newest.set(l.contactId, l)
  }
  const cutoff = now.getTime() - WAIT_DAYS * DAY_MS
  const rows: WaitingRow[] = []
  for (const l of newest.values()) {
    if (l.direction !== 'out' || l.atMs > cutoff) continue
    if (!(pill === 'all' || (l.kind !== null && inPill(l.kind, pill)))) continue
    const days = Math.floor((now.getTime() - l.atMs) / DAY_MS)
    const firstLine = l.body.split('\n')[0]?.trim() ?? ''
    rows.push({
      contactId: l.contactId,
      name: l.name?.trim() || l.customerName?.trim() || 'A number nobody has named',
      days,
      chip: `Their move · ${days} d`,
      words: firstLine.length > WORDS_MAX ? `${firstLine.slice(0, WORDS_MAX).trimEnd()}…` : firstLine,
      when: clockDay(l.atMs),
      tel: l.number?.trim() ? telHrefFor(l.number) : null,
      atMs: l.atMs,
    })
  }
  return rows.sort((a, b) => a.atMs - b.atMs)
}

export const WAITING_WORDS = {
  title: (n: number) => `Waiting on them (${n})`,
  note: `Our line is the last word, ${WAIT_DAYS} days or more. Longest quiet first. A reply from them clears the row.`,
  empty: 'Nobody has gone quiet on us.',
  problem: 'Who went quiet could not be read.',
  nudge: 'Nudge',
  nudgeTip: 'Opens the thread so you can write the nudge.',
  call: 'Call',
}
