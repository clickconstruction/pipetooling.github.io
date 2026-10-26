import { describe, expect, it } from 'vitest'
import { askCounts, askRows, askWords, asksMarkNote, asksNextLine, asksSince, truckName, type AskDueRow } from './vehicleAsks'

const NOW = '2026-10-26T15:00:00.000Z'
const DAY = 86_400_000
const ago = (days: number) => new Date(Date.parse(NOW) - days * DAY).toISOString()

function row(id: string, model: string, holderUserId: string | null, holderName: string | null, daysStale: number | null, motorPool = false): AskDueRow {
  return { vehicle: { id, year: 2022, make: 'Ford', model }, holderUserId, holderName, motorPool, daysStale, lastReadIso: daysStale == null ? null : ago(daysStale), dueDays: motorPool ? 30 : 7 }
}

const ROWS = [
  row('v1', 'Transit', 'u1', 'Sam Pruitt', 19),
  row('v2', 'F-250', 'u2', 'Jorge Ruiz', 19),
  row('v3', 'Van', 'u3', 'Tony Vega', 12),
  row('v4', 'F-150', 'u4', 'Ana Marsh', 9),
  row('v5', 'Ranger', 'u5', 'Dale Hart', 8),
  row('v6', 'Dump', null, null, 40, true),
  row('v7', 'Sprinter', 'u7', 'New Guy', null),
]
const CONTACTS = new Map([['u1', 'c1'], ['u2', 'c2'], ['u3', 'c3'], ['u4', 'c4'], ['u5', 'c5']])
const LINES = [
  // u2 asked 3 days ago, no answer: asked, waiting.
  { contactId: 'c2', at: ago(3), direction: 'out' },
  // u3 asked before the last reading: not an ask for this reading.
  { contactId: 'c3', at: ago(20), direction: 'out' },
  // u4 asked 2 days ago, answered yesterday.
  { contactId: 'c4', at: ago(2), direction: 'out' },
  { contactId: 'c4', at: ago(1), direction: 'in' },
  // u5 asked 6 days ago with no answer: stale, ask again.
  { contactId: 'c5', at: ago(6), direction: 'out' },
  // An inbound line with no ask before it is not an answer.
  { contactId: 'c1', at: ago(1), direction: 'in' },
]

describe('askRows', () => {
  const rows = askRows({ rows: ROWS, contactByUser: CONTACTS, lines: LINES, nowIso: NOW })

  it('sorts not asked first by staleness, then answered, asked, and the motor pool', () => {
    expect(rows.map((r) => `${r.row.vehicle.id}:${r.state}`)).toEqual(['v7:notAsked', 'v1:notAsked', 'v3:notAsked', 'v5:notAsked', 'v4:answered', 'v2:asked', 'v6:walk'])
  })

  it('says the words', () => {
    const by = Object.fromEntries(rows.map((r) => [r.row.vehicle.id, r]))
    expect(by.v1!.words).toBe('Sam Pruitt · never asked')
    expect(by.v7!.words).toBe('New Guy · never asked · no thread with the holder yet')
    expect(by.v3!.words).toBe('Tony Vega · never asked')
    expect(by.v5!.words).toBe('Dale Hart · asked 6d ago, no answer · ask again')
    expect(by.v4!.words).toBe('Ana Marsh answered 1d ago · type the miles from the thread')
    expect(by.v2!.words).toBe('asked Jorge Ruiz 3d ago · waiting on the driver')
    expect(by.v6!.words).toBe('nobody holds it · walk out and read it')
    expect(truckName({ id: 'x', year: null, make: null, model: null })).toBe('the truck')
    expect(askWords(ROWS[0]!)).toBe('Hi Sam, quick check-in on the 2022 Ford Transit: the last reading was 19 days ago. Text back the miles on the dash and anything the truck needs. Thanks!')
    expect(askWords(ROWS[6]!)).toContain('we have no reading on file')
  })

  it('counts, names the first, and writes the note', () => {
    expect(askCounts(rows)).toEqual({ notAsked: 4, asked: 1, answered: 1, walk: 1, late: 7, todo: 6 })
    expect(asksNextLine(rows)).toBe("Ask New Guy for the 2022 Ford Sprinter's miles by text · never read")
    const since = asksSince(rows, ago(4), NOW, () => 'Thursday at 9:55 AM')
    // Crossed late since the mark four days ago: v4 (9 stale, due 7) and v5 (8); asked since: v2 (3d), v4 (2d); answered since: v4.
    expect(since).toEqual({ newLate: 2, askedSince: 2, answeredSince: 1, words: 'Since the last look, Thursday at 9:55 AM' })
    expect(asksMarkNote(rows, since)).toBe(
      '7 late · 4 not asked · 1 asked and waiting · 1 answered, miles to type · 1 motor pool to walk · oldest not asked never read (2022 Ford Sprinter, New Guy) · +2 new late, 2 asked, 1 answered since the last look',
    )
    const allAsked = askRows({ rows: [ROWS[1]!], contactByUser: CONTACTS, lines: LINES, nowIso: NOW })
    expect(asksNextLine(allAsked)).toBeNull()
    expect(asksMarkNote([], null)).toBeNull()
  })
})
