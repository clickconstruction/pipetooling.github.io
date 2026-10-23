import { describe, expect, it } from 'vitest'
import {
  floorChipWords,
  floorControlFromPct,
  floorControlSave,
  floorControlSavesWords,
  floorControlStart,
  floorControlTypePct,
  floorControlTypeUsd,
  floorControlValid,
  floorTodayWords,
} from './settlementFloorControl'

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const BAL = 15781.82

describe('the chip and the line after it', () => {
  it('reads the floor as a person would', () => {
    expect(floorChipWords(null, money)).toBe('any amount')
    expect(floorChipWords({ amount: null, pct: 80 }, money)).toBe('80% or more')
    expect(floorChipWords({ amount: 12000, pct: null }, money)).toBe('$12,000.00 or more')
  })
  it('says what the floor is today, or that the firm never asks', () => {
    expect(floorTodayWords(null, BAL, money)).toBe('The firm settles without asking us.')
    expect(floorTodayWords({ amount: null, pct: 80 }, BAL, money)).toBe('That is $12,625.46 today. Below that, the firm asks us.')
  })
})

describe('the three that move together', () => {
  it('opens on the saved floor, as a share or as dollars', () => {
    expect(floorControlStart(null, BAL)).toEqual({ unit: 'pct', pct: 0, pctText: '', usdText: '' })
    expect(floorControlStart({ amount: null, pct: 80 }, BAL)).toEqual({ unit: 'pct', pct: 80, pctText: '80', usdText: '12,625' })
    expect(floorControlStart({ amount: 12000, pct: null }, BAL)).toEqual({ unit: 'usd', pct: 76, pctText: '76', usdText: '12,000' })
  })
  it('slides in whole numbers and shows whole dollars', () => {
    expect(floorControlFromPct(67, BAL)).toEqual({ unit: 'pct', pct: 67, pctText: '67', usdText: '10,574' })
    expect(floorControlFromPct(0, BAL).usdText).toBe('')
  })
  it('takes digits in the % box and moves the dollars', () => {
    const c = floorControlTypePct(floorControlFromPct(0, BAL), '7a5', BAL)
    expect(c).toEqual({ unit: 'pct', pct: 75, pctText: '75', usdText: '11,836' })
    expect(floorControlTypePct(c, '150', BAL)).toEqual({ ...c, pctText: '150' })
    expect(floorControlTypePct(c, '', BAL)).toEqual({ unit: 'pct', pct: 0, pctText: '', usdText: '' })
  })
  it('takes $ and commas in the $ box and moves the share', () => {
    const c = floorControlTypeUsd(floorControlFromPct(0, BAL), '$12,000', BAL)
    expect(c).toEqual({ unit: 'usd', pct: 76, pctText: '76', usdText: '$12,000' })
    expect(floorControlTypeUsd(c, 'abc', BAL)).toEqual({ ...c, usdText: 'abc' })
    expect(floorControlValid(floorControlTypeUsd(c, 'abc', BAL))).toBe(false)
  })
})

describe('what Save does', () => {
  it('saves the box typed in last, and says so', () => {
    const share = floorControlFromPct(67, BAL)
    expect(floorControlSave(share)).toEqual({ amount: null, pct: 67 })
    expect(floorControlSavesWords(share, money)).toBe('Saves as 67% of the balance, so it moves as payments land.')
    const dollars = floorControlTypeUsd(share, '12,000', BAL)
    expect(floorControlSave(dollars)).toEqual({ amount: 12000, pct: null })
    expect(floorControlSavesWords(dollars, money)).toBe('Saves as $12,000.00, whatever the balance becomes.')
    const none = floorControlFromPct(0, BAL)
    expect(floorControlSave(none)).toEqual({ amount: null, pct: null })
    expect(floorControlSavesWords(none, money)).toBe('Saves as no floor. The firm never has to ask.')
  })
})
