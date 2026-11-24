import { describe, expect, it } from 'vitest'
import { PHONE_PRESS_MIN_HEIGHT } from '../../lib/phonePress'
import { THUMB, chipStyle, linePress, phoneButton, tile, tileRow } from './billsSentLook'

describe('billsSentLook — a press on a phone stands a fingertip tall', () => {
  it('takes its height from the app’s one source', () => {
    expect(THUMB).toBe(PHONE_PRESS_MIN_HEIGHT)
    expect(THUMB).toBe(44)
    expect(phoneButton.minHeight).toBe(44)
  })
  it('draws a chip 44 px tall on a phone, pressed or not, and as the office’s small chip at a desk', () => {
    // The live test of 2026-11-24 measured the chips of both views at 38 px on a phone.
    expect(chipStyle(false, true).minHeight).toBe(44)
    expect(chipStyle(true, true).minHeight).toBe(44)
    expect(chipStyle(false, true).whiteSpace).toBe('nowrap')
    expect(chipStyle(false).minHeight).toBeUndefined()
    expect(chipStyle(true, false).minHeight).toBeUndefined()
  })
  it('gives a name or a word that is a press its own 44 px on a phone, and nothing at a desk', () => {
    // A bill's name and a job's name in By day paid's day box were text links 16 px tall.
    expect(linePress(true)).toEqual({ display: 'inline-flex', alignItems: 'center', minHeight: 44 })
    expect(linePress(false)).toEqual({})
  })
})

describe('tileRow — the tiles over either view', () => {
  it('lets a desk fit as many tiles to a row as have room', () => {
    expect(tileRow(false, 5)).toEqual({ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(8rem, 1fr))', gap: '0.4rem' })
  })
  it('sits an even count two to a row on a phone, so no tile is left alone', () => {
    expect(tileRow(true, 4)).toEqual({ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.4rem' })
    expect(tileRow(true, 2)).toEqual(tileRow(true, 6))
  })
  it('wraps an odd count on a phone so the last row’s tiles grow to fill it, and no hole is left', () => {
    // Five tiles at 375 px sat three and two in a three-column grid, with an empty third cell in the second row.
    expect(tileRow(true, 5)).toEqual({ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' })
    expect(tileRow(true, 3)).toEqual(tileRow(true, 5))
    // A tile grows from the width three of them fit a phone at.
    expect(tile.flex).toBe('1 1 5.2rem')
  })
})
