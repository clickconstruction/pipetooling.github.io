import { describe, expect, it } from 'vitest'
import {
  deriveRecordedBillingActivityDetail,
  deriveStagesBillingActivityDetail,
  deriveStagesBillingActivityYmd,
  deriveStagesFieldReferenceYmd,
  deriveStagesFieldTooltip,
  maxYmd,
  mergeMaxScheduleWorkDateByJobId,
  timestampOrDateToYmd,
} from './stagesJobReferenceDates'

describe('timestampOrDateToYmd', () => {
  it('passes a trimmed YYYY-MM-DD through and slices the date off a DB timestamp without shifting it', () => {
    expect(timestampOrDateToYmd('2026-09-07')).toBe('2026-09-07')
    expect(timestampOrDateToYmd('  2026-09-07 ')).toBe('2026-09-07')
    // Timestamps keep their own calendar date — the first ten characters — whatever the zone suffix.
    expect(timestampOrDateToYmd('2026-09-07T23:30:00+00:00')).toBe('2026-09-07')
    expect(timestampOrDateToYmd('2026-09-08T03:30:00Z')).toBe('2026-09-08')
    expect(timestampOrDateToYmd('2026-09-07 14:05:00')).toBe('2026-09-07')
  })
  it('falls back to Date parsing for other shapes, and gives nothing for blanks or garbage', () => {
    expect(timestampOrDateToYmd('September 7, 2026')).toBe('2026-09-07')
    expect(timestampOrDateToYmd('9/7/2026')).toBe('2026-09-07')
    expect(timestampOrDateToYmd('')).toBeNull()
    expect(timestampOrDateToYmd('   ')).toBeNull()
    expect(timestampOrDateToYmd(null)).toBeNull()
    expect(timestampOrDateToYmd(undefined)).toBeNull()
    expect(timestampOrDateToYmd('not a date')).toBeNull()
    expect(timestampOrDateToYmd('2026-9-7')).toBe('2026-09-07') // unpadded input is normalised through the Date fallback
  })
})

describe('maxYmd', () => {
  it('picks the latest calendar day and ignores gaps and non-YMD strings', () => {
    expect(maxYmd(['2026-01-31', '2026-02-01', null, undefined, '2025-12-31'])).toBe('2026-02-01')
    expect(maxYmd(['2026-01-31', ' 2026-05-01'])).toBe('2026-01-31') // untrimmed input is not a YMD here
    expect(maxYmd(['2026-01-31T00:00:00Z'])).toBeNull()
    expect(maxYmd([])).toBeNull()
    expect(maxYmd([null, undefined])).toBeNull()
  })
})

describe('deriveStagesFieldReferenceYmd (Stages j:)', () => {
  it('shows the later of the approved-session work date and the schedule work date, or whichever exists', () => {
    expect(deriveStagesFieldReferenceYmd({ lastWorkDate: '2026-09-01', lastScheduleWorkDate: '2026-09-04' })).toBe('2026-09-04')
    expect(deriveStagesFieldReferenceYmd({ lastWorkDate: '2026-09-05', lastScheduleWorkDate: '2026-09-04' })).toBe('2026-09-05')
    expect(deriveStagesFieldReferenceYmd({ lastWorkDate: '2026-09-05T08:00:00Z', lastScheduleWorkDate: null })).toBe('2026-09-05')
    expect(deriveStagesFieldReferenceYmd({ lastWorkDate: null, lastScheduleWorkDate: ' 2026-09-04 ' })).toBe('2026-09-04')
    expect(deriveStagesFieldReferenceYmd({ lastWorkDate: undefined, lastScheduleWorkDate: '' })).toBeNull()
  })
})

