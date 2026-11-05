import { describe, expect, it } from 'vitest'
import { jobChargeRuleWordsWithRate, jobChargingValueWords, jobMarkupWords } from './jobChargingWords'

const CARD = { rates: { master_helper: 285, two_techs: 285, tech_alone: 185, helper_alone: 75 }, extraPerson: null, materialsMarkupPct: 25 }

describe("Edit Job's Charging the customer row (punch list #254, PR 4)", () => {
  it('words the rule with its rate from the card', () => {
    expect(jobChargeRuleWordsWithRate({ kind: 'crew' }, CARD)).toBe('the crew on each day, from the rate card')
    expect(jobChargeRuleWordsWithRate({ kind: 'shape', shape: 'master_helper' }, CARD)).toBe('master with a helper throughout · $285.00 the crew’s hour')
    expect(jobChargeRuleWordsWithRate({ kind: 'flat', rate: 300 }, CARD)).toBe('a flat $300.00 an hour')
  })

  it("words the markup: the job's own, the company's, or none", () => {
    expect(jobMarkupWords(30, 25)).toBe('materials 30% over cost, a 23.1% margin on the sale, this job’s own')
    expect(jobMarkupWords(null, 25)).toBe('materials 25% over cost, a 20% margin on the sale, the company’s markup')
    expect(jobMarkupWords(null, null)).toBe('materials at cost')
    expect(jobChargingValueWords({ kind: 'crew' }, null, CARD)).toBe('the crew on each day, from the rate card · materials 25% over cost, a 20% margin on the sale, the company’s markup')
  })
})
