import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildLienAffidavitFieldsForJob, lienOriginalContractor } from './lienAffidavitJobFields'
import * as draft from './lienNoticeDraft'

/**
 * The affidavit's recipe in its own file (v2.7510): `lienNoticeDraft.ts` re-exports it, and the file pulls no document
 * builder and no settings file behind it, so the edge copy can carry it.
 */
describe('lienAffidavitJobFields', () => {
  it('is the one recipe, re-exported where it used to live', () => {
    expect(draft.buildLienAffidavitFieldsForJob).toBe(buildLienAffidavitFieldsForJob)
    expect(draft.lienOriginalContractor).toBe(lienOriginalContractor)
  })

  it('imports types alone from the document builder’s side, and nothing from Settings', () => {
    const src = readFileSync('src/lib/jobs/lienAffidavitJobFields.ts', 'utf8')
    expect(src).toContain("import type { LienAffidavitFields } from '../jobsDocuments/lienAffidavitFieldsType'")
    expect(src).not.toContain('lienFilingDocuments')
    expect(src).not.toContain('physicalInvoiceIssuer')
    expect(readFileSync('src/lib/jobsDocuments/lienAffidavitFieldsType.ts', 'utf8')).not.toMatch(/^import /m)
  })

  it('reads the company from a shape: its name, both addresses and the county it signs in', () => {
    const fields = buildLienAffidavitFieldsForJob({
      jobName: 'ZZ Test Maple Court',
      jobAddress: '14 Maple Ct, Marlow, TX 78000',
      isSub: true,
      originalContractorName: 'ZZ Test Builders',
      originalContractorAddress: '5 Builder Way, Marlow, TX 78000',
      ownerName: 'Pat Sample',
      ownerAddress: '9 Owner Ln, Marlow, TX 78000',
      county: 'Marlow',
      legalDescription: 'LOT 4 BLK 7',
      customerName: 'ZZ Test Builders',
      revenue: 9000,
      paymentsMade: 4820,
      openBalance: 4180,
      lastMonth: '2026-09',
      todayYmd: '2026-11-16',
      noticesRecorded: true,
      contactPerson: 'Sam Sample, Master Plumber',
      issuer: { companyName: 'ZZ Test Plumbing', addressText: '1 Main St\nMarlow, TX 78000', physicalAddressText: '2 Shop Rd\nMarlow, TX 78000', signingCounty: 'Marlow' },
    })
    expect(fields).toMatchObject({ claimantCompany: 'ZZ Test Plumbing', claimantAddress: '1 Main St, Marlow, TX 78000', claimantPhysicalAddress: '2 Shop Rd, Marlow, TX 78000', signingCounty: 'Marlow', unpaidAmount: '4180.00', form: 'short' })
    expect(lienOriginalContractor({ isSub: false, gcName: null, issuer: null }).name).not.toBe('')
  })
})
