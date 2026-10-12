/**
 * Messages, cut 1's screens: the Messages list on GC projects, one row per person. Lifted from the Messages prototype
 * (branch spike/gc-mode, `to-dos/gc-mode/messages/prototype.html` v1.178: `renderMessages`'s list, its filters, its
 * search and its order; a row's three lines; the rail of faces). Pure: the screen draws what this returns.
 *
 * A row reads: who and when; their company (or what they are to us) and a trade partner's trade, with whose move it
 * is; the last line's channel and words. Newest conversation first, and nothing else moves a row (v1.147); the people
 * with no line yet follow, by name.
 */
import { isOptedOut, kindWord, normalizeChannel, type Contact, type ContactKind } from '../contacts/kernel'
import { channelWord, chicagoDay, clockTime, courtOf, lastMessage, lineWhen, snippetOf, type Court, type ThreadMessage } from './thread'

export type ListFilter = 'all' | 'customers' | 'trades' | 'unknown'

/** The filter row, in the prototype's order. */
export const LIST_FILTERS: ReadonlyArray<{ key: ListFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'customers', label: 'Customers' },
  { key: 'trades', label: 'Trades' },
  { key: 'unknown', label: 'Who is this?' },
]

/** Whether a kind of person shows under a filter. Trades holds the trade partners and the architects. */
export function inFilter(kind: ContactKind, filter: ListFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'customers') return kind === 'customer'
  if (filter === 'trades') return kind === 'trade' || kind === 'arch'
  return kind === 'unknown'
}

/** The words a search runs over: their name, company and trade, their numbers and addresses, and every line's words. */
export function searchWords(c: Contact, lines: readonly ThreadMessage[]): string {
  const channels = c.channels.flatMap((ch) => [ch.value, normalizeChannel(ch.kind, ch.value)])
  const said = lines.flatMap((m) => [m.subject ?? '', m.body])
  return [c.name, c.goesBy ?? '', c.company, c.trade ?? '', ...channels, ...said].join(' ').toLowerCase()
}

/** The when at a row's top right: the time today, else the day ("Thu, Oct 1"). */
export function listWhen(atIso: string, nowIso: string): string {
  return chicagoDay(atIso) === chicagoDay(nowIso) ? clockTime(atIso) : (lineWhen(atIso, nowIso).split(' · ')[0] ?? '')
}

export interface ListRow {
  contact: Contact
  /** Their newest line either way, a team note included, an event not. Null: no line yet. */
  last: ThreadMessage | null
  /** The time today or the day; '' with no line. */
  when: string
  /** The second line: their company, or what they are to us, then a trade partner's trade. */
  sub: string
  court: Court
  /** The third line: the last line's channel and words. Null with no line. */
  lastLine: { channel: string; words: string } | null
}

/** The list as it reads under a filter and a search, newest conversation first, then the people with no line by name. */
export function listRows(
  contacts: readonly Contact[],
  messages: readonly ThreadMessage[],
  opts: { filter: ListFilter; search: string; nowIso: string },
): ListRow[] {
  const needle = opts.search.trim().toLowerCase()
  const byContact = new Map<string, ThreadMessage[]>()
  for (const m of messages) byContact.set(m.contactId, [...(byContact.get(m.contactId) ?? []), m])
  const rows = contacts
    .filter((c) => inFilter(c.kind, opts.filter))
    .filter((c) => !needle || searchWords(c, byContact.get(c.id) ?? []).includes(needle))
    .map((c): ListRow => {
      const mine = byContact.get(c.id) ?? []
      const last = lastMessage(mine, c.id) ?? null
      const what = c.company || kindWord(c.kind)
      return {
        contact: c,
        last,
        when: last ? listWhen(last.at, opts.nowIso) : '',
        sub: c.trade ? `${what} · ${c.trade}` : what,
        court: courtOf(mine, c.id, opts.nowIso, { optedOut: isOptedOut(c) }),
        lastLine: last ? { channel: channelWord(last), words: snippetOf(last) } : null,
      }
    })
  return rows.sort((a, b) => {
    if (a.last && b.last) return Date.parse(b.last.at) - Date.parse(a.last.at)
    if (a.last || b.last) return a.last ? -1 : 1
    return a.contact.name.localeCompare(b.contact.name)
  })
}
