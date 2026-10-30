import { describe, expect, it } from 'vitest'
import { legalSuitFiled, settlementLineAmount, settlementPaths, type SettlementPathsInput } from './settlementPaths'
import { plainWordsFailures } from '../plainWords'

// The card's invented matter (to-dos/legal-desk-settlement-floor): two open bills $14,250, retainage no bill asks for
// yet $2,100, so the claim is $16,350; the firm 33% and $350 to file; their offer $9,000, our counter $13,500 to Nov 5;
// the firm's read: hard, $2,800 to try it, 9 months to a judgment.
const read = { tries: 'hard' as const, why: 'The GC disputes the change order.', costToTry: 2800, months: 9, entryId: 'r', ymd: '2026-10-22', by: 'firm' as const, byName: 'D. Reyes' }
const base: SettlementPathsInput = {
  claim: 16350,
  contingencyPct: 0.33,
  filingCost: 350,
  filed: false,
  offers: [
    { key: 'theirs', direction: 'received', amount: 9000, status: 'open', ymd: '2026-10-20', expiresOn: null },
    { key: 'ours', direction: 'made', amount: 13500, status: 'open', ymd: '2026-10-22', expiresOn: '2026-11-05' },
    { key: 'old', direction: 'made', amount: 15000, status: 'withdrawn', ymd: '2026-10-10', expiresOn: null },
  ],
  read,
}

describe('settlementPaths — what each path nets (v2.6176, punch list #218 PR 3)', () => {
  it('one card per standing offer, smallest first, and one for collections and trial, every bar on the claim’s scale', () => {
    const { paths } = settlementPaths(base)
    expect(paths.map((p) => [p.key, p.title, p.gross, p.keep])).toEqual([
      ['offer:theirs', 'Settle at their offer', 9000, 6030],
      ['offer:ours', 'Settle at our counter', 13500, 9045],
      ['trial', 'Collections and trial', 16350, 7804.5],
    ])
    const theirs = paths[0]!
    expect(theirs.parts.map((p) => [p.key, p.amount])).toEqual([['keep', 6030], ['fee', 2970], ['letgo', 7350]])
    expect(theirs.parts.reduce((s, p) => s + p.fraction, 0)).toBeCloseTo(1, 6)
    expect(theirs.when).toBe('within the month')
    expect(theirs.chip).toEqual({ text: '$9,000.00', tone: 'info' })
    expect(paths[1]!.when).toBe('within the month, if they take it by Nov 5')
    const trial = paths[2]!
    expect(trial.parts.map((p) => [p.key, p.amount])).toEqual([['keep', 7804.5], ['fee', 5395.5], ['filing', 350], ['try', 2800]])
    expect(trial.parts.reduce((s, p) => s + p.fraction, 0)).toBeCloseTo(1, 6)
    expect(trial.when).toBe('9 months to a judgment, then collecting it')
    expect(trial.chip).toEqual({ text: 'hard to try', tone: 'warn' })
    expect(trial.caveat).toBe('A hard case. A full win is not the likely end. The firm’s call.')
  })

  it('the walk-away line: the claim less the costs to continue, divided by what we keep after the firm’s cut', () => {
    const { line, words } = settlementPaths(base)
    expect(line?.amount).toBe(11648.51)
    expect(line?.fraction).toBeCloseTo(11648.51 / 16350, 6)
    expect(line?.label).toBe('above this, settling beats a full win')
    // Settling at the line nets what a full win nets.
    expect(Math.round(11648.51 * 0.67 * 100) / 100).toBe(7804.5)
    expect(words).toBe('Their offer nets $6,030.00 within the month. A full win at trial nets $7,804.50 after 9 months and $3,150.00 of costs. An offer above $11,648.51 beats a full win. The firm reads this case as hard to try.')
    for (const s of [words, settlementPaths(base).paths[2]!.caveat]) expect(plainWordsFailures(s)).toEqual([])
  })

  it('no read yet: the trial path counts the filing cost alone, says the firm has not said how long, and the sentence says so', () => {
    const { paths, line, words } = settlementPaths({ ...base, read: null })
    const trial = paths.find((p) => p.kind === 'trial')!
    expect(trial.keep).toBe(10604.5)
    expect(trial.parts.map((p) => p.key)).toEqual(['keep', 'fee', 'filing'])
    expect(trial.when).toBe('the firm has not said how long')
    expect(trial.chip).toEqual({ text: 'not read yet', tone: 'neutral' })
    expect(trial.caveat).toBe('')
    expect(line?.amount).toBe(15827.61)
    expect(words).toContain('The firm has not said how this case tries.')
    expect(settlementLineAmount({ claim: 16350, contingencyPct: 0.33, filingCost: 350, filed: false, read: null })).toBe(15827.61)
  })

  it('once suit is filed the filing cost is spent, so no path carries it and the line moves up', () => {
    const { paths, line } = settlementPaths({ ...base, filed: true })
    const trial = paths.find((p) => p.kind === 'trial')!
    expect(trial.parts.map((p) => p.key)).toEqual(['keep', 'fee', 'try'])
    expect(trial.keep).toBe(8154.5)
    expect(line?.amount).toBe(12170.9)
    expect(['suit', 'judgment', 'post_judgment'].map(legalSuitFiled)).toEqual([true, true, true])
    expect(['review', 'in_house', 'demand', 'settled', null, undefined].map(legalSuitFiled)).toEqual([false, false, false, false, false, false])
  })

  it('no offer standing: the trial path alone, and the line still reads; an easy read is a green chip with no caveat', () => {
    const easy = { ...read, tries: 'easy' as const }
    const { paths, line, words } = settlementPaths({ ...base, offers: [], read: easy })
    expect(paths.map((p) => p.kind)).toEqual(['trial'])
    expect(paths[0]!.chip).toEqual({ text: 'easy to try', tone: 'ok' })
    expect(paths[0]!.caveat).toBe('')
    expect(line?.amount).toBe(11648.51)
    expect(words).toBe('A full win at trial nets $7,804.50 after 9 months and $3,150.00 of costs. An offer above $11,648.51 beats a full win. The firm reads this case as easy to try.')
  })

  it('nothing to claim draws nothing; a cut that takes everything has no line', () => {
    expect(settlementPaths({ ...base, claim: 0, offers: [] })).toEqual({ paths: [], line: null, words: '' })
    expect(settlementLineAmount({ claim: 1000, contingencyPct: 1, filingCost: 350, filed: false, read: null })).toBeNull()
    // Costs past the claim: the line sits at zero and is left off, the trial card reads short.
    const { paths, line } = settlementPaths({ ...base, claim: 1000, offers: [], read: { ...read, costToTry: 5000 } })
    expect(line).toBeNull()
    expect(paths[0]!.keep).toBeLessThan(0)
  })
})
