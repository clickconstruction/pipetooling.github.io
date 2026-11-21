import { describe, expect, it } from 'vitest'
import { MONEY_BAR_WORD_KEYS, barWord, moneyBar, nextGuess } from './moneyBar'
import { plainWordsFailures } from '../plainWords'
import { ELENA_MONEY, PRIYA_MONEY } from './portalTestPeople'

describe("the Money tab's bar (punch list #217, outside-2)", () => {
  it("draws Elena's revised sum in its parts: paid, with the architect, the next one as our guess, and to finish; 34% paid", () => {
    const bar = moneyBar('en', ELENA_MONEY)
    expect(bar.caption).toBe('Your contract, $1,302,450')
    expect(bar.big).toBe('34% paid')
    expect(bar.onTime).toBe('3 of 3 on time')
    expect(bar.segments.map((s) => [s.part, s.amount, s.label])).toEqual([
      ['paid', 445_000, 'paid $445,000'],
      ['architect', 41_200, 'with your architect $41,200'],
      ['next', nextGuess(ELENA_MONEY.next!.bill), `next, about $${nextGuess(ELENA_MONEY.next!.bill).toLocaleString('en-US')}`],
      ['rest', 1_302_450 - 445_000 - 41_200 - nextGuess(ELENA_MONEY.next!.bill), expect.stringMatching(/^to finish \$/)],
    ])
    expect(Math.round(bar.segments.reduce((t, s) => t + s.fraction, 0) * 1000) / 1000).toBe(1)
    expect(bar.guess).toMatch(/^Pay application 5 is our guess from the schedule: about \$[\d,]+, around /)
  })

  it("draws Priya's month zero empty but for our guess at the first one, and says nothing is paid yet", () => {
    const bar = moneyBar('en', PRIYA_MONEY)
    expect(bar.big).toBe('Nothing paid yet')
    expect(bar.onTime).toBeNull()
    expect(bar.segments.map((s) => s.part)).toEqual(['next', 'rest'])
    expect(bar.segments[0]!.amount).toBe(nextGuess(70_000))
    expect(bar.guess).toBe(`Pay application 1 is our guess from the schedule: about $${nextGuess(70_000).toLocaleString('en-US')}, around Nov 5.`)
    // With no next on the page (the live portal today), one grey length: to finish.
    expect(moneyBar('en', { ...PRIYA_MONEY, next: null }).segments.map((s) => [s.part, s.fraction])).toEqual([['rest', 1]])
  })

  it('reads a certified bill as due, a shade of its own, and the Spanish words', () => {
    const due = { ...PRIYA_MONEY, next: null, billed: 60_000, apps: [{ n: 1, month: '2026-10-01', covers: null, amount: 60_000, photos: 0, state: 'due' as const, certifiedBy: 'A', certifiedOn: '2026-10-20', dueOn: '2026-11-19' }] }
    expect(moneyBar('en', due).segments.map((s) => [s.part, s.label])).toEqual([
      ['due', 'certified and due $60,000'],
      ['rest', 'to finish $358,300'],
    ])
    expect(moneyBar('es', due).segments.map((s) => s.label)).toEqual(['certificada y por pagar $60,000', 'por terminar $358,300'])
    expect(moneyBar('es', ELENA_MONEY).big).toBe('34% pagado')
  })

  it('takes the middle of the next one’s range, or its about', () => {
    expect([nextGuess(70_000), nextGuess(15_400), nextGuess(100_000)]).toEqual([70_000, 15_000, 100_000])
  })

  it('keeps its words to the plain-words rules in both languages, with the same blanks', () => {
    const blanks = (t: string) => [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join()
    for (const key of MONEY_BAR_WORD_KEYS) {
      const en = barWord('en', key)
      const es = barWord('es', key)
      expect(plainWordsFailures(en), key).toEqual([])
      expect(plainWordsFailures(es), key).toEqual([])
      expect(blanks(en), key).toBe(blanks(es))
      expect(en, key).not.toBe(es)
    }
  })
})
