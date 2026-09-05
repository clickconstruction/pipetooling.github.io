import { describe, expect, it } from 'vitest'
import { parseOfficeViewStats, portalOpenedLabel } from './portalOpenedLabel'

const now = new Date('2026-09-05T15:00:00') // local time

describe('parseOfficeViewStats', () => {
  it('reads the block off the portal payload', () => {
    expect(parseOfficeViewStats({ customerName: 'Knight', officeViewStats: { opens: 3, lastOpenedAt: '2026-09-03T12:00:00Z' } })).toEqual({
      opens: 3,
      lastOpenedAt: '2026-09-03T12:00:00Z',
    })
  })
  it('is null when the payload has no block (old function build / not staff)', () => {
    expect(parseOfficeViewStats({ customerName: 'Knight' })).toBeNull()
    expect(parseOfficeViewStats(null)).toBeNull()
    expect(parseOfficeViewStats('x')).toBeNull()
  })
  it('sanitises junk to zero / null', () => {
    expect(parseOfficeViewStats({ officeViewStats: { opens: -4, lastOpenedAt: 'not a date' } })).toEqual({ opens: 0, lastOpenedAt: null })
    expect(parseOfficeViewStats({ officeViewStats: { opens: '7' } })).toEqual({ opens: 0, lastOpenedAt: null })
  })
})

describe('portalOpenedLabel', () => {
  it('omits the line without stats', () => {
    expect(portalOpenedLabel(null, now)).toBeNull()
  })
  it('says so when nobody has looked', () => {
    expect(portalOpenedLabel({ opens: 0, lastOpenedAt: null }, now)).toBe('Not opened yet')
    expect(portalOpenedLabel({ opens: 2, lastOpenedAt: null }, now)).toBe('Not opened yet')
  })
  it('once / twice / N times with a short last-open date', () => {
    expect(portalOpenedLabel({ opens: 1, lastOpenedAt: '2026-09-03T12:00:00' }, now)).toBe('Opened once · last Sep 3')
    expect(portalOpenedLabel({ opens: 2, lastOpenedAt: '2026-09-03T12:00:00' }, now)).toBe('Opened twice · last Sep 3')
    expect(portalOpenedLabel({ opens: 14, lastOpenedAt: '2026-08-26T09:00:00' }, now)).toBe('Opened 14 times · last Aug 26')
  })
  it('today / yesterday read as words; another year carries the year', () => {
    expect(portalOpenedLabel({ opens: 1, lastOpenedAt: '2026-09-05T08:00:00' }, now)).toBe('Opened once · today')
    expect(portalOpenedLabel({ opens: 3, lastOpenedAt: '2026-09-04T23:30:00' }, now)).toBe('Opened 3 times · yesterday')
    expect(portalOpenedLabel({ opens: 3, lastOpenedAt: '2025-12-30T10:00:00' }, now)).toBe('Opened 3 times · last Dec 30, 2025')
  })
})
