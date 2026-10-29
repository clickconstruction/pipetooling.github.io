import { describe, expect, it } from 'vitest'
import { messagesLaneHref, messagesMarkNoteFor, messagesNextLine, messagesStation, type MessagesStationInput } from './messagesStation'
import type { LedgerLine } from './textsLedger'

const NOW = Date.parse('2026-10-29T15:00:00Z')
const line = (id: string, contactId: string, channel: LedgerLine['channel'], at: string): [string, LedgerLine] => [id, { id, contactId, channel, direction: 'in', body: 'hi', at }]

const input = (over: Partial<MessagesStationInput['queue']> = {}): MessagesStationInput => ({
  queue: {
    newLane: [{ contactId: 'c-9' }] as MessagesStationInput['queue']['newLane'],
    needsYou: [{} as never, {} as never],
    clauses: [{}],
    needsReply: [
      { contactId: 'c-1', landOnId: 'm-1', waitingSince: '2026-10-29T13:00:00Z', callBack: false, offers: [], acts: [] },
      { contactId: 'c-2', landOnId: 'm-2', waitingSince: '2026-10-29T14:30:00Z', callBack: false, offers: [], acts: [] },
    ],
    weOwe: [{} as never],
    calls: [{} as never, {} as never],
    count: 7,
    ...over,
  },
  contacts: [
    { id: 'c-1', name: 'Priya Natarajan', kind: 'customer', company: null, phone: null },
    { id: 'c-2', name: 'Dale Brennan', kind: 'trade', company: null, phone: null },
  ],
  lines: new Map([line('m-1', 'c-1', 'text', '2026-10-29T13:00:00Z'), line('m-2', 'c-2', 'email', '2026-10-29T14:30:00Z')]),
  nowMs: NOW,
})

describe('messagesStation (v2.6098, punch list #178)', () => {
  it('draws the five lanes with the page’s counts, the badge’s number, and the person waiting longest first', () => {
    const s = messagesStation(input())
    expect(s.count).toBe(7)
    expect(s.lanes.map((l) => [l.lane, l.label, l.count, l.href])).toEqual([
      ['new', 'New', 1, '/messages#new-lane'],
      ['needsYou', 'Needs you', 3, '/messages#needs-you'],
      ['needsReply', 'Needs a reply', 2, '/messages#needs-reply'],
      ['weOwe', 'We owe them', 3, '/messages#we-owe-them'],
      ['waiting', 'Waiting on them', null, '/messages#waiting-on-them'],
    ])
    expect(s.first).toEqual({ contactId: 'c-1', name: 'Priya Natarajan', channelWords: 'a text', waiting: 'waiting 2 h', href: '/messages?thread=c-1&at=m-1' })
    expect(messagesLaneHref('needsReply')).toBe('/messages#needs-reply')
  })

  it('the Next line answers the person waiting longest, else sorts New, else does what we owe', () => {
    expect(messagesNextLine(messagesStation(input()))).toBe('Answer Priya Natarajan · a text · waiting 2 h')
    expect(messagesNextLine(messagesStation(input({ needsReply: [] })))).toBe('Sort the 1 message in New')
    expect(messagesNextLine(messagesStation(input({ needsReply: [], newLane: [] })))).toBe('Do the 3 things we owe')
    expect(messagesNextLine(messagesStation(input({ needsReply: [], newLane: [], weOwe: [], calls: [], needsYou: [], clauses: [], count: 0 })))).toBeNull()
    expect(messagesNextLine(null)).toBeNull()
  })

  it('the Mark’s note says who was waiting, with the texts ledger’s note and the typed words under it', () => {
    const s = messagesStation(input())
    expect(messagesMarkNoteFor({ station: s, ledger: null, typed: '', problem: false })).toBe('7 waiting on us · new 1 · needs you 3 · needs a reply 2 · we owe them 3')
    expect(messagesMarkNoteFor({ station: s, ledger: null, typed: 'called Dale back', problem: false })).toBe('7 waiting on us · new 1 · needs you 3 · needs a reply 2 · we owe them 3\ncalled Dale back')
    expect(messagesMarkNoteFor({ station: messagesStation(input({ needsReply: [], newLane: [], weOwe: [], calls: [], needsYou: [], clauses: [], count: 0 })), ledger: null, typed: '', problem: false })).toBe('nobody waiting on us')
    expect(messagesMarkNoteFor({ station: null, ledger: null, typed: '', problem: true })).toBe('Messages could not be read')
    expect(messagesMarkNoteFor({ station: null, ledger: null, typed: '', problem: false })).toBeNull()
  })
})
