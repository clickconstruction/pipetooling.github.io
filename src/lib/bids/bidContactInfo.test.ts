import { describe, expect, it } from 'vitest'
import { extractContactInfo, formatAddressWithoutZip } from './bidContactInfo'

describe('extractContactInfo', () => {
  it('returns blanks for null', () => {
    expect(extractContactInfo(null)).toEqual({ phone: '', email: '' })
  })

  it('reads string phone and email from an object', () => {
    expect(extractContactInfo({ phone: '512-555-0100', email: 'a@b.com' })).toEqual({
      phone: '512-555-0100',
      email: 'a@b.com',
    })
  })

  it('ignores non-string fields', () => {
    expect(extractContactInfo({ phone: 123, email: null } as never)).toEqual({ phone: '', email: '' })
  })

  it('returns blanks for primitive (non-object) JSON', () => {
    expect(extractContactInfo('nope' as never)).toEqual({ phone: '', email: '' })
  })
})

describe('formatAddressWithoutZip', () => {
  it('returns empty string for null', () => {
    expect(formatAddressWithoutZip(null)).toBe('')
  })

  it('drops a trailing zip-like token', () => {
    expect(formatAddressWithoutZip('123 Main St, Austin, TX 78731')).toBe('123 Main St, Austin, TX')
  })

  it('keeps the address when the last token is not zip-like', () => {
    expect(formatAddressWithoutZip('123 Main St, Austin, Texas')).toBe('123 Main St, Austin, Texas')
  })
})
