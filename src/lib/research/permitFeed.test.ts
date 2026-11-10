import { describe, expect, it } from 'vitest'
import {
  addressKeyOf,
  classifyPermitType,
  dayOf,
  feedPageSql,
  permitRowFromSanAntonio,
  pullSinceDay,
  SA_APPLIED_FEED,
  SA_ISSUED_FEED,
  streetOf,
  zipOf,
} from '../../../supabase/functions/_shared/permitFeed'

const issued = SA_ISSUED_FEED

describe('classifyPermitType', () => {
  it('keeps the commercial building kinds as building rows', () => {
    expect(classifyPermitType('Comm New Building Permit')).toEqual({ kind: 'building', residential: false, work: 'New commercial' })
    expect(classifyPermitType('Commercial Project Application')?.kind).toBe('building')
  })
  it('marks the house kinds residential', () => {
    expect(classifyPermitType('Res New Building Permit')?.residential).toBe(true)
  })
  it('reads every plumbing type as the plumber on a job', () => {
    expect(classifyPermitType('Plumbing General Permit')).toEqual({ kind: 'plumbing', residential: false, work: 'Plumbing General' })
    expect(classifyPermitType('LSR Plumbing Permit')?.kind).toBe('plumbing')
  })
  it('skips the rest', () => {
    expect(classifyPermitType('Garage Sale')).toBeNull()
    expect(classifyPermitType('Electrical General Permit')).toBeNull()
    expect(classifyPermitType('')).toBeNull()
    expect(classifyPermitType(null)).toBeNull()
  })
})

describe('the address parts', () => {
  const a = '100  SAMPLE ST, City of San Antonio, TX 78245'
  it('keys on the street alone, lower-cased and single-spaced', () => {
    expect(addressKeyOf(a)).toBe('100 sample st')
    expect(addressKeyOf('  ')).toBeNull()
  })
  it('keeps the street for the ledger and the zip off the tail', () => {
    expect(streetOf(a)).toBe('100 SAMPLE ST')
    expect(zipOf(a)).toBe('78245')
    expect(zipOf('100 SAMPLE ST, City of San Antonio, TX 782')).toBeNull()
  })
})

describe('permitRowFromSanAntonio', () => {
  const record = {
    _id: 7,
    _full_text: 'dropped',
    'PERMIT TYPE': 'Comm New Building Permit',
    'PERMIT #': 'COM-BLG-PMT26-00000001',
    'PROJECT NAME': 'Building No: N/A; Unit No: N/A',
    'WORK TYPE': 'New',
    ADDRESS: '100 SAMPLE ST, City of San Antonio, TX 78245',
    X_COORD: '-98.5',
    Y_COORD: '29.4',
    'DATE SUBMITTED': '2026-10-02',
    'DATE ISSUED': '2026-11-06',
    'DECLARED VALUATION': '112000.0',
    'AREA (SF)': '600.0',
    'PRIMARY CONTACT': 'Ridgeway Builders',
  } as Record<string, unknown>

  it('maps a kept row with its point, days, money and contact', () => {
    const row = permitRowFromSanAntonio(record, issued)
    expect(row).toMatchObject({
      city: 'San Antonio',
      source: 'sa-issued',
      permit_number: 'COM-BLG-PMT26-00000001',
      kind: 'building',
      stage: 'issued',
      residential: false,
      work_type: 'New commercial',
      address: '100 SAMPLE ST',
      address_key: '100 sample st',
      zip: '78245',
      lat: 29.4,
      lng: -98.5,
      submitted_on: '2026-10-02',
      issued_on: '2026-11-06',
      declared_value: 112000,
      area_sf: 600,
      contact: 'Ridgeway Builders',
    })
    expect(row?.raw).not.toHaveProperty('_full_text')
    expect(row?.raw).toHaveProperty('_id', 7)
  })

  it('returns null for a type the pull skips or a row with no number', () => {
    expect(permitRowFromSanAntonio({ ...record, 'PERMIT TYPE': 'Garage Sale' }, issued)).toBeNull()
    expect(permitRowFromSanAntonio({ ...record, 'PERMIT #': '' }, issued)).toBeNull()
  })

  it('reads an application feed row with a timestamp day and no issue day', () => {
    const row = permitRowFromSanAntonio(
      { ...record, 'PERMIT TYPE': 'Commercial Project Application', 'DATE SUBMITTED': '2026-11-06T00:00:00', 'DATE ISSUED': null },
      SA_APPLIED_FEED,
    )
    expect(row?.stage).toBe('applied')
    expect(row?.submitted_on).toBe('2026-11-06')
    expect(row?.issued_on).toBeNull()
  })
})

describe('feedPageSql', () => {
  it('reads the kept types since the day, oldest first, one page', () => {
    const sql = feedPageSql(issued, '2026-10-01', 500, 1000)
    expect(sql).toContain(`FROM "${issued.resourceId}"`)
    expect(sql).toContain(`"DATE ISSUED" >= '2026-10-01'`)
    expect(sql).toContain(`'Comm New Building Permit'`)
    expect(sql).toContain(`LIKE 'Plumbing %'`)
    expect(sql).toMatch(/ORDER BY "DATE ISSUED" ASC, "_id" ASC LIMIT 500 OFFSET 1000$/)
  })
  it('refuses a since-day that is not a day', () => {
    expect(() => feedPageSql(issued, "2026-10-01' OR 1=1 --", 10, 0)).toThrow()
    // A read back as history takes only the days before its end.
    expect(feedPageSql(issued, '2026-05-26', 500, 0, '2026-08-26')).toContain(`"DATE ISSUED" >= '2026-05-26' AND "DATE ISSUED" < '2026-08-26' AND (`)
    expect(feedPageSql(issued, '2026-05-26', 500, 0)).not.toContain(' < ')
    expect(() => feedPageSql(issued, '2026-05-26', 10, 0, "2026-08-26' OR 1=1 --")).toThrow()
  })
})

describe('pullSinceDay', () => {
  it('starts ten days before the newest row it has', () => {
    expect(pullSinceDay('2026-11-06', '2026-11-09')).toBe('2026-10-27')
  })
  it('reaches back seventy-five days on a first run', () => {
    expect(pullSinceDay(null, '2026-11-09')).toBe('2026-08-26')
  })
  it('reads a feed day with or without a time', () => {
    expect(dayOf('2026-11-06T00:00:00')).toBe('2026-11-06')
    expect(dayOf(null)).toBeNull()
  })
})
