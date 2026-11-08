import { describe, expect, it } from 'vitest'
import { TEXTS_OFF } from '../quo/textsSwitch'
import { courtesyGcChannels, courtesyOwnerChannels, OWNER_NOT_IN_MESSAGES, phoneChannelKey, textChannelFor } from './lienCourtesyContact'

/** The GC's channels for the courtesy notice, read without making a contact (punch list #243, PR 1). */

const ch = (id: string, kind: 'phone' | 'email', value: string, optedOutAt: string | null = null, usualAt: string | null = null) => ({ id, kind, value, optedOutAt, usualAt })

describe('phoneChannelKey — what the spine keeps as a phone channel', () => {
  it('keeps the digits, drops a leading 1 from eleven, and refuses fewer than seven', () => {
    expect(phoneChannelKey('(512) 555-0193')).toBe('5125550193')
    expect(phoneChannelKey('+1 512 555 0193')).toBe('5125550193')
    expect(phoneChannelKey('555-0193')).toBe('5550193')
    expect(phoneChannelKey('12345')).toBe('')
    expect(phoneChannelKey('call the office')).toBe('')
    expect(phoneChannelKey('')).toBe('')
    expect(phoneChannelKey(null)).toBe('')
  })
})

describe('courtesyGcChannels — with a Messages contact', () => {
  it('texts the live phone channel while Send texts is on', () => {
    const r = courtesyGcChannels({ contact: { id: 'c1', channels: [ch('e1', 'email', 'dana@ridgeway.example'), ch('p1', 'phone', '(512) 555-0193')] }, customerPhone: '', customerEmail: '', textsOn: true })
    expect(r).toEqual({ contactId: 'c1', phone: '(512) 555-0193', textHold: '', textChannelId: 'p1', email: 'dana@ridgeway.example' })
  })
  it('texts the usual number first, and the live one when the usual sent STOP (punch list #118, PR 2)', () => {
    const two = [ch('p1', 'phone', '(512) 555-0193'), ch('p2', 'phone', '(512) 555-0144', null, '2026-11-01T00:00:00Z')]
    expect(courtesyGcChannels({ contact: { id: 'c1', channels: two }, customerPhone: '', customerEmail: '', textsOn: true })).toMatchObject({ phone: '(512) 555-0144', textChannelId: 'p2' })
    const stoppedUsual = [ch('p1', 'phone', '(512) 555-0193'), ch('p2', 'phone', '(512) 555-0144', '2026-11-02T00:00:00Z', '2026-11-01T00:00:00Z')]
    expect(courtesyGcChannels({ contact: { id: 'c1', channels: stoppedUsual }, customerPhone: '', customerEmail: '', textsOn: true })).toMatchObject({ phone: '(512) 555-0193', textChannelId: 'p1', textHold: '' })
  })
  it('holds the number with the switch’s words while Send texts is off', () => {
    const r = courtesyGcChannels({ contact: { id: 'c1', channels: [ch('p1', 'phone', '(512) 555-0193')] }, customerPhone: '', customerEmail: '', textsOn: false })
    expect(r.phone).toBe('(512) 555-0193')
    expect(r.textHold).toBe(TEXTS_OFF)
    expect(r.textChannelId).toBeNull()
  })
  it('a number that sent STOP is shown and held; a contact with no number has none to text', () => {
    const stopped = courtesyGcChannels({ contact: { id: 'c1', channels: [ch('p1', 'phone', '(512) 555-0193', '2026-10-01T00:00:00Z')] }, customerPhone: '(512) 555-0100', customerEmail: '', textsOn: true })
    expect(stopped).toMatchObject({ contactId: 'c1', phone: '(512) 555-0193', textHold: 'they sent STOP', textChannelId: null })
    // The record's number is not read past an existing contact: the spine would not add it.
    const none = courtesyGcChannels({ contact: { id: 'c1', channels: [ch('e1', 'email', 'dana@ridgeway.example')] }, customerPhone: '(512) 555-0100', customerEmail: '', textsOn: true })
    expect(none).toEqual({ contactId: 'c1', phone: '', textHold: '', textChannelId: null, email: 'dana@ridgeway.example' })
  })
})

