import { describe, expect, it } from 'vitest'
import { boardStateFromRows } from './boardRows'
import { clinicBoardRows } from './boardTestRows'
import { answerRecord, asksToAnswer, quotedWords } from './reliability'
import type { Partner } from './types'

const counts = (invited: number, bids: number, tookBack?: number) => ({ invited, bids, ...(tookBack ? { tookBack } : {}) }) as Partner

// v2.8518: an ask we took back after the company heard about it is no ask of ours to answer. The live walk of v2.8490
// read "quoted 0 of 1 asks" on the test company whose one ask we had taken back.
describe('the quote record leaves out the asks we took back (v2.8518)', () => {
  it('counts the asks they had to answer', () => {
    expect(asksToAnswer(counts(3, 1))).toBe(3)
    expect(asksToAnswer(counts(3, 1, 2))).toBe(1)
    expect(asksToAnswer(counts(1, 0, 1))).toBe(0)
  })

  it('judges on those alone: two asks we took back do not make a company silent', () => {
    // Four asks, two taken back, both of the rest quoted: reliable, where four asks and two quotes read mixed.
    expect(answerRecord(counts(4, 2, 2))).toBe('reliable')
    expect(answerRecord(counts(4, 2))).toBe('mixed')
    // Two asks, both taken back: not judged yet, never silent.
    expect(answerRecord(counts(2, 0, 2))).toBe('new')
    expect(answerRecord(counts(2, 0))).toBe('silent')
  })

  it('says the record over the asks they had to answer', () => {
    expect(quotedWords(counts(0, 0), 'never asked')).toBe('never asked')
    expect(quotedWords(counts(3, 2), 'never asked')).toBe('quoted 2 of 3 asks')
    expect(quotedWords(counts(3, 2, 1), 'never asked')).toBe('quoted 2 of 2 asks')
    expect(quotedWords(counts(1, 0, 1), 'never asked')).toBe('asked once, and we took it back')
    expect(quotedWords(counts(2, 0, 2), 'never asked yet')).toBe('asked 2 times, and we took each back')
  })

  it('reads the count off the rows: a company with one ask of two taken back', () => {
    const base = clinicBoardRows()
    const taken = boardStateFromRows(clinicBoardRows({ invites: base.invites.map((i) => (i.id === 'i2' ? { ...i, status: 'declined', declined_why: 'withdrawn', declined_on: '2026-10-07' } : i)) }))
    const hillside = taken.partners.find((p) => p.id === 'hillside')!
    expect([hillside.invited, hillside.tookBack, asksToAnswer(hillside)]).toEqual([1, 1, 0])
    // A company with no ask taken back carries no count, so nothing else about it changes.
    expect('tookBack' in boardStateFromRows(base).partners.find((p) => p.id === 'hillside')!).toBe(false)
    // Its pass by phone is its own answer, and stays in the count.
    const passed = boardStateFromRows(clinicBoardRows({ invites: base.invites.map((i) => (i.id === 'i2' ? { ...i, status: 'declined', declined_why: 'cant' } : i)) }))
    expect(passed.partners.find((p) => p.id === 'hillside')!.tookBack).toBeUndefined()
  })
})
