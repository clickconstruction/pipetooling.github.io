import { describe, expect, it } from 'vitest'
import { PORTAL_KEYS, pt } from '../../lib/gc/portalI18n'
import { offWords, saysWord, TU_MARKERS } from '../../lib/gc/spanishVoice'
import { PORTAL_CLIENT_KEYS, portalClientString, portalWord } from './gcTradePortalWords'

const blanks = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('the portal’s own words, which no edge function carries', () => {
  it('has English and Spanish for every key, with the same blanks', () => {
    const wrong = PORTAL_CLIENT_KEYS.filter((key) => {
      const { en, es } = portalClientString(key)
      return en.trim() === '' || es.trim() === '' || blanks(en).join() !== blanks(es).join()
    })
    expect(wrong).toEqual([])
  })

  it('shadows no key of the kernel', () => {
    const kernel = new Set<string>(PORTAL_KEYS)
    expect(PORTAL_CLIENT_KEYS.filter((key) => kernel.has(key))).toEqual([])
  })

  it('keeps the portal’s Spanish voice: usted, and no retired word', () => {
    const off = PORTAL_CLIENT_KEYS.filter((key) => {
      const { es } = portalClientString(key)
      return offWords(es).length > 0 || TU_MARKERS.some((word) => saysWord(es, word))
    })
    expect(off).toEqual([])
  })

  it('fills the blanks of its own words, and hands a kernel key to the kernel', () => {
    expect(portalWord('en', 'pplRemoveAsk', { name: 'ZZ Test Bookkeeper' })).toBe('Remove ZZ Test Bookkeeper? They stop getting our emails.')
    expect(portalWord('es', 'pplRemoveYes', { name: 'ZZ Test Bookkeeper' })).toBe('Quitar a ZZ Test Bookkeeper')
    expect(portalWord('es', 'pplAdd')).toBe(pt('es', 'pplAdd'))
  })
})
