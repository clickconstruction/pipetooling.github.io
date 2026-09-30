import { describe, expect, it } from 'vitest'
import { offeredAddOnsFromAltTexts, referenceWhole, referenceWholeLabel, referenceWholeValue } from '../../../supabase/functions/_shared/referenceWhole'

const texts = {
  heading: 'Alternates:',
  sections: { 'group:break room': { label: 'Break room' } },
  groups: { 'group:break room': { amount: 2717 }, 'group:roof deck': { offered: false, amount: 900 }, 'group:pool': { offered: true, amount: '1500.5' } },
}

describe('referenceWhole', () => {
  it('sums the base and every offered stamped add-on', () => {
    const whole = referenceWhole(10524, texts)
    expect(whole.base).toBe(10524)
    expect(whole.addOns.map((a) => [a.name, a.amount])).toEqual([['Break room', 2717], ['pool', 1500.5]])
    expect(whole.value).toBe(14741.5)
    expect(referenceWholeValue('10524', texts)).toBe(14741.5)
  })
  it('an unticked alternate, a missing amount and a zero amount add nothing', () => {
    expect(offeredAddOnsFromAltTexts({ groups: { 'group:a': { offered: false, amount: 5 }, 'group:b': {}, 'group:c': { amount: 0 } } })).toEqual([])
  })
  it('a bid with no value stays null even with add-ons on record', () => {
    expect(referenceWhole(null, texts).value).toBeNull()
    expect(referenceWhole('', texts)).toEqual({ value: null, base: null, addOns: referenceWhole(1, texts).addOns })
  })
  it('a bid without alternates is its base', () => {
    expect(referenceWhole(50528, null)).toEqual({ value: 50528, base: 50528, addOns: [] })
    expect(referenceWhole(50528, {})).toEqual({ value: 50528, base: 50528, addOns: [] })
    expect(referenceWhole(50528, 'garbage')).toEqual({ value: 50528, base: 50528, addOns: [] })
  })
  it('names the add-on from the letter wording, else the group tag', () => {
    expect(referenceWhole(1, texts).addOns.map((a) => a.name)).toEqual(['Break room', 'pool'])
  })
  it('the scorecard label shows the parts, and nothing without add-ons', () => {
    expect(referenceWholeLabel(referenceWhole(10524, texts))).toBe(' (base $10,524 + Break room $2,717 + pool $1,500.5)')
    expect(referenceWholeLabel(referenceWhole(50528, null))).toBe('')
    expect(referenceWholeLabel(referenceWhole(null, texts))).toBe('')
  })
})
