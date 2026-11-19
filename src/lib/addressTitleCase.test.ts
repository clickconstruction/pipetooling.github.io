import { describe, expect, it } from 'vitest'
import { titleCaseAddress } from './addressTitleCase'

describe('titleCaseAddress', () => {
  it('capitalizes lowercase addresses', () => {
    expect(titleCaseAddress('29007 fm 1117 seguin tx 78155')).toBe('29007 FM 1117 Seguin TX 78155')
    expect(titleCaseAddress('2700 bosworth post san antonio, tx 78254')).toBe(
      '2700 Bosworth Post San Antonio, TX 78254',
    )
  })

  it('tames ALL-CAPS addresses', () => {
    expect(titleCaseAddress('754 ANSLEY PARKWAY SAN ANTONIO TX 78216')).toBe('754 Ansley Parkway San Antonio TX 78216')
    expect(titleCaseAddress('253 N. GADSDEN ST. ROCKWALL TX 75087')).toBe('253 N. Gadsden St. Rockwall TX 75087')
  })

  it('leaves deliberate mixed case alone', () => {
    expect(titleCaseAddress('435 Knowles Rd, McQueeney, TX 78123')).toBe('435 Knowles Rd, McQueeney, TX 78123')
    expect(titleCaseAddress("12 O'Brien Way")).toBe("12 O'Brien Way")
  })

  it('fixes Mc and apostrophe names when case-folding is needed', () => {
    expect(titleCaseAddress('435 knowles rd mcqueeney tx')).toBe('435 Knowles Rd McQueeney TX')
    expect(titleCaseAddress("12 o'brien way")).toBe("12 O'Brien Way")
  })

  it('keeps road-system and directional abbreviations uppercase', () => {
    expect(titleCaseAddress('58786 bexley rd, san antonio, tx 78258')).toBe('58786 Bexley Rd, San Antonio, TX 78258')
    expect(titleCaseAddress('6153 n loop 1604 e san antonio')).toBe('6153 N Loop 1604 E San Antonio')
    expect(titleCaseAddress('5493 ih-10 w new braunfels')).toBe('5493 IH-10 W New Braunfels')
    expect(titleCaseAddress('41892 us 290 austin')).toBe('41892 US 290 Austin')
    expect(titleCaseAddress('60305 tx-29 liberty hill')).toBe('60305 TX-29 Liberty Hill')
  })

  it('handles glued road numbers, ordinals, and suite letters', () => {
    expect(titleCaseAddress('29007 fm1117 seguin')).toBe('29007 FM1117 Seguin')
    expect(titleCaseAddress('8874 i35 south space 735')).toBe('8874 I35 South Space 735')
    expect(titleCaseAddress('76810 5TH e 498 universal city')).toBe('76810 5th E 498 Universal City')
    expect(titleCaseAddress('150 e sonmere blvd 200b san antonio')).toBe('150 E Sonmere Blvd 200B San Antonio')
  })

  it('keeps connective words small except at the start', () => {
    expect(titleCaseAddress('756 ranch to market rd 3237 wimberley')).toBe('756 Ranch to Market Rd 3237 Wimberley')
    expect(titleCaseAddress('756 RANCH TO MARKET RD 3237 WIMBERLEY')).toBe('756 Ranch to Market Rd 3237 Wimberley')
  })

  it('passes numbers, blanks, and punctuation through', () => {
    expect(titleCaseAddress('')).toBe('')
    expect(titleCaseAddress('12925 FM 20, Kingsbury, TX 78638')).toBe('12925 FM 20, Kingsbury, TX 78638')
  })

  it('pattern rules survive adjacent punctuation (the sweep dry-run regression)', () => {
    expect(titleCaseAddress('29007 FM1117, Seguin, TX 78155')).toBe('29007 FM1117, Seguin, TX 78155')
    expect(titleCaseAddress('150 E Sonmere Blvd 200B, San Antonio, TX 78258')).toBe(
      '150 E Sonmere Blvd 200B, San Antonio, TX 78258',
    )
    expect(titleCaseAddress('29007 fm1117, seguin')).toBe('29007 FM1117, Seguin')
    expect(titleCaseAddress('(lockbox 4460)')).toBe('(Lockbox 4460)')
  })
})
