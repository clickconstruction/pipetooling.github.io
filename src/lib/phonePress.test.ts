import { describe, expect, it } from 'vitest'
import { ONE_ROW_PILLS, PHONE_PILL_MIN_HEIGHT, PHONE_PRESS_MIN_HEIGHT, activityPillStyle, activityPillsOnOneRow, thumbInLine } from './phonePress'

describe('phonePress', () => {
  it('holds the two heights the walk asked for', () => {
    expect(PHONE_PRESS_MIN_HEIGHT).toBe(44)
    expect(PHONE_PILL_MIN_HEIGHT).toBe(32)
  })

  it('grows the activity pills to 32 px on a phone and leaves the office chip alone', () => {
    expect(activityPillStyle(true).minHeight).toBe(32)
    expect(activityPillStyle(true).fontSize).toBe('0.75rem')
    expect(activityPillStyle(false).minHeight).toBeUndefined()
    expect(activityPillStyle(false).padding).toBe('0.15rem 0.5rem')
  })

  it('keeps the pills to one row only on a phone, and only on the row that carries Customer', () => {
    expect(activityPillsOnOneRow({ narrow: true, withCustomer: true })).toBe(true)
    expect(activityPillsOnOneRow({ narrow: true, withCustomer: false })).toBe(false)
    expect(activityPillsOnOneRow({ narrow: false, withCustomer: true })).toBe(false)
    expect(activityPillsOnOneRow({ narrow: false, withCustomer: false })).toBe(false)
  })

  it('trims the one row to the sides only: the height is the phone pill\'s own', () => {
    // The vertical half of each trim is the phone pill's, so the 32 px a fingertip needs holds.
    const tall = String(activityPillStyle(true).padding).split(' ')[0]
    expect(ONE_ROW_PILLS.pill.split(' ')[0]).toBe(tall)
    expect(ONE_ROW_PILLS.word.split(' ')[0]).toBe(tall)
    // A dim word's side padding and border are what the fade lets hide.
    expect(ONE_ROW_PILLS.fadeSlack).toBeGreaterThanOrEqual(5)
  })

  it('stands a press in a line a fingertip tall and gives the line back what the press grew by', () => {
    // A 28 px press grows by 16, so 8 comes off over it and 8 under it: the line stays 28.
    expect(thumbInLine(28)).toEqual({ minHeight: 44, marginTop: -8, marginBottom: -8 })
    expect(thumbInLine(27)).toEqual({ minHeight: 44, marginTop: -8.5, marginBottom: -8.5 })
    const { minHeight, marginTop, marginBottom } = thumbInLine(32)
    expect(minHeight + marginTop + marginBottom).toBe(32)
  })

  it('takes no margin from a press that is a fingertip tall already', () => {
    expect(thumbInLine(44)).toEqual({ minHeight: 44, marginTop: 0, marginBottom: 0 })
    expect(thumbInLine(60)).toEqual({ minHeight: 44, marginTop: 0, marginBottom: 0 })
  })
})
