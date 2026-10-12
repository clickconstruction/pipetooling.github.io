import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  PAPER_WORDS,
  PORTAL_WORD_KEYS,
  changeAmount,
  changeDays,
  lacksSpanish,
  listWords,
  pMonth,
  portalWord,
  say,
  signedMoney,
  typed,
  type PaperWords,
} from './pageWords'

const blanks = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('the portal page words in two languages', () => {
  it('has English and Spanish for every key, with the same blanks', () => {
    const wrong = PORTAL_WORD_KEYS.filter((key) => {
      const { en, es } = portalWord(key)
      return en.trim() === '' || es.trim() === '' || blanks(en).join() !== blanks(es).join()
    })
    expect(wrong).toEqual([])
  })

  it('never leaves the Spanish a copy of the English', () => {
    expect(PORTAL_WORD_KEYS.filter((key) => portalWord(key).en === portalWord(key).es)).toEqual([])
  })

  it('says what each paper asks in both languages, field for field', () => {
    const wrong = Object.entries(PAPER_WORDS).filter(([, { en, es }]) => {
      const fields = (w: PaperWords) => Object.keys(w).sort().join()
      return fields(en) !== fields(es) || Object.values(es).some((v) => !v.trim()) || Object.values(en).some((v) => !v.trim())
    })
    expect(wrong.map(([id]) => id)).toEqual([])
  })

  it('keeps every sentence to the plain-words rules: one idea, twenty words at most, nothing glued', () => {
    const texts = [
      ...PORTAL_WORD_KEYS.flatMap((key) => Object.values(portalWord(key))),
      ...Object.values(PAPER_WORDS).flatMap(({ en, es }) => [...Object.values(en), ...Object.values(es)]),
    ]
    expect(texts.flatMap((text) => plainWordsFailures(text))).toEqual([])
  })

  it('fills the blanks, in either language', () => {
    expect(say('en', 'pageTitle', { company: 'Click Construction' })).toBe('Where you are with Click Construction')
    expect(say('es', 'paidOnTime', { n: 3 })).toBe('3 de 3 pagadas a tiempo')
    expect(say('es', 'sendBy', { day: 'lun 5 oct' })).toBe('Se lo enviamos para el lun 5 oct.')
  })
})

describe('the helpers the kernels share', () => {
  it('reads a typed line in Spanish only when someone wrote it', () => {
    expect(typed('es', { en: 'rain', es: 'lluvia' })).toBe('lluvia')
    expect(typed('es', { en: 'rain', es: null })).toBe('rain')
    expect(typed('en', { en: 'rain', es: 'lluvia' })).toBe('rain')
    expect(lacksSpanish({ en: 'rain', es: null })).toBe(true)
    expect(lacksSpanish({ en: 'rain', es: '  ' })).toBe(true)
    expect(lacksSpanish({ en: 'rain', es: 'lluvia' })).toBe(false)
    expect(lacksSpanish(null)).toBe(false)
  })

  it('names the month a pay application is for', () => {
    expect(pMonth('en', '2026-09-01')).toBe('September')
    expect(pMonth('es', '2026-10-14')).toBe('octubre')
  })

  it('lists numbers the way each language does', () => {
    expect(listWords('en', [2, 1])).toBe('2 and 1')
    expect(listWords('en', [3, 2, 1])).toBe('3, 2 and 1')
    expect(listWords('es', [3, 2, 1])).toBe('3, 2 y 1')
    expect(listWords('en', [1])).toBe('1')
  })

  it('says a change order’s money and days, a credit as a credit', () => {
    expect(changeAmount('en', 2150)).toBe('+$2,150')
    expect(changeAmount('en', -500)).toBe('a credit of $500')
    expect(changeAmount('es', -500)).toBe('un crédito de $500')
    expect(changeDays('en', 0)).toBe('adds no days')
    expect(changeDays('en', 1)).toBe('adds 1 working day')
    expect(changeDays('es', 3)).toBe('agrega 3 días hábiles')
    expect(signedMoney(18450)).toBe('+$18,450')
    expect(signedMoney(-500)).toBe('−$500')
  })
})
