import { describe, expect, it } from 'vitest'
import {
  aiaContractorBlockRows,
  AIA_FIELD_DEFS,
  aiaContractSignedOn,
  aiaDownloadFilename,
  buildAiaPrefillFromJob,
  buildAiaPrefillLinesFromJob,
  formatAiaDate,
  jobValueCreated,
  type AiaFieldKey,
} from './aiaG702G703Template'
import type { JobWithDetails } from '../types/jobWithDetails'
import type { LimitedJobDetailSnapshot } from '../types/limitedJobDetailSnapshot'

const minimalLimitedJob = (): LimitedJobDetailSnapshot => ({
  id: 'job-1',
  hcp_number: '501',
  job_name: 'Test Plaza',
  job_address: '100 Main St, Austin, TX 78701',
  google_drive_link: null,
  job_pictures_link: null,
  job_plans_link: null,
  revenue: 2500.5,
  project_id: null,
  customer_name: 'ACME GC',
  customer_email: null,
  customer_phone: null,
  gc_customer_name: null,
  development_name: null,
  last_work_date: null,
  status: 'ready_to_bill',
  service_type_name: null,
})

describe('buildAiaPrefillFromJob', () => {
  it('puts the job in the project block, the customer in the owner block, and leaves the number to type', () => {
    const pre = buildAiaPrefillFromJob(minimalLimitedJob(), {
      companyName: 'Click Plumbing',
      addressText: '5501 Balcones Dr\nAustin TX 78731',
      phone: '',
      email: '',
      tagline: '',
      licenseLine: 'RMP 999',
    })
    // The application number is not the job's name any more; nothing counts applications yet.
    expect(pre.g702_n5_project).toBe('')
    expect(pre.g703_k2_project).toBe('')
    expect(pre.g702_h6_project_name).toBe('Test Plaza')
    expect(pre.g702_h7_project_address).toContain('Main')
    expect(pre.g702_h8_project_city_state_zip).toBe('Austin, TX 78701')
    expect(pre.g702_d6_owner_name).toBe('ACME GC')
    // The job's address is the project's, not the owner's. With no payer address read, the box is empty.
    expect(pre.g702_d7_owner_address).toBe('')
    expect(pre.g702_d8_owner_city_state_zip).toBe('')
    expect(pre.g702_n7_project_no).toBe('501')
    expect(pre.g703_k5_architect_project_no).toBe('501')
    expect(pre.g702_n9_contract_date).toBe('')
    expect(pre.g703_k3_application_date).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
    expect(pre.g702_h18_original_contract_sum).toBe(2500.5)
    // The G703's row is the application's one line, not a form field.
    expect(Object.keys(pre).filter((k) => /^g703_[c-g]13_/.test(k))).toEqual([])
    expect(buildAiaPrefillLinesFromJob(minimalLimitedJob())).toEqual([
      { id: 'line-1', label: '', scheduledValue: 2500.5, labor: null, stage: null, fromPrevious: 0, thisPeriod: 0, stored: 0 },
    ])
    expect(pre.g702_f49_previous_month_change_order_additions).toBeUndefined()
    expect(pre.g702_h49_previous_month_change_order_deductions).toBeUndefined()
    expect(pre.g702_f50_this_month_change_order_additions).toBeUndefined()
    expect(pre.g702_h50_this_month_change_order_deductions).toBeUndefined()
    expect(pre.g702_c28_retainage_percent).toBe(10)
    expect(pre.g702_c31_retainage_material_percent).toBeUndefined()
    expect(pre.g702_d10_contractor_name).toBe('Click Plumbing')
    // Our address keeps the lines Settings holds it on (it was joined with a comma before v2.4506).
    expect(pre.g702_d11_contractor_address).toBe('5501 Balcones Dr\nAustin TX 78731')
    expect(pre.g702_d12_contractor_license).toBe('RMP 999')
  })

  it('addresses the owner block to the payer read beside the job, with the signed contract day', () => {
    const pre = buildAiaPrefillFromJob({ ...minimalLimitedJob(), gc_customer_name: 'Heron Construction Group' }, null, {
      ownerName: 'Heron Construction Group, LLC',
      ownerAddress: '900 Broadway St, San Antonio, TX 78215',
      contractSignedOn: '2026-07-14',
    })
    expect(pre.g702_d6_owner_name).toBe('Heron Construction Group, LLC')
    expect(pre.g702_d7_owner_address).toBe('900 Broadway St')
    expect(pre.g702_d8_owner_city_state_zip).toBe('San Antonio, TX 78215')
    expect(pre.g702_n9_contract_date).toBe('07/14/2026')
    // The project stays the job.
    expect(pre.g702_h6_project_name).toBe('Test Plaza')
  })

  it('names the GC as owner from the job row alone when nothing else was read', () => {
    const pre = buildAiaPrefillFromJob({ ...minimalLimitedJob(), gc_customer_name: 'Heron Construction Group' }, null)
    expect(pre.g702_d6_owner_name).toBe('Heron Construction Group')
  })

  it('uses the Click number as the project number when the job has no HCP number', () => {
    const job = { ...minimalLimitedJob(), hcp_number: '', click_number: '1023' } as unknown as JobWithDetails
    const pre = buildAiaPrefillFromJob(job, null)
    expect(pre.g702_n7_project_no).toBe('1023')
    expect(pre.g703_k5_architect_project_no).toBe('1023')
  })

  it('offers the job\'s value created as the one line\'s work this period, and describes it by its fixtures', () => {
    const job = {
      ...minimalLimitedJob(),
      revenue: 10000,
      pct_complete: 40,
      fixtures: [{ name: 'Water closet', count: 3 }, { name: 'Lavatory', count: 2 }],
    } as unknown as JobWithDetails
    expect(jobValueCreated(job)).toBe(4000)
    expect(buildAiaPrefillLinesFromJob(job)).toEqual([
      { id: 'line-1', label: 'Water closet × 3; Lavatory × 2', scheduledValue: 10000, labor: null, stage: null, fromPrevious: 0, thisPeriod: 4000, stored: 0 },
    ])
    expect(jobValueCreated(minimalLimitedJob())).toBe(0)
    expect(buildAiaPrefillLinesFromJob({ ...minimalLimitedJob(), revenue: null })[0]).toMatchObject({ scheduledValue: 0, thisPeriod: 0 })
  })

  it('defines Previous Month Change Order Deductions on G702 H49', () => {
    const def = AIA_FIELD_DEFS.find((d) => d.key === 'g702_h49_previous_month_change_order_deductions')
    expect(def).toMatchObject({
      label: 'Previous Month Change Order Deductions',
      kind: 'number',
      cellRef: 'H49',
    })
  })

  it('defines This Month Change Order Additions on G702 F50', () => {
    const def = AIA_FIELD_DEFS.find((d) => d.key === 'g702_f50_this_month_change_order_additions')
    expect(def).toMatchObject({
      label: 'This Month Change Order Additions',
      kind: 'number',
      cellRef: 'F50',
    })
  })

  it('defines This Month Change Order Deductions on G702 H50', () => {
    const def = AIA_FIELD_DEFS.find((d) => d.key === 'g702_h50_this_month_change_order_deductions')
    expect(def).toMatchObject({
      label: 'This Month Change Order Deductions',
      kind: 'number',
      cellRef: 'H50',
    })
  })

  it('defines Retainage % on G702 C28 (human percent 0–100 written as Excel fraction)', () => {
    const def = AIA_FIELD_DEFS.find((d) => d.key === 'g702_c28_retainage_percent')
    expect(def).toMatchObject({
      label: 'Retainage %',
      kind: 'percent',
      cellRef: 'C28',
    })
  })

  it('defines Retainage of Material % on G702 C31', () => {
    const def = AIA_FIELD_DEFS.find((d) => d.key === 'g702_c31_retainage_material_percent')
    expect(def).toMatchObject({
      label: 'Retainage of Material %',
      kind: 'percent',
      cellRef: 'C31',
    })
  })

  it('groups the four change-order amount fields under change_orders for the modal details section', () => {
    const co = AIA_FIELD_DEFS.filter((d) => d.detailsGroupId === 'change_orders')
    expect(co).toHaveLength(4)
    expect(co.map((d) => d.key)).toEqual([
      'g702_f49_previous_month_change_order_additions',
      'g702_h49_previous_month_change_order_deductions',
      'g702_f50_this_month_change_order_additions',
      'g702_h50_this_month_change_order_deductions',
    ])
    expect(AIA_FIELD_DEFS.filter((d) => d.detailsGroupId != null)).toHaveLength(4)
  })

  it('defines a unique key per field def', () => {
    const keys = new Set<AiaFieldKey>()
    for (const def of AIA_FIELD_DEFS) {
      expect(keys.has(def.key)).toBe(false)
      keys.add(def.key)
    }
  })
})

