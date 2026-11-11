import { describe, expect, it } from 'vitest'
import { buildLienAffidavitBlocks, filingDocFooter, filingDocHtml, filingDocPrintHtml, prependToFilingPrintHtml, type LienAffidavitFields } from '../jobsDocuments/lienFilingDocuments'
import { LIEN_HELP_EARLIER_FORM_REASON, lienAffidavitBatchHelpSheet, lienAffidavitPrintRun } from './lienAffidavitBatch'
import {
  LIEN_HELP_BLANKS,
  LIEN_HELP_BLANKS_SHORT,
  LIEN_HELP_MARK_NOTES,
  LIEN_HELP_NEVER_FIX,
  LIEN_HELP_STOPS,
  LIEN_HELP_STYLES,
  lienHelpAfterSteps,
  lienHelpBatchSheetHtml,
  lienHelpCoverSheetHtml,
  lienHelpGuideCopyHtml,
  lienHelpMarkPaper,
  lienHelpPaperFromFields,
  lienHelpPrintHtml,
  lienHelpSameProperty,
  type LienHelpPaper,
} from './lienHelpSheet'
import { plainWordsFailures } from '../plainWords'

// Every name, address and county here is made up.
const fields = (over: Partial<LienAffidavitFields> = {}): LienAffidavitFields =>
  ({
    county: 'Alder', claimantPersonName: 'Pat Sample, Master Plumber', claimantCompany: 'Sample Plumbing LLC', claimantAddress: '100 Made Up Rd, Marlow, TX 75001',
    legalDescription: 'SAMPLE ESTATES, BLOCK 2, LOT 4', propertyAddress: '18 Sample Ln, Marlow, TX 75001', contractedWithName: 'Ridgeway Builders', workDescription: 'Plumbing labor and materials',
    workStart: '', workEnd: '', ownerName: 'Jordan and Casey Sample', ownerAddress: '9 Placeholder Ct, Marlow, TX 75001', originalContractorName: 'Ridgeway Builders', originalContractorAddress: '40 Example Pkwy, Marlow, TX 75001',
    contractAmount: '5000.00', paidAmount: '0.00', unpaidAmount: '2650.00', includeNoticesSworn: true, form: 'short', isSub: true, workMonthsWords: 'August 2026', noticesSentWords: 'certified mail on October 14, 2026', ...over,
  }) as LienAffidavitFields
const paper = (over: Partial<LienHelpPaper> = {}): LienHelpPaper => ({ ...lienHelpPaperFromFields({ jobLabel: '412 · Ridgeway Builders', fileBy: 'November 16, 2026', claimWords: '$2,650.00', fields: fields() }), ...over })
const textOf = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/\s+/g, ' ').trim()

describe('the help sheet reads the paper’s own facts (punch list #314)', () => {
  it('takes the clerk, the property, the signer and the two addresses off the affidavit’s fields', () => {
    expect(paper()).toEqual({
      jobLabel: '412 · Ridgeway Builders', propertyAddress: '18 Sample Ln, Marlow, TX 75001', propertyCounty: 'Alder', claim: '$2,650.00', fileBy: 'November 16, 2026', signer: 'Pat Sample, Master Plumber',
      ownerName: 'Jordan and Casey Sample', ownerAddress: '9 Placeholder Ct, Marlow, TX 75001', contractorName: 'Ridgeway Builders', contractorAddress: '40 Example Pkwy, Marlow, TX 75001',
    })
  })
  it('a job contracted with the owner has no original contractor to mail', () => {
    const direct = lienHelpPaperFromFields({ jobLabel: '430', fileBy: '', claimWords: '$360.00', fields: fields({ isSub: false, originalContractorName: 'Sample Plumbing LLC' }) })
    expect([direct.contractorName, direct.contractorAddress]).toEqual(['', ''])
    expect(lienHelpAfterSteps('Alder', false)[3]).toBe('Mail a copy by certified mail to the owner. The app shows the last day to mail.')
  })
})

describe('the words a first-timer reads', () => {
  it('follow the plain-words rules: every blank, every stop, every step and every mark note', () => {
    const sentences = [...LIEN_HELP_BLANKS.map(([lead, rest]) => `${lead} ${rest}`), ...LIEN_HELP_BLANKS_SHORT.map(([, rest]) => rest), ...LIEN_HELP_STOPS, LIEN_HELP_NEVER_FIX, ...Object.values(LIEN_HELP_MARK_NOTES), ...lienHelpAfterSteps('Alder', true).map(textOf)]
    for (const s of sentences) expect(plainWordsFailures(s), s).toEqual([])
  })
  it('name the six blanks in the order the pen meets them, and the Lien window’s presses by their own words', () => {
    expect(LIEN_HELP_BLANKS.map(([lead]) => lead)).toEqual(['COUNTY OF, at the top.', 'The signature line.', 'COUNTY OF, in the notary’s block.', 'The day, the month and the year.', 'The notary’s signature and printed name.', 'The notary’s seal.'])
    const after = lienHelpAfterSteps('Alder', true).join(' ')
    expect(after).toContain('<strong>Alder County Clerk</strong>')
    expect(after).toContain('<strong>Open the affidavit tab ›</strong>')
    expect(after).toContain('<strong>Record filing…</strong>')
    expect(after).toContain('<strong>Record service…</strong>')
    expect(lienHelpAfterSteps('', true)[0]).toContain('County Clerk of the property’s county')
  })
})

