import { describe, expect, it } from 'vitest'
import {
  buildGcCertSnapshot,
  gcGroupCertStatus,
  gcReviewGcsToDo,
  gcReviewNudgeState,
  gcReviewSentThisWeek,
  gcReviewWeekProgress,
  gcReviewWeekStartYmd,
  gcReviewWeekdayIndex,
  latestCertByGc,
  type GcReviewCertRow,
} from './gcReviewCertification'

// 2026-08-26 is a Wednesday; 18:00Z = 13:00 in America/Chicago (CDT).
const WED = new Date('2026-08-26T18:00:00Z')
const MON = new Date('2026-08-24T18:00:00Z')
const FRI = new Date('2026-08-28T18:00:00Z')

function cert(overrides: Partial<GcReviewCertRow> = {}): GcReviewCertRow {
  return {
    gc_customer_id: 'gc-1',
    week_start: '2026-08-24',
    certified_by_name: 'Taunya',
    certified_at: '2026-08-26T12:02:00Z',
    job_count: 2,
    total: 300,
    snapshot: { rows: [{ key: 'a', jobId: 'j1', remaining: 100 }, { key: 'b', jobId: 'j2', remaining: 200 }], total: 300, jobCount: 2 },
    note: '',
    ...overrides,
  }
}

describe('gcReviewCertification', () => {
  it('week key is the company-calendar Monday; weekday index matches Chicago', () => {
    expect(gcReviewWeekStartYmd(WED)).toBe('2026-08-24')
    expect(gcReviewWeekStartYmd(MON)).toBe('2026-08-24')
    expect(gcReviewWeekdayIndex(WED)).toBe(3)
    expect(gcReviewWeekdayIndex(MON)).toBe(1)
  })

  it('snapshot captures row keys, remainders, and totals', () => {
    const snap = buildGcCertSnapshot({
      rows: [
        { key: 'inv-1', jobId: 'j1', remaining: 9800 } as never,
        { key: 'j2', jobId: 'j2', remaining: 650 } as never,
      ],
      subtotal: 10_450,
      jobCount: 2,
    })
    expect(snap).toEqual({
      rows: [
        { key: 'inv-1', jobId: 'j1', remaining: 9800 },
        { key: 'j2', jobId: 'j2', remaining: 650 },
      ],
      total: 10_450,
      jobCount: 2,
    })
  })

  it('latestCertByGc keeps the newest row per GC regardless of order', () => {
    const older = cert({ certified_at: '2026-08-26T10:00:00Z', note: 'old' })
    const newer = cert({ certified_at: '2026-08-26T12:00:00Z', note: 'new' })
    expect(latestCertByGc([newer, older]).get('gc-1')?.note).toBe('new')
    expect(latestCertByGc([older, newer]).get('gc-1')?.note).toBe('new')
  })

  it('status: uncertified without a cert; certified when rows match the snapshot', () => {
    const group = { rows: [{ key: 'a', remaining: 100 }, { key: 'b', remaining: 200 }] as never[], subtotal: 300 }
    expect(gcGroupCertStatus(group, undefined).state).toBe('uncertified')
    expect(gcGroupCertStatus(group, cert()).state).toBe('certified')
  })

  it('status: a new row or a moved remainder flips to changed with the delta vs the certified total', () => {
    const grew = {
      rows: [
        { key: 'a', remaining: 100 },
        { key: 'b', remaining: 200 },
        { key: 'c', remaining: 2700 },
      ] as never[],
      subtotal: 3000,
    }
    const s1 = gcGroupCertStatus(grew, cert())
    expect(s1.state).toBe('changed')
    expect(s1.state === 'changed' && s1.delta).toBe(2700)

    const paidDown = { rows: [{ key: 'a', remaining: 100 }, { key: 'b', remaining: 50 }] as never[], subtotal: 150 }
    const s2 = gcGroupCertStatus(paidDown, cert())
    expect(s2.state).toBe('changed')
    expect(s2.state === 'changed' && s2.delta).toBe(-150)
  })

  it('sent-this-week compares in the company calendar against the Monday key', () => {
    expect(gcReviewSentThisWeek('2026-08-26T12:05:00Z', '2026-08-24')).toBe(true)
    expect(gcReviewSentThisWeek('2026-08-21T12:00:00Z', '2026-08-24')).toBe(false)
    expect(gcReviewSentThisWeek(undefined, '2026-08-24')).toBe(false)
  })

  it('progress counts real GC groups with money outstanding only; the No-GC bucket and paid-up groups are exempt', () => {
    const groups = [
      { gcId: 'gc-1', isNoGc: false, rows: [{ key: 'a', remaining: 100 }, { key: 'b', remaining: 200 }] as never[], subtotal: 300 },
      { gcId: 'gc-2', isNoGc: false, rows: [{ key: 'c', remaining: 50 }] as never[], subtotal: 50 },
      // A billed job that's fully paid but not yet marked paid: $0 outstanding, nothing to certify (v2.2705).
      { gcId: 'gc-3', isNoGc: false, rows: [{ key: 'd', remaining: 0 }] as never[], subtotal: 0 },
      { gcId: null, isNoGc: true, rows: [] as never[], subtotal: 0 },
    ]
    const p = gcReviewWeekProgress(
      groups,
      latestCertByGc([cert()]),
      { 'gc-1': '2026-08-26T12:05:00Z', 'gc-3': '2026-08-26T12:05:00Z' },
      '2026-08-24',
    )
    expect(p).toEqual({ gcs: 2, certified: 1, sent: 1 })
  })

  it('gcs to do = outstanding − done, falling back to min(certified, sent) on a v1 payload', () => {
    expect(gcReviewGcsToDo({ gcs_outstanding: 10, gcs_certified: 10, gcs_sent: 0 })).toBe(10)
    expect(gcReviewGcsToDo({ gcs_outstanding: 10, gcs_certified: 7, gcs_sent: 5 })).toBe(5)
    expect(gcReviewGcsToDo({ gcs_outstanding: 10, gcs_certified: 7, gcs_sent: 5, gcs_done: 4 })).toBe(6)
    expect(gcReviewGcsToDo({ gcs_outstanding: 3, gcs_certified: 3, gcs_sent: 3, gcs_done: 3 })).toBe(0)
  })

  it('nudge: hidden before Wednesday, due while incomplete, done on Wednesday once complete, hidden after', () => {
    const incomplete = { gcs_outstanding: 9, gcs_certified: 3, gcs_sent: 2 }
    const complete = { gcs_outstanding: 9, gcs_certified: 9, gcs_sent: 9 }
    expect(gcReviewNudgeState(incomplete, MON)).toBe('hidden')
    expect(gcReviewNudgeState(incomplete, WED)).toBe('due')
    expect(gcReviewNudgeState(incomplete, FRI)).toBe('due')
    expect(gcReviewNudgeState(complete, WED)).toBe('done')
    expect(gcReviewNudgeState(complete, FRI)).toBe('hidden')
    expect(gcReviewNudgeState({ gcs_outstanding: 0, gcs_certified: 0, gcs_sent: 0 }, WED)).toBe('hidden')
  })
})
