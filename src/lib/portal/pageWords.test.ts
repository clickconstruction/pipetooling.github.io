import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { customerMove } from '../flows/customerMove'
import {
  CODE_WORDS,
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
  wordsWith,
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

describe("the office's edits from Settings → Customer page", () => {
  const edited = wordsWith([
    { key: 'nothingToday', en: 'Nothing needed from you today.', es: 'Hoy no le pedimos nada.' },
    { key: 'weAreOn', en: 'Right now we are on {step}.', es: 'Ahora estamos en {step}.' },
    { key: 'paper.contract.button', en: 'Read and sign the contract', es: 'Lea y firme el contrato' },
    { key: 'goneKey', en: 'A sentence the code dropped.', es: 'Una frase que el código quitó.' },
  ])

  it('lays an edit over its sentence, in both languages, and fills its blanks', () => {
    expect(edited.say('en', 'nothingToday')).toBe('Nothing needed from you today.')
    expect(edited.say('es', 'weAreOn', { step: 'Fecha de inicio' })).toBe('Ahora estamos en Fecha de inicio.')
    expect(edited.say('en', 'fewer')).toBe('Fewer')
    expect(edited.paper('es', 'contract').button).toBe('Lea y firme el contrato')
    expect(edited.paper('en', 'contract').why).toBe('Read it and sign it here.')
    expect(CODE_WORDS.say('en', 'nothingToday')).toBe('Nothing from you today.')
  })

  it('reaches every kernel that writes the sentence', () => {
    const steps = [{ id: 'start', name: { en: 'Start date', es: 'Fecha de inicio' }, who: 'us' as const, where: 'now' as const }]
    expect(customerMove('en', { off: false, steps, changes: [] }, edited)).toEqual({ kind: 'none', line: 'Nothing needed from you today. Right now we are on Start date.' })
    const signing = [{ id: 'contract', name: { en: 'Contract signed', es: 'Contrato firmado' }, who: 'them' as const, where: 'now' as const, papers: [{ id: 'contract' as const, ours: true, mark: 'wait' as const }] }]
    expect(customerMove('en', { off: false, steps: signing, changes: [] }, edited)).toMatchObject({ kind: 'paper', title: 'Read and sign the contract' })
  })
})
