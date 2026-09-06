import { describe, expect, it } from 'vitest'
import { buildHoursGridRoster } from './hoursGridRoster'

describe('buildHoursGridRoster', () => {
  it('drops archived accounts (trimmed match), orders by display sequence, then alphabetically for the unordered', () => {
    const rows = buildHoursGridRoster({
      payConfigNames: ['Zed Quinn', 'Ana Ruiz', ' Old Helper ', 'Bo Lee', 'Cy Park'],
      archivedUserNames: new Set(['Old Helper']),
      displayOrder: { 'Cy Park': 1, 'Zed Quinn': 2 },
    })
    expect(rows).toEqual(['Cy Park', 'Zed Quinn', 'Ana Ruiz', 'Bo Lee'])
  })

  it('is the same list whatever the viewer, given the same inputs — the J7-6 divergence was an unloaded archived set', () => {
    const payConfigNames = ['Ana Ruiz', 'Archived One', 'Archived Two']
    const displayOrder = {}
    const archived = new Set(['Archived One', 'Archived Two'])
    const owner = buildHoursGridRoster({ payConfigNames, archivedUserNames: archived, displayOrder })
    const assistant = buildHoursGridRoster({ payConfigNames, archivedUserNames: archived, displayOrder })
    expect(assistant).toEqual(owner)
    expect(owner).toEqual(['Ana Ruiz'])
    // The bug: an empty archived set (never loaded) shows every archived row as a zero-hour line.
    expect(buildHoursGridRoster({ payConfigNames, archivedUserNames: new Set(), displayOrder })).toHaveLength(3)
  })

  it('returns an empty roster when nobody has a pay-config row', () => {
    expect(buildHoursGridRoster({ payConfigNames: [], archivedUserNames: new Set(), displayOrder: {} })).toEqual([])
  })
})
