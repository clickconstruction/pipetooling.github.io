/** A line's Spanish and its marks in the editor, over the residential prototype's lines for customers (v0.8). */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import type { QuickReply } from './kernel'
import { IN_SPANISH, SPANISH_WORDS, lineMarks, lineWords, spanishOffered } from './spanish'

const line = (set: Partial<QuickReply>): QuickReply => ({
  id: 'r2',
  text: '{first}, this is {me} with Click Plumbing. We are on our way.',
  for: 'customer',
  stepId: 'onway',
  scope: 'team',
  addedBy: 'rosa',
  addedAt: 0,
  removed: false,
  uses: {},
  lastUsed: null,
  ...set,
})

describe('a line’s Spanish', () => {
  it('is offered on a line for customers only', () => {
    expect(spanishOffered({ for: 'customer' })).toBe(true)
    expect(['trade', 'arch', 'lead', 'any'].map((k) => spanishOffered({ for: k as QuickReply['for'] }))).toEqual([false, false, false, false])
  })

  it('marks a customer line es once its Spanish is written, and no es until then', () => {
    expect(lineMarks(line({ textEs: '{first}, le habla {me} de Click Plumbing. Vamos en camino.', phoneOrder: 1 }))).toEqual({ phone: true, es: 'es', mine: false })
    expect(lineMarks(line({ textEs: '  ' }))).toEqual({ phone: false, es: 'no es', mine: false })
    expect(lineMarks(line({}))).toMatchObject({ es: 'no es' })
  })

  it('gives a line for anyone else no Spanish mark, and a line of my own its mine mark', () => {
    expect(lineMarks(line({ for: 'trade', stepId: 'ask', phoneOrder: 1 }))).toEqual({ phone: false, es: null, mine: false })
    expect(lineMarks(line({ scope: 'mine', phoneOrder: 2 }))).toEqual({ phone: false, es: 'no es', mine: true })
  })

  it('reads a line in the language given, its English when it has no Spanish', () => {
    const es = '{first}, le habla {me} de Click Plumbing. Vamos en camino.'
    expect(lineWords(line({ textEs: es }), 'es')).toBe(es)
    expect(lineWords(line({ textEs: es }), 'en')).toBe(line({}).text)
    expect(lineWords(line({ textEs: '  ' }), 'es')).toBe(line({}).text)
    expect(lineWords(line({}), 'es')).toBe(line({}).text)
    expect(IN_SPANISH).toBe('in Spanish')
  })

  it('says its words plainly', () => {
    expect(Object.values(SPANISH_WORDS).filter((s) => !s.startsWith('La ')).flatMap((s) => plainWordsFailures(s))).toEqual([])
  })
})