describe('courtesyGcChannels — no contact yet: the record’s number, nothing made', () => {
  it('plans the text on the record’s number with no contact and no channel, for the press to make', () => {
    const r = courtesyGcChannels({ contact: null, customerPhone: ' (512) 555-0100 ', customerEmail: ' office@ridgeway.example ', textsOn: true })
    expect(r).toEqual({ contactId: null, phone: '(512) 555-0100', textHold: '', textChannelId: null, email: 'office@ridgeway.example' })
  })
  it('holds it while Send texts is off, and plans no text on a number the spine would not keep', () => {
    expect(courtesyGcChannels({ contact: null, customerPhone: '(512) 555-0100', customerEmail: '', textsOn: false })).toMatchObject({ contactId: null, phone: '(512) 555-0100', textHold: TEXTS_OFF, textChannelId: null })
    expect(courtesyGcChannels({ contact: null, customerPhone: 'ask for Dana', customerEmail: '', textsOn: true })).toMatchObject({ contactId: null, phone: '', textHold: '', textChannelId: null })
    expect(courtesyGcChannels({ contact: null, customerPhone: '', customerEmail: '', textsOn: true })).toEqual({ contactId: null, phone: '', textHold: '', textChannelId: null, email: '' })
  })
})

describe('textChannelFor — the channel on the contact the press made', () => {
  it('finds the planned number by its key however it is written, else the first live number, else nothing', () => {
    const channels = [ch('e1', 'email', 'x@y.example'), ch('p0', 'phone', '(210) 555-0001'), ch('p1', 'phone', '512-555-0100')]
    expect(textChannelFor(channels, '+1 (512) 555-0100')?.id).toBe('p1')
    expect(textChannelFor(channels, '(830) 555-0000')?.id).toBe('p0')
    expect(textChannelFor([ch('p1', 'phone', '512-555-0100', '2026-10-01T00:00:00Z')], '512-555-0100')).toBeNull()
    expect(textChannelFor([], '512-555-0100')).toBeNull()
  })
})

describe('courtesyOwnerChannels — the owner of record’s number, texted only on a thread that already holds it (v2.6497)', () => {
  const novy = { id: 'c-novy', channels: [ch('e1', 'email', 'office@novy.example'), ch('p1', 'phone', '(512) 555-0142'), ch('p2', 'phone', '512-555-0199')] }
  it('nobody in Messages holds the number: the number shows, the hold says the email goes alone, and no contact is named to make', () => {
    expect(courtesyOwnerChannels({ contact: null, phone: '(512) 555-0142', textsOn: true })).toEqual({ contactId: null, textChannelId: null, phone: '(512) 555-0142', textHold: OWNER_NOT_IN_MESSAGES })
  })
  it('a contact holds the number: the text goes on the channel that carries it, not the contact’s first number', () => {
    expect(courtesyOwnerChannels({ contact: novy, phone: '512 555 0199', textsOn: true })).toEqual({ contactId: 'c-novy', textChannelId: 'p2', phone: '512 555 0199', textHold: '' })
  })
  it('the GC’s own holds apply: Send texts off, and a STOP on that number', () => {
    expect(courtesyOwnerChannels({ contact: novy, phone: '(512) 555-0142', textsOn: false })).toMatchObject({ contactId: 'c-novy', textChannelId: null, textHold: TEXTS_OFF })
    const stopped = { id: 'c-novy', channels: [ch('p1', 'phone', '(512) 555-0142', '2026-10-01T00:00:00Z')] }
    expect(courtesyOwnerChannels({ contact: stopped, phone: '(512) 555-0142', textsOn: true })).toMatchObject({ contactId: 'c-novy', textChannelId: null, textHold: 'they sent STOP' })
  })
  it('no number, or one the spine would keep no channel for, plans no text and names no hold — the plan says no number on the property record', () => {
    expect(courtesyOwnerChannels({ contact: null, phone: '', textsOn: true })).toEqual({ contactId: null, textChannelId: null, phone: '', textHold: '' })
    expect(courtesyOwnerChannels({ contact: novy, phone: 'call the office', textsOn: true })).toEqual({ contactId: null, textChannelId: null, phone: '', textHold: '' })
    // A contact found for the number that somehow does not carry it is no door either.
    expect(courtesyOwnerChannels({ contact: { id: 'c-x', channels: [ch('p9', 'phone', '(210) 555-0000')] }, phone: '(512) 555-0142', textsOn: true })).toMatchObject({ contactId: null, textHold: OWNER_NOT_IN_MESSAGES })
  })
})
