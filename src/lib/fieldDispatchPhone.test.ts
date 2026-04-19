import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FIELD_DISPATCH_DISPLAY,
  DEFAULT_FIELD_DISPATCH_TEL,
  parseFieldDispatchPhoneFromValueText,
} from './fieldDispatchPhone'

describe('parseFieldDispatchPhoneFromValueText', () => {
  it('uses defaults when null, empty, or non-digits', () => {
    expect(parseFieldDispatchPhoneFromValueText(null)).toEqual({
      telHref: DEFAULT_FIELD_DISPATCH_TEL,
      display: DEFAULT_FIELD_DISPATCH_DISPLAY,
    })
    expect(parseFieldDispatchPhoneFromValueText('')).toEqual({
      telHref: DEFAULT_FIELD_DISPATCH_TEL,
      display: DEFAULT_FIELD_DISPATCH_DISPLAY,
    })
    expect(parseFieldDispatchPhoneFromValueText('   ')).toEqual({
      telHref: DEFAULT_FIELD_DISPATCH_TEL,
      display: DEFAULT_FIELD_DISPATCH_DISPLAY,
    })
    expect(parseFieldDispatchPhoneFromValueText('abc')).toEqual({
      telHref: DEFAULT_FIELD_DISPATCH_TEL,
      display: DEFAULT_FIELD_DISPATCH_DISPLAY,
    })
  })

  it('formats US 10-digit with spaces and +1 tel', () => {
    expect(parseFieldDispatchPhoneFromValueText('5123600599')).toEqual({
      telHref: '+15123600599',
      display: '512 360 0599',
    })
    expect(parseFieldDispatchPhoneFromValueText('512 360 0599')).toEqual({
      telHref: '+15123600599',
      display: '512 360 0599',
    })
  })

  it('normalizes US 11-digit starting with 1', () => {
    expect(parseFieldDispatchPhoneFromValueText('15123600599')).toEqual({
      telHref: '+15123600599',
      display: '512 360 0599',
    })
    expect(parseFieldDispatchPhoneFromValueText('+15123600599')).toEqual({
      telHref: '+15123600599',
      display: '512 360 0599',
    })
  })

  it('preserves leading + for other lengths', () => {
    expect(parseFieldDispatchPhoneFromValueText('+44 20 7946 0958')).toEqual({
      telHref: '+442079460958',
      display: '+44 20 7946 0958',
    })
  })
})
