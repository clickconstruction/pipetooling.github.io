import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LABOR_RATE_KEY,
  JOBS_BILLING_VALUE_KEYS,
  JOBS_BILLING_VALUE_SLUGS,
  gcCardValueLine,
  gcCutoffValueLine,
  isJobsBillingValueSlug,
  jobBookValueLine,
  jobsBillingValueKeysFor,
  jobsBillingValueLines,
  laborRateValueLine,
  markupValueLine,
  moneyWords,
  ratesValueLine,
  tripChargesValueLine,
} from './jobsBillingValueLines'
import { JOBS_BILLING_GROUPS } from './jobsBillingGroups'
import { MATERIALS_MARKUP_PCT_KEY, RATE_CARD_EXTRA_PERSON_KEY, RATE_CARD_KEYS } from '../charges/rateCard'
import { APP_SETTINGS_KEY_TRIP_CHARGE_CLIENT_NOT_HOME, APP_SETTINGS_KEY_TRIP_CHARGE_SITE_NOT_READY } from '../appSettingsKeys'
import { BILL_DAY_CUTOFF_KEY } from '../gc/billDay/billDayIo'
import { GC_CARD_BILL_SETTING_KEY } from '../../../supabase/functions/_shared/gcCardBill'

const row = (key: string, value_num: unknown, value_text: string | null = null) => ({ key, value_num, value_text })

