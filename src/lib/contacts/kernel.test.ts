import { describe, expect, it } from 'vitest'
import { DEMO_CONTACTS, DEMO_MESSAGES } from '../messages/messagesDemo'
import { threadOf } from '../messages/thread'
import { plainWordsFailures } from '../plainWords'
import {
  applyNamePlan,
  contactById,
  firstName,
  greetingName,
  initials,
  isOptedOut,
  kindOf,
  kindWord,
  matchChannel,
  nameContact,
  normalizeChannel,
  textableNumbers,
  type Contact,
  type ContactKind,
  type ContactRecord,
} from './kernel'

const who = (id: string): Contact => contactById(DEMO_CONTACTS, id)!

describe('what we call a contact (the prototype’s firstName, with main’s titled rule)', () => {
  it('greets by the first name, and a title keeps the last name', () => {
    expect(greetingName('Greg Paulk')).toBe('Greg')
    expect(greetingName('Dr. Priya Raman')).toBe('Dr. Raman')
    expect(greetingName('Ms Ana Ruiz')).toBe('Ms Ruiz')
    expect(greetingName('  Elena   Marchetti ')).toBe('Elena')
    expect(greetingName('')).toBe('')
  })

  it('takes what they go by first, never drops a title, and names nobody for an unknown number', () => {
    expect(firstName(who('greg'))).toBe('Greg')
    expect(firstName(who('priya'))).toBe('Dr. Raman')
    expect(firstName({ ...who('priya'), goesBy: 'Priya' })).toBe('Priya')
    expect(firstName({ ...who('priya'), goesBy: '  ' })).toBe('Dr. Raman')
    expect(firstName(who('unk1'))).toBe('')
  })

  it('draws the face’s letters without the title, a question mark for an unknown number', () => {
    expect(initials(who('priya'))).toBe('PR')
    expect(initials(who('greg'))).toBe('GP')
    expect(initials(who('unk1'))).toBe('?')
  })

  it('says what they are to us', () => {
    expect(kindWord('customer')).toBe('customer')
    expect(kindWord('trade')).toBe('trade partner')
    expect(kindWord('arch')).toBe('architect')
    expect(kindWord('unknown')).toBe('who is this?')
  })

  it('says the four kinds of 2026-10-13 in plain words', () => {
    const four: ContactKind[] = ['lead', 'supply_house', 'candidate', 'sub']
    expect(four.map(kindWord)).toEqual(['lead', 'supply house', 'candidate', 'sub'])
    expect(four.flatMap((k) => plainWordsFailures(`Greg is a ${kindWord(k)}.`))).toEqual([])
  })
})

describe('seven kinds of contact: what a record makes them', () => {
  const at = (table: NonNullable<ContactRecord>['table']) => ({ table, id: 'r1' }) as NonNullable<ContactRecord>

  it('reads each table as the kind Who is this? first offers', () => {
    expect(kindOf(at('customers'))).toBe('customer')
    expect(kindOf(at('customer_contact_persons'))).toBe('customer')
    expect(kindOf(at('gc_companies'))).toBe('trade')
    expect(kindOf(at('gc_company_people'))).toBe('trade')
    expect(kindOf(at('prospects'))).toBe('lead')
    expect(kindOf(at('supply_houses'))).toBe('supply_house')
    expect(kindOf(at('supply_house_contacts'))).toBe('supply_house')
    expect(kindOf(at('team_prospects'))).toBe('candidate')
  })

  it('tells a sub from anyone else on the roster by the roster kind', () => {
    expect(kindOf(at('people'), 'sub')).toBe('sub')
    expect(kindOf(at('people'), 'helper')).toBe('team')
    expect(kindOf(at('people'), 'master_technician')).toBe('team')
    expect(kindOf(at('people'), null)).toBe('team')
    expect(kindOf(at('people'))).toBe('team')
  })
})

