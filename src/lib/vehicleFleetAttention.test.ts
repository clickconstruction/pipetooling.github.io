import { describe, expect, it } from 'vitest'
import { buildFleetAttentionItems, fleetFactsLine } from './vehicleFleetAttention'

const money = (n: number) => n.toFixed(2)

describe('fleetFactsLine', () => {
  it('always names the total, adds pool and $/wk only when non-zero', () => {
    expect(fleetFactsLine({ total: 12, motorPool: 7, weeklyInsReg: 203.73 }, money)).toEqual(['12 vehicles', '7 in motor pool', '$203.73/wk ins+reg'])
    expect(fleetFactsLine({ total: 1, motorPool: 0, weeklyInsReg: 0 }, money)).toEqual(['1 vehicle'])
    expect(fleetFactsLine({ total: 3, motorPool: 1 }, money)).toEqual(['3 vehicles', '1 in motor pool'])
  })
})

describe('buildFleetAttentionItems', () => {
  it('red first, then amber in reading order; zero rows dropped; actions on the two catch-up rows', () => {
    const items = buildFleetAttentionItems({ unassigned: 2, uninsured: 7, staleReadings: 8, oilDueSoon: 0, oilOverdue: 1, openProblems: 2, openTasks: 1 })
    expect(items.map((i) => `${i.tone}:${i.count} ${i.label}${i.action ? ' ›' : ''}`)).toEqual([
      'red:1 oil overdue',
      'red:2 open problems',
      'amber:8 need a reading ›',
      'amber:7 not on insurance',
      'amber:2 unassigned',
      'amber:1 maintenance task ›',
    ])
  })
  it('pluralizes and empties cleanly', () => {
    expect(buildFleetAttentionItems({ unassigned: 0, uninsured: 0, staleReadings: 0, oilDueSoon: 0, oilOverdue: 0, openProblems: 1, openTasks: 2 }).map((i) => i.label)).toEqual(['open problem', 'maintenance tasks'])
    expect(buildFleetAttentionItems({ unassigned: 0, uninsured: 0, staleReadings: 0, oilDueSoon: 0, oilOverdue: 0, openProblems: 0, openTasks: 0 })).toEqual([])
  })
})
