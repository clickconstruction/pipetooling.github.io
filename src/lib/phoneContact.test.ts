import { describe, expect, it } from 'vitest'
import { phoneContact, telHrefFor } from './phoneContact'

describe('phoneContact', () => {
  it('US ten digits, with any punctuation, become +1 tel/sms and (xxx) xxx-xxxx display', () => {
    expect(phoneContact('512-555-0142')).toEqual({
      telHref: 'tel:+15125550142',
      smsHref: 'sms:+15125550142',
      display: '(512) 555-0142',
      e164: '+15125550142',
    })
    expect(phoneContact('1 (512) 555 0142')?.e164).toBe('+15125550142')
  })
  it('other lengths dial the digits as typed and display as typed; + is kept', () => {
    expect(phoneContact('+44 20 7946 0958')).toEqual({
      telHref: 'tel:+442079460958',
      smsHref: 'sms:+442079460958',
      display: '+44 20 7946 0958',
      e164: '+442079460958',
    })
  })
  it('null for blanks and anything under seven digits', () => {
    expect(phoneContact('')).toBeNull()
    expect(phoneContact(null)).toBeNull()
    expect(phoneContact('call me')).toBeNull()
    expect(phoneContact('12345')).toBeNull()
  })
})

describe('telHrefFor (the tel: sweep)', () => {
  it('dials a US number as +1 and an international one as typed', () => {
    expect(telHrefFor('(512) 555-0142')).toBe('tel:+15125550142')
    expect(telHrefFor('1 512 555 0142')).toBe('tel:+15125550142')
    expect(telHrefFor('+44 20 7946 0958')).toBe('tel:+442079460958')
  })

  it('falls back to the typed digits for anything under seven, never a blank href change', () => {
    expect(telHrefFor('555-01')).toBe('tel:55501')
    expect(telHrefFor('')).toBe('tel:')
    expect(telHrefFor(null)).toBe('tel:')
  })
})
