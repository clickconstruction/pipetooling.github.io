import { describe, expect, it } from 'vitest'
import { applyNamePlan, type Contact } from '../contacts/kernel'
import type { ThreadMessage } from '../messages/thread'
import { plainWordsFailures } from '../plainWords'
import { addedToProspects, bookingRepoint, leadCardThread, leadFromWhoIsThis, leadNeeds, prospectRowFor, threadLink } from './leadThread'

// Kevin texts the team line about his water heater, card 9 of the customer Messages integrations mockups (v0.2), on Tue
// Oct 13 2026 at 10:00 AM in Chicago. Made-up people, never a real row.
const NOW = '2026-10-13T15:00:00Z'

const person = (c: Partial<Contact> & Pick<Contact, 'id' | 'kind' | 'name'>): Contact => ({
  goesBy: null,
  company: '',
  record: null,
  channels: [],
  jobIds: [],
  defaultJobId: null,
  ...c,
})

const KEVIN_NUMBER = { id: 'ch-kevin', kind: 'phone' as const, value: '(210) 555-0188', optedOutAt: null }
const KEVIN = person({ id: 'kevin', kind: 'unknown', name: '(210) 555-0188', channels: [KEVIN_NUMBER] })
const DANA = person({ id: 'dana', kind: 'customer', name: 'Dana Whitfield', record: { table: 'customers', id: 'c-dana' }, customerId: 'c-dana' })
const CONTACTS = [KEVIN, DANA]

const line = (id: string, direction: ThreadMessage['direction'], at: string, body: string, channel: ThreadMessage['channel'] = 'text'): ThreadMessage => ({
  id,
  contactId: 'kevin',
  jobId: null,
  channel,
  direction,
  at,
  who: direction === 'in' ? 'Kevin' : 'Rosa',
  body,
})

const MESSAGES: ThreadMessage[] = [
  line('m1', 'in', '2026-10-13T13:41:00Z', 'Hi this is Kevin Alvarez, can someone come look at my water heater? It is leaking at the bottom.'),
  line('m2', 'out', '2026-10-13T13:50:00Z', 'Hi Kevin, we can come at 2 today. Does that work?'),
  line('m3', 'team', '2026-10-13T13:52:00Z', 'Sounds like the tank. Bring a 50 gallon quote.', 'note'),
  line('m4', 'in', '2026-10-13T14:05:00Z', 'Yes 2 works. Thank you!'),
  line('m5', 'out', '2026-10-13T14:10:00Z', 'See you at 2.'),
  { ...line('d1', 'in', '2026-10-12T21:05:00Z', 'Can you do Thursday?'), contactId: 'dana' },
]

/** Kevin, named a lead from his text. */
const asLead = () => {
  const plan = leadFromWhoIsThis(CONTACTS, 'kevin', 'Kevin Alvarez')!
  return applyNamePlan(CONTACTS, MESSAGES, plan)
}
const KEVIN_LEAD = () => asLead().contacts.find((c) => c.id === 'kevin')!

describe('Who is this? names a new number a lead', () => {
  it('re-points Kevin to a lead under the name in his text, with no record, and keeps his thread', () => {
    const plan = leadFromWhoIsThis(CONTACTS, 'kevin', 'Kevin Alvarez')
    expect(plan).toEqual({
      way: 'repoint',
      contact: { ...KEVIN, kind: 'lead', name: 'Kevin Alvarez', company: '', record: null, jobIds: [], defaultJobId: null },
      jobId: null,
    })
    const after = asLead()
    expect(after.messages.filter((m) => m.contactId === 'kevin').map((m) => m.id)).toEqual(['m1', 'm2', 'm3', 'm4', 'm5'])
    expect(after.contacts.find((c) => c.id === 'dana')).toBe(DANA)
  })

  it('keeps the number as the name when the text gives none', () => {
    expect(leadFromWhoIsThis(CONTACTS, 'kevin', null)).toMatchObject({ contact: { kind: 'lead', name: '(210) 555-0188', record: null } })
    expect(leadFromWhoIsThis(CONTACTS, 'kevin', '  ')).toMatchObject({ contact: { name: '(210) 555-0188' } })
  })

  it('names only a number nobody has named', () => {
    expect(leadFromWhoIsThis(CONTACTS, 'dana', 'Dana Whitfield')).toBeNull()
    expect(leadFromWhoIsThis(CONTACTS, 'nobody', 'Kevin')).toBeNull()
  })
})

