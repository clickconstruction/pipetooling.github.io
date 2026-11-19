import { SALARIED_DEFAULT_WEEK, salariedWeekWords, salariedWeeklyPay, type SalariedWeek } from '../salariedEffectiveHours'

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
