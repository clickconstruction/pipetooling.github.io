/**
 * The tests of `gcBuildingWords.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the Building lane's U2). The data is `schedule/testState.ts`. The tests that play the
 * prototype's reducer or read another lane stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { BUILDING_WORD_KEYS, buildingWord, bw } from './buildingWords'

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
