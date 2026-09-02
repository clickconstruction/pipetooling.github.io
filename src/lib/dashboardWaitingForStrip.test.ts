import { describe, expect, it } from 'vitest'
import { buildWaitingForStripSummary, clipWaitingForBlockerTitle } from './dashboardWaitingForStrip'

const group = (blockerTitle: string, blockerNames: string[], taskCount: number) => ({
  blockerTitle,
  blockerNames,
  tasks: Array.from({ length: taskCount }, (_, i) => i),
})

describe('buildWaitingForStripSummary', () => {
  it('returns null with no groups', () => {
    expect(buildWaitingForStripSummary([])).toBeNull()
  })

  it('sums tasks across groups and peeks at the first group', () => {
    const s = buildWaitingForStripSummary([
      group('get measurment of foam thickness so i know what wood to buy', ['Robert'], 1),
      group('another blocker', ['Grace', 'Taunya'], 2),
    ])
    expect(s?.count).toBe(3)
    expect(s?.peek).toBe('after "get measurment of foam thickness so i know w…" — Robert')
  })

  it('joins multiple blocker names with commas', () => {
    const s = buildWaitingForStripSummary([group('short blocker', ['Grace', 'Taunya'], 1)])
    expect(s?.peek).toBe('after "short blocker" — Grace, Taunya')
  })

  it('falls back to "not staffed yet" when the blocker has no assignees', () => {
    const s = buildWaitingForStripSummary([group('short blocker', [], 1)])
    expect(s?.peek).toBe('after "short blocker" — not staffed yet')
  })

  it('keeps short titles unclipped', () => {
    expect(clipWaitingForBlockerTitle('short blocker')).toBe('short blocker')
  })

  it('clips long titles at the cap without a trailing space before the ellipsis', () => {
    const clipped = clipWaitingForBlockerTitle('a'.repeat(40) + ' bcdefgh')
    expect(clipped.endsWith('…')).toBe(true)
    expect(clipped).not.toContain(' …')
    expect(clipped.length).toBeLessThanOrEqual(45)
  })
})