describe('the lead’s card', () => {
  it('shows the last three lines, the thread’s link, whose move and when he wrote', () => {
    expect(leadCardThread(KEVIN_LEAD(), MESSAGES, NOW)).toEqual({
      lines: [
        { id: 'm2', direction: 'out', channel: 'text', words: 'Hi Kevin, we can come at 2 today. Does that work?', when: 'today at 8:50 AM' },
        { id: 'm4', direction: 'in', channel: 'text', words: 'Yes 2 works. Thank you!', when: 'today at 9:05 AM' },
        { id: 'm5', direction: 'out', channel: 'text', words: 'See you at 2.', when: 'today at 9:10 AM' },
      ],
      threadLink: '/gc?thread=kevin&at=m5',
      move: 'theirs',
      wrote: 'today at 9:05 AM',
    })
  })

  it('leaves the team note in the thread, off the card', () => {
    expect(leadCardThread(KEVIN_LEAD(), MESSAGES, NOW).lines.map((l) => l.id)).not.toContain('m3')
  })

  it('is our move when his line is the newest, and he waits on us', () => {
    const early = MESSAGES.filter((m) => m.id !== 'm5')
    expect(leadCardThread(KEVIN_LEAD(), early, NOW)).toMatchObject({ move: 'ours', threadLink: '/gc?thread=kevin&at=m4' })
    expect([...leadNeeds([KEVIN_LEAD(), DANA], early)]).toEqual(['kevin'])
  })

  it('flags no lead we have answered, and no one who is not a lead', () => {
    expect(leadNeeds([KEVIN_LEAD(), DANA], MESSAGES).size).toBe(0)
  })

  it('is empty for a lead with no lines', () => {
    expect(leadCardThread({ id: 'quiet' }, MESSAGES, NOW)).toEqual({ lines: [], threadLink: '/gc?thread=quiet', move: 'none', wrote: null })
  })

  it('builds the thread’s link the way the thread window reads it', () => {
    expect(threadLink('a b', 'm 1')).toBe('/gc?thread=a+b&at=m+1')
  })
})

describe('Add to Prospects', () => {
  const BY = { userId: 'u-rosa', masterUserId: 'u-owner' }

  it('writes his name, his number and his first words, led by how he came in', () => {
    expect(prospectRowFor(KEVIN_LEAD(), MESSAGES, BY)).toEqual({
      contact_name: 'Kevin Alvarez',
      company_name: null,
      phone_number: '(210) 555-0188',
      email: null,
      notes: 'Texted the office: Hi this is Kevin Alvarez, can someone come look at my water heater? It is leaking at the bottom.',
      last_contact: '2026-10-13T14:10:00Z',
      prospect_fit_status: null,
      created_by: 'u-rosa',
      master_user_id: 'u-owner',
    })
  })

  it('leaves the name empty when the lead is still a number, and says how an email came in', () => {
    const nameless = { ...KEVIN_LEAD(), name: '(210) 555-0188' }
    expect(prospectRowFor(nameless, MESSAGES, BY).contact_name).toBeNull()
    const emailed = MESSAGES.map((m) => (m.id === 'm1' ? { ...m, channel: 'email' as const, subject: 'Water heater leak' } : m))
    expect(prospectRowFor(KEVIN_LEAD(), emailed, BY).notes).toBe('Emailed the office: Water heater leak')
  })

  it('points the lead at the row, still a lead, through nameContact', () => {
    const { contacts } = asLead()
    expect(addedToProspects(contacts, 'kevin', 'p-1')).toMatchObject({ way: 'repoint', contact: { id: 'kevin', kind: 'lead', name: 'Kevin Alvarez', record: { table: 'prospects', id: 'p-1' } } })
  })

  it('adds a lead to Prospects once, and nobody who is not a lead', () => {
    const { contacts } = asLead()
    const added = applyNamePlan(contacts, [], addedToProspects(contacts, 'kevin', 'p-1')!).contacts
    expect(addedToProspects(added, 'kevin', 'p-2')).toBeNull()
    expect(addedToProspects(CONTACTS, 'kevin', 'p-1')).toBeNull()
    expect(addedToProspects(CONTACTS, 'dana', 'p-1')).toBeNull()
  })
})

