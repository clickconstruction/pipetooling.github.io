import { describe, expect, it } from 'vitest'
import { crewRateFor, crewRateWords, crewShapeOf, parseChargeStanding, parseCrewShape, rateCardFromSettings, RATE_CARD_KEYS, RATE_CARD_SETTING_KEYS, type RateCard } from './rateCard'

/** The owner's numbers of 2026-11-03; the other rows are hers to fill. */
const OWNER: RateCard = { rates: { master_helper: 285, two_techs: 285, tech_alone: 185, helper_alone: 75 }, extraPerson: null, materialsMarkupPct: null }

describe('the rate card by crew (punch list #254)', () => {
  it('reads the card from app_settings rows, the master-with-a-helper row from the v2.6431 key, and leaves a missing row absent', () => {
    const card = rateCardFromSettings([
      { key: 'hourly_charge_rate_v1', value_num: 285 },
      { key: 'charge_rate_two_techs_v1', value_num: '285.00' },
      { key: 'charge_rate_tech_alone_v1', value_num: 185 },
      { key: 'charge_rate_helper_alone_v1', value_num: 75 },
      { key: 'charge_rate_master_alone_v1', value_num: null },
      { key: 'charge_rate_two_helpers_v1', value_num: -1 },
      { key: 'materials_markup_pct_v1', value_num: 25 },
    ])
    expect(card.rates).toEqual({ master_helper: 285, two_techs: 285, tech_alone: 185, helper_alone: 75 })
    expect(card.extraPerson).toBeNull()
    expect(card.materialsMarkupPct).toBe(25)
    expect(RATE_CARD_KEYS.master_helper).toBe('hourly_charge_rate_v1')
    expect(RATE_CARD_SETTING_KEYS).toHaveLength(8)
  })

  it('shapes a crew from the two highest standings: a master with anyone, a tech with anyone below a master, two helpers, each alone', () => {
    expect(crewShapeOf(['master', 'helper'])).toMatchObject({ shape: 'master_helper', extra: 0 })
    expect(crewShapeOf(['helper', 'master'])).toMatchObject({ shape: 'master_helper', extra: 0 })
    expect(crewShapeOf(['master', 'master'])).toMatchObject({ shape: 'master_helper', extra: 0 })
    expect(crewShapeOf(['tech', 'tech'])).toMatchObject({ shape: 'two_techs', extra: 0 })
    expect(crewShapeOf(['tech', 'helper'])).toMatchObject({ shape: 'two_techs', extra: 0 })
    expect(crewShapeOf(['helper', 'helper'])).toMatchObject({ shape: 'two_helpers', extra: 0 })
    expect(crewShapeOf(['master'])).toMatchObject({ shape: 'master_alone' })
    expect(crewShapeOf(['tech'])).toMatchObject({ shape: 'tech_alone' })
    expect(crewShapeOf(['helper'])).toMatchObject({ shape: 'helper_alone' })
  })

  it('never counts a person who is not charged, and counts everyone past two as an extra person', () => {
    expect(crewShapeOf(['none'])).toMatchObject({ shape: null, extra: 0 })
    expect(crewShapeOf(['tech', 'none'])).toMatchObject({ shape: 'tech_alone', extra: 0 })
    expect(crewShapeOf(['master', 'tech', 'helper'])).toMatchObject({ shape: 'master_helper', extra: 1, counted: ['master', 'tech', 'helper'] })
  })

  it("prices the owner's examples: two techs together $285, each alone $185, a helper alone $75", () => {
    expect(crewRateFor(OWNER, crewShapeOf(['tech', 'tech']).shape, 0)).toEqual({ rate: 285, why: null })
    expect(crewRateFor(OWNER, crewShapeOf(['tech']).shape, 0)).toEqual({ rate: 185, why: null })
    expect(crewRateFor(OWNER, crewShapeOf(['helper']).shape, 0)).toEqual({ rate: 75, why: null })
    expect(crewRateFor(OWNER, crewShapeOf(['master', 'helper']).shape, 0)).toEqual({ rate: 285, why: null })
    expect(crewRateWords({ rate: 285, why: null })).toBe('$285.00 the crew’s hour')
  })

  it('names the missing row instead of pricing in silence: a master alone, three out with no extra-person rate, nobody charged', () => {
    expect(crewRateFor(OWNER, 'master_alone', 0)).toEqual({ rate: null, why: 'The rate card has no rate for master alone.' })
    expect(crewRateFor(OWNER, 'master_helper', 1)).toEqual({ rate: null, why: 'The rate card has no rate for each person beyond two, and this day had 3 out.' })
    expect(crewRateFor(OWNER, null, 0).why).toBe('Nobody out that day is charged to a customer.')
    expect(crewRateFor({ ...OWNER, extraPerson: 60 }, 'master_helper', 2)).toEqual({ rate: 405, why: null })
  })

  it('parses a stored standing and shape, and turns anything unknown into not charged or null', () => {
    expect(parseChargeStanding('master')).toBe('master')
    expect(parseChargeStanding('plumber')).toBe('none')
    expect(parseChargeStanding(null)).toBe('none')
    expect(parseCrewShape('two_techs')).toBe('two_techs')
    expect(parseCrewShape('crew')).toBeNull()
  })
})