describe('the matching rule by number and address', () => {
  it('compares numbers as ten digits and addresses in lower case', () => {
    expect(normalizeChannel('phone', '+1 (210) 555-0113')).toBe('2105550113')
    expect(normalizeChannel('phone', '+12105550113')).toBe('2105550113')
    expect(normalizeChannel('phone', '555')).toBe('')
    expect(normalizeChannel('email', ' Greg@Hillside.Example ')).toBe('greg@hillside.example')
    expect(normalizeChannel('email', 'not an address')).toBe('')
  })

  it('finds the person a webhook’s number or a sender’s address belongs to', () => {
    const byText = matchChannel(DEMO_CONTACTS, 'phone', '+12105550113')
    expect(byText).toMatchObject({ match: 'one', contact: { id: 'greg' }, channel: { id: 'greg-phone' } })
    expect(matchChannel(DEMO_CONTACTS, 'email', 'ELENA@cibolocreek.example')).toMatchObject({ match: 'one', contact: { id: 'elena' } })
  })

  it('a number nobody has is none, with its digits for the new contact', () => {
    expect(matchChannel(DEMO_CONTACTS, 'phone', '(512) 555-0199')).toEqual({ match: 'none', value: '5125550199' })
    expect(matchChannel(DEMO_CONTACTS, 'phone', 'no digits')).toEqual({ match: 'none', value: '' })
  })

  it('a number two people share lands on the one it last carried a message for', () => {
    const dana: Contact = {
      ...who('greg'),
      id: 'dana',
      name: 'Dana Paulk',
      record: { table: 'gc_company_people', id: 'hillside-dana' },
      channels: [{ id: 'dana-phone', kind: 'phone', value: '210-555-0113', optedOutAt: null }],
    }
    const contacts = [...DEMO_CONTACTS, dana]
    // With no messages, the list's order decides.
    expect(matchChannel(contacts, 'phone', '2105550113')).toMatchObject({ match: 'many', contact: { id: 'greg' }, others: [{ id: 'dana' }] })
    const toDana = { contactId: 'dana', channelId: 'dana-phone', at: '2026-10-02T16:40:00.000Z' }
    expect(matchChannel(contacts, 'phone', '2105550113', [...DEMO_MESSAGES, toDana])).toMatchObject({
      match: 'many',
      contact: { id: 'dana' },
      channel: { id: 'dana-phone' },
      others: [{ id: 'greg' }],
    })
  })
})

describe('opting out is per number', () => {
  const stopped = { optedOutAt: '2026-10-01T15:00:00.000Z' }

  it('a STOP closes that number and leaves the others open', () => {
    const greg = who('greg')
    const second = { id: 'greg-cell', kind: 'phone' as const, value: '(210) 555-0114', optedOutAt: null }
    const twoNumbers = { channels: [{ ...greg.channels[0]!, ...stopped }, second, greg.channels[1]!] }
    expect(textableNumbers(greg).map((c) => c.id)).toEqual(['greg-phone'])
    expect(textableNumbers(twoNumbers).map((c) => c.id)).toEqual(['greg-cell'])
    expect(isOptedOut(twoNumbers)).toBe(false)
  })

  it('opted out only when every number stopped and there is no address to write to', () => {
    const tom = who('tom')
    expect(isOptedOut(tom)).toBe(false)
    expect(isOptedOut({ channels: tom.channels.map((c) => ({ ...c, ...stopped })) })).toBe(true)
    const greg = who('greg')
    expect(isOptedOut({ channels: greg.channels.map((c) => (c.kind === 'phone' ? { ...c, ...stopped } : c)) })).toBe(false)
  })
})

