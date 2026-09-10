import { describe, expect, it } from 'vitest'
import {
  compareCustomerWaitingFirst,
  describeCalled,
  describeWait,
  firstName,
  formatPriorityChangeNote,
  isCustomerWaiting,
  portalKindLabel,
} from './requestPriority'

const NOW = Date.parse('2026-09-10T19:14:00Z')
const minAgo = (m: number) => new Date(NOW - m * 60_000).toISOString()

describe('isCustomerWaiting / compareCustomerWaitingFirst', () => {
  it('open + high is waiting; closed high and open normal are not', () => {
    expect(isCustomerWaiting({ status: 'open', priority: 'high' })).toBe(true)
    expect(isCustomerWaiting({ status: 'closed', priority: 'high' })).toBe(false)
    expect(isCustomerWaiting({ status: 'open', priority: 'normal' })).toBe(false)
    expect(isCustomerWaiting({ status: 'open' })).toBe(false)
  })

  it('waiting rows sort first and ties fall through (0) for the caller comparator', () => {
    const w = { status: 'open', priority: 'high' }
    const n = { status: 'open', priority: 'normal' }
    expect(compareCustomerWaitingFirst(w, n)).toBeLessThan(0)
    expect(compareCustomerWaitingFirst(n, w)).toBeGreaterThan(0)
    expect(compareCustomerWaitingFirst(w, { ...w })).toBe(0)
    expect(compareCustomerWaitingFirst(n, n)).toBe(0)
  })
})

describe('formatPriorityChangeNote', () => {
  it('reason + note, reason alone, note alone, nothing', () => {
    expect(formatPriorityChangeNote('Scheduled', ' Thu 9/12, 8–10 am ')).toBe('Scheduled: Thu 9/12, 8–10 am')
    expect(formatPriorityChangeNote('Scheduled', '')).toBe('Scheduled')
    expect(formatPriorityChangeNote(null, 'called back, no answer')).toBe('called back, no answer')
    expect(formatPriorityChangeNote(null, '   ')).toBeNull()
  })
})

describe('describeWait', () => {
  it('minutes, then hours + minutes, then whole days; red at 30 min', () => {
    expect(describeWait(minAgo(14), NOW)).toEqual({ minutes: 14, label: 'waiting 14 min', short: '14 min', red: false })
    expect(describeWait(minAgo(30), NOW)?.red).toBe(true)
    expect(describeWait(minAgo(72), NOW)?.short).toBe('1 h 12 min')
    expect(describeWait(minAgo(120), NOW)?.short).toBe('2 h')
    expect(describeWait(minAgo(3 * 24 * 60 + 5), NOW)?.short).toBe('3 days')
  })
  it('null for missing or unparseable stamps; a future stamp reads as 0', () => {
    expect(describeWait(null, NOW)).toBeNull()
    expect(describeWait('nope', NOW)).toBeNull()
    expect(describeWait(new Date(NOW + 60_000).toISOString(), NOW)?.minutes).toBe(0)
  })
})

describe('describeCalled', () => {
  it('same day: "<first name> called <time>"; another day adds the weekday; null when nobody called', () => {
    expect(describeCalled(minAgo(10), 'Sam Rivera', NOW, 'UTC')).toBe('Sam called 7:04 pm')
    expect(describeCalled(new Date(NOW - 2 * 24 * 3600_000).toISOString(), 'Sam Rivera', NOW, 'UTC')).toBe('Sam called Tue 7:14 pm')
    expect(describeCalled(minAgo(10), null, NOW, 'UTC')).toBe('Someone called 7:04 pm')
    expect(describeCalled(null, 'Sam', NOW)).toBeNull()
  })
})

describe('firstName / portalKindLabel', () => {
  it('first word of a name; kind words for the three portal request kinds', () => {
    expect(firstName('  Taunya  Miller ')).toBe('Taunya')
    expect(firstName('')).toBeNull()
    expect(portalKindLabel('visit')).toBe('asks for a visit')
    expect(portalKindLabel('bid')).toBe('asks for a bid')
    expect(portalKindLabel('gc_stage_ask')).toBe('asks for other dates')
    expect(portalKindLabel(null)).toBe('sent a request')
  })
})
