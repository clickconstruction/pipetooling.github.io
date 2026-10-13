import { describe, expect, it } from 'vitest'
import { contactById } from '../contacts/kernel'
import { contactFromRows, contactsFromRows, type ContactRecordRows, type ContactRow } from '../contacts/load'
import { PORTAL_SPANISH_ON } from '../gc/portalI18n'
import { plainWordsFailures } from '../plainWords'
import { customerLang, languageWords, lineFor, type QuickLineWords } from './customerLang'
import { SPINE_CHANNELS, SPINE_CONTACTS, SPINE_JOBS, SPINE_RECORDS } from './spineRows'

// The spine's seed people (made up, never a real row), with Cibolo Creek Partners reading Spanish: Elena is a person at
// Cibolo, Bell Family Dental is a customer that is its own person, and Hillside is a trade partner.
const RECORDS: ContactRecordRows = {
  ...SPINE_RECORDS,
  customers: (SPINE_RECORDS.customers ?? []).map((c) => (c.id === 'cust-cibolo' ? { ...c, language: 'es' } : c.id === 'cust-bell' ? { ...c, language: null } : c)),
}
const loaded = contactsFromRows(SPINE_CONTACTS, SPINE_CHANNELS, SPINE_JOBS, RECORDS)
const who = (id: string) => contactById(loaded, id)!

// The on-the-way quick reply in both languages, as card 16 shows it, and one the office has not put in Spanish yet.
const ON_THE_WAY: QuickLineWords = {
  text: 'Dana, this is Luis with Click Plumbing. We are on our way.',
  textEs: 'Dana, le habla Luis de Click Plumbing. Vamos en camino.',
}
const NO_SPANISH: QuickLineWords = { text: 'Your invoice is ready.', textEs: null }

describe('a customer’s language, read from their customer’s row', () => {
  it('reaches a person at a Spanish customer', () => {
    expect(who('c-elena').lang).toBe('es')
  })

  it('leaves it unset for a customer whose row says nothing, and for a trade partner or an architect', () => {
    expect(who('c-bell').lang).toBeUndefined()
    expect(who('c-greg').lang).toBeUndefined()
    expect(who('c-jonah').lang).toBeUndefined()
    expect(who('c-unknown').lang).toBeUndefined()
  })

  it('never guesses from a name', () => {
    const row: ContactRow = { ...SPINE_CONTACTS.find((r) => r.id === 'c-bell')!, id: 'c-jose', customer_id: 'cust-garcia' }
    const records: ContactRecordRows = { customers: [{ id: 'cust-garcia', name: 'José García' }] }
    const jose = contactFromRows(row, [], [], records)!
    expect(jose.name).toBe('José García')
    expect(jose.lang).toBeUndefined()
    expect(customerLang(jose, true)).toBe('en')
  })

  it('reads a value the check would refuse as English', () => {
    const records: ContactRecordRows = { customers: [{ id: 'cust-bell', name: 'Bell Family Dental', language: 'fr' }] }
    expect(contactFromRows(SPINE_CONTACTS.find((r) => r.id === 'c-bell')!, [], [], records)!.lang).toBeUndefined()
  })
})

describe('the words a Spanish customer gets', () => {
  it('Spanish when the gate is open, English while it is shut', () => {
    expect(customerLang(who('c-elena'), true)).toBe('es')
    expect(customerLang(who('c-elena'), false)).toBe('en')
    expect(lineFor(ON_THE_WAY, who('c-elena'), true)).toBe('Dana, le habla Luis de Click Plumbing. Vamos en camino.')
    expect(lineFor(ON_THE_WAY, who('c-elena'), false)).toBe('Dana, this is Luis with Click Plumbing. We are on our way.')
  })

  it('holds Spanish behind the portal’s gate by default', () => {
    expect(PORTAL_SPANISH_ON).toBe(false)
    expect(customerLang(who('c-elena'))).toBe('en')
    expect(lineFor(ON_THE_WAY, who('c-elena'))).toBe(ON_THE_WAY.text)
  })

  it('a line with no Spanish goes in English', () => {
    expect(lineFor(NO_SPANISH, who('c-elena'), true)).toBe('Your invoice is ready.')
    expect(lineFor({ ...ON_THE_WAY, textEs: '   ' }, who('c-elena'), true)).toBe(ON_THE_WAY.text)
  })

  it('an English customer gets English with the gate open', () => {
    expect(customerLang(who('c-bell'), true)).toBe('en')
    expect(lineFor(ON_THE_WAY, who('c-bell'), true)).toBe(ON_THE_WAY.text)
  })
})

describe('the customer card’s field', () => {
  it('says what the record keeps, whatever the gate', () => {
    expect(languageWords(who('c-elena'))).toBe('Reads Spanish')
    expect(languageWords(who('c-bell'))).toBe('Reads English')
    expect([languageWords(who('c-elena')), languageWords(who('c-bell'))].flatMap(plainWordsFailures)).toEqual([])
  })
})
