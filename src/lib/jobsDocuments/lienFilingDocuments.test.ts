import { describe, expect, it } from 'vitest'
import {
  buildLienAffidavitBlocks,
  buildLienNoticeBlocks,
  buildReleaseOfRecordBlocks,
  filingDocText,
  filingPdfFilename,
  type LienAffidavitFields,
} from './lienFilingDocuments'

describe('§ 53.056 notice', () => {
  it('renders the statutory form lines verbatim with values', () => {
    const text = filingDocText(
      buildLienNoticeBlocks({
        noticeDate: '2026-09-03',
        projectDescription: 'Reliant Health — 150 E Sonterra Blvd 200B, San Antonio, TX 78258',
        claimantName: 'Click Plumbing and Electrical',
        laborMaterialsType: 'Plumbing labor and materials',
        originalContractorName: 'Knight Contracting',
        contractedWithIfDifferent: '',
        claimAmount: '2711.50',
        contactPerson: 'Malachi Whites',
        claimantAddress: '5501 Balcones Dr Ste A141, Austin, TX 78731',
      }),
    )
    expect(text).toContain('NOTICE OF CLAIM FOR UNPAID LABOR OR MATERIALS')
    expect(text).toContain('Project description and/or address: Reliant Health')
    expect(text).toContain("Original contractor's name: Knight Contracting")
    expect(text).toContain('Party with whom claimant contracted if different from original contractor: —')
    expect(text).toContain('Claim amount: $2,711.50')
    expect(text).toContain("(Claimant's contact person) Malachi Whites")
  })
})

describe('§ 53.054 affidavit', () => {
  const fields: LienAffidavitFields = {
    county: 'Bexar',
    claimantPersonName: 'Malachi Whites',
    claimantCompany: 'Click Plumbing and Electrical',
    claimantAddress: '5501 Balcones Dr, Austin, TX',
    legalDescription: 'Lot 3, Block A, Sonterra Commercial Park',
    propertyAddress: '150 E Sonterra Blvd 200B, San Antonio, TX 78258',
    contractedWithName: 'Knight Contracting',
    workDescription: 'Plumbing rough-in and trim',
    workStart: '2026-06-03',
    workEnd: '2026-07-28',
    ownerName: 'Sonterra Holdings LLC',
    ownerAddress: 'PO Box 1420, San Antonio, TX',
    originalContractorName: 'Knight Contracting',
    originalContractorAddress: '2904 Corporate CR, Flower Mound, TX',
    contractAmount: '3850',
    paidAmount: '1138.50',
    unpaidAmount: '2711.50',
    includeNoticesSworn: true,
  }
  it('carries the sworn structure: jurisdiction, ten paragraphs, notarial block', () => {
    const text = filingDocText(buildLienAffidavitBlocks(fields))
    expect(text).toContain("MECHANIC'S AND MATERIALMAN'S LIEN AFFIDAVIT")
    expect(text).toContain('COUNTY OF BEXAR')
    expect(text).toContain('2. Claimant furnished labor and/or materials')
    expect(text).toContain('Legal description: Lot 3, Block A, Sonterra Commercial Park')
    expect(text).toContain('6. The name and last known address of the owner')
    expect(text).toContain('PO Box 1420')
    expect(text).toContain('8. The original contract amount was $3,850.00. The amount paid to date is $1,138.50.')
    expect(text).toContain('9. All statutory notices required by the Texas Property Code have been sent')
    expect(text).toContain('10. Claimant claims a lien')
    expect(text).toContain('Notary Public, State of Texas')
  })
  it('without sworn notices, ¶9 drops and the lien claim renumbers to 9', () => {
    const text = filingDocText(buildLienAffidavitBlocks({ ...fields, includeNoticesSworn: false }))
    expect(text).not.toContain('All statutory notices')
    expect(text).toContain('9. Claimant claims a lien')
  })
})

describe('release of recorded lien', () => {
  it('names the recorded instrument and fully releases it', () => {
    const text = filingDocText(
      buildReleaseOfRecordBlocks({
        county: 'Bexar',
        claimantCompany: 'Click Plumbing and Electrical',
        claimantPersonName: 'Malachi Whites',
        recordingNumber: '2026-0455812',
        filedDate: '2026-09-04',
        legalDescription: 'Lot 3, Block A',
        propertyAddress: '150 E Sonterra Blvd',
        ownerName: 'Sonterra Holdings LLC',
        paymentDate: '2026-10-01',
      }),
    )
    expect(text).toContain("RELEASE OF MECHANIC'S AND MATERIALMAN'S LIEN")
    expect(text).toContain('instrument number 2026-0455812, filed on September 4, 2026')
    expect(text).toContain('fully and unconditionally RELEASES and DISCHARGES')
    expect(text).toContain('Notary Public, State of Texas')
  })
})

describe('filenames', () => {
  it('slugs kind + job number', () => {
    expect(filingPdfFilename('notice_53_056', '915')).toBe('notice-53-056-915.pdf')
    expect(filingPdfFilename('affidavit', '')).toBe('affidavit-job.pdf')
  })
})
