import { describe, expect, it } from 'vitest'
import type { Contact } from '../contacts/kernel'
import { plainWordsFailures } from '../plainWords'
import type { ThreadMessage } from './thread'
import { searchLines, SEARCH_MAX_HITS, SEARCH_WORDS } from './searchLines'

const NOW = '2026-10-21T05:10:00Z'
const contact = (set: Partial<Contact>): Contact => ({ id: 'c1', kind: 'customer', name: 'Dana Whitfield', goesBy: null, company: '', channels: [], jobs: [], record: null, ...set }) as unknown as Contact
const CONTACTS = [contact({}), contact({ id: 'c2', kind: 'trade', name: 'Greg Paulk', company: 'Hillside Excavation' }), contact({ id: 'c3', kind: 'unknown', name: '', company: '' })]
const line = (set: Partial<ThreadMessage>): ThreadMessage => ({ id: 'm1', contactId: 'c1', jobId: null, channel: 'text', direction: 'in', at: '2026-10-20T21:12:00Z', who: 'Dana', body: 'Thanks, the water heater estimate looks good, I will sign tonight.', ...set }) as ThreadMessage
const LINES: ThreadMessage[] = [
  line({}),
  line({ id: 'm2', contactId: 'c2', direction: 'in', at: '2026-10-13T15:00:00Z', body: 'Is the detention pond in sitework, or is that ours?' }),
  line({ id: 'm3', contactId: 'c1', direction: 'out', channel: 'email', subject: 'Estimate #212 — Water heater — $4,860', body: 'Please review and accept.', at: '2026-10-20T18:31:00Z' }),
  line({ id: 'm4', contactId: 'c3', direction: 'in', at: '2026-09-02T12:00:00Z', body: 'Is this the plumbing office? My water heater is leaking.' }),
  line({ id: 'm5', contactId: 'c1', channel: 'event', direction: 'team', at: '2026-10-20T18:32:00Z', body: 'The app sent the water heater reminder.' }),
]

describe('searchLines (v2.5701, punch list #139)', () => {
  it('finds the lines whose words hold the needle, newest first, with the match apart from the words around it', () => {
    const { hits, total } = searchLines(LINES, CONTACTS, 'Water Heater', 'all', NOW)
    expect(total).toBe(3)
    expect(hits.map((h) => h.id)).toEqual(['m1', 'm3', 'm4'])
    expect(hits[0]).toMatchObject({ contactId: 'c1', name: 'Dana Whitfield', kind: 'customer', who: 'Them · Text', before: 'Thanks, the ', match: 'water heater', after: ' estimate looks good, I will sign tonight.', when: 'Tue, Oct 20' })
    expect(hits[1]).toMatchObject({ who: 'Us · Email', before: 'Estimate #212 — ', match: 'Water heater' })
    expect(hits[2]?.name).toBe('A number nobody has named')
  })
  it('an email’s subject counts, the app’s event lines never do, and the pill narrows by kind', () => {
    expect(searchLines(LINES, CONTACTS, 'reminder', 'all', NOW).total).toBe(0)
    expect(searchLines(LINES, CONTACTS, 'detention', 'all', NOW).hits.map((h) => h.id)).toEqual(['m2'])
    expect(searchLines(LINES, CONTACTS, 'detention', 'customer', NOW).total).toBe(0)
    expect(searchLines(LINES, CONTACTS, 'water', 'trade', NOW).total).toBe(0)
  })
  it('asks for two letters, and caps the rows while counting every match', () => {
    expect(searchLines(LINES, CONTACTS, 'w', 'all', NOW)).toEqual({ hits: [], total: 0 })
    const many = Array.from({ length: SEARCH_MAX_HITS + 5 }, (_, i) => line({ id: `x${i}`, body: `line ${i} about the water heater`, at: new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString() }))
    const r = searchLines(many, CONTACTS, 'heater', 'all', NOW)
    expect(r.total).toBe(SEARCH_MAX_HITS + 5)
    expect(r.hits).toHaveLength(SEARCH_MAX_HITS)
    expect(r.hits[0]?.id).toBe(`x${SEARCH_MAX_HITS + 4}`)
  })
  it('the words are plain (a count in parentheses is the page’s own shape)', () => {
    expect(SEARCH_WORDS.title(3)).toBe('Lines that match (3)')
    for (const words of [SEARCH_WORDS.label, SEARCH_WORDS.placeholder, SEARCH_WORDS.note, SEARCH_WORDS.none, SEARCH_WORDS.reading, SEARCH_WORDS.short, SEARCH_WORDS.more(12)]) {
      expect(plainWordsFailures(words), words).toEqual([])
    }
  })
})
