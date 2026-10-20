import { describe, expect, it } from 'vitest'
import { WINDOW_ZONE_MM, isMailShortCode, mailOpenCodeFrom, mailOpenDisplay, mailOpenUrl, mailShortCode, windowAddressLines } from './windowEnvelope'

describe('the window envelope (the Docsmit train, PR 4)', () => {
  it('the window lines: the company or the person, the street, a suite, City, ST ZIP; blanks fall out', () => {
    expect(windowAddressLines({ name: '', organization: 'ATI Schertz Holdings LLC', address1: '17300 IH 35 N', address2: '', city: 'Schertz', state: 'TX', postalCode: '78154' })).toEqual(['ATI Schertz Holdings LLC', '17300 IH 35 N', 'Schertz, TX 78154'])
    expect(windowAddressLines({ name: 'John A. Backham', organization: '', address1: '9993 IH 10 West', address2: 'Suite 102', city: 'San Antonio', state: 'tx', postalCode: '78230-1234' })).toEqual(['John A. Backham', '9993 IH 10 West', 'Suite 102', 'San Antonio, TX 78230-1234'])
    expect(windowAddressLines({ name: '', organization: '', address1: '', address2: '', city: '', state: '', postalCode: '' })).toEqual([])
    expect(WINDOW_ZONE_MM.top + WINDOW_ZONE_MM.height).toBeLessThan(100)
  })

  it('a short code is eight unmistakable characters, and only such a code is read back', () => {
    let n = 0
    const code = mailShortCode(() => ((n += 0.13) % 1))
    expect(code).toHaveLength(8)
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/)
    expect(isMailShortCode(code)).toBe(true)
    expect(mailShortCode()).not.toBe(mailShortCode())
    expect(isMailShortCode('abc')).toBe(false)
    expect(isMailShortCode('ABCD-234')).toBe(false)
  })

  it('the link the QR carries is the bill’s pay page with the piece’s code; the pay page reads the code off its address', () => {
    expect(mailOpenUrl('https://clicktooling.com/pay/8f3c2a1e-6b7d-4c9a-9e21-5d0f7a3b1c44', 'KX7M2QRT')).toBe('https://clicktooling.com/pay/8f3c2a1e-6b7d-4c9a-9e21-5d0f7a3b1c44?m=KX7M2QRT')
    expect(mailOpenDisplay('https://clicktooling.com/pay/abc', 'KX7M2QRT')).toBe('clicktooling.com/pay/abc?m=KX7M2QRT')
    expect(mailOpenCodeFrom('?m=kx7m2qrt')).toBe('KX7M2QRT')
    expect(mailOpenCodeFrom('m=KX7M2QRT&x=1')).toBe('KX7M2QRT')
    expect(mailOpenCodeFrom('')).toBeNull()
    expect(mailOpenCodeFrom('?m=no')).toBeNull()
    expect(mailOpenCodeFrom('?m=../etc')).toBeNull()
  })
})
