import { describe, expect, it } from 'vitest'
import type { Contact } from '../contacts/kernel'
import { plainWordsFailures } from '../plainWords'
import { customerPayloadFrom, JOB_NAME_MAX, jobPrefillFrom, LEAD_DOOR_WORDS, leadFacts, leadFirstName, leadHasName, newestInboundWords } from './leadDoors'

const channel = (kind: 'phone' | 'email', value: string) => ({ id: `ch-${kind}`, contactId: 'lena', kind, value, optedOutAt: null }) as unknown as Contact['channels'][number]

const LENA: Pick<Contact, 'id' | 'name' | 'channels'> = { id: 'lena', name: 'Lena Ortiz', channels: [channel('phone', '(830) 555-0101'), channel('email', 'lena@example.com')] }

const line = (id: string, direction: 'in' | 'out', channel: 'text' | 'email' | 'voicemail' | 'missed', at: string, body: string) => ({ contactId: 'lena', id, direction, channel, at, body })

describe('a lead’s doors (punch list #140 PR 8)', () => {
  it('reads who they are off the thread: the name, the first number, the first address, their words', () => {
    expect(leadFacts(LENA, '  Can you come Thursday?  ')).toEqual({ contactId: 'lena', name: 'Lena Ortiz', phone: '(830) 555-0101', email: 'lena@example.com', words: 'Can you come Thursday?' })
    expect(leadFacts({ id: 'x', name: '(830) 555-0199', channels: [] }, null)).toEqual({ contactId: 'x', name: '(830) 555-0199', phone: null, email: null, words: null })
  })

  it('needs a name a person gave, never a number', () => {
    expect(leadHasName({ name: 'Lena Ortiz' })).toBe(true)
    expect(leadHasName({ name: '(830) 555-0199' })).toBe(false)
    expect(leadHasName({ name: '' })).toBe(false)
  })

  it('takes their newest words: a text, an email’s first line, a voicemail; never ours, never a missed call', () => {
    const lines = [
      line('1', 'in', 'text', '2026-10-20T15:00:00.000Z', 'Hi, is this the plumbing office?'),
      line('2', 'out', 'text', '2026-10-20T15:05:00.000Z', 'It is. How can we help?'),
      line('3', 'in', 'email', '2026-10-21T09:00:00.000Z', 'Water heater is leaking.\nCan you come Thursday?'),
      line('4', 'in', 'missed', '2026-10-21T10:00:00.000Z', ''),
    ]
    expect(newestInboundWords(lines, 'lena')).toBe('Water heater is leaking.')
    expect(newestInboundWords(lines.slice(0, 2), 'lena')).toBe('Hi, is this the plumbing office?')
    expect(newestInboundWords(lines, 'someone-else')).toBeNull()
    expect(newestInboundWords([line('5', 'in', 'voicemail', '2026-10-22T10:00:00.000Z', 'Call me back about the heater.')], 'lena')).toBe('Call me back about the heater.')
  })

  it('makes the customer row: a homeowner met today, with the number and the address they gave', () => {
    const facts = leadFacts(LENA, 'Can you come Thursday?')
    expect(customerPayloadFrom(facts, 'owner-1', '2026-10-21')).toEqual({
      name: 'Lena Ortiz',
      address: null,
      contact_info: { phone: '(830) 555-0101', email: 'lena@example.com' },
      customer_type: 'residential',
      date_met: '2026-10-21',
      master_user_id: 'owner-1',
    })
    expect(customerPayloadFrom(leadFacts({ id: 'x', name: 'Tom', channels: [] }, null), 'owner-1', '2026-10-21').contact_info).toBeNull()
  })

  it('fills Add Job with the three fields and their words as the job’s name, cut to a line', () => {
    expect(jobPrefillFrom(leadFacts(LENA, 'Can you come Thursday?'))).toEqual({ name: 'Lena Ortiz', phone: '(830) 555-0101', email: 'lena@example.com', note: 'Can you come Thursday?' })
    const long = 'The water heater in the garage started leaking last night and the floor is wet, can someone come out this week please'
    const note = jobPrefillFrom(leadFacts(LENA, long)).note!
    expect(note.length).toBeLessThanOrEqual(JOB_NAME_MAX + 1)
    expect(note.endsWith('…')).toBe(true)
    expect(note).toBe('The water heater in the garage started leaking last night…')
    expect(jobPrefillFrom(leadFacts(LENA, null)).note).toBeNull()
  })

  it('names them by first name in the toast', () => {
    expect(leadFirstName({ name: 'Lena Ortiz' })).toBe('Lena')
    expect(LEAD_DOOR_WORDS.converted('Lena')).toBe('Lena is a customer now. The thread came with them.')
    expect(leadFirstName({ name: '' })).toBe('They')
  })

  it('keeps every sentence in plain words', () => {
    for (const w of Object.values(LEAD_DOOR_WORDS)) {
      const words = typeof w === 'function' ? w('Lena') : w
      expect(plainWordsFailures(words), words).toEqual([])
    }
  })
})
