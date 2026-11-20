import { SALARIED_DEFAULT_WEEK, salariedWeekHours, salariedWeekWords, salariedWeeklyPay, type SalariedWeek } from '../salariedEffectiveHours'
import { val } from '../valuesInPlace'

/**
 * What a salaried wage comes to, as one line for the Pay & schedule card (v2.7829):
 * *6 h Mon to Fri · $300.00 a week*. The app stores the wage and the week. The
 * weekly figure is always worked out from them, so the two can never disagree.
 * Null for an hourly person and for a salaried row with no wage, where there is
 * nothing to multiply.
 */
export function salariedWeekLine(input: { isSalary: boolean; hourlyWage: number | null; week?: SalariedWeek | null }): string | null {
  if (!input.isSalary || input.hourlyWage == null || !(input.hourlyWage > 0)) return null
  const week = input.week ?? SALARIED_DEFAULT_WEEK
  const pay = salariedWeeklyPay(input.hourlyWage, week)
  const money = pay.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  return `${salariedWeekWords(week)} · ${money} a week`
}

/**
 * What the Employment tab's **Salaried** switch says the person is credited, from their own week:
 * *credited 8 h Mon to Fri on all pay and cost screens, whatever the clock says.* The card used to print
 * 8 hours on weekdays for everyone, which a set week of any other shape made false. The week is marked
 * as a value, so the card draws it apart from the words. A week with no paid days says so in place of a
 * credit of nothing.
 */
export function salariedCreditSentence(week?: SalariedWeek | null): string {
  const own = week ?? SALARIED_DEFAULT_WEEK
  if (!(salariedWeekHours(own) > 0)) return `credited ${val('week', 'nothing')}: their set week has no paid days.`
  return `credited ${val('week', salariedWeekWords(own))} on all pay and cost screens, whatever the clock says.`
}
