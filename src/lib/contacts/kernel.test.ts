import { describe, expect, it } from 'vitest'
import { DEMO_CONTACTS, DEMO_MESSAGES } from '../messages/messagesDemo'
import { threadOf } from '../messages/thread'
import {
  applyNamePlan,
  contactById,
  firstName,
  greetingName,
  initials,
  isOptedOut,
  kindWord,
  matchChannel,
  nameContact,
  normalizeChannel,
  textableNumbers,
  type Contact,
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

  it('only names an unknown number', () => {
    expect(nameContact(DEMO_CONTACTS, 'greg', { record: { table: 'customers', id: 'x' }, kind: 'customer', name: 'X', company: '' })).toBeNull()
    expect(nameContact(DEMO_CONTACTS, 'nobody', { record: { table: 'customers', id: 'x' }, kind: 'customer', name: 'X', company: '' })).toBeNull()
  })
})
