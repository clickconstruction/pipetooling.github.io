import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { axisClock, coverageDoor, coverageGrid, PUSH_HOURS_DOOR } from './coverageGrid'
import { parsePushHours } from './pushHours'
import type { CoverageMember } from './whoIsOff'

/** Every day, 6 AM to 8 PM: the Push me default. */
const EVERY_DAY = parsePushHours({ days: [0, 1, 2, 3, 4, 5, 6], opens: '06:00', closes: '20:00' })!
/** Mon to Fri, 6 AM to 8 PM. */
const WEEKDAYS = parsePushHours({ days: [1, 2, 3, 4, 5], opens: '06:00', closes: '20:00' })!

const member = (name: string, hours: CoverageMember['hours'], id?: string): CoverageMember => ({ name, hours, ...(id ? { id } : {}) })

describe('the coverage grid (punch list #217, office-11): the hours the line is read from', () => {
  it('a gap every row shares: one panel for every day, a bar a person, the night as two red columns with their times', () => {
    const grid = coverageGrid([member('Rosa Delgado', EVERY_DAY, 'u-rosa'), member('Cora Lee', EVERY_DAY, 'u-cora'), member('Max Hart', EVERY_DAY, 'u-max')], 'u-cora')!
    expect(grid.panels).toHaveLength(1)
    const panel = grid.panels[0]!
    expect(panel.label).toBe('Every day')
    expect(panel.days).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(panel.rows.map((r) => r.short)).toEqual(['Rosa', 'Cora', 'Max'])
    expect(panel.rows.every((r) => r.bar?.start === 6 * 60 && r.bar.end === 20 * 60 && r.bar.words === '6 AM to 8 PM')).toBe(true)
    expect(panel.gaps).toEqual([
      { start: 0, end: 6 * 60, words: 'to 6 AM' },
      { start: 20 * 60, end: 24 * 60, words: 'from 8 PM' },
    ])
    expect(grid.long).toEqual([])
    expect(grid.ticks.map((t) => t.words)).toEqual(['midnight', '6 AM', 'noon', '6 PM', 'midnight'])
    // The press: your own hours on Your account, another's desk.
    expect(panel.rows[1]!.mine).toBe(true)
    expect(panel.rows[1]!.door).toEqual({ to: PUSH_HOURS_DOOR, words: 'You: open your Push me hours.' })
    expect(panel.rows[0]!.door).toEqual({ to: '/settings?tab=settings-phone-texts&person=u:u-rosa', words: 'Rosa: open their desk. Only Rosa can set their hours.' })
  })

  it('a weekend gap: the weekdays draw once and the weekend is a chip, not a panel of empty rows', () => {
    const grid = coverageGrid([member('Rosa', WEEKDAYS), member('Evan', WEEKDAYS)])!
    expect(grid.panels.map((p) => p.label)).toEqual(['Mon to Fri'])
    expect(grid.panels[0]!.gaps.map((g) => g.words)).toEqual(['to 6 AM', 'from 8 PM'])
    expect(grid.long).toEqual(['Fri 8 PM to Mon 6 AM'])
    // No id came with the rows: no door.
    expect(grid.panels[0]!.rows.every((r) => r.door === null)).toBe(true)
  })

  it('days that differ each draw: one person on the weekend keeps it a panel, the other off that day', () => {
    const cora = parsePushHours({ days: [0, 1, 2, 3, 4, 5, 6], opens: '06:00', closes: '23:00' })
    const grid = coverageGrid([member('Rosa', WEEKDAYS, 'u-rosa'), member('Cora', cora, 'u-cora')])!
    expect(grid.panels.map((p) => p.label)).toEqual(['Sun and Sat', 'Mon to Fri'])
    const weekend = grid.panels[0]!
    expect(weekend.days).toEqual([0, 6])
    expect(weekend.rows.map((r) => r.bar?.words ?? 'off')).toEqual(['off', '6 AM to 11 PM'])
    expect(weekend.gaps.map((g) => g.words)).toEqual(['to 6 AM', 'from 11 PM'])
    const weekdays = grid.panels[1]!
    expect(weekdays.rows.map((r) => r.bar?.words ?? 'off')).toEqual(['6 AM to 8 PM', '6 AM to 11 PM'])
    expect(weekdays.gaps.map((g) => g.words)).toEqual(['to 6 AM', 'from 11 PM'])
    expect(grid.long).toEqual([])
  })

  it('one person covering the night closes the gap: two shifts that meet leave only what neither covers', () => {
    const early = parsePushHours({ days: [0, 1, 2, 3, 4, 5, 6], opens: '06:00', closes: '14:00' })
    const night = parsePushHours({ days: [0, 1, 2, 3, 4, 5, 6], opens: '14:00', closes: '23:30' })
    const grid = coverageGrid([member('Rosa', early), member('Max', night)])!
    expect(grid.panels[0]!.gaps).toEqual([
      { start: 0, end: 6 * 60, words: 'to 6 AM' },
      { start: 23 * 60 + 30, end: 24 * 60, words: 'from 11:30 PM' },
    ])
    // Someone pushed any time, or around the clock: no gap, so no grid, as there is no line.
    expect(coverageGrid([member('Rosa', early), member('Max', null)])).toBeNull()
    expect(coverageGrid([member('Rosa', { ...early!, always: true })])).toBeNull()
  })

  it('nobody with hours: nothing to draw', () => {
    expect(coverageGrid([])).toBeNull()
    expect(coverageGrid([member('Rosa', null), member('Max', null)])).toBeNull()
  })

  it('a stretch inside the day is said with both ends, and a whole day as such', () => {
    const morning = parsePushHours({ days: [0, 1, 2, 3, 4, 5, 6], opens: '06:00', closes: '12:00' })
    const afternoon = parsePushHours({ days: [0, 1, 2, 3, 4, 5, 6], opens: '13:00', closes: '20:00' })
    const grid = coverageGrid([member('Rosa', morning), member('Max', afternoon)])!
    expect(grid.panels[0]!.gaps.map((g) => g.words)).toEqual(['to 6 AM', '12 PM to 1 PM', 'from 8 PM'])
    expect(axisClock(0)).toBe('midnight')
    expect(axisClock(24 * 60)).toBe('midnight')
    expect(axisClock(7 * 60 + 30)).toBe('7:30 AM')
  })

  it('the words, plain', () => {
    const grid = coverageGrid([member('Rosa Delgado', WEEKDAYS, 'u-rosa'), member('Cora Lee', EVERY_DAY, 'u-cora')], 'u-cora')!
    for (const p of grid.panels) {
      for (const r of p.rows) if (r.door) expect(plainWordsFailures(r.door.words)).toEqual([])
    }
    expect(coverageDoor({ id: null, short: 'Rosa', mine: false })).toBeNull()
  })
})
