import { describe, expect, it } from 'vitest'
import {
  buildRecipientPeople,
  ccAddRefusal,
  filterRecipientPeople,
  lockedCopyEmail,
  personForEmail,
  recipientReadback,
  recipientRowsForLine,
  replyTakers,
  typedAddressOffer,
  withTypedAddress,
} from './gcStatementRecipients'

const taunya = { id: 'u-taunya', name: 'Taunya', email: 'Taunya@office.test', role: 'assistant' }
const malachi = { id: 'u-malachi', name: 'Malachi', email: 'malachi@office.test', role: 'master_technician' }
const roxi = { id: 'u-roxi', name: 'Roxi', email: 'roxi@office.test', role: 'controller' }
const noAddress = { id: 'u-blank', name: 'Blank', email: '', role: 'assistant' }
const helper = { id: 'u-helper', name: 'Hal', email: 'hal@office.test', role: 'helpers' }

const people = () =>
  buildRecipientPeople({
    gcName: 'RLC- Dunmere Mallin',
    gcEmail: 'Office@RLC.test',
    contacts: [
      { name: 'Accounts payable', email: 'ap@rlc.test', gets_bill_copies: true },
      { name: 'Same as main', email: 'office@rlc.test' },
      { name: 'No address', email: null },
      { name: 'PM', email: 'pm@rlc.test', gets_bill_copies: false },
    ],
    users: [roxi, taunya, malachi, noAddress, helper],
    meId: taunya.id,
    accountManId: malachi.id,
  })

describe('buildRecipientPeople', () => {
  it('leads with the GC and its contact people, then the office by name, each address once', () => {
    expect(people().map((p) => [p.group, p.name, p.email, p.tag ?? ''])).toEqual([
      ['gc', 'RLC- Dunmere Mallin', 'office@rlc.test', 'main address'],
      ['gc', 'Accounts payable', 'ap@rlc.test', 'gets bill copies'],
      ['gc', 'PM', 'pm@rlc.test', 'contact'],
      ['office', 'Malachi', 'malachi@office.test', 'account man'],
      ['office', 'Roxi', 'roxi@office.test', ''],
      ['office', 'Taunya', 'taunya@office.test', 'you'],
    ])
    expect(people().find((p) => p.name === 'Malachi')?.userId).toBe('u-malachi')
  })

  it('has no GC rows when the customer has no address and no contacts', () => {
    const rows = buildRecipientPeople({ gcName: 'Kestrin', gcEmail: '', contacts: [], users: [taunya], meId: null, accountManId: null })
    expect(rows.map((p) => p.group)).toEqual(['office'])
    expect(rows[0]?.tag).toBeUndefined()
  })
})

describe('the menu', () => {
  it('finds a person by address, and gives a typed address a row of its own', () => {
    expect(personForEmail(people(), ' Office@RLC.test ')?.name).toBe('RLC- Dunmere Mallin')
    expect(personForEmail(people(), 'someone@else.test')).toEqual({ email: 'someone@else.test', name: 'someone@else.test', group: 'typed' })
    expect(personForEmail(people(), 'not an address')).toBeNull()
    expect(withTypedAddress(people(), 'someone@else.test').slice(-1)[0]).toEqual({ email: 'someone@else.test', name: 'someone@else.test', group: 'typed' })
    expect(withTypedAddress(people(), 'office@rlc.test')).toHaveLength(people().length)
  })

  it('searches names and addresses, and offers a whole address nobody has as Use…', () => {
    expect(filterRecipientPeople(people(), 'ma').map((p) => p.name)).toEqual(['RLC- Dunmere Mallin', 'Malachi'])
    expect(filterRecipientPeople(people(), 'rlc.test')).toHaveLength(3)
    expect(typedAddressOffer(people(), 'bookkeeper@rlc.test')).toBe('bookkeeper@rlc.test')
    expect(typedAddressOffer(people(), 'ap@rlc.test')).toBeNull()
    expect(typedAddressOffer(people(), 'bookkeeper')).toBeNull()
  })

  it('reads each row for the To line and the Cc line', () => {
    const state = { toEmail: 'office@rlc.test', ccEmails: ['pm@rlc.test'], lockedCopyEmail: 'taunya@office.test' }
    const to = recipientRowsForLine('to', people(), state)
    expect(to.map((r) => [r.person.name, r.picked, r.held])).toEqual([
      ['RLC- Dunmere Mallin', true, null],
      ['Accounts payable', false, null],
      ['PM', false, null],
      ['Malachi', false, null],
      ['Roxi', false, null],
      ['Taunya', false, null],
    ])
    const cc = recipientRowsForLine('cc', people(), state)
    expect(cc.map((r) => [r.person.name, r.picked, r.held])).toEqual([
      ['RLC- Dunmere Mallin', false, 'on To'],
      ['Accounts payable', false, null],
      ['PM', true, null],
      ['Malachi', false, null],
      ['Roxi', false, null],
      ['Taunya', true, 'copied by Reply to'],
    ])
  })

  it('offers the reply to office people with an address, the signed-in person first', () => {
    expect(replyTakers([roxi, taunya, malachi, noAddress, helper], taunya.id).map((u) => u.name)).toEqual(['Taunya', 'Malachi', 'Roxi'])
  })

  it('refuses the eleventh Cc', () => {
    expect(ccAddRefusal(9)).toBeNull()
    expect(ccAddRefusal(10)).toBe('Up to 10 on the Cc line.')
  })
})

