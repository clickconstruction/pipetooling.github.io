import { describe, it, expect } from 'vitest'
import { formatPayRunDay, formatSubPortalDate, subPortalT } from './subPortalI18n'

describe('subPortalT', () => {
  it('returns both languages and interpolates tokens', () => {
    expect(subPortalT('en', 'owedToYou')).toBe('Owed to you')
    expect(subPortalT('es', 'owedToYou')).toBe('Se le debe')
    expect(subPortalT('en', 'payableAfter', { date: 'Sep 9, 2026' })).toBe('Payable after Sep 9, 2026')
    expect(subPortalT('es', 'docSigned', { date: '2 sep 2026' })).toBe('Firmado el 2 sep 2026')
  })
})

describe('formatSubPortalDate', () => {
  it('formats per language', () => {
    expect(formatSubPortalDate('2026-09-05', 'en')).toBe('Sep 5, 2026')
    expect(formatSubPortalDate('2026-09-05', 'es')).toBe('5 sep 2026')
  })
  it('echoes malformed input', () => {
    expect(formatSubPortalDate('soon', 'en')).toBe('soon')
    expect(formatSubPortalDate(null, 'es')).toBe('')
    expect(formatSubPortalDate('2026-13-05', 'en')).toBe('2026-13-05')
  })
})

describe('formatPayRunDay', () => {
  it('maps day keys per language, null on unknown', () => {
    expect(formatPayRunDay('friday', 'en')).toBe('Friday')
    expect(formatPayRunDay(' Friday ', 'es')).toBe('viernes')
    expect(formatPayRunDay('someday', 'en')).toBeNull()
    expect(formatPayRunDay(null, 'es')).toBeNull()
  })
})
