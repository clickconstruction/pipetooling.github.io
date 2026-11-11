import { describe, expect, it } from 'vitest'
import {
  buildLienAffidavitBlocks,
  buildLienNoticeBlocks,
  buildReleaseOfRecordBlocks,
  filingDocFooter,
  filingDocHtml,
  appendToFilingPrintHtml,
  filingDocPrintHtml,
  FILING_PRINT_TIGHT_LEADING,
  lienAffidavitPrintOptions,
  filingKeepTogetherRuns,
  filingDocText,
  filingLetterheadFromIssuer,
  filingPdfFilename,
  type LienAffidavitFields,
  HOMESTEAD_AFFIDAVIT_NOTICE,
  HOMESTEAD_NOTICE_STATEMENT,
  type LienNoticeFields,
  buildLienRetainageNoticeBlocks,
} from './lienFilingDocuments'

const NOTICE_FIELDS: LienNoticeFields = {
  noticeDate: '2026-09-03',
  projectDescription: 'Reliant Health — 150 E Sonterra Blvd 200B, San Antonio, TX 78258',
  claimantName: 'Click Plumbing and Electrical',
  laborMaterialsType: 'Plumbing labor and materials',
  originalContractorName: 'Knight Contracting',
  contractedWithIfDifferent: '',
  claimAmount: '2711.50',
  contactPerson: 'Malachi Whites',
  claimantAddress: '5501 Balcones Dr Ste A141, Austin, TX 78731',
}

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
    // Blank "party if different" is omitted entirely (owner decision 2026-09-02).
    expect(text).not.toContain('Party with whom claimant contracted')
    expect(
      filingDocText(buildLienNoticeBlocks({ ...NOTICE_FIELDS, contractedWithIfDifferent: 'Sonterra JV Partners' })),
    ).toContain('Party with whom claimant contracted if different from original contractor: Sonterra JV Partners')
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

