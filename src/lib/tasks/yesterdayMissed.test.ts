import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { MISSED_WORDS, missedDayName, missedLabel, yesterdayMissed } from './yesterdayMissed'

const today = '2026-11-16' // a Monday
const r = (id: string, scheduled_date: string) => ({ id, scheduled_date })

describe('Yesterday', () => {
  it('asks about the latest day in reach that had an unticked task', () => {
    const rows = [r('a', '2026-11-13'), r('b', '2026-11-13'), r('c', '2026-11-12'), r('old', '2026-11-01')]
    expect(yesterdayMissed(rows, today, new Set())).toEqual({ day: '2026-11-13', rows: [r('a', '2026-11-13'), r('b', '2026-11-13')] })
  })
  it('asks once: a task answered as skipped leaves the question', () => {
    const rows = [r('a', '2026-11-15'), r('b', '2026-11-15')]
    expect(yesterdayMissed(rows, today, new Set(['a'])).rows.map((x) => x.id)).toEqual(['b'])
    expect(yesterdayMissed(rows, today, new Set(['a', 'b']))).toEqual({ day: null, rows: [] })
  })
  it('with the latest day all answered, it moves back to the day before, within its reach', () => {
    const rows = [r('a', '2026-11-15'), r('b', '2026-11-14')]
    expect(yesterdayMissed(rows, today, new Set(['a']))).toEqual({ day: '2026-11-14', rows: [r('b', '2026-11-14')] })
  })
  it('does not reach past three days, and never asks about today', () => {
    expect(yesterdayMissed([r('a', '2026-11-12')], today, new Set()).day).toBeNull()
    expect(yesterdayMissed([r('a', '2026-11-13')], today, new Set()).day).toBe('2026-11-13')
    expect(yesterdayMissed([r('a', today)], today, new Set()).day).toBeNull()
  })
  it('names the day', () => {
    expect(missedDayName('2026-11-15', today)).toBe('Yesterday')
    expect(missedDayName('2026-11-13', today)).toBe('Friday')
    expect(missedLabel('2026-11-13', today, 2)).toBe('Friday · 2 not ticked')
    expect(missedLabel('2026-11-15', today, 1)).toBe('Yesterday · 1 not ticked')
  })
  it('says why it asks in plain words', () => {
    expect(plainWordsFailures(MISSED_WORDS)).toEqual([])
  })
})