describe('lockedCopyEmail', () => {
  it('is the sender when replies go to someone else and she is not on the email yet', () => {
    expect(lockedCopyEmail({ sender: taunya, replyToPerson: malachi, toEmail: 'office@rlc.test', ccEmails: [] })).toBe('taunya@office.test')
  })

  it('is nothing when she takes the replies, or is on To or the Cc already', () => {
    expect(lockedCopyEmail({ sender: taunya, replyToPerson: null, toEmail: 'office@rlc.test', ccEmails: [] })).toBeNull()
    expect(lockedCopyEmail({ sender: taunya, replyToPerson: taunya, toEmail: 'office@rlc.test', ccEmails: [] })).toBeNull()
    expect(lockedCopyEmail({ sender: taunya, replyToPerson: malachi, toEmail: 'taunya@office.test', ccEmails: [] })).toBeNull()
    expect(lockedCopyEmail({ sender: taunya, replyToPerson: malachi, toEmail: 'office@rlc.test', ccEmails: ['taunya@office.test'] })).toBeNull()
  })

  it('is nothing when the Cc is full, as the send function then drops the copy', () => {
    const full = Array.from({ length: 10 }, (_, i) => `cc${i}@rlc.test`)
    expect(lockedCopyEmail({ sender: taunya, replyToPerson: malachi, toEmail: 'office@rlc.test', ccEmails: full })).toBeNull()
  })
})

describe('recipientReadback', () => {
  const base = { toName: 'RLC- Dunmere Mallin', replyToName: 'Malachi', replyIsMe: false, ccNames: [] as string[], copiesMe: true, scheduled: false }

  it('says who gets it, who gets the reply and who is copied', () => {
    expect(recipientReadback(base)).toBe('Goes to RLC- Dunmere Mallin. Their reply goes to Malachi. You get a copy.')
    expect(recipientReadback({ ...base, ccNames: ['Roxi'] })).toBe('Goes to RLC- Dunmere Mallin. Their reply goes to Malachi. Roxi and you get a copy.')
    expect(recipientReadback({ ...base, ccNames: ['Roxi', 'PM'], copiesMe: false })).toBe('Goes to RLC- Dunmere Mallin. Their reply goes to Malachi. Roxi and PM get a copy.')
    expect(recipientReadback({ ...base, ccNames: ['Roxi'], copiesMe: false })).toBe('Goes to RLC- Dunmere Mallin. Their reply goes to Malachi. Roxi gets a copy.')
    expect(recipientReadback({ ...base, replyIsMe: true, copiesMe: false })).toBe('Goes to RLC- Dunmere Mallin. Their reply comes to you.')
  })

  it('asks for a To when there is none, and says a scheduled send is rebuilt', () => {
    expect(recipientReadback({ ...base, toName: null })).toBe('Pick who gets the statement. It cannot send without a To.')
    expect(recipientReadback({ ...base, replyIsMe: true, copiesMe: false, scheduled: true })).toBe('Goes to RLC- Dunmere Mallin. Their reply comes to you. A scheduled send is rebuilt fresh when it goes out.')
  })
})
