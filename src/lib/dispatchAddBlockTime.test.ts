import { describe, expect, it } from 'vitest'
import {
  DISPATCH_ADD_BLOCK_SLOT_COUNT,
  DISPATCH_DEFAULT_NEW_BLOCK_PREFERRED_DURATION_MIN,
  DISPATCH_DEFAULT_NEW_BLOCK_PREFERRED_START_MIN,
  MAX_MIN,
  MIN_MIN,
  clampDispatchEndStartForMinDuration,
  clampDispatchStartEndForMinDuration,
  dispatchMinutesToFractionalSlotIndex,
  dispatchMinutesToHHmm,
  dispatchMinutesToSlotIndex,
  dispatchSlotIndexToMinutes,
  formatBlockDurationAriaLabel,
  formatBlockDurationMinutes,
  formatDispatchQuickTimeLabel,
  timeInputToMinutesSafe,
  timeInputToPg,
} from './dispatchAddBlockTime'

describe('the dispatch grid', () => {
  it('runs 4:00 AM to 8:00 PM in 30-minute slots, preferring an 8 AM–4 PM block', () => {
    expect(MIN_MIN).toBe(240)
    expect(MAX_MIN).toBe(1200)
    expect(DISPATCH_ADD_BLOCK_SLOT_COUNT).toBe(33)
    expect(DISPATCH_DEFAULT_NEW_BLOCK_PREFERRED_START_MIN).toBe(480)
    expect(DISPATCH_DEFAULT_NEW_BLOCK_PREFERRED_DURATION_MIN).toBe(480)
  })
  it('slot ↔ minutes conversions clamp to the grid and round to the nearest slot', () => {
    expect(dispatchSlotIndexToMinutes(0)).toBe(240)
    expect(dispatchSlotIndexToMinutes(32)).toBe(1200)
    expect(dispatchSlotIndexToMinutes(99)).toBe(1200)
    expect(dispatchSlotIndexToMinutes(-5)).toBe(240)
    expect(dispatchMinutesToSlotIndex(480)).toBe(8)
    expect(dispatchMinutesToSlotIndex(494)).toBe(8) // 8:14 rounds down
    expect(dispatchMinutesToSlotIndex(495)).toBe(9) // 8:15 rounds up
    expect(dispatchMinutesToSlotIndex(0)).toBe(0)
    expect(dispatchMinutesToSlotIndex(5000)).toBe(32)
    expect(dispatchMinutesToFractionalSlotIndex(495)).toBe(8.5)
    expect(dispatchMinutesToFractionalSlotIndex(0)).toBe(0)
  })
})

describe('time strings', () => {
  it('timeInputToPg appends seconds once', () => {
    expect(timeInputToPg('08:30')).toBe('08:30:00')
    expect(timeInputToPg(' 08:30:15 ')).toBe('08:30:15')
    expect(timeInputToPg('8:30')).toBe('8:30:00')
  })
  it('dispatchMinutesToHHmm clamps to the grid', () => {
    expect(dispatchMinutesToHHmm(495)).toBe('08:15')
    expect(dispatchMinutesToHHmm(0)).toBe('04:00')
    expect(dispatchMinutesToHHmm(1439)).toBe('20:00')
  })
  it('timeInputToMinutesSafe parses HH:MM and falls back to 0', () => {
    expect(timeInputToMinutesSafe('08:30')).toBe(510)
    expect(timeInputToMinutesSafe('junk')).toBe(0)
  })
  it('formatDispatchQuickTimeLabel renders 12-hour labels', () => {
    expect(formatDispatchQuickTimeLabel('08:05')).toBe('8:05 AM')
    expect(formatDispatchQuickTimeLabel('12:00')).toBe('12:00 PM')
    expect(formatDispatchQuickTimeLabel('00:30')).toBe('12:30 AM')
    expect(formatDispatchQuickTimeLabel('16:00')).toBe('4:00 PM')
    expect(formatDispatchQuickTimeLabel('nope')).toBe('nope')
  })
})

describe('minimum-duration clamps', () => {
  it('moving the start keeps at least 30 minutes by pushing the end, or the start back at the top of the grid', () => {
    expect(clampDispatchStartEndForMinDuration(600, 660)).toEqual({ s: 600, e: 660 })
    expect(clampDispatchStartEndForMinDuration(600, 600)).toEqual({ s: 600, e: 630 })
    expect(clampDispatchStartEndForMinDuration(600, 590)).toEqual({ s: 600, e: 630 })
    expect(clampDispatchStartEndForMinDuration(1190, 1200)).toEqual({ s: 1170, e: 1200 })
  })
  it('moving the end keeps at least 30 minutes by pulling the start, or the end forward at the bottom of the grid', () => {
    expect(clampDispatchEndStartForMinDuration(660, 600)).toEqual({ s: 600, e: 660 })
    expect(clampDispatchEndStartForMinDuration(600, 600)).toEqual({ s: 570, e: 600 })
    expect(clampDispatchEndStartForMinDuration(250, 240)).toEqual({ s: 240, e: 270 })
  })
})

describe('duration labels', () => {
  it('formats minutes as h/m, with a dash for nothing', () => {
    expect(formatBlockDurationMinutes(0)).toBe('—')
    expect(formatBlockDurationMinutes(Number.NaN)).toBe('—')
    expect(formatBlockDurationMinutes(45)).toBe('45m')
    expect(formatBlockDurationMinutes(480)).toBe('8h 0m')
    expect(formatBlockDurationMinutes(95)).toBe('1h 35m')
  })
  it('spells out the aria label with singular/plural', () => {
    expect(formatBlockDurationAriaLabel(0)).toBe('Duration not available')
    expect(formatBlockDurationAriaLabel(60)).toBe('Duration 1 hour')
    expect(formatBlockDurationAriaLabel(121)).toBe('Duration 2 hours 1 minute')
    expect(formatBlockDurationAriaLabel(30)).toBe('Duration 30 minutes')
  })
})
