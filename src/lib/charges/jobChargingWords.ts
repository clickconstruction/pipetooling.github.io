import { jobChargeRuleWords, type JobChargeRule } from './crewDays'
import { CREW_SHAPE_LOWER, crewRateFor, crewRateWords, type RateCard } from './rateCard'
import { markupMarginWords } from './markupMargin'

/**
 * The words on Edit Job's *Charging the customer* row (punch list #254, PR 4): the job's rule with its rate from the
 * card, and the markup that stands on this job — its own, the company's, or none.
 */

/** `the crew on each day, from the rate card` · `master with a helper throughout · $285.00 the crew’s hour` · `a flat $300.00 an hour`. */
export function jobChargeRuleWordsWithRate(rule: JobChargeRule, card: RateCard): string {
  if (rule.kind === 'shape') return `${CREW_SHAPE_LOWER[rule.shape]} throughout · ${crewRateWords(crewRateFor(card, rule.shape, 0))}`
  if (rule.kind === 'crew') return 'the crew on each day, from the rate card'
  return jobChargeRuleWords(rule)
}

/** `materials 30% over cost, a 23.1% margin on the sale, this job’s own` · `materials 25% over cost, a 20% margin on the sale, the company’s markup` · `materials at cost`. */
export function jobMarkupWords(jobPct: number | null, companyPct: number | null): string {
  if (jobPct != null) return `materials ${markupMarginWords(jobPct)}, this job’s own`
  if (companyPct != null) return `materials ${markupMarginWords(companyPct)}, the company’s markup`
  return 'materials at cost'
}

/** The row's collapsed value: the rule, then the markup. */
export function jobChargingValueWords(rule: JobChargeRule, jobPct: number | null, card: RateCard): string {
  return `${jobChargeRuleWordsWithRate(rule, card)} · ${jobMarkupWords(jobPct, card.materialsMarkupPct)}`
}
