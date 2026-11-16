import { describe, expect, it } from 'vitest'
import { filingDocText, HOMESTEAD_AFFIDAVIT_NOTICE, type LienAffidavitFields } from './lienFilingDocuments'
import {
  buildLienServeLetterBlocks,
  buildLienServedCopyBlocks,
  lienServeEnvelopeWords,
  lienServeFiledWords,
  lienServeHoldActs,
  lienServeHoldWords,
  lienServeHolds,
  lienServeLetterParagraphs,
  lienServePacketHtml,
  lienServePapers,
  lienServeRecipients,
  lienServedCopyBoxWords,
  lienServedCopySentTitle,
  LIEN_SERVE_LETTER_ENCLOSED,
  LIEN_SERVE_LETTER_READ_BY_COUNSEL,
  LIEN_SERVED_COPY_READ_BY_COUNSEL,
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
  it('holds nothing when the filing and both addresses are on record', () => {
    expect(lienServeHolds(facts())).toEqual([])
    expect(lienServeHoldWords([])).toBe('')
    expect(lienServeHoldActs([])).toBe('')
  })

  it('holds a filing with no recording number, and its door is the filing', () => {
    const holds = lienServeHolds(facts({ recordingNumber: '  ' }))
    expect(holds).toEqual([{ key: 'no_recording_number', words: 'no recording number yet', act: 'Type the number the clerk gave.', door: 'filing' }])
    expect(lienServePapers(facts({ recordingNumber: '' }), { letter: true })).toEqual([])
    expect(lienServePacketHtml(facts({ recordingNumber: '' }), { letter: true, title: 't' })).toBe('')
  })

  it('names every reason, the filing’s own first, and what to do about each', () => {
    const holds = lienServeHolds(facts({ recordingNumber: '' }, { ownerAddress: '', originalContractorAddress: ' ' }))
    expect(holds.map((h) => h.key)).toEqual(['no_recording_number', 'no_owner_address', 'no_contractor_address'])
    expect(lienServeHoldWords(holds)).toBe('Held: no recording number yet, no mailing address for the owner, no mailing address for the original contractor.')
    expect(lienServeHoldActs(holds)).toBe('Type the number the clerk gave. Add it on the property record. Add it on the GC’s customer record.')
  })

  it('does not ask for a contractor on a job contracted with the owner', () => {
    expect(lienServeHolds(facts({ isSub: false }, { originalContractorName: '', originalContractorAddress: '' }))).toEqual([])
  })

  it('mails to the address the office holds today, and the paper’s own when it holds none', () => {
    const f = facts({ to: { owner: { name: '', address: '500 New Owner Blvd, Austin, TX 78701' }, contractor: null } }, { ownerAddress: '' })
    expect(lienServeHolds(f)).toEqual([])
    expect(lienServeRecipients(f)).toEqual([
      { recipient: 'owner', name: 'Hollow Creek Holdings LLC', address: '500 New Owner Blvd, Austin, TX 78701' },
      { recipient: 'original_contractor', name: 'Brightline Builders', address: '12 Example Pkwy, Buda, TX 78610' },
    ])
    // The copy is the paper as filed: today's address is on the letter, never on the copy.
    expect(filingDocText(buildLienServeLetterBlocks(f, 'owner'))).toContain('500 New Owner Blvd, Austin, TX 78701')
    expect(filingDocText(buildLienServedCopyBlocks(f))).not.toContain('500 New Owner Blvd')
  })

  it('draws no copy of an affidavit the app did not draw', () => {
    // Recorded with Already filed — record it…, while the app's own page still had blanks.
    const holds = lienServeHolds(facts({}, { ownerName: '', ownerAddress: '' }))
    expect(holds.map((h) => h.key)).toEqual(['no_paper', 'no_owner_address'])
    expect(holds[0]).toMatchObject({ door: 'photocopy', act: 'Mail a photocopy of the filed affidavit.' })
    expect(lienServeHolds(facts({ to: { owner: { name: 'Hollow Creek Holdings LLC', address: '1 Way, Austin, TX 78701' } } }, { ownerName: '', ownerAddress: '' })).map((h) => h.key)).toEqual(['no_paper'])
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

describe('the copy', () => {
  it('opens with the box that says what it is and what it does not show', () => {
    const blocks = buildLienServedCopyBlocks(facts())
    expect(blocks[0]).toEqual({ kind: 'callout', text: lienServedCopyBoxWords(facts()) })
    expect(lienServedCopyBoxWords(facts())).toBe(
      'COPY. This is a copy of the lien affidavit filed with the County Clerk of Hays County, Texas, on November 13, 2026, as document number 2026-0041877. ' +
        'It is drawn from the claimant\'s record of the paper as filed. The filed affidavit is signed and notarized. This copy does not show the signatures, the notary\'s seal or the clerk\'s stamp.',
    )
  })

  it('keeps the homestead notice first on the page, the box after it', () => {
    const blocks = buildLienServedCopyBlocks(facts({}, { homestead: true }))
    expect(blocks[0]).toEqual({ kind: 'topNotice', text: HOMESTEAD_AFFIDAVIT_NOTICE })
    expect(blocks[1]?.kind).toBe('callout')
  })

  it('is the affidavit’s own words under the box', () => {
    const text = filingDocText(buildLienServedCopyBlocks(facts()))
    expect(text).toContain('The amount of the claim is $18,450.00. Claimant claims a lien on the property for that amount.')
    expect(text).toContain('The owner or reputed owner is Hollow Creek Holdings LLC, 88 Sample Ridge Rd, Austin, TX 78700.')
  })

  it('falls back to the affidavit’s county when the record names none', () => {
    expect(lienServedCopyBoxWords(facts({ county: '' }))).toContain('County Clerk of Hays County, Texas')
  })
})

describe('the packet', () => {
  it('prints each reader’s letter in front of that reader’s copy', () => {
    expect(lienServePapers(facts(), { letter: true }).map((p) => p.label)).toEqual(['Letter to the owner', 'Copy for the owner', 'Letter to the original contractor', 'Copy for the original contractor'])
  })

  it('never leaves the copy out when the letter is left out', () => {
    expect(lienServePapers(facts(), { letter: false }).map((p) => p.what)).toEqual(['copy', 'copy'])
    expect(lienServePapers(facts({ isSub: false }, { isSub: false }), { letter: false }).map((p) => p.label)).toEqual(['Copy for the owner'])
  })

  it('draws one print document with every paper on its own sheet', () => {
    const html = lienServePacketHtml(facts(), { letter: true, title: 'Copy of lien affidavit — Job 2291' })
    expect(html).toContain('<title>Copy of lien affidavit — Job 2291</title>')
    expect(html.match(/class="filing-paper filing-next-paper/g)?.length).toBe(3)
    expect(html).toContain('COPY. This is a copy of the lien affidavit')
  })

  it('titles the copy filed on the job by its job number', () => {
    expect(lienServedCopySentTitle('2291')).toBe('Copy of lien affidavit — Job 2291')
    expect(lienServedCopySentTitle(' ')).toBe('Copy of lien affidavit')
  })
})

describe('counsel’s read', () => {
  // The day counsel answers, the flag turns and the screen's line goes with it; this test turns with it.
  it('is still open on the letter and on the copy', () => {
    expect(LIEN_SERVE_LETTER_READ_BY_COUNSEL).toBe(false)
    expect(LIEN_SERVED_COPY_READ_BY_COUNSEL).toBe(false)
  })
})
