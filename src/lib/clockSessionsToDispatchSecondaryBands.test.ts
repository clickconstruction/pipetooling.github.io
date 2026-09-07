import { describe, expect, it } from 'vitest'
import { denverCalendarDayKey } from '@/utils/dateUtils'
import {
  associationLabel,
  clockSessionsToDispatchSecondaryBands,
  type ClockSessionForDispatchBand,
} from './clockSessionsToDispatchSecondaryBands'

// September → CDT (UTC−5): 13:00Z is 08:00 company time.
const s = (id: string, inIso: string, outIso: string | null, extra: Partial<ClockSessionForDispatchBand> = {}): ClockSessionForDispatchBand => ({
  id,
  user_id: 'u1',
  clocked_in_at: inIso,
  clocked_out_at: outIso,
  job_ledger_id: null,
  bid_id: null,
  notes: null,
  ...extra,
})
const jobs = new Map([['J1', 'Smith residence']])
const bids = new Map([['B1', 'Hyper Kidz']])
const PAST_DAY = '2026-09-01'
const NOW = new Date('2026-09-10T18:30:00.000Z').getTime() // 13:30 CDT
const TODAY = denverCalendarDayKey(NOW)

describe('associationLabel', () => {
  it('prefers the job, then the bid, then "No job"', () => {
    expect(associationLabel(s('a', '', null, { job_ledger_id: 'J1', bid_id: 'B1' }), jobs, bids)).toBe('Smith residence')
    expect(associationLabel(s('a', '', null, { bid_id: 'B1' }), jobs, bids)).toBe('Hyper Kidz')
    expect(associationLabel(s('a', '', null, { job_ledger_id: 'unknown' }), jobs, bids)).toBe('No job')
    expect(associationLabel(s('a', '', null), jobs, bids)).toBe('No job')
  })
})

describe('clockSessionsToDispatchSecondaryBands', () => {
  it('maps a closed session to 30-minute slots with a time-range label', () => {
    const [band] = clockSessionsToDispatchSecondaryBands([s('a', '2026-09-01T13:00:00Z', '2026-09-01T17:00:00Z', { job_ledger_id: 'J1', notes: ' gate 1234 ' })], PAST_DAY, NOW, jobs, bids)
    expect(band).toMatchObject({ id: 'a', startSlotIndex: 8, endSlotIndex: 16, sessionUserId: 'u1' })
    expect(band!.label).toBe('8:00 AM–12:00 PM · Smith residence · gate 1234')
    expect(band!.displayLabel).toBe('Smith residence · gate 1234')
  })

  it('an open session on a past day runs to the end of the grid and says so', () => {
    const [band] = clockSessionsToDispatchSecondaryBands([s('a', '2026-09-01T13:00:00Z', null)], PAST_DAY, NOW, jobs, bids)
    expect(band).toMatchObject({ startSlotIndex: 8, endSlotIndex: 32 })
    expect(band!.label).toBe('8:00 AM–no clock out (past day) · No job')
    expect(band!.displayLabel).toBe('No job')
  })

  it('an open session today runs to now', () => {
    const [band] = clockSessionsToDispatchSecondaryBands([s('a', '2026-09-10T13:00:00Z', null)], TODAY, NOW, jobs, bids)
    expect(band).toMatchObject({ startSlotIndex: 8, endSlotIndex: 19 }) // 13:30 CDT → slot 19
    expect(band!.label).toBe('8:00 AM–1:30 PM · No job')
  })

  it('sessions outside 4 AM–8 PM are clipped, and one entirely outside is dropped', () => {
    const out = clockSessionsToDispatchSecondaryBands(
      [
        s('early', '2026-09-01T07:00:00Z', '2026-09-01T10:00:00Z'), // 02:00–05:00 CDT → clipped to 04:00–05:00
        s('night', '2026-09-02T02:00:00Z', '2026-09-02T04:00:00Z'), // 21:00–23:00 CDT → dropped
      ],
      PAST_DAY,
      NOW,
      jobs,
      bids,
    )
    expect(out.map((b) => [b.id, b.startSlotIndex, b.endSlotIndex])).toEqual([['early', 0, 2]])
  })

  it('a session shorter than a slot is widened to one slot so it stays visible', () => {
    const [mid] = clockSessionsToDispatchSecondaryBands([s('a', '2026-09-01T13:00:00Z', '2026-09-01T13:05:00Z')], PAST_DAY, NOW, jobs, bids)
    expect(mid).toMatchObject({ startSlotIndex: 8, endSlotIndex: 9 })
    const [last] = clockSessionsToDispatchSecondaryBands([s('b', '2026-09-02T00:55:00Z', '2026-09-02T01:00:00Z')], PAST_DAY, NOW, jobs, bids) // 19:55–20:00
    expect(last).toMatchObject({ startSlotIndex: 31, endSlotIndex: 32 })
  })

  it('returns nothing for no sessions', () => {
    expect(clockSessionsToDispatchSecondaryBands([], PAST_DAY, NOW, jobs, bids)).toEqual([])
  })
})
