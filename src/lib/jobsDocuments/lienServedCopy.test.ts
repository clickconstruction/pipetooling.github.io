import { describe, expect, it } from 'vitest'
import { filingDocText, type LienAffidavitFields } from './lienFilingDocuments'
import {
  buildLienServeLetterBlocks,
  lienServeEnvelopeWords,
  lienServeFiledWords,
  lienServeHoldActs,
  lienServeHoldWords,
  lienServeHolds,
  lienServeLetterParagraphs,
  lienServeLetterDrawable,
  lienServeLetters,
  lienServeRecipients,
  lienServedCopySentTitle,
  LIEN_SERVE_LETTER_ENCLOSED,
  LIEN_SERVE_LETTER_READ_BY_COUNSEL,
  LIEN_SERVE_WORDS,
  type LienServeFacts,
} from './lienServedCopy'

// Every name, address and figure here is made up.
const FIELDS: LienAffidavitFields = {
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
  workMonthsWords: 'July and August 2026',
  noticesSentWords: 'certified mail on September 14, 2026',
}

const facts = (over: Partial<LienServeFacts> = {}, fields: Partial<LienAffidavitFields> = {}): LienServeFacts => ({
  fields: { ...FIELDS, ...fields },
  isSub: true,
  county: 'Hays County',
  recordingNumber: '2026-0041877',
  filedYmd: '2026-11-13',
  letterYmd: '2026-11-16',
  phone: '(512) 555-0142',
  ...over,
})

describe('who the copies go to', () => {
  it('sends two on a job under an original contractor, the owner first', () => {
    expect(lienServeRecipients(facts())).toEqual([
      { recipient: 'owner', name: 'Hollow Creek Holdings LLC', address: '88 Sample Ridge Rd, Austin, TX 78700' },
      { recipient: 'original_contractor', name: 'Brightline Builders', address: '12 Example Pkwy, Buda, TX 78610' },
    ])
    expect(lienServeEnvelopeWords(facts())).toBe('Two envelopes: the owner and the original contractor.')
  })

  it('sends one on a job contracted with the owner', () => {
    const f = facts({ isSub: false }, { isSub: false, originalContractorName: '', originalContractorAddress: '' })
    expect(lienServeRecipients(f).map((r) => r.recipient)).toEqual(['owner'])
    expect(lienServeEnvelopeWords(f)).toBe('One envelope: the owner.')
  })
})

