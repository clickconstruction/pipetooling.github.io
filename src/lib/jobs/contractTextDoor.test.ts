import { describe, expect, it } from 'vitest'
import type { Contact } from '../contacts/kernel'
import {
  addNumberChipWords,
  addNumberNote,
  contactLeadingWith,
  contractSignTextWords,
  contractSignedTextWords,
  numberAddedWords,
  textDoorNumber,
  textOnFileWords,
  typedNumberOnContact,
} from './contractTextDoor'

const sam: Contact = {
  id: 'c-sam',
  kind: 'customer',
  name: 'Sam Sample',
  goesBy: null,
  company: '',
  record: { table: 'customers', id: 'cust-sam' },
  channels: [
    { id: 'ch-home', kind: 'phone', value: '(512) 555-0100', optedOutAt: null },
    { id: 'ch-email', kind: 'email', value: 'sam@example.com', optedOutAt: null },
    { id: 'ch-cell', kind: 'phone', value: '512-555-0199', optedOutAt: null },
  ],
  jobIds: [],
  defaultJobId: null,
  customerId: 'cust-sam',
  gcCompanyId: null,
}

describe('contractTextDoor', () => {
  it('the words are the sms: door’s, the address or "your project", then the link', () => {
    expect(contractSignTextWords('12 Oak St', 'https://a.example/sign?t=1')).toBe('Here is your service agreement for 12 Oak St — review and sign here: https://a.example/sign?t=1')
    expect(contractSignTextWords('  ', 'https://a.example/sign?t=1')).toBe('Here is your service agreement for your project — review and sign here: https://a.example/sign?t=1')
    expect(contractSignedTextWords(null, 'https://a.example/sign?t=2')).toBe('Here is your signed agreement for your project: https://a.example/sign?t=2')
  })

  it('finds the typed number on the contact as the spine compares, ten digits, however it was typed', () => {
    expect(typedNumberOnContact(sam, '+1 512 555 0199')?.id).toBe('ch-cell')
    expect(typedNumberOnContact(sam, '5125550100')?.id).toBe('ch-home')
    expect(typedNumberOnContact(sam, '512-555-0123')).toBeNull()
    expect(typedNumberOnContact(sam, '')).toBeNull()
    expect(typedNumberOnContact(sam, 'sam@example.com')).toBeNull()
  })

  it('puts the window’s number first so the box texts it, and leaves a contact alone for a channel it does not have', () => {
    expect(contactLeadingWith(sam, 'ch-cell').channels.map((c) => c.id)).toEqual(['ch-cell', 'ch-home', 'ch-email'])
    expect(contactLeadingWith(sam, 'ch-home').channels.map((c) => c.id)).toEqual(['ch-home', 'ch-email', 'ch-cell'])
    expect(contactLeadingWith(sam, 'ch-nope')).toBe(sam)
    expect(contactLeadingWith(sam, null)).toBe(sam)
  })

  it('the door’s number: none typed, on file, or not on file with the numbers on file offered beside the chip', () => {
    expect(textDoorNumber(sam, '')).toEqual({ kind: 'none' })
    expect(textDoorNumber(sam, 'not a number')).toEqual({ kind: 'none' })
    expect(textDoorNumber(sam, '512.555.0199')).toEqual({ kind: 'onFile', channel: sam.channels[2] })
    const missing = textDoorNumber(sam, ' (512) 555-0123 ')
    expect(missing.kind).toBe('notOnFile')
    if (missing.kind !== 'notOnFile') throw new Error('expected notOnFile')
    expect(missing.typed).toBe('(512) 555-0123')
    expect(missing.onFile.map((c) => c.id)).toEqual(['ch-home', 'ch-cell'])
  })

  it('a number that sent STOP is not offered beside the chip', () => {
    const stopped: Contact = { ...sam, channels: sam.channels.map((c) => (c.id === 'ch-home' ? { ...c, optedOutAt: '2026-10-01T00:00:00Z' } : c)) }
    const missing = textDoorNumber(stopped, '512-555-0123')
    if (missing.kind !== 'notOnFile') throw new Error('expected notOnFile')
    expect(missing.onFile.map((c) => c.id)).toEqual(['ch-cell'])
  })

  it('the chip, the note, the quiet press and the toast name the number and the person', () => {
    expect(addNumberChipWords('Sam', ' (512) 555-0123 ')).toBe('Add (512) 555-0123 to Sam’s contact')
    expect(addNumberNote('Sam', '(512) 555-0123')).toBe('(512) 555-0123 is not on Sam’s contact yet, so the company number cannot text it.')
    expect(textOnFileWords({ value: '512-555-0199' })).toBe('Text 512-555-0199 instead')
    expect(numberAddedWords('Sam', '(512) 555-0123')).toBe('(512) 555-0123 added to Sam’s contact.')
  })
})
