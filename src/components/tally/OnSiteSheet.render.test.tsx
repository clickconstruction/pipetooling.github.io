// @vitest-environment jsdom
/**
 * The On site tab's sheet (punch list #209): its × is 48 by 48, the bar a box's screen holds every press to
 * (punch list #398). The phone walk of 2026-11-21 read it at 39 by 38 on a box's More sheet. A layout is a browser's
 * to measure, so this holds the sizes the measure rests on, and the margins that keep the title row where it was.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SHEET_CLOSE_STYLE, SHEET_TOUCH_MIN, Sheet } from './OnSiteSheet'

afterEach(cleanup)

describe('the On site sheet’s ×', () => {
  it('is 48 by 48 and closes the sheet', () => {
    const onClose = vi.fn()
    render(
      <Sheet title="More for G12" onClose={onClose}>
        <p>Edit G12</p>
      </Sheet>,
    )
    const x = screen.getByRole('button', { name: 'Close' })
    expect(SHEET_TOUCH_MIN).toBe(48)
    expect([x.style.minHeight, x.style.minWidth]).toEqual(['48px', '48px'])
    fireEvent.click(x)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('gives the title row back what it grew by, so the row and the × stay where they were', () => {
    // 38 px drawn: 5 comes back over it and 5 under it. 39 px wide: 4.5 comes back at the right, where it grew past its old edge.
    expect([SHEET_CLOSE_STYLE.marginTop, SHEET_CLOSE_STYLE.marginBottom, SHEET_CLOSE_STYLE.marginRight]).toEqual([-5, -5, -4.5])
    expect(Number(SHEET_CLOSE_STYLE.minHeight) + Number(SHEET_CLOSE_STYLE.marginTop) + Number(SHEET_CLOSE_STYLE.marginBottom)).toBe(38)
    expect(SHEET_CLOSE_STYLE.marginLeft).toBe('auto')
  })
})
