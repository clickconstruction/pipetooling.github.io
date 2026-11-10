import { describe, expect, it } from 'vitest'
import {
  addressKeyOf,
  austinPageUrl,
  austinPlumbingType,
  permitRowFromAustin,
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

// Every name, address and number below is made up, in the shape Austin's feed gives.
describe('Austin’s feed', () => {
  const record = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    permittype: 'BP', permit_type_desc: 'Building Permit', permit_number: '2026-100001 BP', permit_class_mapped: 'Commercial', permit_class: 'C-1000 Commercial Remodel', work_class: 'Remodel',
    permit_location: '6800 SAMPLE BLVD UNIT 143', original_address1: '6800 SAMPLE BLVD UNIT 143', original_city: 'AUSTIN', original_zip: '78745', description: 'Tenant finish out for a dental office.',
    applieddate: '2026-10-14T00:00:00.000', issue_date: '2026-11-09T00:00:00.000', latitude: '30.2', longitude: '-97.8', total_job_valuation: '250000', remodel_repair_sqft: '2304',
    contractor_trade: 'General Contractor', contractor_company_name: 'Ridgeway Builders, LLC', contractor_full_name: 'Dana Whitlow', contractor_phone: '5125550142', location: { latitude: '30.2' }, link: { url: 'x' }, ...over,
  })

  it('asks for building and plumbing permits issued since a day, oldest first, with an end on a read back', () => {
    const url = decodeURIComponent(austinPageUrl('2026-08-27', 2000, 4000).replace(/\+/g, ' '))
    expect(url).toContain("$where=issue_date >= '2026-08-27' AND permittype in ('BP','PP')")
    expect(url).toContain('$order=issue_date ASC, permit_number ASC')
    expect(url).toContain('$limit=2000')
    expect(url).toContain('$offset=4000')
    expect(decodeURIComponent(austinPageUrl('2026-05-26', 10, 0, '2026-08-26').replace(/\+/g, ' '))).toContain("issue_date >= '2026-05-26' AND issue_date < '2026-08-26' AND permittype")
    expect(() => austinPageUrl("2026-08-27' OR 1=1", 10, 0)).toThrow()
  })

  it('reads a commercial building permit, with the contractor as the contact and the unit kept on the address', () => {
    expect(permitRowFromAustin(record())).toMatchObject({
      city: 'Austin', source: 'atx-issued', permit_number: '2026-100001 BP', permit_type: 'Building Permit', kind: 'building', stage: 'issued', residential: false, work_type: 'Commercial remodel',
      project_name: 'Tenant finish out for a dental office.', address: '6800 SAMPLE BLVD UNIT 143', address_key: '6800 sample blvd unit 143', zip: '78745', lat: 30.2, lng: -97.8,
      submitted_on: '2026-10-14', issued_on: '2026-11-09', declared_value: 250000, area_sf: 2304, contact: 'Dana Whitlow, Ridgeway Builders, LLC', builder_key: 'ridgewaybuilders',
    })
    // The phone stays on the row the feed sent; the two nested objects do not.
    const raw = permitRowFromAustin(record())?.raw ?? {}
    expect(raw.contractor_phone).toBe('5125550142')
    expect(raw.location).toBeUndefined()
    expect(raw.link).toBeUndefined()
  })

  it('tells the building’s plumbing from irrigation and a fire line by the work class', () => {
    expect(austinPlumbingType('Remodel')).toBe('Plumbing General Permit')
    expect(austinPlumbingType('Irrigation')).toBe('Plumbing Irrigation Permit')
    expect(austinPlumbingType('Fireline')).toBe('Plumbing Fireline Permit')
    expect(permitRowFromAustin(record({ permittype: 'PP', permit_number: '2026-100002 PP', work_class: 'Irrigation' }))).toMatchObject({ kind: 'plumbing', permit_type: 'Plumbing Irrigation Permit', work_type: 'Plumbing Irrigation' })
    expect(permitRowFromAustin(record({ permittype: 'PP', permit_number: '2026-100003 PP', work_class: 'New' }))).toMatchObject({ kind: 'plumbing', permit_type: 'Plumbing General Permit' })
  })

  it('marks houses residential, falls back to the applicant, and skips the other trades', () => {
    expect(permitRowFromAustin(record({ permit_class_mapped: 'Residential', work_class: 'New' }))).toMatchObject({ residential: true, work_type: 'New house' })
    expect(permitRowFromAustin(record({ contractor_company_name: null, contractor_full_name: null, applicant_full_name: 'Paula Kemp', applicant_org: 'Hartwell Interiors' }))?.contact).toBe('Paula Kemp, Hartwell Interiors')
    expect(permitRowFromAustin(record({ contractor_company_name: null, contractor_full_name: null }))?.contact).toBeNull()
    expect(permitRowFromAustin(record({ total_job_valuation: '0', total_valuation_remodel: '90000', remodel_repair_sqft: null, total_new_add_sqft: '1200' }))).toMatchObject({ declared_value: 90000, area_sf: 1200 })
    expect(permitRowFromAustin(record({ permittype: 'EP' }))).toBeNull()
    expect(permitRowFromAustin(record({ permit_number: '' }))).toBeNull()
  })
})