describe('A · a cover sheet for one paper', () => {
  const html = lienHelpCoverSheetHtml(paper(), 'November 11, 2026')
  const text = textOf(html)
  it('says it is not the paper, and carries the job’s facts, the stop list, the blanks and the steps', () => {
    expect(html.startsWith('<section class="lien-help" data-lien-help="cover">')).toBe(true)
    expect(text).toContain('Help sheet · do not file this page')
    expect(text).toContain('Lien affidavit: before you sign')
    expect(text).toContain('Job 412 · Ridgeway Builders Property 18 Sample Ln, Marlow, TX 75001 Claim $2,650.00 File by November 16, 2026')
    for (const stop of LIEN_HELP_STOPS) expect(text).toContain(stop)
    expect(text).toContain(LIEN_HELP_NEVER_FIX)
    expect(text).toContain('The signature line. Pat Sample, Master Plumber signs in front of the notary, and not before.')
    expect(text).toContain('File the original with the Alder County Clerk')
    expect(text).toContain('Owner Jordan and Casey Sample 9 Placeholder Ct, Marlow, TX 75001')
    expect(text).toContain('Original contractor Ridgeway Builders 40 Example Pkwy, Marlow, TX 75001')
    expect(text).toContain('The paper to sign is the next page')
  })
  it('escapes what the record holds, and says so when the file-by day is not known', () => {
    const odd = lienHelpCoverSheetHtml(paper({ ownerName: 'Sample & <Sons>', fileBy: '' }), '')
    expect(odd).toContain('Sample &amp; &lt;Sons&gt;')
    expect(odd).not.toContain('<Sons>')
    expect(textOf(odd)).toContain('File by see the Lien desk')
  })
})

describe('B · one sheet for a batch', () => {
  const papers = [paper(), paper({ jobLabel: '418 · Mock Ave', propertyAddress: '77 Mock Ave, Fenwick, TX 75002', propertyCounty: 'Cedar' }), paper({ jobLabel: '421 · Second job', propertyAddress: '18 SAMPLE LN,  Marlow TX 75001' })]
  it('lists each paper with its clerk and who gets a copy, five boxes to tick, and the papers left out with the reason', () => {
    const html = lienHelpBatchSheetHtml({ papers, leftOut: [{ jobLabel: '430 · Civic Drains', reason: LIEN_HELP_EARLIER_FORM_REASON }], printedOn: 'November 11, 2026' })
    const text = textOf(html)
    expect(html.startsWith('<section class="lien-help" data-lien-help="batch">')).toBe(true)
    expect(text).toContain('Lien affidavits: this batch of 3')
    expect(text).toContain('All due November 16, 2026')
    expect(text).toContain('412 · Ridgeway Builders 18 Sample Ln, Marlow, TX 75001 $2,650.00 Alder County Jordan and Casey Sample · Ridgeway Builders')
    expect(text).toContain('Cedar County')
    expect(html.match(/<span class="lien-help-tick"><\/span>/g)).toHaveLength(15)
    expect(text).toContain('430 · Civic Drains Not printed. It is on the earlier form. Redraw it, or print it from its own Lien window.')
    expect(text).toContain('3 papers follow this page')
    // The steps sit above the rows, so a long batch keeps every instruction on its first page.
    expect(html.indexOf('After the notary, for each paper')).toBeLessThan(html.indexOf('<table class="lien-help-rows">'))
  })
  it('says ask first on a paper whose property an earlier paper of the batch is on, however the address is typed', () => {
    expect([...lienHelpSameProperty(papers)]).toEqual([[2, 0]])
    expect(textOf(lienHelpBatchSheetHtml({ papers, printedOn: '' }))).toContain('Ask first. Same property as paper 1.')
    expect([...lienHelpSameProperty([{ propertyAddress: '' }, { propertyAddress: '' }])]).toEqual([])
  })
  it('names each paper’s own day when the batch has more than one, and counts a batch of one', () => {
    const mixed = lienHelpBatchSheetHtml({ papers: [paper(), paper({ fileBy: 'December 15, 2026' })], printedOn: '' })
    expect(textOf(mixed)).not.toContain('All due')
    expect(textOf(mixed)).toContain('by December 15, 2026')
    expect(textOf(lienHelpBatchSheetHtml({ papers: [paper()], printedOn: '' }))).toContain('Lien affidavit: this batch of 1')
  })
})

