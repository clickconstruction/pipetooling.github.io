import { describe, expect, it } from 'vitest'
import { pickActiveDashboardSection, clampedCenterScrollLeft } from './dashboardSectionDock'

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

describe('clampedCenterScrollLeft', () => {
  it('zero when the content fits the view (no overflow)', () => {
    expect(clampedCenterScrollLeft(100, 50, 800, 600)).toBe(0)
  })

  it('centers a middle chip', () => {
    // chip center 1000, view 400 -> ideal 800; content 2000 -> max 1600
    expect(clampedCenterScrollLeft(975, 50, 400, 2000)).toBe(800)
  })

  it('clamps at the left start', () => {
    expect(clampedCenterScrollLeft(10, 50, 400, 2000)).toBe(0)
  })

  it('clamps once the right end of the bar is in view', () => {
    // ideal would be 1750; max scroll is 1600
    expect(clampedCenterScrollLeft(1925, 50, 400, 2000)).toBe(1600)
  })
})
