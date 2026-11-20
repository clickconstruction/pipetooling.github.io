import { describe, expect, it } from 'vitest'
import { byTrouble, type Site, type Stage } from './startChecks'
import { TIME_LINE_WORDS, movedSheet, timeLine } from './timeLine'

// Every site, person and day here is made up.
const SITE: Site = { noticeDays: 10, contact: 'Ray' }
const TODAY = '2026-11-17'
const stage = (over: Partial<Stage>): Stage => ({ id: 's1', part: '', job: 'J2101', name: 'Top Out', window: ['2026-12-01', '2026-12-05'], trip: null, finished: false, theirDays: [], bullets: [], decision: null, arrival: null, ...over }) as Stage
const said = (day: string, on: string) => ({ day, said: on, who: 'Ray', how: 'by phone' })

describe('the Schedule look on a line of time', () => {
  it('draws nothing with no stage ahead that has a day', () => {
    expect(timeLine([], SITE, TODAY)).toBeNull()
    expect(timeLine([stage({ window: null })], SITE, TODAY)).toBeNull()
    expect(timeLine([stage({ finished: true })], SITE, TODAY)).toBeNull()
  })

  it('opens on a Monday, spans every day it draws, and places each mark as a share of the span', () => {
    const line = timeLine([stage({ theirDays: [said('2026-11-25', '2026-11-10'), said('2026-11-28', '2026-11-14')] })], SITE, TODAY)
    if (!line) throw new Error('no line')
    expect(new Date(`${line.first}T12:00:00Z`).getUTCDay()).toBe(1)
    expect(line.first <= TODAY && line.last >= '2026-12-06').toBe(true)
    const [row] = line.rows
    expect(row?.bar && row.bar.from < row.bar.to).toBe(true)
    // In order along the line: today, the day we decide (Nov 21), the day they gave before, the day they say now, our days.
    expect((line.today ?? 0) < (row?.decide ?? 0)).toBe(true)
    expect((row?.decide ?? 0) < (row?.before[0] ?? 0)).toBe(true)
    expect((row?.before[0] ?? 0) < (row?.said ?? 0)).toBe(true)
    expect((row?.said ?? 0) < (row?.bar?.from ?? 0)).toBe(true)
    expect(row?.moved).toBe(3)
    expect(row?.words).toBe('Top Out, J2101: Dec 1 to 5. They say ready Nov 28. We decide by Nov 21. They have moved 3 days.')
    expect(line.ticks.every((t) => t.at >= 0 && t.at <= 100)).toBe(true)
    expect(line.ticks.length).toBeLessThanOrEqual(9)
  })

  it('keeps the look’s order, and reads a stage with no day of theirs or of ours in words', () => {
    const late = stage({ id: 'late', name: 'Trim Set', window: ['2027-01-11', '2027-01-15'], theirDays: [said('2027-01-20', '2026-11-14')] })
    const line = timeLine([stage({ id: 'plain' }), late, stage({ id: 'bare', name: 'Rough In', window: null, bullets: [] })], SITE, TODAY)
    // The rows are the look's own, in its order (`byTrouble`).
    expect(line?.rows.map((r) => r.id)).toEqual(byTrouble([stage({ id: 'plain' }), late, stage({ id: 'bare', name: 'Rough In', window: null, bullets: [] })], SITE, TODAY).map((s) => s.id))
    expect(line?.rows.find((r) => r.id === 'late')?.words).toBe('Trim Set, J2101: Jan 11 to 15. They say ready Jan 20. We decide by Jan 1.')
    expect(line?.rows.find((r) => r.id === 'plain')?.words).toBe('Top Out, J2101: Dec 1 to 5. They have given no day. We decide by Nov 21.')
    expect(line?.rows.find((r) => r.id === 'bare')).toMatchObject({ bar: null, decide: null, said: null })
  })

  it('names the moved days by count', () => {
    expect(TIME_LINE_WORDS.moved(1)).toBe('moved 1 day')
    expect(TIME_LINE_WORDS.moved(4)).toBe('moved 4 days')
  })
})

describe('the days they gave, on paper', () => {
  it('lists every day a stage was given, oldest first, with each move and the total', () => {
    const sheet = movedSheet([
      stage({ theirDays: [said('2026-11-25', '2026-11-10'), said('2026-11-26', '2026-11-12'), said('2026-11-28', '2026-11-14')] }),
      stage({ id: 's2', name: 'Trim Set', part: 'Building B', theirDays: [said('2027-01-08', '2026-11-14')] }),
      stage({ id: 's3', name: 'Rough In' }),
    ])
    expect(sheet.stages.map((s) => s.id)).toEqual(['s1', 's2'])
    expect(sheet.stages[0]?.days.map((d) => d.moved)).toEqual([null, 1, 2])
    expect(sheet.stages[0]).toMatchObject({ moved: 3, ours: 'Dec 1 to 5', job: 'J2101' })
    expect(sheet.stages[1]).toMatchObject({ moved: 0, job: 'J2101 · Building B' })
    expect(sheet.total).toBe(3)
    expect(sheet.line).toBe('3 days moved across 1 stage.')
    expect(movedSheet([stage({ theirDays: [said('2026-11-25', '2026-11-10')] })]).line).toBe('No day has moved.')
  })
})
