import { describe, expect, it } from 'vitest'
import { budgetBySize, perSqFtWords } from './budgets'

describe('the budgets against the size', () => {
  it('gives each trade and the total a cost per square foot, to the cent', () => {
    const summary = budgetBySize(
      [
        { trade: 'Concrete', amount: 84000, ours: false },
        { trade: 'Plumbing', amount: 52000, ours: true },
        { trade: 'Painting', amount: 0, ours: false },
      ],
      6800,
    )
    expect(summary.total).toBe(136000)
    expect(summary.lines.map((l) => (l.perSqFt === null ? null : perSqFtWords(l.perSqFt)))).toEqual(['$12.35/sq ft', '$7.65/sq ft', '$0.00/sq ft'])
    expect(perSqFtWords(summary.totalPerSqFt ?? 0)).toBe('$20.00/sq ft')
    expect(perSqFtWords(1234.5)).toBe('$1,234.50/sq ft')
  })

  it('gives amounts only when no size was given', () => {
    const summary = budgetBySize([{ trade: 'Concrete', amount: 84000, ours: false }], null)
    expect(summary.lines[0]?.perSqFt).toBeNull()
    expect(summary.totalPerSqFt).toBeNull()
    expect(summary.total).toBe(84000)
  })
})
