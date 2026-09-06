import { describe, expect, it } from 'vitest'
import {
  chicagoWeekdayAndTime,
  formatWeekdays,
  groupStandingCopies,
  isStandingWholeReportRow,
  nextOccurrenceIso,
  planStandingCopyEdit,
  type StandingCopyGroup,
} from './gcStatementStandingCopies'
import type { PendingGcStatementSend } from './gcStatementSchedule'

// Aug 2026: Mon Aug 10, Wed Aug 12. CDT = UTC-5, so 07:00 Central = 12:00Z.
const MON_7AM = '2026-08-10T12:00:00.000Z'
const WED_7AM = '2026-08-12T12:00:00.000Z'
const NOW = new Date('2026-08-06T22:00:00Z') // Thu Aug 6, 5 PM Central

function row(over: Partial<PendingGcStatementSend> = {}): PendingGcStatementSend {
  return {
    id: 'r1',
    requested_by: 'u-dev',
    sent_to: 'todd@example.com',
    group_by: 'gc',
    gc_customer_id: null,
    development_id: null,
    entity_name: 'All GCs',
    include_collections: false,
    send_at: MON_7AM,
    repeat_weekly: true,
    ...over,
  }
}

describe('chicagoWeekdayAndTime', () => {
  it('derives the Central weekday and wall clock from a UTC instant', () => {
    expect(chicagoWeekdayAndTime(MON_7AM)).toEqual({ dow: 1, timeHm: '07:00' })
    expect(chicagoWeekdayAndTime(WED_7AM)).toEqual({ dow: 3, timeHm: '07:00' })
    // 01:30Z Wed = 20:30 Central TUESDAY — the день flips at the zone boundary.
    expect(chicagoWeekdayAndTime('2026-08-12T01:30:00.000Z')).toEqual({ dow: 2, timeHm: '20:30' })
  })
})

describe('isStandingWholeReportRow / groupStandingCopies', () => {
  it('groups whole-report weekly chains by recipient; skips one-offs and per-GC chains', () => {
    const rows: PendingGcStatementSend[] = [
      row({ id: 'a', send_at: MON_7AM }),
      row({ id: 'b', send_at: WED_7AM }),
      row({ id: 'c', sent_to: 'BOOKS@cpa.com', send_at: WED_7AM }),
      row({ id: 'oneoff', repeat_weekly: false }),
      row({ id: 'gcchain', gc_customer_id: 'gc-1' }),
    ]
    expect(isStandingWholeReportRow(rows[3]!)).toBe(false)
    expect(isStandingWholeReportRow(rows[4]!)).toBe(false)
    const groups = groupStandingCopies(rows)
    expect(groups.map((g) => g.email)).toEqual(['books@cpa.com', 'todd@example.com'])
    const todd = groups[1]!
    expect(todd.weekdays).toEqual([1, 3])
    expect(todd.timeHm).toBe('07:00')
    expect(todd.rowIdsByWeekday[1]).toEqual(['a'])
    expect(todd.allRowIds).toEqual(['a', 'b'])
  })
})

describe('nextOccurrenceIso', () => {
  it('lands on the next Central occurrence of the weekday, strictly in the future', () => {
    // From Thu Aug 6 5 PM Central: next Monday is Aug 10.
    expect(nextOccurrenceIso(1, '07:00', NOW)).toBe(MON_7AM)
    // Thursday 7 AM already passed today → next Thursday Aug 13.
    expect(nextOccurrenceIso(4, '07:00', NOW)).toBe('2026-08-13T12:00:00.000Z')
    // Thursday 6 PM is still ahead today (now is 5 PM Central) → today.
    expect(nextOccurrenceIso(4, '18:00', NOW)).toBe('2026-08-06T23:00:00.000Z')
    expect(nextOccurrenceIso(9, '07:00', NOW)).toBeNull()
    expect(nextOccurrenceIso(1, 'noon', NOW)).toBeNull()
  })
})

describe('planStandingCopyEdit', () => {
  const base = {
    requestedBy: 'dev-1',
    email: 'Todd@Example.com',
    byDevelopment: false,
    includeCollections: false,
    desiredTimeHm: '07:00',
  }
  const currentMonWed: StandingCopyGroup = {
    email: 'todd@example.com',
    weekdays: [1, 3],
    timeHm: '07:00',
    rowIdsByWeekday: { 1: ['a'], 3: ['b'] },
    allRowIds: ['a', 'b'],
    includeCollections: false,
  }

  it('adding a new standing copy inserts one chain per weekday, email lowercased', () => {
    const plan = planStandingCopyEdit({ ...base, desiredWeekdays: [1, 3], current: null }, NOW)
    if (!plan.ok) throw new Error(plan.error)
    expect(plan.cancelIds).toEqual([])
    expect(plan.inserts).toHaveLength(2)
    expect(plan.inserts[0]?.sent_to).toBe('todd@example.com')
    expect(plan.inserts.map((i) => i.send_at)).toEqual([MON_7AM, WED_7AM])
    expect(plan.inserts.every((i) => i.repeat_weekly && i.gc_customer_id == null && i.development_id == null)).toBe(true)
    expect(plan.inserts[0]?.entity_name).toBe('All GCs')
  })

  it('a weekday-only edit touches only the added/removed days', () => {
    const plan = planStandingCopyEdit({ ...base, desiredWeekdays: [3, 5], current: currentMonWed }, NOW)
    if (!plan.ok) throw new Error(plan.error)
    expect(plan.cancelIds).toEqual(['a'])
    expect(plan.inserts).toHaveLength(1)
    expect(chicagoWeekdayAndTime(plan.inserts[0]!.send_at)).toEqual({ dow: 5, timeHm: '07:00' })
  })

  it('a time change re-creates every chain', () => {
    const plan = planStandingCopyEdit({ ...base, desiredTimeHm: '06:30', desiredWeekdays: [1, 3], current: currentMonWed }, NOW)
    if (!plan.ok) throw new Error(plan.error)
    expect(plan.cancelIds).toEqual(['a', 'b'])
    expect(plan.inserts).toHaveLength(2)
    expect(plan.inserts.every((i) => chicagoWeekdayAndTime(i.send_at)?.timeHm === '06:30')).toBe(true)
  })

  it('zero desired weekdays removes the standing copy', () => {
    const plan = planStandingCopyEdit({ ...base, desiredWeekdays: [], current: currentMonWed }, NOW)
    if (!plan.ok) throw new Error(plan.error)
    expect(plan.cancelIds).toEqual(['a', 'b'])
    expect(plan.inserts).toEqual([])
  })

  it('rejects a bad email and an empty add', () => {
    expect(planStandingCopyEdit({ ...base, email: 'nope', desiredWeekdays: [1], current: null }, NOW).ok).toBe(false)
    expect(planStandingCopyEdit({ ...base, desiredWeekdays: [], current: null }, NOW).ok).toBe(false)
  })

  it('development grouping stamps the development entity name', () => {
    const plan = planStandingCopyEdit({ ...base, byDevelopment: true, desiredWeekdays: [1], current: null }, NOW)
    if (!plan.ok) throw new Error(plan.error)
    expect(plan.inserts[0]?.entity_name).toBe('All developments')
    expect(plan.inserts[0]?.group_by).toBe('development')
  })
})

describe('formatWeekdays', () => {
  it('renders Monday-first', () => {
    expect(formatWeekdays([0, 1, 3])).toBe('Mon · Wed · Sun')
    expect(formatWeekdays([5])).toBe('Fri')
  })
})
