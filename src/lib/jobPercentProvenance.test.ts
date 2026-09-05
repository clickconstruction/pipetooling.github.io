import { describe, expect, it } from 'vitest'
import {
  formatProvenanceDate,
  latestReportPercent,
  percentProvenanceLabel,
  percentProvenanceTitle,
  recordedPercentProvenance,
  reportPercentSeedHint,
  seedUntouchedPercentFields,
} from './jobPercentProvenance'
import { REPORT_FIELD_LABEL_JOB_COMPLETION } from './reportTemplateFieldDisplay'

const PCT = REPORT_FIELD_LABEL_JOB_COMPLETION
// 2026-08-27 14:00 Central (UTC-5) — the J523 example in the journey map.
const AUG_27 = '2026-08-27T19:00:00.000Z'

describe('formatProvenanceDate', () => {
  it('renders the company-calendar month and day', () => {
    expect(formatProvenanceDate(AUG_27)).toBe('Aug 27')
  })
  it('crosses midnight on the company calendar, not UTC', () => {
    // 2026-08-28 03:30Z is still Aug 27 in Chicago (22:30 CDT).
    expect(formatProvenanceDate('2026-08-28T03:30:00.000Z')).toBe('Aug 27')
  })
  it('is null for nothing or garbage', () => {
    expect(formatProvenanceDate(null)).toBeNull()
    expect(formatProvenanceDate('')).toBeNull()
    expect(formatProvenanceDate('not a date')).toBeNull()
  })
})

describe('percentProvenanceLabel', () => {
  it('names the crew report with its day when the date is known', () => {
    expect(percentProvenanceLabel('crew-report', { reportedOn: AUG_27 })).toBe('crew report Aug 27')
  })
  it('still names the crew report when the date is not carried (row RPC has no date)', () => {
    expect(percentProvenanceLabel('crew-report')).toBe('crew report')
    expect(percentProvenanceLabel('crew-report', { reportedOn: null })).toBe('crew report')
  })
  it('names the office and the paid-invoices override', () => {
    expect(percentProvenanceLabel('office')).toBe('set by office')
    expect(percentProvenanceLabel('paid-invoices')).toBe('fully collected')
  })
  it('is null when nobody said a % — no badge next to "—"', () => {
    expect(percentProvenanceLabel('none')).toBeNull()
    expect(percentProvenanceTitle('none')).toBeNull()
  })
  it('has a hover sentence for every source that gets a badge', () => {
    for (const s of ['crew-report', 'office', 'paid-invoices'] as const) {
      expect(percentProvenanceTitle(s)).toMatch(/\S/)
    }
  })
})

describe('latestReportPercent', () => {
  it('picks the newest report that carries a %, regardless of input order', () => {
    const got = latestReportPercent([
      { created_at: '2026-08-27T19:00:00Z', field_values: { [PCT]: '77' } },
      { created_at: '2026-08-20T19:00:00Z', field_values: { [PCT]: '63' } },
      { created_at: '2026-08-30T19:00:00Z', field_values: { Notes: 'walked the site' } },
    ])
    expect(got).toEqual({ pct: 77, createdAt: '2026-08-27T19:00:00Z' })
  })
  it('is null with no reports or no % anywhere', () => {
    expect(latestReportPercent(null)).toBeNull()
    expect(latestReportPercent([])).toBeNull()
    expect(latestReportPercent([{ created_at: '2026-08-27T19:00:00Z', field_values: { Notes: 'x' } }])).toBeNull()
    expect(latestReportPercent([{ created_at: '2026-08-27T19:00:00Z', field_values: null }])).toBeNull()
  })
})

describe('recordedPercentProvenance (Job Detail header / report modal)', () => {
  const reports = [{ created_at: AUG_27, field_values: { [PCT]: '77' } }]
  it('is the crew report when the recorded % matches the newest report %', () => {
    expect(recordedPercentProvenance(77, reports)).toEqual({ source: 'crew-report', reportedOn: AUG_27 })
  })
  it('is set by office when the recorded % differs from what the crew last said (J6-N2: 63 vs 77)', () => {
    expect(recordedPercentProvenance(63, reports)).toEqual({ source: 'office' })
  })
  it('is set by office when there are no reports with a %', () => {
    expect(recordedPercentProvenance(30, [])).toEqual({ source: 'office' })
    expect(recordedPercentProvenance(30, null)).toEqual({ source: 'office' })
  })
  it('is none when the job has no recorded %', () => {
    expect(recordedPercentProvenance(null, reports)).toEqual({ source: 'none' })
    expect(recordedPercentProvenance(undefined, reports)).toEqual({ source: 'none' })
  })
})

describe('seedUntouchedPercentFields (report modal opens on the current %)', () => {
  const fields = [
    { label: PCT, input_type: 'percent_0_100' },
    { label: 'Notes', input_type: 'long_text' },
  ]
  it('fills an untouched percent field with the job’s current % — the slider starts at 30, not 0', () => {
    expect(seedUntouchedPercentFields(fields, {}, 30)).toEqual({ [PCT]: '30' })
  })
  it('leaves a touched percent field alone — including an explicit 0', () => {
    expect(seedUntouchedPercentFields(fields, { [PCT]: '0' }, 30)).toEqual({ [PCT]: '0' })
    expect(seedUntouchedPercentFields(fields, { [PCT]: '55' }, 30)).toEqual({ [PCT]: '55' })
  })
  it('never touches non-percent fields', () => {
    expect(seedUntouchedPercentFields(fields, { Notes: 'hi' }, 30)).toEqual({ Notes: 'hi', [PCT]: '30' })
  })
  it('passes values through untouched with no seed (bids, projects, jobs with no % yet)', () => {
    const fv = { Notes: 'hi' }
    expect(seedUntouchedPercentFields(fields, fv, null)).toBe(fv)
    expect(seedUntouchedPercentFields(fields, fv, undefined)).toBe(fv)
  })
  it('clamps and rounds the seed into 0–100', () => {
    expect(seedUntouchedPercentFields(fields, {}, 77.6)).toEqual({ [PCT]: '78' })
    expect(seedUntouchedPercentFields(fields, {}, 140)).toEqual({ [PCT]: '100' })
  })
})

describe('reportPercentSeedHint', () => {
  it('tells the tech the number is the job’s current % and how to change it', () => {
    expect(reportPercentSeedHint(30, undefined)).toBe('Currently 30% — move to update')
    expect(reportPercentSeedHint(30, '30')).toBe('Currently 30% — move to update')
  })
  it('remembers where it was once the slider moves', () => {
    expect(reportPercentSeedHint(30, '55')).toBe('Was 30%')
    expect(reportPercentSeedHint(30, '0')).toBe('Was 30%')
  })
  it('appends who said the current %', () => {
    expect(reportPercentSeedHint(30, undefined, { source: 'crew-report', reportedOn: AUG_27 })).toBe(
      'Currently 30% — move to update · crew report Aug 27',
    )
    expect(reportPercentSeedHint(30, '40', { source: 'office' })).toBe('Was 30% · set by office')
  })
  it('is null without a seed', () => {
    expect(reportPercentSeedHint(null, '0')).toBeNull()
  })
})
