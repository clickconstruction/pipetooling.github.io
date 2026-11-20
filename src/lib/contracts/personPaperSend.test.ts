/**
 * Sending a person's paper to sign: who the email goes to by default, who it is from, what an address must look like,
 * and what the app says once the send comes back. Every name and address here is made up.
 */
import { describe, expect, it } from 'vitest'
import { initialSignerName, onePersonIdForName, rosterEmailForName, sendWindowSender, sentToastWords, signerEmailRefusal, signerNameRefusal } from './personPaperSend'

const people = [
  { id: 'p1', name: 'Priya Nair', email: ' priya@example.com ' },
  { id: 'p2', name: 'Bryce Tolland', email: null },
  { id: 'p3', name: 'Dana Ortiz', email: 'dana@example.com' },
  { id: 'p4', name: 'Dana Ortiz', email: 'other@example.com' },
]
const users = [
  { id: 'u1', name: 'Bryce Tolland', email: 'bryce@example.com' },
  { id: 'u2', name: 'Grace Hale', email: 'grace@example.com' },
  { id: 'u3', name: 'No Address', email: null },
]

describe('rosterEmailForName', () => {
  it('takes the roster’s address for the name, trimmed', () => {
    expect(rosterEmailForName(' Priya Nair ', people, users)).toBe('priya@example.com')
  })
  it('falls back to a login of that name when the roster has no address', () => {
    expect(rosterEmailForName('Bryce Tolland', people, users)).toBe('bryce@example.com')
  })
  it('answers nothing for a name nobody has, and for no name', () => {
    expect(rosterEmailForName('Nobody Here', people, users)).toBe('')
    expect(rosterEmailForName('  ', people, users)).toBe('')
  })
})

describe('onePersonIdForName', () => {
  it('answers the person only when the name finds exactly one', () => {
    expect(onePersonIdForName('Priya Nair', people)).toBe('p1')
    expect(onePersonIdForName('Dana Ortiz', people)).toBeNull()
    expect(onePersonIdForName('Nobody Here', people)).toBeNull()
    expect(onePersonIdForName('', people)).toBeNull()
  })
})

describe('sendWindowSender', () => {
  it('is the signed-in staff member with their address, or nobody', () => {
    expect(sendWindowSender('u2', users)).toEqual({ name: 'Grace Hale', email: 'grace@example.com' })
    expect(sendWindowSender('u3', users)).toBeNull()
    expect(sendWindowSender('gone', users)).toBeNull()
    expect(sendWindowSender(null, users)).toBeNull()
  })
})

describe('signerEmailRefusal', () => {
  it('refuses no address and one that does not look like an address, in the window’s words', () => {
    expect(signerEmailRefusal('   ')).toBe('Enter a valid signer email.')
    expect(signerEmailRefusal('not-an-email')).toBe('Enter a valid email address.')
    expect(signerEmailRefusal('a b@c.d')).toBe('Enter a valid email address.')
    expect(signerEmailRefusal(' priya@example.com ')).toBeNull()
  })
})

describe('sentToastWords', () => {
  it('says the email went', () => {
    expect(sentToastWords({ acceptUrl: 'https://x/contract/accept?t=1', emailed: true, emailNote: null })).toEqual({ words: 'Signing link emailed.', tone: 'success' })
  })
  it('hands the link over when the mail did not go', () => {
    expect(sentToastWords({ acceptUrl: 'https://x/contract/accept?t=1', emailed: false, emailNote: 'Resend 500' })).toEqual({ words: 'Link ready — https://x/contract/accept?t=1', tone: 'info' })
  })
  it('says a link was made when nothing else is known', () => {
    expect(sentToastWords({ acceptUrl: null, emailed: false, emailNote: null })).toEqual({ words: 'Signing link created.', tone: 'info' })
  })
})

describe('who signs', () => {
  it('a send needs somebody named to sign', () => {
    expect(signerNameRefusal('Priya Nair')).toBeNull()
    expect(signerNameRefusal('   ')).toBe('Enter the name of the person who signs.')
    expect(signerNameRefusal('')).toBe('Enter the name of the person who signs.')
  })

  it('the box opens on the signer the paper kept, else on the person it is filed under', () => {
    expect(initialSignerName(' Luis Ortega ', 'Ortega Mechanical')).toBe('Luis Ortega')
    expect(initialSignerName('', ' Priya Nair ')).toBe('Priya Nair')
    expect(initialSignerName(undefined, 'Priya Nair')).toBe('Priya Nair')
    expect(initialSignerName(null, null)).toBe('')
  })

  it('a stored name is never a signer: the box opens empty', () => {
    expect(initialSignerName('', 'gc-company:3f2b7c1e-0a4d-4e8b-9c6f-1d2e3a4b5c6d')).toBe('')
    expect(initialSignerName(undefined, 'party:3f2b7c1e-0a4d-4e8b-9c6f-1d2e3a4b5c6d')).toBe('')
  })
})
