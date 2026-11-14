import { describe, expect, it } from 'vitest'
import { lienStepFoldList, lienStepFoldWords, lienStepRailsShown } from './lienStepFold'

describe('lienStepFold', () => {
  it('lists the kinds of paper as a sentence would', () => {
    expect(lienStepFoldList(['Notices', 'Reminders', 'Affidavits', 'Retainage'])).toBe('Notices, Reminders, Affidavits and Retainage')
    expect(lienStepFoldList(['Notices', 'Affidavits'])).toBe('Notices and Affidavits')
    expect(lienStepFoldList(['Notices'])).toBe('Notices')
    expect(lienStepFoldList([])).toBe('')
  })

  it('folded, the row names what unfolds; unfolded, it offers to hide them', () => {
    expect(lienStepFoldWords(['Notices', 'Affidavits'], false)).toEqual({ label: 'Steps of each paper', hint: 'Notices and Affidavits' })
    expect(lienStepFoldWords(['Notices', 'Affidavits'], true)).toEqual({ label: 'Hide the steps', hint: '' })
  })

  it('a computer always draws the rails', () => {
    expect(lienStepRailsShown({ isMobile: false, unfolded: false, stepPressed: false })).toBe(true)
  })

  it('a phone draws them once unfolded, or while a step is pressed', () => {
    expect(lienStepRailsShown({ isMobile: true, unfolded: false, stepPressed: false })).toBe(false)
    expect(lienStepRailsShown({ isMobile: true, unfolded: true, stepPressed: false })).toBe(true)
    expect(lienStepRailsShown({ isMobile: true, unfolded: false, stepPressed: true })).toBe(true)
  })
})
