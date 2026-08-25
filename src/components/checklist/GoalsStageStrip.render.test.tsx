// @vitest-environment jsdom
/**
 * Regression guard for the Goals bar phone fix (v2.2263 → clobbered by a
 * stale-checkout merge in v2.2264 → restored + extracted in v2.2278).
 * These assertions pin the wrap styling: if a future PR reverts the strip to
 * a non-wrapping row with shrinkable segments, this fails loudly instead of
 * the bar silently bleeding off 375px screens again.
 */
import { describe, expect, it, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { GoalsStageStrip } from './GoalsStageStrip'
import type { GoalsStageRow } from '../../lib/roadmapBridge'

afterEach(cleanup)

function makeStages(n: number): GoalsStageRow[] {
  return Array.from({ length: n }, (_, i) => ({
    groupId: `g${i + 1}`,
    title: `Stage ${i + 1}`,
    done: i < 18 ? 3 : i === 18 ? 1 : 0,
    total: 3,
    state: i < 18 ? 'complete' : i === 18 ? 'current' : i >= 44 ? 'unplanned' : 'locked',
    openAssigned: 0,
    blockedBy: [],
  }))
}

describe('GoalsStageStrip', () => {
  it('wraps 50 stages instead of overflowing: flex-wrap on the row, 12px flex-basis floor per segment', () => {
    render(<GoalsStageStrip stages={makeStages(50)} />)
    const strip = screen.getByTestId('goals-stage-strip')
    expect(strip.style.flexWrap).toBe('wrap')
    const segments = Array.from(strip.children) as HTMLElement[]
    expect(segments).toHaveLength(50)
    for (const seg of segments) {
      // '1 0 12px' — grow, no shrink, legible minimum. A shrinkable basis is
      // exactly the regression that pushed the tail off-screen.
      expect(seg.style.flexBasis).toBe('12px')
      expect(seg.style.flexShrink).toBe('0')
    }
  })

  it('numbers every stage — the wrap minimum always fits them, even past 40 stages', () => {
    render(<GoalsStageStrip stages={makeStages(50)} />)
    expect(screen.getByText('50')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy()
  })

  it('keeps the stage states: green done, amber-ringed current with partial fill, dashed unplanned', () => {
    render(<GoalsStageStrip stages={makeStages(50)} />)
    const strip = screen.getByTestId('goals-stage-strip')
    const segments = Array.from(strip.children) as HTMLElement[]
    expect(segments[0]!.style.background).toContain('22, 163, 74') // #16a34a
    expect(segments[18]!.style.outline).toContain('#d97706')
    expect(segments[18]!.querySelector('span')!.style.width).toBe('33%') // 1 of 3 done
    expect(segments[49]!.style.border).toContain('dashed')
  })
})