describe('C · a guide copy of the paper', () => {
  const paperHtml = filingDocHtml(buildLienAffidavitBlocks(fields()))
  it('puts a mark beside each blank and beside the lines to read twice, and leaves every word of the paper', () => {
    const marked = lienHelpMarkPaper(paperHtml)
    expect(marked.marks).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(marked.html.replace(/<span class="lien-help-num">\d<\/span>/g, '')).toBe(paperHtml)
    expect(marked.html).toContain('(where signed)</span><span class="lien-help-num">1</span>')
    expect(marked.html).toContain('the original contractor.')
  })
  it('a job contracted with the owner names no months and no notices, so it gets no mark 8', () => {
    const direct = filingDocHtml(buildLienAffidavitBlocks(fields({ isSub: false })))
    expect(lienHelpMarkPaper(direct).marks).toEqual([1, 2, 3, 4, 5, 6, 7])
    const guide = lienHelpGuideCopyHtml(direct, { jobLabel: '430', fileBy: '', propertyCounty: 'Alder', contractorName: '' })
    expect(textOf(guide)).not.toContain(LIEN_HELP_MARK_NOTES[8])
    expect(textOf(guide)).toContain('Mail a copy to the owner.')
  })
  it('says twice that it is never signed or filed, and prints as a page of its own', () => {
    const guide = lienHelpGuideCopyHtml(paperHtml, paper())
    expect(guide.match(/Guide copy · do not sign or file this page/g)).toHaveLength(2)
    expect(textOf(guide)).toContain('Where the pen goes on the paper')
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) expect(textOf(guide)).toContain(LIEN_HELP_MARK_NOTES[n]!)
    const page = lienHelpPrintHtml(guide, 'Guide copy — Job 412')
    expect(page).toContain('<html data-theme="light">')
    expect(page).toContain('@page { size: letter; margin: 0.5in; }')
    expect(page).toContain('<title>Guide copy — Job 412</title>')
  })
})

describe('a help sheet is never the paper', () => {
  const f = fields()
  const blocks = buildLienAffidavitBlocks(f)
  const printed = filingDocPrintHtml(blocks, 'Lien Affidavit — Job 412', filingDocFooter('affidavit'))
  it('goes first in the print sheet, with its styles in the head, and the paper’s own HTML is untouched after it', () => {
    const withSheet = prependToFilingPrintHtml(printed, lienHelpCoverSheetHtml(paper(), ''), LIEN_HELP_STYLES)
    expect(withSheet.indexOf('data-lien-help="cover"')).toBeGreaterThan(0)
    expect(withSheet.indexOf('data-lien-help="cover"')).toBeLessThan(withSheet.indexOf('BEFORE ME'))
    expect(withSheet).toContain('.lien-help { font-family')
    expect(withSheet.replace(lienHelpCoverSheetHtml(paper(), ''), '').replace(LIEN_HELP_STYLES, '')).toBe(printed)
    expect(prependToFilingPrintHtml(printed, '', LIEN_HELP_STYLES)).toBe(printed)
  })
  it('the batch prints behind its sheet, and no job’s filed copy carries it', () => {
    const papers = [{ jobId: 'j1', jobNumber: '412', fields: f, label: '412 · Ridgeway Builders', fileBy: 'November 16, 2026' }, { jobId: 'j2', jobNumber: '418', fields: fields({ propertyAddress: '77 Mock Ave, Fenwick, TX 75002' }) }]
    const sheet = lienAffidavitBatchHelpSheet(papers, [], 'November 11, 2026')
    expect(textOf(sheet)).toContain('412 · Ridgeway Builders')
    // A paper with no label falls back to its number.
    expect(textOf(sheet)).toContain('Job 418')
    const run = lienAffidavitPrintRun(papers, sheet)
    expect(run.html.indexOf('data-lien-help="batch"')).toBeLessThan(run.html.indexOf('<div class="filing-paper'))
    expect(run.copies).toHaveLength(2)
    expect(run.copies.every((c) => !c.html.includes('lien-help'))).toBe(true)
    // With the box off the print is the papers alone, as before.
    expect(lienAffidavitPrintRun(papers).html).not.toContain('lien-help')
    expect(lienAffidavitPrintRun(papers, null).html).toBe(lienAffidavitPrintRun(papers).html)
  })
})
