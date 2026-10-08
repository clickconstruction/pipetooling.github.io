
import { describe, expect, it } from 'vitest'
import { theirSovGap } from './theirSov'

const lines = [
  { label: 'Underground and gear', amount: 70_000 },
  { label: 'Rough-in', amount: 98_000 },
  { label: 'Trim', amount: 56_000 },
  { label: 'Site lighting', amount: 24_000 },
]

describe("a trade's own schedule of values (question 4)", () => {
  it('checks it adds up to their number', () => {
    expect(theirSovGap(lines, 248_000)).toBe(0)
    expect(theirSovGap(lines, 250_000)).toBe(-2_000)
  })
})
