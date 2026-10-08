/**
 * Main's own scan of the trade portal's Spanish: every word the portal and its emails say (`portalI18n.ts`), the exclusion names and
 * the pay application's words (`buildingWords.ts`) keep the voice, one word for each thing and usted throughout. A string that fails
 * is rewritten, never exempted.
 */
import { describe, expect, it } from 'vitest'
import { BUILDING_WORD_KEYS, buildingWord } from './buildingWords'
import { EXCLUSION_ES, PORTAL_KEYS, portalString, pt } from './portalI18n'
import { offWords } from './spanishVoice'

const SPANISH = [
  ...PORTAL_KEYS.map((k) => ({ key: k, es: portalString(k).es })),
  ...Object.entries(EXCLUSION_ES).map(([k, es]) => ({ key: `exclusion ${k}`, es })),
  ...BUILDING_WORD_KEYS.map((k) => ({ key: `building ${k}`, es: buildingWord(k).es })),
]

describe('the portal’s Spanish voice on main', () => {
  it('reads every portal string, each with its Spanish', () => {
    expect(SPANISH.length).toBeGreaterThan(700)
    expect(SPANISH.filter((r) => !r.es.trim()).map((r) => r.key)).toEqual([])
  })

  it('no string says a retired word, a word kept out or a tú form', () => {
    const found = SPANISH.flatMap((r) => offWords(r.es).map((o) => `${r.key} → "${o.word}" (${o.term}, ${o.why}): ${r.es}`))
    expect(found).toEqual([])
  })

  it('writes a new set’s lines of the quote and its added lines in both languages', () => {
    expect(pt('en', 'mPlansYourLines', { list: 'Panels and feeders, Lighting' })).toBe('It touches these lines of your quote: Panels and feeders, Lighting.')
    expect(pt('es', 'mPlansYourLines', { list: 'Tableros' })).toBe('Toca estas partidas de su cotización: Tableros.')
    expect(pt('en', 'mPlansAddsLines', { trade: 'Electrical', list: 'EV chargers' })).toBe('It adds these lines to Electrical: EV chargers.')
    expect(pt('es', 'mPlansAddsLines', { trade: 'Electrical', list: 'Cargadores' })).toBe('Agrega estas partidas a Electrical: Cargadores.')
  })
})