describe('what holds a filing’s copies', () => {
  it('holds nothing when the filing, both addresses and a stamped copy in Drive are on record', () => {
    expect(lienServeHolds(facts(), 'drive')).toEqual([])
    expect(lienServeHoldWords([])).toBe('')
    expect(lienServeHoldActs([])).toBe('')
  })

  it('holds a filing with no recording number, and its door is the filing', () => {
    const holds = lienServeHolds(facts({ recordingNumber: '  ' }), 'drive')
    expect(holds).toEqual([{ key: 'no_recording_number', words: 'no recording number yet', act: 'Type the number the clerk gave.', door: 'filing' }])
  })

  it('holds a filing with no stamped copy, and never falls back to a page of its own', () => {
    expect(lienServeHolds(facts(), 'none')).toEqual([{ key: 'no_saved_copy', words: 'no stamped copy saved', act: 'Add the clerk’s stamped scan on the job’s Lien window.', door: 'scan' }])
    expect(lienServeHolds(facts(), 'not_drive')).toEqual([{ key: 'copy_not_drive', words: 'the saved copy is a link the app cannot read', act: 'Upload the stamped scan itself on the job’s Lien window.', door: 'scan' }])
  })

  it('names every reason, the filing’s own first, and what to do about each', () => {
    const holds = lienServeHolds(facts({ recordingNumber: '' }, { ownerAddress: '', originalContractorAddress: ' ' }), 'none')
    expect(holds.map((h) => h.key)).toEqual(['no_recording_number', 'no_saved_copy', 'no_owner_address', 'no_contractor_address'])
    expect(lienServeHoldWords(holds)).toBe('Held: no recording number yet, no stamped copy saved, no mailing address for the owner, no mailing address for the original contractor.')
    expect(lienServeHoldActs(holds)).toBe('Type the number the clerk gave. Add the clerk’s stamped scan on the job’s Lien window. Add it on the property record. Add it on the GC’s customer record.')
  })

  it('does not ask for a contractor on a job contracted with the owner', () => {
    expect(lienServeHolds(facts({ isSub: false }, { originalContractorName: '', originalContractorAddress: '' }), 'drive')).toEqual([])
  })

  it('mails to the address the office holds today, and the paper’s own when it holds none', () => {
    const f = facts({ to: { owner: { name: '', address: '500 New Owner Blvd, Austin, TX 78701' }, contractor: null } }, { ownerAddress: '' })
    expect(lienServeHolds(f, 'drive')).toEqual([])
    expect(lienServeRecipients(f)).toEqual([
      { recipient: 'owner', name: 'Hollow Creek Holdings LLC', address: '500 New Owner Blvd, Austin, TX 78701' },
      { recipient: 'original_contractor', name: 'Brightline Builders', address: '12 Example Pkwy, Buda, TX 78610' },
    ])
    expect(filingDocText(buildLienServeLetterBlocks(f, 'owner'))).toContain('500 New Owner Blvd, Austin, TX 78701')
  })

  it('does not hold an affidavit the app did not draw: its stamped copy prints, with no letter', () => {
    // Recorded with Already filed — record it…, or filed by counsel: the record keeps none of the paper's words.
    const blank = facts({ to: { owner: { name: 'Hollow Creek Holdings LLC', address: '1 Way, Austin, TX 78701' } } }, { ownerName: '', ownerAddress: '', unpaidAmount: '' })
    expect(lienServeHolds(blank, 'drive')).toEqual([])
    expect(lienServeLetterDrawable(blank.fields)).toBe(false)
    expect(lienServeLetters(blank, { letter: true })).toEqual([])
    expect(lienServeLetterDrawable(facts().fields)).toBe(true)
  })
})

