// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { TagBreakdownCard } from './TagBreakdownCard'
import { KindBreakdownCard } from './KindBreakdownCard'

afterEach(() => {
  cleanup()
  try {
    localStorage.clear()
  } catch {
    /* jsdom */
  }
})

const marginColor = () => 'green'
const rows = [
  { id: 'a', name: 'WC', count: 2, cost: 500, revenue: 1000, kind: 'fixture' as const, tags: ['restrooms'], materialCost: 200, materialPrice: 320 },
  { id: 'b', name: 'LAV', count: 2, cost: 400, revenue: 800, kind: 'fixture' as const, tags: ['restrooms', 'level 2'], materialCost: 100, materialPrice: 150 },
  { id: 'c', name: 'Scissor lift', count: 1, cost: 0, revenue: 200, kind: 'equipment' as const, tags: [] },
]

describe('TagBreakdownCard', () => {
  it('lists each tag with its price and the weighted markup, then No tag, and says a row carries two tags', () => {
    render(<TagBreakdownCard rows={rows} marginColor={marginColor} />)
    expect(screen.getByText('Tag breakdown')).toBeTruthy()
    expect(screen.getByText('restrooms')).toBeTruthy()
    expect(screen.getByText('level 2')).toBeTruthy()
    expect(screen.getByText('No tag')).toBeTruthy()
    expect(screen.getByText('$1,800.00')).toBeTruthy()
    expect(screen.getByText(/carries two tags/)).toBeTruthy()
  })
  it('with no tags says so and draws no table', () => {
    render(<TagBreakdownCard rows={rows.map((r) => ({ ...r, tags: [] }))} marginColor={marginColor} />)
    expect(screen.getByText(/no tags yet/)).toBeTruthy()
    expect(screen.queryByText('No tag')).toBeNull()
  })
})

describe('KindBreakdownCard', () => {
  it('buckets the rows by their saved kind with cost, price, profit and margin', () => {
    render(<KindBreakdownCard rows={rows} marginColor={marginColor} />)
    expect(screen.getByText('Kind breakdown')).toBeTruthy()
    expect(screen.getByText('2 kinds')).toBeTruthy()
    expect(screen.getByText('Fixtures')).toBeTruthy()
    expect(screen.getByText('Equipment')).toBeTruthy()
    expect(screen.getByText('$1,800.00')).toBeTruthy()
    expect(screen.getByText('$2,000.00')).toBeTruthy()
  })
})