describe('aiaContractorBlockRows', () => {
  it('gives each address line its own row, then the license line', () => {
    expect(aiaContractorBlockRows('5501 Balcones Dr A141\nAustin, TX 78731', '')).toEqual(['5501 Balcones Dr A141', 'Austin, TX 78731'])
    expect(aiaContractorBlockRows('5501 Balcones Dr A141\nAustin, TX 78731', 'RMP 999')).toEqual(['5501 Balcones Dr A141', 'Austin, TX 78731', 'RMP 999'])
  })

  it('leaves a one-line address as the sheet always printed it: address, then license', () => {
    expect(aiaContractorBlockRows('5501 Balcones Dr A141, Austin, TX 78731', 'RMP 999')).toEqual(['5501 Balcones Dr A141, Austin, TX 78731', 'RMP 999'])
    expect(aiaContractorBlockRows('', 'RMP 999')).toEqual(['', 'RMP 999'])
    expect(aiaContractorBlockRows('', '')).toEqual([''])
  })

  it('folds a third line and on onto the second, and drops blank lines', () => {
    expect(aiaContractorBlockRows('Suite A141\n\n5501 Balcones Dr\r\nAustin, TX 78731', '')).toEqual(['Suite A141', '5501 Balcones Dr, Austin, TX 78731'])
  })
})

