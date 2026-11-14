// @vitest-environment jsdom
/**
 * The When bar on a narrow screen (punch list #348). At 322 px of screen, which is Safari's text at 125% on a
 * current iPhone, *Repeats* was cut at the bar's edge. The words tighten with the screen and a segment that still
 * cannot fit shortens with … in place of being cut off.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { TaskWhenBar, WHEN_BAR_FONT, WHEN_BAR_PAD } from './TaskWhenBar'

afterEach(cleanup)

/** What a clamp(min, preferred, max) of px and vw comes to at a screen width, as the browser works it out. */
function clampAt(css: string, screenPx: number): number {
  const m = /^clamp\((\d+)px, (.+), (\d+)px\)$/.exec(css)
  if (!m) throw new Error(`not a clamp: ${css}`)
  const [, min, mid, max] = m as unknown as [string, string, string, string]
  const vw = /^([\d.]+)vw$/.exec(mid)
  const calc = /^calc\(\(100vw - (\d+)px\) \/ (\d+)\)$/.exec(mid)
  const preferred = vw ? (Number(vw[1]) / 100) * screenPx : calc ? (screenPx - Number(calc[1])) / Number(calc[2]) : Number.NaN
  return Math.min(Number(max), Math.max(Number(min), preferred))
}

describe('TaskWhenBar', () => {
  it('draws the four choices, one lit', () => {
    render(<TaskWhenBar choice="today" dayLabel="Pick a day" onPick={() => {}} />)
    const bar = screen.getByRole('group', { name: 'When' })
    expect(Array.from(bar.querySelectorAll('button')).map((b) => `${b.textContent}${b.getAttribute('aria-pressed') === 'true' ? ' ✓' : ''}`)).toEqual(['Today ✓', 'Tomorrow', 'Pick a day', 'Repeats'])
  })

  it('lets a segment shorten with … and never cuts one off at the edge', () => {
    render(<TaskWhenBar choice="today" dayLabel="Pick a day" onPick={() => {}} />)
    for (const b of screen.getByRole('group', { name: 'When' }).querySelectorAll('button')) {
      expect(['0', '0px']).toContain(b.style.minWidth)
      expect([b.style.overflow, b.style.textOverflow, b.style.whiteSpace]).toEqual(['hidden', 'ellipsis', 'nowrap'])
    }
  })

  it('keeps its full size on a phone and tightens on a narrow screen', () => {
    // A current iPhone and an iPhone SE: as drawn.
    expect([clampAt(WHEN_BAR_FONT, 402), clampAt(WHEN_BAR_PAD, 402)]).toEqual([13, 5])
    expect([clampAt(WHEN_BAR_FONT, 375), clampAt(WHEN_BAR_PAD, 375)]).toEqual([13, 5])
    // Safari's text at 125% on a current iPhone: 322 px of screen.
    expect([clampAt(WHEN_BAR_FONT, 322), clampAt(WHEN_BAR_PAD, 322)]).toEqual([12, 2])
  })
})
