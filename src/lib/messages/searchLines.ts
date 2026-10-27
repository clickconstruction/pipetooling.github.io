/**
 * Search every message (v2.5701, punch list #139 PR 10; the owner, 2026-10-21, on the mock-up's "a step further": the
 * search at the top of `/messages` lands on the line itself, not just the person). Over the page's view — every
 * contact and message there is, read on the first words typed — the lines whose words hold the needle, newest first,
 * each a row that opens the thread at that line. An email's subject counts with its body; the app's event lines never
 * match. Pure; the page draws it.
 */
import type { Contact, ContactKind } from '../contacts/kernel'
import { unnamedOnLine } from '../contacts/names'
import { inPill, type KindPill } from './kindPills'
import { listWhen } from './listRows'
import { channelWord, type ThreadMessage } from './thread'

/** Fewer letters than this match too much to be worth a read. */
export const SEARCH_MIN = 2
export const SEARCH_MAX_HITS = 50
const AROUND = 70

export interface LineHit {
  id: string
  contactId: string
  /** Who the thread is with. */
  name: string
  kind: ContactKind
  /** Whose line and its channel: "Them · text", "Us · email". */
  who: string
  /** The words around the first match, the match itself apart so the row can mark it. */
  before: string
  match: string
  after: string
  /** The time today, else the day, as the people list says it. */
  when: string
}

export interface LineSearch {
  hits: LineHit[]
  /** Every match, the ones past `SEARCH_MAX_HITS` included. */
  total: number
}

const NONE: LineSearch = { hits: [], total: 0 }

export function searchLines(messages: readonly ThreadMessage[], contacts: readonly Contact[], needle: string, pill: KindPill, nowIso: string): LineSearch {
  const q = needle.trim().toLowerCase()
  if (q.length < SEARCH_MIN) return NONE
  const byId = new Map(contacts.map((c) => [c.id, c]))
  const found: Array<{ m: ThreadMessage; c: Contact; flat: string; at: number }> = []
  for (const m of messages) {
    if (m.channel === 'event') continue
    const c = byId.get(m.contactId)
    if (!c || !(pill === 'all' || inPill(c.kind, pill))) continue
    const flat = (m.channel === 'email' && m.subject ? `${m.subject} — ${m.body}` : m.body).replace(/\s+/g, ' ').trim()
    if (!flat.toLowerCase().includes(q)) continue
    found.push({ m, c, flat, at: Date.parse(m.at) })
  }
  found.sort((a, b) => b.at - a.at)
  const hits = found.slice(0, SEARCH_MAX_HITS).map(({ m, c, flat }): LineHit => {
    const i = flat.toLowerCase().indexOf(q)
    const start = Math.max(0, i - AROUND)
    const end = Math.min(flat.length, i + q.length + AROUND)
    return {
      id: m.id,
      contactId: c.id,
      name: c.name.trim() || c.company.trim() || unnamedOnLine(m.channel),
      kind: c.kind,
      who: `${m.direction === 'out' ? 'Us' : m.direction === 'team' ? 'Team' : 'Them'} · ${channelWord(m)}`,
      before: (start > 0 ? '…' : '') + flat.slice(start, i),
      match: flat.slice(i, i + q.length),
      after: flat.slice(i + q.length, end) + (end < flat.length ? '…' : ''),
      when: listWhen(m.at, nowIso),
    }
  })
  return { hits, total: found.length }
}

/** The search lives in the URL as `?q=` (v2.5708), like the pill: a reload keeps it and a link carries it. */
export const QUERY_PARAM = 'q'

export function queryOf(search: URLSearchParams): string {
  return search.get(QUERY_PARAM) ?? ''
}

/** The search with the words set, every other param kept. Empty words take the param away. */
export function withQuery(search: URLSearchParams, q: string): URLSearchParams {
  const next = new URLSearchParams(search)
  if (q.trim()) next.set(QUERY_PARAM, q)
  else next.delete(QUERY_PARAM)
  return next
}

export const SEARCH_WORDS = {
  label: 'Search every message',
  placeholder: 'Search any words in every message',
  title: (n: number) => `Lines that match (${n})`,
  note: 'Newest first. A row opens the thread at that line.',
  none: 'No message has those words.',
  reading: 'Reading the messages…',
  short: 'Type two letters or more.',
  more: (n: number) => `${n} more match. Add a word to narrow it.`,
}