describe('jobsBillingValueLines (punch list #261, PR 3)', () => {
  it('the seven value cards are exactly the Billing and money heading, in its order', () => {
    expect(JOBS_BILLING_VALUE_SLUGS).toEqual(JOBS_BILLING_GROUPS[0]!.cards.map((c) => c.slug))
    for (const s of JOBS_BILLING_VALUE_SLUGS) expect(isJobsBillingValueSlug(s)).toBe(true)
    expect(isJobsBillingValueSlug('stage-checklists')).toBe(false)
  })

  it('one select reads each key once, in card order, for the cards the role sees', () => {
    const all = jobsBillingValueKeysFor(JOBS_BILLING_VALUE_SLUGS)
    expect(new Set(all).size).toBe(all.length)
    expect(all).toEqual([...JOBS_BILLING_VALUE_KEYS.rates, MATERIALS_MARKUP_PCT_KEY, APP_SETTINGS_KEY_TRIP_CHARGE_CLIENT_NOT_HOME, APP_SETTINGS_KEY_TRIP_CHARGE_SITE_NOT_READY, DEFAULT_LABOR_RATE_KEY, GC_CARD_BILL_SETTING_KEY, BILL_DAY_CUTOFF_KEY, 'line_budget_settings_v1'])
    // A master sees Job Book, pay by card and the cut-off: two keys, none of the dev's.
    expect(jobsBillingValueKeysFor(['job-book', 'gc-card', 'gc-cutoff'])).toEqual([GC_CARD_BILL_SETTING_KEY, BILL_DAY_CUTOFF_KEY])
    expect(jobsBillingValueKeysFor([])).toEqual([])
  })

  it('money reads whole dollars bare and cents only when there are some', () => {
    expect(moneyWords(285)).toBe('$285')
    expect(moneyWords(92.5)).toBe('$92.50')
    expect(moneyWords(1250)).toBe('$1,250')
    expect(moneyWords(75.004)).toBe('$75')
  })

  it("the rate card reads the owner's two rows, or the first two set, or that it is blank", () => {
    expect(ratesValueLine([row(RATE_CARD_KEYS.master_helper, 285), row(RATE_CARD_KEYS.tech_alone, '185'), row(RATE_CARD_KEYS.two_techs, 285)])).toBe('$285 master with a helper · $185 a tech alone')
    expect(ratesValueLine([row(RATE_CARD_KEYS.two_techs, 285), row(RATE_CARD_KEYS.helper_alone, 75)])).toBe('$285 two techs · $75 a helper alone')
    expect(ratesValueLine([row(RATE_CARD_KEYS.tech_alone, 185), row(RATE_CARD_KEYS.helper_alone, 75)])).toBe('$185 a tech alone · $75 a helper alone')
    expect(ratesValueLine([row(RATE_CARD_KEYS.master_alone, 240.5)])).toBe('$240.50 master alone')
    // The extra-person row is not a shape; a null, zero or negative row is blank.
    expect(ratesValueLine([row(RATE_CARD_EXTRA_PERSON_KEY, 60), row(RATE_CARD_KEYS.master_helper, null), row(RATE_CARD_KEYS.tech_alone, 0)])).toBe('No rate set yet')
    expect(ratesValueLine([])).toBe('No rate set yet')
  })

  it('the markup reads percent over cost, or at cost while blank', () => {
    expect(markupValueLine([row(MATERIALS_MARKUP_PCT_KEY, 18)])).toBe('18% over cost')
    expect(markupValueLine([row(MATERIALS_MARKUP_PCT_KEY, '12.5')])).toBe('12.5% over cost')
    expect(markupValueLine([row(MATERIALS_MARKUP_PCT_KEY, 0)])).toBe('0% over cost')
    expect(markupValueLine([row(MATERIALS_MARKUP_PCT_KEY, null)])).toBe('At cost, no markup set')
    expect(markupValueLine([])).toBe('At cost, no markup set')
  })

  it('the trip charges read each amount set and leave a blank one out', () => {
    expect(tripChargesValueLine([row(APP_SETTINGS_KEY_TRIP_CHARGE_CLIENT_NOT_HOME, 95), row(APP_SETTINGS_KEY_TRIP_CHARGE_SITE_NOT_READY, 75)])).toBe('$95 client not home · $75 site not ready')
    expect(tripChargesValueLine([row(APP_SETTINGS_KEY_TRIP_CHARGE_SITE_NOT_READY, 75)])).toBe('$75 site not ready')
    expect(tripChargesValueLine([row(APP_SETTINGS_KEY_TRIP_CHARGE_CLIENT_NOT_HOME, 0)])).toBe('No amount set')
  })

  it('the labor rate reads dollars an hour, or no default', () => {
    expect(laborRateValueLine([row(DEFAULT_LABOR_RATE_KEY, 75)])).toBe('$75 an hour')
    expect(laborRateValueLine([row(DEFAULT_LABOR_RATE_KEY, null)])).toBe('No default')
    expect(laborRateValueLine([])).toBe('No default')
  })

  it('the Job Book counts its line items', () => {
    expect(jobBookValueLine(14)).toBe('14 line items')
    expect(jobBookValueLine(1)).toBe('1 line item')
    expect(jobBookValueLine(0)).toBe('No line items yet')
  })

  it("pay by card reads On only when the row says 'true', as the switch does", () => {
    expect(gcCardValueLine([row(GC_CARD_BILL_SETTING_KEY, null, 'true')])).toBe('On')
    expect(gcCardValueLine([row(GC_CARD_BILL_SETTING_KEY, null, ' TRUE ')])).toBe('On')
    expect(gcCardValueLine([row(GC_CARD_BILL_SETTING_KEY, null, 'false')])).toBe('Off')
    expect(gcCardValueLine([])).toBe('Off')
  })

  it('the cut-off reads its days, and the default when the row is missing or out of range', () => {
    expect(gcCutoffValueLine([row(BILL_DAY_CUTOFF_KEY, 9)])).toBe('9 days before bill day')
    expect(gcCutoffValueLine([row(BILL_DAY_CUTOFF_KEY, '4')])).toBe('4 days before bill day')
    expect(gcCutoffValueLine([])).toBe('6 days before bill day')
    expect(gcCutoffValueLine([row(BILL_DAY_CUTOFF_KEY, 40)])).toBe('6 days before bill day')
  })

  it('one line per card asked for; the Job Book gets none until its count is read', () => {
    const settings = [row(RATE_CARD_KEYS.master_helper, 260), row(RATE_CARD_KEYS.tech_alone, 170), row(MATERIALS_MARKUP_PCT_KEY, 18), row(GC_CARD_BILL_SETTING_KEY, null, 'true'), row(BILL_DAY_CUTOFF_KEY, 6)]
    expect(jobsBillingValueLines({ settings, jobBookLines: null })).toEqual({
      rates: '$260 master with a helper · $170 a tech alone',
      markup: '18% over cost',
      'trip-charges': 'No amount set',
      'labor-rate': 'No default',
      'gc-card': 'On',
      'gc-cutoff': '6 days before bill day',
      'line-budgets': '45 / 35 rough in · 45 / 35 top out · 40 / 40 trim set · 45 / 35 any line · $45 an hour',
    })
    expect(jobsBillingValueLines({ settings, jobBookLines: 14 }, ['job-book', 'gc-card'])).toEqual({ 'job-book': '14 line items', 'gc-card': 'On' })
    expect(jobsBillingValueLines({ settings: [], jobBookLines: null }, ['stage-checklists'])).toEqual({})
  })
})