describe('booking', () => {
  const CUSTOMER = { id: 'c-kevin', name: 'Kevin Alvarez' }

  it('re-points the lead to the new customer and keeps every line', () => {
    const { contacts, messages } = asLead()
    const booking = bookingRepoint(contacts, 'kevin', CUSTOMER)!
    expect(booking.convertProspectId).toBeNull()
    expect(booking.card).toEqual({ words: 'Became a customer.', link: '/customers/c-kevin' })
    const after = applyNamePlan(contacts, messages, booking.plan)
    expect(after.contacts.find((c) => c.id === 'kevin')).toMatchObject({
      kind: 'customer',
      name: 'Kevin Alvarez',
      record: { table: 'customers', id: 'c-kevin' },
      channels: [KEVIN_NUMBER],
    })
    expect(after.messages.filter((m) => m.contactId === 'kevin').map((m) => m.id)).toEqual(['m1', 'm2', 'm3', 'm4', 'm5'])
    expect(leadCardThread({ id: 'kevin' }, after.messages, NOW).lines.map((l) => l.id)).toEqual(['m2', 'm4', 'm5'])
  })

  it('closes the prospect when the lead was added to Prospects', () => {
    const { contacts } = asLead()
    const added = applyNamePlan(contacts, [], addedToProspects(contacts, 'kevin', 'p-1')!).contacts
    expect(bookingRepoint(added, 'kevin', CUSTOMER)?.convertProspectId).toBe('p-1')
  })

  it('folds into the customer’s own contact when one is already there, the lines moving onto it', () => {
    const { contacts, messages } = asLead()
    const theirs = person({
      id: 'c-kevin-contact',
      kind: 'customer',
      name: 'kevin alvarez',
      record: { table: 'customers', id: 'c-kevin' },
      channels: [{ id: 'ch-2', kind: 'phone', value: '210-555-0188', optedOutAt: null }, { id: 'ch-3', kind: 'email', value: 'kevin@example.com', optedOutAt: null }],
    })
    const booking = bookingRepoint([...contacts, theirs], 'kevin', CUSTOMER)!
    expect(booking.plan).toMatchObject({ way: 'merge', dropId: 'kevin', into: { id: 'c-kevin-contact' } })
    const after = applyNamePlan([...contacts, theirs], messages, booking.plan)
    expect(after.contacts.map((c) => c.id)).toEqual(['dana', 'c-kevin-contact'])
    expect(after.contacts[1]!.channels.map((ch) => ch.id)).toEqual(['ch-2', 'ch-3'])
    expect(after.messages.filter((m) => m.contactId === 'c-kevin-contact').map((m) => m.id)).toEqual(['m1', 'm2', 'm3', 'm4', 'm5'])
  })

  it('books only a lead', () => {
    expect(bookingRepoint(CONTACTS, 'dana', CUSTOMER)).toBeNull()
    expect(bookingRepoint(CONTACTS, 'kevin', CUSTOMER)).toBeNull()
  })
})

describe('plain words', () => {
  it('every sentence a person reads passes', () => {
    const { contacts } = asLead()
    const texts = [
      `${prospectRowFor(KEVIN_LEAD(), MESSAGES, { userId: 'u', masterUserId: 'm' }).notes.split(': ')[0]}.`,
      bookingRepoint(contacts, 'kevin', { id: 'c-kevin', name: 'Kevin Alvarez' })!.card.words,
      ...leadCardThread(KEVIN_LEAD(), MESSAGES, NOW).lines.map((l) => l.when),
    ]
    expect(texts.flatMap(plainWordsFailures)).toEqual([])
  })
})