describe('deriveStagesFieldTooltip', () => {
  it('explains where the j: date came from — both sources, one source, or agreement', () => {
    expect(deriveStagesFieldTooltip({ lastWorkDate: '2026-09-01', lastScheduleWorkDate: '2026-09-04', resolvedYmd: '2026-09-04' })).toBe(
      'Sessions: 2026-09-01; schedule: 2026-09-04. Line shows the later date (2026-09-04).',
    )
    expect(deriveStagesFieldTooltip({ lastWorkDate: '2026-09-01', lastScheduleWorkDate: null, resolvedYmd: '2026-09-01' })).toBe(
      'From approved clock sessions (2026-09-01).',
    )
    expect(deriveStagesFieldTooltip({ lastWorkDate: null, lastScheduleWorkDate: '2026-09-04', resolvedYmd: '2026-09-04' })).toBe(
      'From job schedule (2026-09-04). No approved session work date yet.',
    )
    expect(deriveStagesFieldTooltip({ lastWorkDate: '2026-09-04T10:00:00Z', lastScheduleWorkDate: '2026-09-04', resolvedYmd: '2026-09-04' })).toBe(
      'Sessions and schedule agree (2026-09-04).',
    )
  })
  it('has nothing to say without a resolved date, or when neither source parses', () => {
    expect(deriveStagesFieldTooltip({ lastWorkDate: '2026-09-01', lastScheduleWorkDate: '2026-09-04', resolvedYmd: null })).toBeNull()
    expect(deriveStagesFieldTooltip({ lastWorkDate: 'junk', lastScheduleWorkDate: '', resolvedYmd: '2026-09-04' })).toBeNull()
  })
})

describe('billing activity (Stages b: and the Job Detail middle row)', () => {
  const job = {
    invoices: [
      { sent_to_customer_at: '2026-08-20T15:00:00+00:00', billed_at: '2026-08-19' },
      { sent_to_customer_at: null, billed_at: '2026-08-28T09:00:00Z' },
    ],
    payments: [{ paid_on: '2026-08-25' }, { paid_on: null }],
  }
  it('finds the latest invoice sent / billed / payment date and names it in the tooltip', () => {
    expect(deriveStagesBillingActivityDetail(job)).toEqual({ ymd: '2026-08-28', tooltip: 'Latest: Invoice billed (2026-08-28)' })
    expect(deriveStagesBillingActivityYmd(job)).toBe('2026-08-28')
    expect(deriveRecordedBillingActivityDetail(job)).toEqual(deriveStagesBillingActivityDetail(job)) // identical since the manual last_bill_date retired (v2.1154)
  })
  it('a payment on the latest day wins the line and the tooltip', () => {
    const paid = { ...job, payments: [{ paid_on: '2026-09-02' }] }
    expect(deriveStagesBillingActivityDetail(paid)).toEqual({ ymd: '2026-09-02', tooltip: 'Latest: Payment recorded (2026-09-02)' })
  })
  it('a same-day tie lists every distinct label once, in sent → billed → payment order', () => {
    const tied = {
      invoices: [
        { sent_to_customer_at: '2026-09-03T12:00:00Z', billed_at: '2026-09-03' },
        { sent_to_customer_at: '2026-09-03T18:00:00Z', billed_at: null },
      ],
      payments: [{ paid_on: '2026-09-03' }],
    }
    expect(deriveStagesBillingActivityDetail(tied)).toEqual({
      ymd: '2026-09-03',
      tooltip: 'Latest: Invoice sent · Invoice billed · Payment recorded (2026-09-03)',
    })
  })
  it('gives nothing when there is no dated activity, and tolerates missing arrays', () => {
    expect(deriveStagesBillingActivityDetail({ invoices: [], payments: [] })).toBeNull()
    expect(deriveStagesBillingActivityYmd({ invoices: [{ sent_to_customer_at: null, billed_at: '' }], payments: [{ paid_on: 'junk' }] })).toBeNull()
    expect(deriveStagesBillingActivityDetail({ invoices: undefined, payments: undefined } as unknown as typeof job)).toBeNull()
  })
})

describe('mergeMaxScheduleWorkDateByJobId', () => {
  it('keeps the latest work_date per job and skips rows whose date does not parse', () => {
    const map = mergeMaxScheduleWorkDateByJobId([
      { job_id: 'a', work_date: '2026-09-01' },
      { job_id: 'b', work_date: '2026-09-10T00:00:00Z' },
      { job_id: 'a', work_date: '2026-09-03' },
      { job_id: 'a', work_date: '2026-09-02' },
      { job_id: 'c', work_date: 'junk' },
      { job_id: 'b', work_date: '' },
    ])
    expect([...map.entries()]).toEqual([
      ['a', '2026-09-03'],
      ['b', '2026-09-10'],
    ])
    expect(mergeMaxScheduleWorkDateByJobId([]).size).toBe(0)
  })
})
