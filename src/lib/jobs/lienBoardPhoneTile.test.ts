import { describe, expect, it } from 'vitest'
import { lienBoardDayLabelParts, lienBoardTileLabelSplits } from './lienBoardPhoneTile'

describe('a Board tile on a phone', () => {
  it('the day’s label is the day, then its parts', () => {
    expect(lienBoardDayLabelParts('by Dec 15 · 9 to file · 8 to send')).toEqual({ day: 'by Dec 15', parts: '9 to file · 8 to send' })
    expect(lienBoardDayLabelParts('by tomorrow · 2 to send')).toEqual({ day: 'by tomorrow', parts: '2 to send' })
  })

  it('a label with no parts is one line', () => {
    expect(lienBoardDayLabelParts('by Dec 15')).toEqual({ day: 'by Dec 15', parts: '' })
    expect(lienBoardDayLabelParts('nothing dated')).toEqual({ day: 'nothing dated', parts: '' })
  })

  it('only the day’s tile splits, and only on a phone', () => {
    const day = { key: 'by_day', label: 'by Dec 15 · 9 to file · 8 to send' }
    expect(lienBoardTileLabelSplits(day, true)).toBe(true)
    expect(lienBoardTileLabelSplits(day, false)).toBe(false)
    expect(lienBoardTileLabelSplits({ key: 'by_day', label: 'nothing dated' }, true)).toBe(false)
    // Another tile's label stays whole, whatever marks it carries.
    expect(lienBoardTileLabelSplits({ key: 'in_mail', label: 'to print · and mail' }, true)).toBe(false)
  })
})
