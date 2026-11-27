import { describe, expect, it } from 'vitest'
import { burdenWords, burnBurden, burnLaborBasisWords, burnLaborLineWords, burnLaborOf, chargeEventsAtBurden, laborAtBurden } from './burnAtBurden'
import { buildJobBurn } from './jobBurn'
import { spendByComponent } from './jobBudget'
import { plainSentence, sentenceParts } from '../valuesInPlace'
import type { JobChargeEvent } from '../jobChargesTimeline'

// The card's own example: 100 hours at a wage of 30, a burden of 1.20.
const day = (n: number) => `2026-11-${String(n).padStart(2, '0')}`
const events: JobChargeEvent[] = [
  ...[2, 3, 4, 5, 6].map((d): JobChargeEvent => ({ source: 'team_labor', dateKey: day(d), amount: 600, label: 'ZZ Test Tech — team labor', who: 'ZZ Test Tech', hours: 20 })),
  { source: 'sub_labor', dateKey: day(4), amount: 1_000, label: 'ZZ Test Sub' },
  { source: 'supply_house', dateKey: day(5), amount: 4_000, label: 'ZZ Test Supply' },
]

describe('the burn at the burden (punch list #448)', () => {
  it('prices team labor at wages times the factor, and nothing else', () => {
    const at = chargeEventsAtBurden(events, 1.2)
    const spend = spendByComponent(at)
    expect(spend.teamUsd).toBeCloseTo(3_600, 6)
    expect(spend.subUsd).toBe(1_000)
    expect(spend.partsUsd).toBe(4_000)
    // The list handed in is as it was: the Costs tab's own lines keep the wages paid.
    expect(spendByComponent(events).teamUsd).toBe(3_000)
    expect(at.find((e) => e.source === 'team_labor')).toMatchObject({ hours: 20, who: 'ZZ Test Tech', dateKey: day(2) })
  })

  it('a factor of 1 gives the old numbers, and hands the same list back', () => {
    expect(chargeEventsAtBurden(events, 1)).toBe(events)
    expect(laborAtBurden(3_000, 1)).toBe(3_000)
  })

  it('a factor that is missing, not a number or under 1 reads as 1: a wage never shrinks under burden', () => {
    for (const bad of [null, undefined, Number.NaN, 0, 0.8, -2, Number.POSITIVE_INFINITY]) expect(burnBurden(bad)).toBe(1)
    expect(burnBurden(1.2)).toBe(1.2)
    expect(chargeEventsAtBurden(events, Number.NaN)).toBe(events)
  })

  it('the burn built from those events spends 3,600 of labor where it spent 3,000', () => {
    const args = { valueEvents: [{ dateKey: day(6), percent: 50, label: 'report' }], fallbackPercent: null, priceUsd: 20_000, budget: null, overhead: null, todayYmd: day(9), earnedBasis: 'price' as const }
    const raw = buildJobBurn({ ...args, chargeEvents: events })
    const burdened = buildJobBurn({ ...args, chargeEvents: chargeEventsAtBurden(events, 1.2) })
    expect(raw.spentUsd).toBe(8_000)
    expect(burdened.spentUsd).toBeCloseTo(8_600, 6)
    // Spent ÷ % done: the cost at completion moves by the same sixth of labor, doubled at 50%.
    expect(raw.eacUsd).toBeCloseTo(16_000, 6)
    expect(burdened.eacUsd).toBeCloseTo(17_200, 6)
    expect(burdened.fieldDays).toBe(raw.fieldDays)
  })

  it('says what the labor stands on, its values marked', () => {
    const l = burnLaborOf(3_000, 1.2)
    expect(l).toEqual({ wagesUsd: 3_000, burden: 1.2, usd: 3_600 })
    expect(plainSentence(burnLaborBasisWords(l))).toBe('$3,000 wages × 1.20')
    expect(plainSentence(burnLaborLineWords(l))).toBe('labor $3,000 wages × 1.20 = $3,600')
    expect(sentenceParts(burnLaborLineWords(l)).filter((p) => typeof p !== 'string')).toEqual([
      { kind: 'wages', text: '$3,000' },
      { kind: 'burden', text: '1.20' },
      { kind: 'labor', text: '$3,600' },
    ])
    expect(burdenWords(1.25)).toBe('1.25')
  })
})
