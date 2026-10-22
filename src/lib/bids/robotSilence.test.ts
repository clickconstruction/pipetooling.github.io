import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { clockWords, robotAsleepWords, robotBlockedWords, robotSilence } from './robotSilence'

const NOW = Date.parse('2026-10-21T19:38:00Z') // Tue 2:38 PM Central
const ago = (m: number) => new Date(NOW - m * 60_000).toISOString()

describe('robotSilence', () => {
  it('asleep after fifteen minutes with no call, only while a key called within a week', () => {
    expect(robotSilence(ago(2), NOW).asleep).toBe(false)
    expect(robotSilence(ago(15), NOW).asleep).toBe(false)
    expect(robotSilence(ago(16), NOW).asleep).toBe(true)
    expect(robotSilence(ago(60 * 24 * 8), NOW).asleep).toBe(false)
    expect(robotSilence(null, NOW)).toEqual({ lastSeenAt: null, asleep: false })
  })
  it('the clock in the company time zone: a time today, a day and time otherwise', () => {
    expect(clockWords(ago(3), NOW)).toBe('2:35 PM')
    expect(clockWords('2026-10-16T22:12:00Z', NOW)).toBe('Fri 5:12 PM')
  })
  it('the words, under the plain-words rules', () => {
    const asleep = robotAsleepWords(ago(33), NOW)
    expect(asleep.title).toBe('The robots have not made a round since 2:05 PM')
    expect(plainWordsFailures(asleep.detail)).toEqual([])
    const one = robotBlockedWords({ count: 1, first: { bidId: 'x', bidNumber: '507', project: 'Live Oak Pediatrics' } })
    expect(one.title).toBe('The robot is blocked on b507 Live Oak Pediatrics')
    expect(plainWordsFailures(one.detail)).toEqual([])
    const two = robotBlockedWords({ count: 2, first: { bidId: 'x', bidNumber: '507', project: 'Live Oak Pediatrics' } })
    expect(two.title).toBe('The robot is blocked on 2 bids')
    expect(two.detail.endsWith('First: b507 Live Oak Pediatrics.')).toBe(true)
  })
})
