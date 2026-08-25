// @vitest-environment jsdom
/**
 * Regression guard for the Goals bar phone layout (v2.2263 wrap → clobbered
 * by a stale-checkout merge in v2.2264 → restored in v2.2278 → uniform grid
 * in v2.2281). These assertions pin the grid: uniform auto-fit columns with a
 * 12px floor mean every segment is the same size on every row and a short
 * last row ends early instead of stretching. If a future PR reverts to a
 * plain flex row, this fails loudly instead of the bar silently bleeding off
 * (or ballooning on) 375px screens again.
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
  it('lays 50 stages on a uniform auto-fit grid: equal columns with a 12px floor, no per-segment flex', () => {
    render(<GoalsStageStrip stages={makeStages(50)} />)
    const strip = screen.getByTestId('goals-stage-strip')
    // Uniform columns by construction: every segment is the same width on
    // every row, and a short last row ends early instead of flex-growing its
    // few segments into giants (the v2.2278 regression) or shrinking the
    // tail off-screen (the pre-v2.2263 one).
    expect(strip.style.display).toBe('grid')
    expect(strip.style.gridTemplateColumns).toBe('repeat(auto-fit, minmax(12px, 1fr))')
    const segments = Array.from(strip.children) as HTMLElement[]
    expect(segments).toHaveLength(50)
    for (const seg of segments) {
      expect(seg.style.flex).toBe('')
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
