import { describe, expect, it } from 'vitest'
import { pickActiveDashboardSection } from './dashboardSectionDock'

const anchors = [
  { id: 'a', top: 0 },
  { id: 'b', top: 500 },
  { id: 'c', top: 1200 },
]

describe('pickActiveDashboardSection', () => {
  it('null when there are no anchors', () => {
    expect(pickActiveDashboardSection([], 100)).toBeNull()
  })

  it('first section before any anchor is passed', () => {
    expect(pickActiveDashboardSection(anchors, -50)).toBe('a')
  })

  it('last passed anchor wins', () => {
    expect(pickActiveDashboardSection(anchors, 499)).toBe('a')
    expect(pickActiveDashboardSection(anchors, 500)).toBe('b')
    expect(pickActiveDashboardSection(anchors, 5000)).toBe('c')
  })

  it('order of input does not matter', () => {
    expect(pickActiveDashboardSection([...anchors].reverse(), 600)).toBe('b')
  })
})
