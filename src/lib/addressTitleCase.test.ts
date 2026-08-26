import { describe, expect, it } from 'vitest'
import { titleCaseAddress } from './addressTitleCase'

describe('titleCaseAddress', () => {
  it('capitalizes lowercase addresses', () => {
    expect(titleCaseAddress('11704 fm 1117 seguin tx 78155')).toBe('11704 FM 1117 Seguin TX 78155')
    expect(titleCaseAddress('9619 bricewood post san antonio, tx 78254')).toBe(
      '9619 Bricewood Post San Antonio, TX 78254',
    )
  })

  it('tames ALL-CAPS addresses', () => {
    expect(titleCaseAddress('823 ARION PARKWAY SAN ANTONIO TX 78216')).toBe('823 Arion Parkway San Antonio TX 78216')
    expect(titleCaseAddress('906 N. GOLIAD ST. ROCKWALL TX 75087')).toBe('906 N. Goliad St. Rockwall TX 75087')
  })

  it('leaves deliberate mixed case alone', () => {
    expect(titleCaseAddress('157 Koepsel Rd, McQueeney, TX 78123')).toBe('157 Koepsel Rd, McQueeney, TX 78123')
    expect(titleCaseAddress("12 O'Brien Way")).toBe("12 O'Brien Way")
  })

  it('fixes Mc and apostrophe names when case-folding is needed', () => {
    expect(titleCaseAddress('157 koepsel rd mcqueeney tx')).toBe('157 Koepsel Rd McQueeney TX')
    expect(titleCaseAddress("12 o'brien way")).toBe("12 O'Brien Way")
  })

  it('keeps road-system and directional abbreviations uppercase', () => {
    expect(titleCaseAddress('20076 blanco rd, san antonio, tx 78258')).toBe('20076 Blanco Rd, San Antonio, TX 78258')
    expect(titleCaseAddress('7218 n loop 1604 e san antonio')).toBe('7218 N Loop 1604 E San Antonio')
    expect(titleCaseAddress('3030 ih-10 w new braunfels')).toBe('3030 IH-10 W New Braunfels')
    expect(titleCaseAddress('13519 us 290 austin')).toBe('13519 US 290 Austin')
    expect(titleCaseAddress('11730 tx-29 liberty hill')).toBe('11730 TX-29 Liberty Hill')
  })

  it('handles glued road numbers, ordinals, and suite letters', () => {
    expect(titleCaseAddress('11704 fm1117 seguin')).toBe('11704 FM1117 Seguin')
    expect(titleCaseAddress('3939 i35 south space 735')).toBe('3939 I35 South Space 735')
    expect(titleCaseAddress('10370 5TH e 498 universal city')).toBe('10370 5th E 498 Universal City')
    expect(titleCaseAddress('150 e sonterra blvd 200b san antonio')).toBe('150 E Sonterra Blvd 200B San Antonio')
  })

  it('keeps connective words small except at the start', () => {
    expect(titleCaseAddress('501 ranch to market rd 3237 wimberley')).toBe('501 Ranch to Market Rd 3237 Wimberley')
    expect(titleCaseAddress('501 RANCH TO MARKET RD 3237 WIMBERLEY')).toBe('501 Ranch to Market Rd 3237 Wimberley')
  })

  it('passes numbers, blanks, and punctuation through', () => {
    expect(titleCaseAddress('')).toBe('')
    expect(titleCaseAddress('12925 FM 20, Kingsbury, TX 78638')).toBe('12925 FM 20, Kingsbury, TX 78638')
  })

  it('pattern rules survive adjacent punctuation (the sweep dry-run regression)', () => {
    expect(titleCaseAddress('11704 FM1117, Seguin, TX 78155')).toBe('11704 FM1117, Seguin, TX 78155')
    expect(titleCaseAddress('150 E Sonterra Blvd 200B, San Antonio, TX 78258')).toBe(
      '150 E Sonterra Blvd 200B, San Antonio, TX 78258',
    )
    expect(titleCaseAddress('11704 fm1117, seguin')).toBe('11704 FM1117, Seguin')
    expect(titleCaseAddress('(lockbox 4460)')).toBe('(Lockbox 4460)')
  })
})
