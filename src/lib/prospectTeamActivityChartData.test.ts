import { describe, expect, it } from 'vitest'
import {
  buildProspectTeamActivityChartData,
  getOrderedDateKeysLast30Days,
} from './prospectTeamActivityChartData'
import type { ProspectTeamRow } from './prospectTeamActivity'

describe('prospectTeamActivityChartData', () => {
  it('getOrderedDateKeysLast30Days returns 30 keys oldest to newest', () => {
    const keys = getOrderedDateKeysLast30Days()
    expect(keys).toHaveLength(30)
    for (let i = 1; i < keys.length; i++) {
      expect(keys[i]! > keys[i - 1]!).toBe(true)
    }
  })

  it('buildProspectTeamActivityChartData sums marked+updated per user per day', () => {
    const keys = getOrderedDateKeysLast30Days()
    const dk = keys[keys.length - 1]!
    const u1 = 'user-1'
    const u2 = 'user-2'
    const row: ProspectTeamRow = {
      user_id: u1,
      name: 'Alice',
      email: null,
      cards_marked: 2,
      cards_updated: 1,
    }
    const row2: ProspectTeamRow = {
      user_id: u2,
      name: 'Bob',
      email: null,
      cards_marked: 0,
      cards_updated: 0,
    }
    const teamDataByDate: Record<string, ProspectTeamRow[]> = {}
    for (const k of keys) {
      teamDataByDate[k] = [
        { ...row, cards_marked: k === dk ? 2 : 0, cards_updated: k === dk ? 1 : 0 },
        { ...row2 },
      ]
    }
    const { chartRows, userSeries } = buildProspectTeamActivityChartData(teamDataByDate)
    expect(userSeries.map((u) => u.userId)).toEqual([u1, u2])
    const last = chartRows[chartRows.length - 1]!
    expect(last[u1]).toBe(3)
    expect(last[u2]).toBe(0)
  })
})
