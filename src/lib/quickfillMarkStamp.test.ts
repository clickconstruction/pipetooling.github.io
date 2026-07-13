import { describe, expect, it } from 'vitest'
import { markStampInitial, markStampTime } from './quickfillMarkStamp'

const NOW = new Date('2026-07-13T18:00:00Z').getTime()
const agoIso = (ms: number) => new Date(NOW - ms).toISOString()

describe('markStampInitial', () => {
  it('uppercased first letter', () => {
    expect(markStampInitial('Taunya')).toBe('T')
    expect(markStampInitial('  wendi s ')).toBe('W')
  })

  it('question mark when unknown', () => {
    expect(markStampInitial(null)).toBe('?')
    expect(markStampInitial('  ')).toBe('?')
    expect(markStampInitial('123')).toBe('?')
  })
})

describe('markStampTime', () => {
  it('minutes and hours and days buckets', () => {
    expect(markStampTime(agoIso(30 * 1000), NOW)).toBe('now')
    expect(markStampTime(agoIso(5 * 60 * 1000), NOW)).toBe('5m')
    expect(markStampTime(agoIso(4 * 3600 * 1000), NOW)).toBe('4h')
    expect(markStampTime(agoIso(3 * 86400 * 1000), NOW)).toBe('3d')
  })

  it('numeric month/day once older than a week', () => {
    const old = new Date('2026-04-14T12:00:00')
    expect(markStampTime(old.toISOString(), NOW)).toBe('4/14')
  })

  it('empty for unparseable input', () => {
    expect(markStampTime('not-a-date', NOW)).toBe('')
  })
})