describe('the letter', () => {
  it('tells the owner what was filed, where, and how the claim is released', () => {
    expect(lienServeLetterParagraphs(facts(), 'owner')).toEqual([
      'Sample Plumbing LLC has filed an affidavit claiming a lien on the property named above. A copy of the affidavit is enclosed. It is sent to you as the owner or reputed owner of the property, as Texas Property Code § 53.055 requires.',
      'The affidavit states a claim of $18,450.00 for plumbing labor and materials furnished to improve the property under a contract with Brightline Builders, the original contractor.',
      'When the claim is paid, Sample Plumbing LLC will sign a release of the claim and of the lien in a form that can be filed with the county clerk. To pay, or to ask about the amount, call (512) 555-0142.',
    ])
  })

  it('tells the original contractor it is the contractor, and names its own contract', () => {
    const [first, second] = lienServeLetterParagraphs(facts(), 'original_contractor')
    expect(first).toContain('It is sent to you as the original contractor, as Texas Property Code § 53.055 requires.')
    expect(second).toBe('The affidavit states a claim of $18,450.00 for plumbing labor and materials furnished to improve the property under Sample Plumbing LLC\'s contract with you.')
  })

  it('names the hiring party when it is not the original contractor', () => {
    const f = facts({}, { contractedWithName: 'Second Tier Mechanical' })
    expect(lienServeLetterParagraphs(f, 'owner')[1]).toContain('under a contract with Second Tier Mechanical. The original contractor is Brightline Builders.')
    expect(lienServeLetterParagraphs(f, 'original_contractor')[1]).toContain('under a contract with Second Tier Mechanical.')
  })

  it('says our contract with you on a job contracted with the owner', () => {
    const f = facts({ isSub: false }, { isSub: false, contractedWithName: 'Hollow Creek Holdings LLC' })
    expect(lienServeLetterParagraphs(f, 'owner')[1]).toContain('under Sample Plumbing LLC\'s contract with you.')
  })

  it('leaves the call line off when the company has no phone on record', () => {
    expect(lienServeLetterParagraphs(facts({ phone: '' }), 'owner')[2]).toBe('When the claim is paid, Sample Plumbing LLC will sign a release of the claim and of the lien in a form that can be filed with the county clerk.')
  })

  it('never calls the filing a lien, makes no threat and gives no advice', () => {
    for (const to of ['owner', 'original_contractor'] as const) {
      const text = lienServeLetterParagraphs(facts({}, { homestead: true }), to).join(' ')
      expect(text).not.toMatch(/\bfiled a lien\b|\blien has been filed\b|\blien was filed\b/i)
      expect(text).not.toMatch(/foreclos|lawsuit|sue\b|attorney|must pay|within \d+ days|should/i)
    }
  })

  it('carries the filing’s facts above the paragraphs and the enclosure under the signature', () => {
    const blocks = buildLienServeLetterBlocks(facts(), 'owner', { letterhead: { company: 'Sample Plumbing LLC', licenseLine: '', contactLines: ['PO Box 100'] } })
    expect(blocks[0]?.kind).toBe('letterhead')
    const text = filingDocText(blocks)
    expect(lienServeFiledWords(facts())).toBe('November 13, 2026, County Clerk of Hays County, Texas')
    expect(text).toContain('November 13, 2026, County Clerk of Hays County, Texas')
    expect(text).toContain('2026-0041877')
    expect(text).toContain('Hollow Creek Holdings LLC')
    expect(text).toContain('88 Sample Ridge Rd, Austin, TX 78700')
    expect(text).toContain('$18,450.00')
    expect(blocks[blocks.length - 1]).toEqual({ kind: 'paragraph', text: LIEN_SERVE_LETTER_ENCLOSED })
    expect(blocks[blocks.length - 2]).toEqual({ kind: 'signature', lines: ['Dana Whitlow', 'Sample Plumbing LLC'] })
  })
})

describe('the letters', () => {
  it('draws one letter for each reader, in envelope order', () => {
    expect(lienServeLetters(facts(), { letter: true }).map((p) => p.label)).toEqual(['Letter to the owner', 'Letter to the original contractor'])
    expect(lienServeLetters(facts({ isSub: false }, { isSub: false }), { letter: true }).map((p) => p.recipient)).toEqual(['owner'])
  })

  it('draws none when the letter is left out: the envelope still takes the stamped copy', () => {
    expect(lienServeLetters(facts(), { letter: false })).toEqual([])
  })

  it('draws nothing that stands in for the copy', () => {
    // The redrawn page is gone (v2.7916): no paper here says COPY, and the screen says what the copy is.
    const text = lienServeLetters(facts(), { letter: true }).map((l) => filingDocText(l.blocks)).join('\n')
    expect(text).not.toContain('COPY.')
    expect(text).not.toContain('does not show the signatures')
    expect(LIEN_SERVE_WORDS.copyIs).toBe('The copy in each envelope is the clerk’s stamped scan, every page of it.')
  })

  it('titles the copy filed on the job by its job number', () => {
    expect(lienServedCopySentTitle('2291')).toBe('Copy of lien affidavit — Job 2291')
    expect(lienServedCopySentTitle(' ')).toBe('Copy of lien affidavit')
  })
})

describe('counsel’s read', () => {
  // The day counsel answers, the flag turns and the screen's line goes with it; this test turns with it.
  it('is still open on the letter', () => {
    // The copy's own question went with the redrawn page: the copy is now the stamped scan itself.
    expect(LIEN_SERVE_LETTER_READ_BY_COUNSEL).toBe(false)
  })
})
