import { describe, expect, it } from 'vitest'
import {
  TAKEOFF_FOCUS_BESIDE_PX,
  TAKEOFF_LINES_ROOMY_PX,
  TAKEOFF_LINES_SNUG_PX,
  TAKEOFF_SHEET_BESIDE_PX,
  focusListFitsBeside,
  railFitsBeside,
  takeoffLinesFit,
  tightenedLinesFit,
} from './takeoffSheetFit'

describe('railFitsBeside', () => {
  it('is the list at its comfortable width, the gap and the rail: 1,096 px', () => {
    expect(TAKEOFF_SHEET_BESIDE_PX).toBe(1096)
    expect(railFitsBeside(1096)).toBe(true)
    expect(railFitsBeside(1095.5)).toBe(false)
  })

  it('answers the four measured windows (1,400, 1,100, 900 and 760 px give the sheet 1,222, 922, 722 and 630)', () => {
    expect(railFitsBeside(1222)).toBe(true)
    expect(railFitsBeside(922)).toBe(false)
    expect(railFitsBeside(722)).toBe(false)
    expect(railFitsBeside(630)).toBe(false)
  })

  it('keeps the rail beside the list in a 1,280 px window (1,102) and lets it go at 1,273 (1,095)', () => {
    expect(railFitsBeside(1102)).toBe(true)
    expect(railFitsBeside(1095)).toBe(false)
  })

  it('reads a box nobody measured as wide, the look the screen had before', () => {
    expect(railFitsBeside(null)).toBe(true)
    expect(railFitsBeside(undefined)).toBe(true)
  })
})

describe('focusListFitsBeside', () => {
  it('is the list, the gap, the card around the table and the table: 1,114 px', () => {
    expect(TAKEOFF_FOCUS_BESIDE_PX).toBe(1114)
    expect(focusListFitsBeside(1114)).toBe(true)
    expect(focusListFitsBeside(1113)).toBe(false)
    expect(focusListFitsBeside(782)).toBe(false)
    expect(focusListFitsBeside(null)).toBe(true)
  })
})

describe('takeoffLinesFit', () => {
  it('is roomy from 760 px, snug from 620, and scrolls under that', () => {
    expect(takeoffLinesFit(TAKEOFF_LINES_ROOMY_PX)).toBe('roomy')
    expect(takeoffLinesFit(TAKEOFF_LINES_ROOMY_PX - 1)).toBe('snug')
    expect(takeoffLinesFit(TAKEOFF_LINES_SNUG_PX)).toBe('snug')
    expect(takeoffLinesFit(TAKEOFF_LINES_SNUG_PX - 1)).toBe('scroll')
    expect(takeoffLinesFit(0)).toBe('scroll')
  })

  it('answers the list widths of the measured windows once the rail is out of the column', () => {
    // 900 px window: the sheet is 722 wide and the list has all of it.
    expect(takeoffLinesFit(722)).toBe('snug')
    // 760 px window: 630.
    expect(takeoffLinesFit(630)).toBe('snug')
    // A phone at 390: 290.
    expect(takeoffLinesFit(290)).toBe('scroll')
    // 1,400 px with the rail beside: 886.
    expect(takeoffLinesFit(886)).toBe('roomy')
  })

  it('reads an unmeasured box as roomy', () => {
    expect(takeoffLinesFit(null)).toBe('roomy')
    expect(takeoffLinesFit(undefined)).toBe('roomy')
  })
})

describe('tightenedLinesFit', () => {
  it('steps one tighter for each overflow seen and stops at scroll', () => {
    expect(tightenedLinesFit('roomy', 0)).toBe('roomy')
    expect(tightenedLinesFit('roomy', 1)).toBe('snug')
    expect(tightenedLinesFit('roomy', 2)).toBe('scroll')
    expect(tightenedLinesFit('roomy', 9)).toBe('scroll')
    expect(tightenedLinesFit('snug', 1)).toBe('scroll')
    expect(tightenedLinesFit('scroll', 3)).toBe('scroll')
  })
})