describe('§ 53.054 affidavit · the short form (punch list #305)', () => {
  // The same facts as a filing stores them, marked for the short form, with the months and the notices the record holds.
  const short: LienAffidavitFields = {
    county: 'Bexar',
    claimantPersonName: 'Malachi Whites',
    claimantCompany: 'Click Plumbing and Electrical',
    claimantAddress: '5501 Balcones Dr, Austin, TX',
    legalDescription: 'Lot 3, Block A, Sonterra Commercial Park',
    propertyAddress: '150 E Sonterra Blvd 200B, San Antonio, TX 78258',
    contractedWithName: 'Knight Contracting',
    workDescription: 'Plumbing labor and materials',
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
    form: 'short',
    isSub: true,
    workMonthsWords: 'July and August 2026',
    noticesSentWords: 'certified mail on August 14, 2026 and September 11, 2026',
  }
  const text = (f: LienAffidavitFields, extras?: Parameters<typeof buildLienAffidavitBlocks>[1]) => filingDocText(buildLienAffidavitBlocks(f, extras))
  const numbered = (f: LienAffidavitFields) => text(f).split('\n').filter((l) => /^\d+\. /.test(l))

  it('a job under a general contractor: the title, a blank county for the notary, the opening, seven paragraphs, the signature and the jurat', () => {
    expect(text(short)).toBe(
      [
        "MECHANIC'S AND MATERIALMAN'S LIEN AFFIDAVIT",
        // The top blank says which county it wants (punch list #314); the notary's own blank below stays plain.
        'STATE OF TEXAS\nCOUNTY OF ___________ (where signed)',
        'BEFORE ME, the undersigned authority, on this day personally appeared Malachi Whites, who being by me duly sworn, upon oath states the following:',
        '1. I am authorized to make this affidavit for Click Plumbing and Electrical ("Claimant"). Claimant\'s mailing address is 5501 Balcones Dr, Austin, TX.',
        '2. Claimant furnished plumbing labor and materials to improve this property in Bexar County, Texas: Lot 3, Block A, Sonterra Commercial Park, 150 E Sonterra Blvd 200B, San Antonio, TX 78258.',
        '3. Claimant did so under a contract with Knight Contracting, 2904 Corporate CR, Flower Mound, TX, the original contractor.',
        '4. The owner or reputed owner is Sonterra Holdings LLC, PO Box 1420, San Antonio, TX.',
        '5. Payment is requested for work done and materials furnished in July and August 2026.',
        '6. Notice of the claim was sent to the owner by certified mail on August 14, 2026 and September 11, 2026.',
        '7. The amount of the claim is $2,711.50. Claimant claims a lien on the property for that amount.',
        '______________________________\nMalachi Whites\nClick Plumbing and Electrical',
        'STATE OF TEXAS\nCOUNTY OF ___________\n\nSWORN TO AND SUBSCRIBED BEFORE ME on this _____ day of _____________, ______, by Malachi Whites.\n\n________________________________\nNotary Public, State of Texas\n\nPrinted name: ______________________________',
      ].join('\n\n'),
    )
  })

  it('a job contracted with the owner: four paragraphs, no months and no notices', () => {
    const owner = { ...short, isSub: false, contractedWithName: 'Sonterra Holdings LLC', originalContractorName: 'Click Plumbing and Electrical', originalContractorAddress: '5501 Balcones Dr, Austin, TX' }
    expect(numbered(owner)).toEqual([
      '1. I am authorized to make this affidavit for Click Plumbing and Electrical ("Claimant"). Claimant\'s mailing address is 5501 Balcones Dr, Austin, TX.',
      '2. Claimant furnished plumbing labor and materials to improve this property in Bexar County, Texas: Lot 3, Block A, Sonterra Commercial Park, 150 E Sonterra Blvd 200B, San Antonio, TX 78258.',
      '3. Claimant did so under a contract with the owner, Sonterra Holdings LLC, PO Box 1420, San Antonio, TX. Claimant is the original contractor.',
      '4. The amount of the claim is $2,711.50. Claimant claims a lien on the property for that amount.',
    ])
    expect(text(owner)).not.toContain('Payment is requested')
    expect(text(owner)).not.toContain('Notice of the claim')
  })

  it('the physical address prints only when it is held and differs from the mailing address', () => {
    expect(numbered({ ...short, claimantPhysicalAddress: '12 Shop Rd, San Antonio, TX' })[0]).toBe('1. I am authorized to make this affidavit for Click Plumbing and Electrical ("Claimant"). Claimant\'s mailing address is 5501 Balcones Dr, Austin, TX. Its physical address is 12 Shop Rd, San Antonio, TX.')
    expect(numbered({ ...short, claimantPhysicalAddress: ' 5501 balcones dr, austin, tx ' })[0]).not.toContain('physical address')
    expect(numbered({ ...short, claimantPhysicalAddress: '' })[0]).not.toContain('physical address')
  })

  it('someone other than the original contractor hired us: that party and its address, then the original contractor and its address', () => {
    expect(numbered({ ...short, contractedWithName: 'Alamo Mechanical', contractedWithAddress: '9 Yard St, Devine TX 78016' })[2]).toBe('3. Claimant did so under a contract with Alamo Mechanical, 9 Yard St, Devine TX 78016. The original contractor is Knight Contracting, 2904 Corporate CR, Flower Mound, TX.')
    // The hiring party named with no address on file is a blank the office sees.
    expect(numbered({ ...short, contractedWithName: 'Alamo Mechanical' })[2]).toContain('Alamo Mechanical, _______________.')
    // The same party named twice, in another case, is one party.
    expect(numbered({ ...short, contractedWithName: 'KNIGHT CONTRACTING ' })[2]).toBe('3. Claimant did so under a contract with Knight Contracting, 2904 Corporate CR, Flower Mound, TX, the original contractor.')
  })

  it('what the earlier form carried and the statute does not list is gone', () => {
    const t = text(short, { letterhead: { company: 'Click Plumbing and Electrical', licenseLine: 'M-12345', contactLines: ['(512) 360-0599'] }, refItems: ['Job #650', 'Work month 2026-08', 'November 10, 2026'] })
    for (const gone of ['Job #650', 'Work month', '(512) 360-0599', 'M-12345', 'My name is', 'during the period from', 'The original contract amount', 'The amount paid to date', 'All statutory notices', "attorney's fees", 'COUNTY OF BEXAR']) expect(t).not.toContain(gone)
    expect(buildLienAffidavitBlocks(short, { refItems: ['Job #650'] })[0]).toEqual({ kind: 'title', lines: ["Mechanic's and Materialman's Lien Affidavit"] })
  })

  it('a fact not on the record prints a blank, never a guess', () => {
    const bare = numbered({ ...short, claimantAddress: '', legalDescription: '', originalContractorName: '', originalContractorAddress: '', contractedWithName: '', ownerAddress: '', workMonthsWords: '', noticesSentWords: undefined })
    expect(bare[0]).toContain("Claimant's mailing address is _______________.")
    expect(bare[1]).toContain('Texas: _______________, 150 E Sonterra Blvd')
    expect(bare[2]).toBe('3. Claimant did so under a contract with _______________, _______________, the original contractor.')
    expect(bare[3]).toBe('4. The owner or reputed owner is Sonterra Holdings LLC, _______________.')
    expect(bare[4]).toBe('5. Payment is requested for work done and materials furnished in _______________.')
    expect(bare[5]).toBe('6. Notice of the claim was sent to the owner by _______________.')
  })

  it('an acronym trade keeps its capitals inside the sentence', () => {
    expect(numbered({ ...short, workDescription: 'HVAC labor and materials' })[1]).toContain('Claimant furnished HVAC labor and materials to improve')
    expect(numbered({ ...short, workDescription: 'Electrical labor and materials' })[1]).toContain('Claimant furnished electrical labor and materials to improve')
  })

  it('the jurat carries the printed-name line in the HTML and keeps the signature with its notary on one page', () => {
    const blocks = buildLienAffidavitBlocks(short)
    expect(filingDocHtml(blocks)).toContain('Printed name: ______________________________')
    expect(filingDocHtml(blocks)).not.toContain('My commission expires')
    // The county blank's note sits on the county's own line, in the paper's HTML and once only: the notary's blank has none.
    expect(filingDocHtml(blocks)).toContain('<strong>COUNTY OF ___________</strong> <span data-county-note style="font-size:0.85em">(where signed)</span>')
    expect(filingDocHtml(blocks).match(/where signed/g)).toHaveLength(1)
    // The county the company signs in (punch list #314): both county lines print it, and the note beside the blank is gone with the blank.
    const signed = filingDocHtml(buildLienAffidavitBlocks({ ...short, signingCounty: 'Travis County' }))
    expect(signed).toContain('<strong>COUNTY OF TRAVIS</strong></p>')
    expect(signed).toContain('COUNTY OF TRAVIS</p><p')
    expect(signed).not.toContain('where signed')
    expect(signed).not.toContain('COUNTY OF ___')
    // The county the paper is filed in is still the property's, in its own paragraph.
    expect(signed).toContain(short.county)
    const last = blocks.length - 1
    expect(filingKeepTogetherRuns(blocks)).toEqual([[last - 2, last]])
  })

  it('a stored copy with no form mark draws as the ten paragraphs it was filed with', () => {
    const { form: _form, ...asFiledBefore } = short
    expect(numbered(asFiledBefore)).toHaveLength(10)
    expect(text(asFiledBefore)).toContain('COUNTY OF BEXAR')
    expect(text(asFiledBefore)).toContain("together with all interest, costs, and attorney's fees allowed by law")
  })

  describe('on a homestead (§ 53.254(f))', () => {
    it('opens with the statute’s notice, above the title, and changes nothing else', () => {
      const blocks = buildLienAffidavitBlocks({ ...short, homestead: true })
      expect(blocks[0]).toEqual({ kind: 'topNotice', text: 'NOTICE: THIS IS NOT A LIEN. THIS IS ONLY AN AFFIDAVIT CLAIMING A LIEN.' })
      expect(blocks[1]).toEqual({ kind: 'title', lines: ["Mechanic's and Materialman's Lien Affidavit"] })
      expect(blocks.slice(1)).toEqual(buildLienAffidavitBlocks(short))
      expect(text({ ...short, homestead: true }).startsWith(`${HOMESTEAD_AFFIDAVIT_NOTICE}\n\nMECHANIC'S AND MATERIALMAN'S LIEN AFFIDAVIT`)).toBe(true)
    })

    it('prints it bold, centred and at 12 point, whatever size the paper around it is drawn at', () => {
      const html = filingDocHtml(buildLienAffidavitBlocks({ ...short, homestead: true }))
      const notice = /<p data-top-notice style="([^"]*)">([^<]*)<\/p>/.exec(html)!
      expect(notice[2]).toBe(HOMESTEAD_AFFIDAVIT_NOTICE)
      expect(notice[1]).toContain('font-weight:700')
      expect(notice[1]).toContain('font-size:12pt')
      expect(notice[1]).toContain('text-align:center')
      // Nothing is drawn before it.
      expect(html.startsWith('<p data-top-notice')).toBe(true)
    })

    it('a property that is not a homestead carries no notice', () => {
      expect(text(short)).not.toContain('THIS IS NOT A LIEN')
      expect(text({ ...short, homestead: false })).not.toContain('THIS IS NOT A LIEN')
      expect(filingDocHtml(buildLienAffidavitBlocks(short))).not.toContain('data-top-notice')
    })

    it('a paper on the earlier form stays as it was drafted', () => {
      const { form: _form, ...earlier } = short
      expect(text({ ...earlier, homestead: true })).not.toContain('THIS IS NOT A LIEN')
    })
  })

  describe('on the printed sheet (v2.6895)', () => {
    // Chrome's print put the seven paragraphs under a GC a few lines over one Letter sheet at the paper's own leading.
    const printBody = (html: string) => /@media print \{[\s\S]*?body \{([^}]*)\}/.exec(html)?.[1] ?? ''

    it('the short form prints at the PDF’s leading, so the notary gets one page', () => {
      expect(lienAffidavitPrintOptions(short)).toEqual({ leading: 'tight' })
      const html = filingDocPrintHtml(buildLienAffidavitBlocks(short), 'Lien Affidavit', filingDocFooter('affidavit'), lienAffidavitPrintOptions(short))
      expect(printBody(html)).toContain(`line-height: ${FILING_PRINT_TIGHT_LEADING};`)
      expect(FILING_PRINT_TIGHT_LEADING).toBe(1.45)
      // The screen keeps the paper's own leading, and the closing is still one run a page does not split.
      expect(html).toContain('line-height: 1.75; }')
      expect(html).toContain('<div class="filing-keep">')
    })

    it('the earlier form and every other paper keep the sheet they had', () => {
      // The earlier form is a paper with no mark.
      const earlier: LienAffidavitFields = { ...short, form: undefined }
      expect(lienAffidavitPrintOptions(earlier)).toBeUndefined()
      const long = filingDocPrintHtml(buildLienAffidavitBlocks(earlier), 'Lien Affidavit', filingDocFooter('affidavit'), lienAffidavitPrintOptions(earlier))
      expect(printBody(long)).not.toContain('line-height')
      expect(printBody(filingDocPrintHtml(buildLienNoticeBlocks(NOTICE_FIELDS), 'Notice'))).not.toContain('line-height')
    })
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

describe('letterhead + extras dressing (v2.2663)', () => {
  const extras = {
    letterhead: { company: 'Click Plumbing and Electrical', licenseLine: 'Master Plumber Lic. M-00000', contactLines: ['5501 Balcones Dr A141', 'Austin, TX 78731', '(512) 360-0599', 'office@clickplumbing.com'] },
    refItems: ['Job #898', 'Work month 2026-07', 'September 2, 2026'],
    deliveryLines: ['Owner of record — certified mail, return receipt · 9400 1111 · September 2, 2026'],
  }

  it('prepends letterhead + ref strip and appends the delivery record around the untouched statutory text', () => {
    const text = filingDocText(buildLienNoticeBlocks(NOTICE_FIELDS, extras))
    const iCo = text.indexOf('Click Plumbing and Electrical')
    const iRef = text.indexOf('Job #898 · Work month 2026-07')
    const iTitle = text.indexOf('NOTICE OF CLAIM FOR UNPAID LABOR OR MATERIALS')
    const iDelivery = text.indexOf('DELIVERY RECORD')
    expect(iCo).toBeGreaterThanOrEqual(0)
    expect(iRef).toBeGreaterThan(iCo)
    expect(iTitle).toBeGreaterThan(iRef)
    expect(iDelivery).toBeGreaterThan(iTitle)
    expect(text).toContain('Master Plumber Lic. M-00000')
    // Statutory lines unchanged by the dressing.
    expect(text).toContain('Claim amount: $2,711.50')
    expect(text).toContain("(Claimant's address) 5501 Balcones Dr Ste A141, Austin, TX 78731")
  })

  it('without extras the statutory blocks render exactly as before (plus the claimant signature)', () => {
    const text = filingDocText(buildLienNoticeBlocks(NOTICE_FIELDS))
    expect(text.startsWith('NOTICE OF CLAIM FOR UNPAID LABOR OR MATERIALS')).toBe(true)
    expect(text).not.toContain('DELIVERY RECORD')
    expect(text).toContain('______________________________\nMalachi Whites\nClick Plumbing and Electrical')
  })

  it('letterhead helper folds the issuer into company / license / contact lines and skips blanks', () => {
    expect(filingLetterheadFromIssuer(null)).toBeUndefined()
    expect(filingLetterheadFromIssuer({ companyName: ' ', addressText: 'x', phone: '', email: '', licenseLine: '' })).toBeUndefined()
    const lh = filingLetterheadFromIssuer({
      companyName: 'Click Plumbing and Electrical',
      addressText: '5501 Balcones Dr A141\nAustin, TX 78731',
      phone: '(512) 360-0599',
      email: 'office@clickplumbing.com',
      licenseLine: 'RMP-1234',
    })
    expect(lh).toEqual({
      company: 'Click Plumbing and Electrical',
      licenseLine: 'RMP-1234',
      contactLines: ['5501 Balcones Dr A141', 'Austin, TX 78731', '(512) 360-0599', 'office@clickplumbing.com'],
    })
  })

  it('html render escapes values and draws the form grid with ruled values', () => {
    const html = filingDocHtml(buildLienNoticeBlocks({ ...NOTICE_FIELDS, projectDescription: 'A <b>risky</b> & "quoted" address' }, extras))
    expect(html).toContain('A &lt;b&gt;risky&lt;/b&gt; &amp; &quot;quoted&quot; address')
    expect(html).toContain('Delivery record')
    expect(html).toContain('border-bottom:1px solid')
  })

  it('footers cite the right statute per instrument', () => {
    expect(filingDocFooter('notice_53_056')).toContain('§ 53.056')
    expect(filingDocFooter('affidavit')).toContain('53.052')
    expect(filingDocFooter('release_of_record')).toContain('Chapter 53')
  })
})

describe('the § 53.254(g) homestead statement (v2.3744)', () => {
  it('prints under the form, verbatim, only when the notice carries the flag', () => {
    const plain = filingDocText(buildLienNoticeBlocks(NOTICE_FIELDS))
    expect(plain).not.toContain('53.254')
    const withIt = filingDocText(buildLienNoticeBlocks({ ...NOTICE_FIELDS, homesteadStatement: true }))
    expect(withIt).toContain(HOMESTEAD_NOTICE_STATEMENT.heading.toUpperCase())
    expect(withIt).toContain(HOMESTEAD_NOTICE_STATEMENT.lead)
    expect(withIt).toContain('1. ' + HOMESTEAD_NOTICE_STATEMENT.one)
    expect(withIt).toContain('2. ' + HOMESTEAD_NOTICE_STATEMENT.two)
    // it comes after the signature — the form itself is untouched
    expect(withIt.indexOf('Malachi Whites')).toBeLessThan(withIt.indexOf('53.254'))
  })
})

describe('the § 53.057 retainage form (v2.3753)', () => {
  const f = { noticeDate: '2026-09-24', projectDescription: '44 Lantern Row', claimantName: 'Click Plumbing and Electrical', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'Harborline Builders', contractedWithIfDifferent: '', claimAmount: '1760.00', contactPerson: 'Rey Salinas, Master Plumber', claimantAddress: '1 Main St' }
  it('is the § 53.056 form with the title and the money line swapped, and no per-month or retainage lines', () => {
    const blocks = buildLienRetainageNoticeBlocks({ ...f, claimSplit: 'x', retainageIncluded: '5.00' })
    const title = blocks.find((b) => b.kind === 'title')
    expect(title && title.kind === 'title' ? title.lines : []).toEqual(['Notice of Claim for Unpaid Retainage', '(Tex. Prop. Code § 53.057)'])
    const labels = blocks.filter((b) => b.kind === 'formLine').map((b) => (b.kind === 'formLine' ? b.label : ''))
    expect(labels).toContain('Total retainage unpaid:')
    expect(labels).not.toContain('Claim amount:')
    expect(labels).not.toContain('Of which, by month:')
    expect(labels).not.toContain('Of which, unpaid retainage:')
    expect(filingDocFooter('retainage_53_057')).toBe('Given pursuant to Texas Property Code § 53.057')
  })
  it('the § 53.056 form names the retainage inside its claim when the job records one', () => {
    const labels = buildLienNoticeBlocks({ ...f, claimAmount: '9800.00', retainageIncluded: '1760.00' }).filter((b) => b.kind === 'formLine').map((b) => (b.kind === 'formLine' ? `${b.label} ${b.value}` : ''))
    expect(labels).toContain('Claim amount: $9,800.00')
    expect(labels).toContain('Of which, unpaid retainage: $1,760.00')
    expect(buildLienNoticeBlocks(f).some((b) => b.kind === 'formLine' && b.label === 'Of which, unpaid retainage:')).toBe(false)
  })
})

describe('the pay page blocks (v2.3758)', () => {
  it('a callout is a boxed line; a pay row carries its code, or a dashed box and a note without one', () => {
    const html = filingDocHtml([
      { kind: 'callout', text: 'Please pay these only if the GC says so.' },
      { kind: 'payRow', label: 'Invoice #273-1, May 5, 2026', description: 'Trim.', amountLine: 'Still owed: $13,420.00', address: 'clicktooling.com/pay/inv-1', note: '', svg: '<svg data-code></svg>', png: null },
      { kind: 'payRow', label: 'Invoice #273-3, July 3, 2026', description: '', amountLine: 'Still owed: $3,500.00', address: '', note: 'No online payment page for this bill — pay by check to the address above.', svg: null, png: null },
    ])
    expect(html).toContain('#fff8e1')
    expect(html).toContain('Please pay these only if the GC says so.')
    expect(html).toContain('<svg data-code></svg>')
    expect(html).toContain('clicktooling.com/pay/inv-1')
    expect(html).toContain('border:1px dashed')
    expect(html).toContain('pay by check to the address above')
    expect(filingDocText([{ kind: 'callout', text: 'Rule.' }, { kind: 'payRow', label: 'L', description: 'D', amountLine: 'A', address: 'X', note: '', svg: null, png: null }])).toBe('Rule.\n\nL\nD\nA\nX')
  })
})

describe('the signed frame (v2.5077, lien desk signing)', () => {
  const signed = { mode: 'type' as const, printedName: 'Robert Douglas', pngDataUrl: null, signedWords: 'Signed October 9, 2026 at 2:14 PM CT', recordId: 'L878-4C2E91', auditLine: 'Placed by Robert Douglas with one press under his own sign-in to ClickTooling on October 9, 2026 at 2:14 PM CT.' }

  it('unsigned, the block is the rule and the names as before; signed, the page carries the tag, the cursive name, the names under the rule, the day, the record ID and the audit lines', () => {
    const plain = filingDocHtml(buildLienNoticeBlocks(NOTICE_FIELDS))
    expect(plain).toContain('border-bottom:1px solid currentColor;height:1.6em')
    expect(plain).not.toContain('Signed electronically')
    const html = filingDocHtml(buildLienNoticeBlocks(NOTICE_FIELDS, undefined, { signature: signed }))
    expect(html).toContain('data-filing-signed="L878-4C2E91"')
    expect(html).toContain('data-filing-signed-mode="type"')
    expect(html).toContain('Signed electronically')
    expect(html).toContain("font-family:'Great Vibes'")
    expect(html).toContain('>Robert Douglas</div>')
    expect(html).toContain('Malachi Whites<br/>Click Plumbing and Electrical<br/>Signed October 9, 2026 at 2:14 PM CT')
    expect(html).toContain('>L878-4C2E91</span>')
    expect(html).toContain('Placed by Robert Douglas with one press')
    expect(html).toContain('ESIGN Act (15 U.S.C. § 7001)')
    expect(html).not.toContain('height:1.6em')
  })

  it('drawn, the frame holds the ink instead of the cursive name', () => {
    const html = filingDocHtml(buildLienNoticeBlocks(NOTICE_FIELDS, undefined, { signature: { ...signed, mode: 'draw', pngDataUrl: 'data:image/png;base64,AAAA' } }))
    expect(html).toContain('<img src="data:image/png;base64,AAAA" alt="Signature of Robert Douglas"')
    expect(html).toContain('data-filing-signed-mode="draw"')
    expect(html).not.toContain("font-family:'Great Vibes'")
  })

  it('in plain text the mark is /s/ the name with the record line; the print shell loads the cursive face only for a pressed signature', () => {
    const text = filingDocText(buildLienNoticeBlocks(NOTICE_FIELDS, undefined, { signature: signed }))
    expect(text).toContain('/s/ Robert Douglas\nSigned electronically · L878-4C2E91 · Signed October 9, 2026 at 2:14 PM CT\nMalachi Whites\nClick Plumbing and Electrical\nPlaced by Robert Douglas')
    expect(filingDocText(buildLienNoticeBlocks(NOTICE_FIELDS))).toContain('______________________________\nMalachi Whites')
    const shellSigned = filingDocPrintHtml(buildLienNoticeBlocks(NOTICE_FIELDS, undefined, { signature: signed }), 'Notice')
    expect(shellSigned).toContain('fonts.googleapis.com/css2?family=Great+Vibes')
    expect(filingDocPrintHtml(buildLienNoticeBlocks(NOTICE_FIELDS), 'Notice')).not.toContain('Great+Vibes')
    expect(filingDocPrintHtml(buildLienNoticeBlocks(NOTICE_FIELDS, undefined, { signature: { ...signed, mode: 'draw', pngDataUrl: 'data:image/png;base64,AAAA' } }), 'Notice')).not.toContain('Great+Vibes')
  })
})

describe('the window envelope blocks (the Docsmit train, PR 4)', () => {
  it('the HTML shows the recipient block in a window box and the code with its link in words; the text twin carries both', async () => {
    const { filingDocHtml, filingDocText } = await import('./lienFilingDocuments')
    const blocks = [
      { kind: 'windowAddress' as const, lines: ['ATI Schertz Holdings LLC', '17300 IH 35 N', 'Schertz, TX 78154'] },
      { kind: 'qrLink' as const, png: null, svg: '<svg data-code="1"></svg>', display: 'clicktooling.com/pay/abc?m=KX7M2QRT', caption: 'Scan to see and pay the bills this notice is about.' },
    ]
    const html = filingDocHtml(blocks)
    expect(html).toContain('data-window-address')
    expect(html).toContain('ATI Schertz Holdings LLC<br/>17300 IH 35 N<br/>Schertz, TX 78154')
    expect(html).toContain('data-qr-link')
    expect(html).toContain('<svg data-code="1"></svg>')
    expect(html).toContain('clicktooling.com/pay/abc?m=KX7M2QRT')
    expect(filingDocHtml([{ kind: 'qrLink', png: null, svg: null, display: 'x', caption: 'c' }])).toContain('border:1px dashed')
    expect(filingDocText(blocks)).toBe('ATI Schertz Holdings LLC\n17300 IH 35 N\nSchertz, TX 78154\n\nScan to see and pay the bills this notice is about.\nclicktooling.com/pay/abc?m=KX7M2QRT')
  })
})

describe('the printed page (v2.6810)', () => {
  // The office's print of an affidavit: item 10 at the foot of page 1, the signature alone at the head of page 2, and the
  // browser's own header and footer (the date and time, the title, "about:blank", the page count) on both sheets.
  const affidavit: LienAffidavitFields = {
    county: 'Bexar',
    claimantPersonName: 'Rey Master, Master Plumber',
    claimantCompany: 'Sample Plumbing',
    claimantAddress: '1 Sample Dr, Austin, TX',
    legalDescription: 'Lot 3, Block A',
    propertyAddress: '12 Sample Rd, San Antonio, TX 78209',
    contractedWithName: 'Harborline Builders',
    workDescription: 'Plumbing labor and materials',
    workStart: '2026-06-03',
    workEnd: '2026-07-28',
    ownerName: 'Pat Owner',
    ownerAddress: '4 Owner Ct, San Antonio, TX 78209',
    originalContractorName: 'Harborline Builders',
    originalContractorAddress: '',
    contractAmount: '5000',
    paidAmount: '0',
    unpaidAmount: '5000',
    includeNoticesSworn: true,
  }
  const kinds = (blocks: ReturnType<typeof buildLienAffidavitBlocks>, [first, last]: [number, number]) => blocks.slice(first, last + 1).map((b) => b.kind)

  it('a signature runs with the statement above it and the notary’s block under it', () => {
    const aff = buildLienAffidavitBlocks(affidavit)
    const [run] = filingKeepTogetherRuns(aff)
    expect(filingKeepTogetherRuns(aff)).toHaveLength(1)
    expect(kinds(aff, run!)).toEqual(['numbered', 'signature', 'notarial'])
    expect(run![1]).toBe(aff.length - 1)
    expect(aff[run![0]]).toMatchObject({ kind: 'numbered', n: 10 })
    // The release: its last paragraph, the signature, the notary.
    const release = buildReleaseOfRecordBlocks({ county: 'Bexar', claimantCompany: 'Sample Plumbing', claimantPersonName: 'Rey Master', recordingNumber: '1', filedDate: '2026-10-01', legalDescription: 'Lot 3', propertyAddress: '12 Sample Rd', ownerName: 'Pat Owner', paymentDate: '2026-11-09' })
    expect(kinds(release, filingKeepTogetherRuns(release)[0]!)).toEqual(['paragraph', 'signature', 'notarial'])
    // The notice: the last form line and the signature; the homestead statement under it is not part of the run.
    const notice = buildLienNoticeBlocks({ ...NOTICE_FIELDS, homesteadStatement: true })
    const noticeRun = filingKeepTogetherRuns(notice)[0]!
    expect(kinds(notice, noticeRun)).toEqual(['formLine', 'signature'])
    expect(noticeRun[1]).toBeLessThan(notice.length - 1)
    // No signature, no run; two signatures in a row are one run and never claim a block twice.
    expect(filingKeepTogetherRuns([{ kind: 'paragraph', text: 'a' }])).toEqual([])
    expect(filingKeepTogetherRuns([{ kind: 'paragraph', text: 'a' }, { kind: 'signature', lines: ['A'] }, { kind: 'signature', lines: ['B'] }, { kind: 'paragraph', text: 'b' }, { kind: 'signature', lines: ['C'] }])).toEqual([[0, 2], [3, 4]])
    expect(filingKeepTogetherRuns([{ kind: 'signature', lines: ['A'] }])).toEqual([[0, 0]])
  })

  it('the print document keeps the run in one unsplittable block, the footer with it, and item 9 outside it', () => {
    const html = filingDocPrintHtml(buildLienAffidavitBlocks(affidavit), 'Lien Affidavit', filingDocFooter('affidavit'))
    const keepAt = html.indexOf('<div class="filing-keep">')
    expect(keepAt).toBeGreaterThan(0)
    expect(html.match(/class="filing-keep"/g)).toHaveLength(1)
    expect(html).toContain('.filing-keep { break-inside: avoid; page-break-inside: avoid; }')
    const at = (text: string) => html.indexOf(text)
    expect(at('9. All statutory notices')).toBeLessThan(keepAt)
    expect(at('9. All statutory notices')).toBeGreaterThan(0)
    for (const inside of ['10. Claimant claims a lien', 'Rey Master, Master Plumber<br/>Sample Plumbing', 'SWORN TO AND SUBSCRIBED BEFORE ME', 'Notary Public, State of Texas', 'Filed pursuant to Texas Property Code']) expect(at(inside), inside).toBeGreaterThan(keepAt)
    // The words on the paper are the same blocks in the same order.
    expect(html.match(/Claimant claims a lien/g)).toHaveLength(1)
    expect(html.match(/Filed pursuant to Texas Property Code/g)).toHaveLength(1)
  })

  it('the page leaves the browser no room for its own header and footer, and draws its own margins on every page', () => {
    const html = filingDocPrintHtml(buildLienAffidavitBlocks(affidavit), 'Lien Affidavit', filingDocFooter('affidavit'))
    expect(html).toContain('@page { size: letter; margin: 0; }')
    // The head and foot of each page: a table header and footer the print engine repeats, blank on screen.
    expect(html).toContain('<thead><tr><td><div class="filing-page-gap"></div></td></tr></thead>')
    expect(html).toContain('<tfoot><tr><td><div class="filing-page-gap"></div></td></tr></tfoot>')
    expect(html).toContain('.filing-page-gap { height: 0; }')
    expect(html).toMatch(/@media print \{[^]*\.filing-page-gap \{ height: 0\.6in; \}/)
  })

  it('a paper with no footer and one whose signature is not last still print whole', () => {
    const bare = filingDocPrintHtml(buildLienNoticeBlocks(NOTICE_FIELDS), 'Notice')
    expect(bare).toContain("(Claimant's address)")
    expect(bare.match(/class="filing-keep"/g)).toHaveLength(1)
    const homestead = filingDocPrintHtml(buildLienNoticeBlocks({ ...NOTICE_FIELDS, homesteadStatement: true }), 'Notice', filingDocFooter('notice_53_056'))
    // The footer is under the statement, after the run closes.
    expect(homestead.indexOf('Given pursuant to Texas Property Code § 53.056')).toBeGreaterThan(homestead.indexOf(HOMESTEAD_NOTICE_STATEMENT.heading))
    expect(homestead.match(/Given pursuant to/g)).toHaveLength(1)
  })

  it('pages added behind the paper go inside the sheet, so they keep its margins', () => {
    const html = filingDocPrintHtml(buildLienNoticeBlocks(NOTICE_FIELDS), 'Notice', filingDocFooter('notice_53_056'))
    const added = appendToFilingPrintHtml(html, '<section>ENCLOSED</section>')
    expect(added.indexOf('ENCLOSED')).toBeGreaterThan(added.indexOf('Given pursuant to'))
    expect(added.indexOf('ENCLOSED')).toBeLessThan(added.indexOf('</td></tr></tbody>'))
    expect(appendToFilingPrintHtml(html, '')).toBe(html)
    // A page that is not this builder's takes it before the body closes, as before.
    expect(appendToFilingPrintHtml('<html><body><p>x</p></body></html>', '<i>y</i>')).toBe('<html><body><p>x</p><i>y</i></body></html>')
  })
})