describe('formatAiaDate', () => {
  it('prints a calendar day as the paper does, and nothing for anything else', () => {
    expect(formatAiaDate('2026-10-04')).toBe('10/04/2026')
    expect(formatAiaDate('2026-10-04T15:00:00Z')).toBe('10/04/2026')
    expect(formatAiaDate('')).toBe('')
    expect(formatAiaDate(null)).toBe('')
    expect(formatAiaDate('Oct 4')).toBe('')
  })
})

describe('aiaContractSignedOn', () => {
  it('is the earliest live signed contract, the paper\'s own date first', () => {
    expect(
      aiaContractSignedOn([
        { status: 'signed', voided_at: null, signed_at: '2026-08-02T18:00:00Z', paper_signed_on: null },
        { status: 'signed', voided_at: null, signed_at: '2026-09-01T18:00:00Z', paper_signed_on: '2026-07-14' },
        { status: 'signed', voided_at: '2026-07-01T00:00:00Z', signed_at: '2026-06-01T18:00:00Z', paper_signed_on: null },
        { status: 'sent', voided_at: null, signed_at: null, paper_signed_on: null },
      ]),
    ).toBe('2026-07-14')
  })

  it('reads a signing late in the evening as that Central day', () => {
    // 03:30 UTC on the 16th is 10:30 pm on the 15th in Central time.
    expect(aiaContractSignedOn([{ status: 'signed', voided_at: null, signed_at: '2026-09-16T03:30:00Z', paper_signed_on: null }])).toBe('2026-09-15')
  })

  it('is empty when the job has no signed contract', () => {
    expect(aiaContractSignedOn([])).toBe('')
    expect(aiaContractSignedOn([{ status: 'sent', voided_at: null, signed_at: null, paper_signed_on: null }])).toBe('')
  })
})

describe('aiaDownloadFilename', () => {
  it('carries the job number, and the application number when it is one', () => {
    expect(aiaDownloadFilename('1023', '3')).toMatch(/^AIA-G702-G703-1023-app-3-\d{4}-\d{2}-\d{2}\.xlsx$/)
    expect(aiaDownloadFilename('1023', 3)).toMatch(/^AIA-G702-G703-1023-app-3-/)
    expect(aiaDownloadFilename('1023', '')).toMatch(/^AIA-G702-G703-1023-\d{4}/)
    expect(aiaDownloadFilename('1023', 'three / final')).toMatch(/^AIA-G702-G703-1023-\d{4}/)
    expect(aiaDownloadFilename('')).toMatch(/^AIA-G702-G703-job-\d{4}/)
  })

  it('stamps the company\'s day, not the UTC clock\'s: 7:16 PM Central on Oct 7 is still Oct 7 (v2.4891)', () => {
    expect(aiaDownloadFilename('1071', 1, new Date('2026-10-08T00:16:00Z'))).toBe('AIA-G702-G703-1071-app-1-2026-10-07.xlsx')
    expect(aiaDownloadFilename('1071', 1, new Date('2026-10-07T15:00:00Z'))).toBe('AIA-G702-G703-1071-app-1-2026-10-07.xlsx')
    expect(aiaDownloadFilename('1071', 1, new Date('2026-10-08T05:30:00Z'))).toBe('AIA-G702-G703-1071-app-1-2026-10-08.xlsx')
  })
})
