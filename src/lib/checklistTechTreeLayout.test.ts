import { describe, expect, it } from 'vitest'
import { nodeHeightForGroup } from './checklistTechTreeLayout'

describe('nodeHeightForGroup', () => {
  it('uses a smaller height when collapsed than expanded for the same task count', () => {
    const n = 5
    const expanded = nodeHeightForGroup(n, false)
    const collapsed = nodeHeightForGroup(n, true)
    expect(collapsed < expanded).toBe(true)
  })
})
