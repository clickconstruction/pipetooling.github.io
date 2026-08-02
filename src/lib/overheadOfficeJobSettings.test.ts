import { describe, expect, it } from 'vitest'
import { parseOverheadOfficeJobLedgerId } from './overheadOfficeJobSettings'

describe('parseOverheadOfficeJobLedgerId', () => {
  const uuid = '11111111-1111-4111-8111-111111111111'

  it('returns a valid uuid unchanged', () => {
    expect(parseOverheadOfficeJobLedgerId(uuid)).toBe(uuid)
  })

  it('trims surrounding whitespace', () => {
    expect(parseOverheadOfficeJobLedgerId(`  ${uuid}\n`)).toBe(uuid)
  })

  it('accepts uppercase hex (case-insensitive uuid regex)', () => {
    expect(parseOverheadOfficeJobLedgerId(uuid.toUpperCase())).toBe(uuid.toUpperCase())
  })

  it('returns null for null / undefined / empty / blank', () => {
    expect(parseOverheadOfficeJobLedgerId(null)).toBe(null)
    expect(parseOverheadOfficeJobLedgerId(undefined)).toBe(null)
    expect(parseOverheadOfficeJobLedgerId('')).toBe(null)
    expect(parseOverheadOfficeJobLedgerId('   ')).toBe(null)
  })

  it('returns null for non-uuid junk (stale/corrupt app_settings values)', () => {
    expect(parseOverheadOfficeJobLedgerId('not-a-uuid')).toBe(null)
    expect(parseOverheadOfficeJobLedgerId('12345')).toBe(null)
    // uuid with a trailing character
    expect(parseOverheadOfficeJobLedgerId(`${uuid}x`)).toBe(null)
    // version nibble outside 1-5
    expect(parseOverheadOfficeJobLedgerId('11111111-1111-9111-8111-111111111111')).toBe(null)
  })
})