describe('Who is this? re-points and keeps the thread', () => {
  it('names a number nobody knew as a new person, tying its untied lines to the job picked', () => {
    const plan = nameContact(DEMO_CONTACTS, 'unk1', {
      record: { table: 'gc_companies', id: 'alamo' },
      kind: 'trade',
      name: 'Dee',
      company: 'Alamo Concrete',
      trade: 'Concrete',
      jobId: 'padb',
    })
    expect(plan).toMatchObject({ way: 'repoint', jobId: 'padb' })
    const { contacts, messages } = applyNamePlan(DEMO_CONTACTS, DEMO_MESSAGES, plan!)
    expect(contacts).toHaveLength(DEMO_CONTACTS.length)
    expect(contactById(contacts, 'unk1')).toMatchObject({
      kind: 'trade',
      name: 'Dee',
      company: 'Alamo Concrete',
      record: { table: 'gc_companies', id: 'alamo' },
      channels: [{ id: 'unk1-phone' }],
      jobIds: ['padb'],
      defaultJobId: 'padb',
    })
    // Same contact, same thread: Dee's text is still hers, now on Pad B.
    expect(threadOf(messages, 'unk1').map((m) => [m.id, m.jobId])).toEqual([['14', 'padb']])
    expect(firstName(contactById(contacts, 'unk1')!)).toBe('Dee')
  })

  it('folds into the contact that already points at the record: one person, one thread', () => {
    const plan = nameContact(DEMO_CONTACTS, 'unk1', { record: { table: 'gc_companies', id: 'hillside' }, kind: 'trade', name: 'Greg Paulk', company: 'Hillside Excavation' })
    expect(plan).toMatchObject({ way: 'merge', into: { id: 'greg' }, dropId: 'unk1', jobId: null })
    const { contacts, messages } = applyNamePlan(DEMO_CONTACTS, DEMO_MESSAGES, plan!)
    expect(contacts.map((c) => c.id)).not.toContain('unk1')
    expect(contactById(contacts, 'greg')!.channels.map((c) => c.value)).toEqual(['(210) 555-0113', 'greg@hillside.example', '(830) 555-0172'])
    expect(threadOf(messages, 'greg').map((m) => m.id)).toEqual(['1', '2', '3', '4', '14', '16'])
    // The rule learns the number: his next text from the new cell lands on him.
    expect(matchChannel(contacts, 'phone', '+18305550172')).toMatchObject({ match: 'one', contact: { id: 'greg' } })
  })

  it('a second person at a company keeps her own contact under her own name', () => {
    const plan = nameContact(DEMO_CONTACTS, 'unk1', { record: { table: 'gc_companies', id: 'hillside' }, kind: 'trade', name: 'Dee', company: 'Hillside Excavation' })
    expect(plan).toMatchObject({ way: 'repoint', contact: { id: 'unk1', name: 'Dee', record: { table: 'gc_companies', id: 'hillside' } } })
    const { contacts } = applyNamePlan(DEMO_CONTACTS, DEMO_MESSAGES, plan!)
    expect(contacts.filter((c) => c.record?.id === 'hillside').map((c) => c.name)).toEqual(['Greg Paulk', 'Dee'])
    // Greg's own name, in another case, is still Greg.
    expect(nameContact(DEMO_CONTACTS, 'unk1', { record: { table: 'gc_companies', id: 'hillside' }, kind: 'trade', name: ' greg paulk ', company: '' })).toMatchObject({ way: 'merge', into: { id: 'greg' } })
  })

  it('a number the person already had is not added twice', () => {
    const again: Contact = { ...who('unk1'), id: 'unk2', channels: [{ id: 'unk2-phone', kind: 'phone', value: '210.555.0113', optedOutAt: null }] }
    const plan = nameContact([...DEMO_CONTACTS, again], 'unk2', { record: { table: 'gc_companies', id: 'hillside' }, kind: 'trade', name: 'Greg Paulk', company: 'Hillside Excavation' })
    expect(plan?.way === 'merge' && plan.into.channels.map((c) => c.id)).toEqual(['greg-phone', 'greg-email'])
  })

  it('names a number as a sub on the roster, a lead or a candidate, each one person on their own row', () => {
    const sub = nameContact(DEMO_CONTACTS, 'unk1', { record: { table: 'people', id: 'p-ray' }, kind: kindOf({ table: 'people', id: 'p-ray' }, 'sub'), name: 'Ray Flores', company: '' })
    expect(sub).toMatchObject({ way: 'repoint', contact: { id: 'unk1', kind: 'sub', name: 'Ray Flores', record: { table: 'people', id: 'p-ray' } } })
    const lead = nameContact(DEMO_CONTACTS, 'unk1', { record: { table: 'prospects', id: 'pr-1' }, kind: 'lead', name: 'Kevin Alvarez', company: '' })
    expect(lead).toMatchObject({ way: 'repoint', contact: { kind: 'lead', record: { table: 'prospects', id: 'pr-1' } } })
    const candidate = nameContact(DEMO_CONTACTS, 'unk1', { record: { table: 'team_prospects', id: 'tp-1' }, kind: 'candidate', name: 'Luis Ortega', company: '' })
    expect(candidate).toMatchObject({ way: 'repoint', contact: { kind: 'candidate', record: { table: 'team_prospects', id: 'tp-1' } } })
  })

  it('a supply house holds more people than its own, each by name', () => {
    const counter: Contact = { ...who('unk1'), id: 'sh-main', kind: 'supply_house', name: 'Hill Country Pipe Supply', record: { table: 'supply_houses', id: 'sh-1' }, channels: [] }
    const contacts = [...DEMO_CONTACTS, counter]
    const ray = nameContact(contacts, 'unk1', { record: { table: 'supply_houses', id: 'sh-1' }, kind: 'supply_house', name: 'Ray', company: 'Hill Country Pipe Supply' })
    expect(ray).toMatchObject({ way: 'repoint', contact: { id: 'unk1', kind: 'supply_house', name: 'Ray' } })
    expect(nameContact(contacts, 'unk1', { record: { table: 'supply_houses', id: 'sh-1' }, kind: 'supply_house', name: 'hill country pipe supply', company: '' })).toMatchObject({ way: 'merge', into: { id: 'sh-main' } })
  })

  it('a lead who books is named once more, as the customer they became, keeping their jobs and thread', () => {
    const lead: Contact = { ...who('unk1'), kind: 'lead', name: 'Kevin Alvarez', record: { table: 'prospects', id: 'pr-1' }, jobIds: ['estimate'], defaultJobId: 'estimate' }
    const contacts = DEMO_CONTACTS.map((c) => (c.id === 'unk1' ? lead : c))
    const booked = nameContact(contacts, 'unk1', { record: { table: 'customers', id: 'cust-alvarez' }, kind: 'customer', name: 'Kevin Alvarez', company: '', jobId: 'job-1' })
    expect(booked).toMatchObject({
      way: 'repoint',
      contact: { id: 'unk1', kind: 'customer', record: { table: 'customers', id: 'cust-alvarez' }, jobIds: ['estimate', 'job-1'], defaultJobId: 'estimate' },
    })
    const { messages } = applyNamePlan(contacts, DEMO_MESSAGES, booked!)
    expect(threadOf(messages, 'unk1').map((m) => m.id)).toEqual(['14'])
    // A customer who already has a contact: the lead folds into it.
    const elena = DEMO_CONTACTS.find((c) => c.record?.table === 'customer_contact_persons')!
    expect(nameContact(contacts, 'unk1', { record: elena.record!, kind: 'customer', name: elena.name, company: elena.company })).toMatchObject({ way: 'merge', into: { id: elena.id }, dropId: 'unk1' })
  })

  it('a lead with no record is added to Prospects, and folds into the lead already there', () => {
    const lead: Contact = { ...who('unk1'), kind: 'lead', name: 'Kevin Alvarez', record: null }
    const contacts = DEMO_CONTACTS.map((c) => (c.id === 'unk1' ? lead : c))
    expect(nameContact(contacts, 'unk1', { record: { table: 'prospects', id: 'pr-1' }, kind: 'lead', name: 'Kevin Alvarez', company: '' })).toMatchObject({
      way: 'repoint',
      contact: { id: 'unk1', kind: 'lead', record: { table: 'prospects', id: 'pr-1' } },
    })
    const onProspects: Contact = { ...who('greg'), id: 'kevin-pr', kind: 'lead', name: 'Kevin Alvarez', record: { table: 'prospects', id: 'pr-1' }, channels: [] }
    expect(nameContact([...contacts, onProspects], 'unk1', { record: { table: 'prospects', id: 'pr-1' }, kind: 'lead', name: 'Kevin Alvarez', company: '' })).toMatchObject({ way: 'merge', into: { id: 'kevin-pr' } })
    // A lead already on Prospects is not added again.
    expect(nameContact([...contacts, onProspects], 'kevin-pr', { record: { table: 'prospects', id: 'pr-2' }, kind: 'lead', name: 'Kevin Alvarez', company: '' })).toBeNull()
  })

  it('a lead is named again only as a customer, and nobody else is named again', () => {
    const lead: Contact = { ...who('unk1'), kind: 'lead', record: { table: 'prospects', id: 'pr-1' } }
    const contacts = DEMO_CONTACTS.map((c) => (c.id === 'unk1' ? lead : c))
    expect(nameContact(contacts, 'unk1', { record: { table: 'gc_companies', id: 'hillside' }, kind: 'trade', name: 'Kevin', company: '' })).toBeNull()
    expect(nameContact(contacts, 'unk1', { record: { table: 'customers', id: 'x' }, kind: 'arch', name: 'Kevin', company: '' })).toBeNull()
    const counter: Contact = { ...lead, kind: 'supply_house', record: { table: 'supply_houses', id: 'sh-1' } }
    expect(nameContact(DEMO_CONTACTS.map((c) => (c.id === 'unk1' ? counter : c)), 'unk1', { record: { table: 'customers', id: 'x' }, kind: 'customer', name: 'X', company: '' })).toBeNull()
  })

  it('only names an unknown number', () => {
    expect(nameContact(DEMO_CONTACTS, 'greg', { record: { table: 'customers', id: 'x' }, kind: 'customer', name: 'X', company: '' })).toBeNull()
    expect(nameContact(DEMO_CONTACTS, 'nobody', { record: { table: 'customers', id: 'x' }, kind: 'customer', name: 'X', company: '' })).toBeNull()
  })
})
