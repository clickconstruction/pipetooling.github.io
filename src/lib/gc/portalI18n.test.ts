
import { describe, expect, it } from 'vitest'
import { PORTAL_KEYS, pDate, pWeekday, portalString, pt } from './portalI18n'

const blanks = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('the portal in two languages', () => {
  it('has English and Spanish for every key, with the same blanks', () => {
    const wrong = PORTAL_KEYS.filter((key) => {
      const { en, es } = portalString(key)
      return en.trim() === '' || es.trim() === '' || blanks(en).join() !== blanks(es).join()
    })
    expect(wrong).toEqual([])
  })

  it('fills the blanks', () => {
    expect(pt('es', 'todoDraw', { gc: 'Click', amount: '$92,000', project: 'Fair Oaks' })).toBe('Puede pedirle a Click $92,000 de Fair Oaks.')
  })

  it('writes dates the Spanish way', () => {
    expect(pDate('es', '2026-10-08')).toBe('8 oct')
    expect(pWeekday('es', '2026-10-08')).toBe('jue 8 oct')
    expect(pWeekday('en', '2026-10-08')).toBe('Thu Oct 8')
  })

  it('says late and the day they gave on the chip (owner, 2026-10-04)', () => {
    expect(pt('en', 'chipDayPassed', { date: pDate('en', '2026-09-30') })).toBe('late: you said Sep 30')
    expect(pt('es', 'chipDayPassed', { date: pDate('es', '2026-09-30') })).toBe('atrasado: dijo el 30 sep')
  })
})
