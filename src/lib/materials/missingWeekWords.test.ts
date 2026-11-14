import { describe, expect, it } from 'vitest'
import { missingWeekIsPartial, missingWeekNote, shortLinesBadgeWords } from './missingWeekWords'

describe('the words beside the week’s missing money', () => {
  it('says nothing when nothing came up short', () => {
    expect(missingWeekNote(0, 0)).toBe('')
  })
  it('counts the short lines when every one has a price', () => {
    expect(missingWeekNote(1, 0)).toBe('1 line')
    expect(missingWeekNote(3, 0)).toBe('3 lines')
  })
  it('says how many the money leaves out', () => {
    expect(missingWeekNote(3, 2)).toBe('3 lines · 2 with no price')
    expect(missingWeekNote(1200, 1100)).toBe('1,200 lines · 1,100 with no price')
  })
  it('says so when none of them has a price, where the money reads $0.00', () => {
    expect(missingWeekNote(1, 1)).toBe('1 line, with no price')
    expect(missingWeekNote(4, 4)).toBe('4 lines, none with a price')
  })
  it('the money is a floor when any short line has no price', () => {
    expect(missingWeekIsPartial(3, 2)).toBe(true)
    expect(missingWeekIsPartial(3, 0)).toBe(false)
    expect(missingWeekIsPartial(0, 0)).toBe(false)
  })
  it('the badge names the lines when there is no money to name', () => {
    expect(shortLinesBadgeWords(1)).toBe('1 line came up short')
    expect(shortLinesBadgeWords(12)).toBe('12 lines came up short')
  })
})
