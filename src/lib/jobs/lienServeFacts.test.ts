import { describe, expect, it } from 'vitest'
import { lienServeHolds } from '../jobsDocuments/lienServedCopy'
import { lienServeFactsFromFiling, type LienServeFiling } from './lienServeFacts'

// Every name, address and figure here is made up.
const FIELDS = {
  county: 'Hays',
  claimantPersonName: 'Dana Whitlow',
  claimantCompany: 'Sample Plumbing LLC',
  claimantAddress: 'PO Box 100, Kyle, TX 78640',
  legalDescription: 'Lot 4, Block 2, Sample Addition',
  propertyAddress: '410 Sample Street, Kyle, TX 78640',
  contractedWithName: 'Brightline Builders',
  workDescription: 'Plumbing labor and materials',
  workStart: '2026-07-01',
  workEnd: '2026-08-28',
  ownerName: 'Hollow Creek Holdings LLC',
  ownerAddress: '88 Sample Ridge Rd, Austin, TX 78700',
  originalContractorName: 'Brightline Builders',
  originalContractorAddress: '12 Example Pkwy, Buda, TX 78610',
  contractAmount: '40000.00',
  paidAmount: '21550.00',
  unpaidAmount: '18450.00',
  includeNoticesSworn: true,
  form: 'short',
  isSub: true,
}

/** `fields` is loose on purpose: a stored row can keep anything. */
const filing = (over: Partial<Omit<LienServeFiling, 'fields'>> & { fields?: unknown } = {}): LienServeFiling =>
  ({ kind: 'affidavit', fields: FIELDS, county: 'Hays', recording_number: '2026-0041877', filed_at: '2026-11-13', voided_at: null, ...over }) as LienServeFiling
const CTX = { isSub: true, letterYmd: '2026-11-16', phone: ' (512) 555-0142 ' }

describe('lienServeFactsFromFiling', () => {
  it('reads the filing’s own fields, county, number and day', () => {
    const facts = lienServeFactsFromFiling(filing(), CTX)
    expect(facts).toMatchObject({ isSub: true, county: 'Hays', recordingNumber: '2026-0041877', filedYmd: '2026-11-13', letterYmd: '2026-11-16', phone: '(512) 555-0142' })
    expect(facts?.fields.ownerName).toBe('Hollow Creek Holdings LLC')
    expect(facts?.fields.form).toBe('short')
    expect(lienServeHolds(facts!, 'drive')).toEqual([])
  })

  it('is null for a row that is not a filed, live affidavit', () => {
    expect(lienServeFactsFromFiling(null, CTX)).toBeNull()
    expect(lienServeFactsFromFiling(filing({ kind: 'notice_53_056' }), CTX)).toBeNull()
    expect(lienServeFactsFromFiling(filing({ filed_at: null }), CTX)).toBeNull()
    expect(lienServeFactsFromFiling(filing({ voided_at: '2026-11-14T10:00:00Z' }), CTX)).toBeNull()
  })

  it('reads a filed affidavit that keeps no fields with every field blank: its stamped copy still prints', () => {
    for (const fields of [null, []]) {
      const facts = lienServeFactsFromFiling(filing({ fields }), CTX)
      expect(facts).toMatchObject({ county: 'Hays', recordingNumber: '2026-0041877', filedYmd: '2026-11-13' })
      expect(facts?.fields).toMatchObject({ ownerName: '', propertyAddress: '', unpaidAmount: '' })
      // The job's own answer stands when the paper keeps none.
      expect(facts?.isSub).toBe(CTX.isSub)
    }
  })

  it('lets the paper on file say whether there is an original contractor', () => {
    expect(lienServeFactsFromFiling(filing({ fields: { ...FIELDS, isSub: false } }), CTX)?.isSub).toBe(false)
    // An affidavit on the earlier form keeps no answer, so the job's own stands.
    const { isSub: _isSub, form: _form, ...earlier } = FIELDS
    expect(lienServeFactsFromFiling(filing({ fields: earlier }), { ...CTX, isSub: false })?.isSub).toBe(false)
    expect(lienServeFactsFromFiling(filing({ fields: earlier }), CTX)?.fields.form).toBeUndefined()
  })

  it('draws a blank for a field the row never kept, and the hold names it', () => {
    const facts = lienServeFactsFromFiling(filing({ recording_number: '', fields: { ...FIELDS, ownerAddress: undefined, unpaidAmount: 18450 } }), CTX)
    expect(facts?.fields.ownerAddress).toBe('')
    expect(facts?.fields.unpaidAmount).toBe('18450')
    expect(lienServeHolds(facts!, 'drive').map((h) => h.key)).toEqual(['no_recording_number', 'no_owner_address'])
  })
})
