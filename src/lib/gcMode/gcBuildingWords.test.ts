/**
 * GC mode — design spike: the pay application door and window in English and Spanish
 * (gcBuildingWords.ts). Every key has both languages with the same blanks.
 */
import { describe, expect, it } from 'vitest'
import { BUILDING_WORD_KEYS, buildingWord, bw } from './gcModel'

const blanks = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('the pay application in two languages', () => {
  it('has English and Spanish for every key, with the same blanks', () => {
    const wrong = BUILDING_WORD_KEYS.filter((key) => {
      const { en, es } = buildingWord(key)
      return en.trim() === '' || es.trim() === '' || blanks(en).join() !== blanks(es).join()
    })
    expect(wrong).toEqual([])
  })

  it('fills the blanks, and leaves one not given to be drawn in its place', () => {
    expect(bw('es', 'seesLine', { line: 'Ceilings', gc: 'Click', n: 50, m: 60 })).toBe('Ceilings: Click ve 50%. Usted pidió 60%.')
    expect(bw('es', 'canAsk')).toBe('Puede pedir {amount} ahora. La mayor parte de la solicitud de pago ya está llena.')
    expect(bw('en', 'fillOut', { n: 2 })).toBe('Fill out pay application 2')
  })
})
