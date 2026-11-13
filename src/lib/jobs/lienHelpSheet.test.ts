import { describe, expect, it } from 'vitest'
import { buildLienAffidavitBlocks, filingDocFooter, filingDocHtml, filingDocPrintHtml, prependToFilingPrintHtml, type LienAffidavitFields } from '../jobsDocuments/lienFilingDocuments'
import { LIEN_HELP_EARLIER_FORM_REASON, lienAffidavitBatchHelpSheet, lienAffidavitPrintRun } from './lienAffidavitBatch'
import {
  LIEN_HELP_ASK_FIRST,
  LIEN_HELP_BLANKS,
  LIEN_HELP_BLANKS_PRINTED_COUNTY,
  LIEN_HELP_BLANKS_PRINTED_COUNTY_SHORT,
  LIEN_HELP_BLANKS_SHORT,
  LIEN_HELP_MARK_NOTES,
  LIEN_HELP_NEVER_FIX,
  LIEN_HELP_STOPS,
  LIEN_HELP_STYLES,
  LIEN_HELP_YOUR_CHECK,
  GUIDE_WATERMARK,
  lienHelpAfterSteps,
  lienHelpBatchAfterSteps,
  lienHelpBatchBlanksTitle,
  lienHelpAskWords,
  lienHelpClerkGroupWords,
  lienHelpClerkLine,
  lienHelpPictureHtml,
  lienHelpBatchAsks,
  lienHelpBatchSummary,
  lienHelpChecks,
  lienHelpPrintedCountyLine,
  lienHelpBatchSheetHtml,
  lienHelpCoverSheetHtml,
  lienHelpGuideCopyHtml,
  lienHelpMarkPaper,
  lienHelpPaperFromFields,
  lienHelpPrintHtml,
  lienHelpSameProperty,
  LIEN_HELP_NOTICE_ASK_FIRST,
  lienHelpNoticeChecks,
  lienHelpNoticeMailBy,
  lienHelpNoticeSheetHtml,
  lienHelpNoticeSteps,
  type LienHelpNotice,
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
    expect(textOf(lienHelpAfterSteps('Alder', false)[3] as string)).toBe('Mail a copy by certified mail to the owner. The app shows the last day to mail. Mail by')
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
    // Each clerk has a row of its own above its papers, with a count (change 7).
    expect(text).toContain('ALDER COUNTY CLERK · 2 papers 1 412 · Ridgeway Builders 18 Sample Ln, Marlow, TX 75001 $2,650.00 Jordan and Casey Sample · Ridgeway Builders')
    expect(text).toContain('CEDAR COUNTY CLERK · 1 paper')
    expect(text).toContain('Recording no. · day filed')
    expect(html.match(/<span class="lien-help-tick"><\/span>/g)).toHaveLength(15)
    expect(text).toContain('430 · Civic Drains Not printed. It is on the earlier form. Redraw it, or print it from its own Lien window.')
    expect(text).toContain('3 papers follow this page')
    // The steps sit above the rows, so a long batch keeps every instruction on its first page.
    expect(html.indexOf('After the notary, one trip for each clerk')).toBeLessThan(html.indexOf('<table class="lien-help-rows">'))
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
    expect(marked.html).toContain('<strong>COUNTY OF ___________</strong><span class="lien-help-num">1</span>')
    expect(marked.html).not.toContain('where signed')
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

// The best-we-can-do pass (punch list #314): the sheet says what the app checked, and the counties print.
describe('what the app checked on a paper', () => {
  const clear = { propertyKind: 'residential', homestead: false, noticeLines: [] as string[] }
  const late = { ...clear, noticeLines: ['The owner’s notice went after its date, or is not on record, for April through July 2026.'] }
  const checkedPaper = (checked = clear, over: Partial<LienAffidavitFields> = {}) => lienHelpPaperFromFields({ jobLabel: '412 · Ridgeway Builders', fileBy: 'November 16, 2026', claimWords: '$2,650.00', fields: fields(over), checked })

  it('answers the owner, the homestead mark and the notices, and says only what the record says of a homestead', () => {
    expect(lienHelpChecks({ ownerName: 'Jordan Sample', propertyKind: 'residential', homestead: false, isSub: true, monthsWords: 'August 2026', noticeLines: [], contractorName: 'Ridgeway Builders' })).toEqual([
      { state: 'ok', lead: 'Owner.', words: 'Jordan Sample. A private owner, not a city, a county, a school or the State.' },
      { state: 'ok', lead: 'Homestead.', words: 'The property record is not marked a homestead.' },
      { state: 'ok', lead: 'Notices.', words: 'A notice went on time for every month sworn: August 2026. It went to the owner and to Ridgeway Builders.' },
    ])
  })
  it('a commercial property has no homestead line, and a job contracted with the owner has no notice line', () => {
    expect(lienHelpChecks({ ownerName: 'Mock Holdings LLC', propertyKind: 'non_residential', homestead: false, isSub: false, monthsWords: '', noticeLines: [], contractorName: '' }).map((c) => c.lead)).toEqual(['Owner.'])
  })
  it('a late notice, a homestead mark and a paper that names no month each want an answer first', () => {
    const asks = (over: Partial<Parameters<typeof lienHelpChecks>[0]>) => lienHelpChecks({ ownerName: 'Jordan Sample', propertyKind: 'residential', homestead: false, isSub: true, monthsWords: 'August 2026', noticeLines: [], contractorName: 'Ridgeway Builders', ...over }).filter((c) => c.state === 'ask')
    expect(asks({})).toEqual([])
    expect(asks({ noticeLines: late.noticeLines })).toEqual([{ state: 'ask', lead: 'Notices.', words: late.noticeLines[0] }])
    expect(asks({ homestead: true }).map((c) => c.lead)).toEqual(['Homestead.'])
    expect(asks({ monthsWords: '' }).map((c) => c.words)).toEqual(['The paper names no month of work with a notice behind it.'])
  })
  it('the words follow the plain-words rules', () => {
    const sentences = [LIEN_HELP_YOUR_CHECK, LIEN_HELP_ASK_FIRST, lienHelpPrintedCountyLine('Alder County'), ...LIEN_HELP_BLANKS_PRINTED_COUNTY.map(([lead, rest]) => `${lead} ${rest}`), ...LIEN_HELP_BLANKS_PRINTED_COUNTY_SHORT.map(([, rest]) => rest), ...lienHelpChecks({ ownerName: 'Jordan Sample', propertyKind: 'residential', homestead: true, isSub: true, monthsWords: '', noticeLines: [], contractorName: '' }).map((c) => c.words)]
    for (const s of sentences) expect(plainWordsFailures(s), s).toEqual([])
  })

  it('the cover sheet draws the checks in place of the list a reader checks by eye, and leaves the reader one check', () => {
    const html = lienHelpCoverSheetHtml(checkedPaper(), 'November 11, 2026')
    const text = textOf(html)
    expect(html).toContain('data-lien-help-checks')
    expect(text).toContain('What the app checked on this paper')
    expect(text).toContain('✓ Owner. Jordan and Casey Sample. A private owner')
    expect(text).toContain(`YOUR CHECK ${LIEN_HELP_YOUR_CHECK}`)
    expect(text).not.toContain('Do not sign. Call the office first if any of these is true.')
    expect(html).not.toContain('data-lien-help-ask>')
    // A paper nobody checked keeps the list.
    expect(textOf(lienHelpCoverSheetHtml(paper(), 'November 11, 2026'))).toContain('Do not sign. Call the office first if any of these is true.')
  })
  it('a paper with a question says ask first above the reader’s check, and marks the line', () => {
    const html = lienHelpCoverSheetHtml(checkedPaper(late), 'November 11, 2026')
    expect(html).toContain('data-lien-help-ask>')
    expect(textOf(html)).toContain(`ASK FIRST ${LIEN_HELP_ASK_FIRST}`)
    expect(html).toContain('<li data-state="ask"><span class="lien-help-mark">!</span>')
    expect(html.indexOf('data-lien-help-ask>')).toBeLessThan(html.indexOf('YOUR CHECK'))
  })

  it('with the county printed the sheets list four things to write, and say where the paper says it was signed', () => {
    const printed = checkedPaper(clear, { signingCounty: 'Alder' })
    expect(printed.signingCounty).toBe('Alder County')
    expect(checkedPaper(clear, { signingCounty: 'Alder county ' }).signingCounty).toBe('Alder County')
    const text = textOf(lienHelpCoverSheetHtml(printed, 'November 11, 2026'))
    expect(text).toContain('Four things to write. Nothing else is written on the paper.')
    expect(text).toContain('The counties are printed: signed in Alder County. Signing somewhere else? Change the county beside the print press and print again.')
    expect(text).toContain('Pat Sample, Master Plumber signs in front of the notary, and not before.')
    expect(text).not.toContain('COUNTY OF, at the top.')
    // The notary writes the counties by hand on a paper with none printed: six blanks, as before.
    expect(textOf(lienHelpCoverSheetHtml(checkedPaper(), 'November 11, 2026'))).toContain('COUNTY OF, at the top.')
    const batch = textOf(lienHelpBatchSheetHtml({ papers: [printed, { ...printed, jobLabel: '418 · Mock Ave', propertyAddress: '77 Mock Ave, Fenwick, TX 75002' }], printedOn: 'November 11, 2026' }))
    expect(batch).toContain('Each paper has three things to write')
    // A batch that mixes a printed county with a blank keeps the county blanks: five on the batch sheet.
    expect(textOf(lienHelpBatchSheetHtml({ papers: [printed, checkedPaper(clear, { propertyAddress: '77 Mock Ave, Fenwick, TX 75002' })], printedOn: 'November 11, 2026' }))).toContain('Each paper has five blanks')
  })

  it('the batch sheet lists five blanks, each name on its own line, with the notary’s signature and seal as one', () => {
    // The owner, 2026-11-13, working from a printed batch: the name on one line, its words under it, and lines 5 and 6
    // one line, the notarial certificate.
    expect(LIEN_HELP_BLANKS_SHORT).toEqual([
      ['COUNTY OF, at the top:', 'where you sign. Not the property’s county.'],
      ['Signature:', 'in front of the notary.'],
      ['COUNTY OF, notary’s block:', 'the same county.'],
      ['Day, month, year:', 'the day it is signed.'],
      ['Notarial certificate:', 'notary signs and stamps.'],
    ])
    expect(LIEN_HELP_BLANKS_PRINTED_COUNTY_SHORT.map(([lead]) => lead)).toEqual(['Signature:', 'Day, month, year:', 'Notarial certificate:'])
    expect(lienHelpBatchBlanksTitle(false)).toBe('Each paper has five blanks')
    expect(lienHelpBatchBlanksTitle(true)).toBe('Each paper has three things to write')
    const numsIn = (html: string) => html.match(/<span class="lien-help-num">\d+<\/span>/g)?.map((m) => m.replace(/\D/g, '')) ?? []
    const blank = lienHelpBatchSheetHtml({ papers: [checkedPaper()], printedOn: 'November 13, 2026' })
    expect(blank).toContain('<li><strong style="display:block">Signature:</strong> in front of the notary.</li>')
    expect(blank).toContain('<li><strong style="display:block">Notarial certificate:</strong> notary signs and stamps.</li>')
    expect(blank).not.toContain('Seal:')
    expect(blank.match(/<li><strong style="display:block">/g)).toHaveLength(5)
    // The picture's numbers are the list's own: one for each line, and no sixth.
    expect(numsIn(blank)).toEqual(['1', '2', '3', '4', '5'])
    const printed = lienHelpBatchSheetHtml({ papers: [checkedPaper(clear, { signingCounty: 'Alder' })], printedOn: 'November 13, 2026' })
    expect(printed.match(/<li><strong style="display:block">/g)).toHaveLength(3)
    expect(numsIn(printed)).toEqual(['1', '2', '3'])
    // The cover sheet for one paper keeps its six, the seal on a line of its own, and its picture's six numbers.
    const cover = lienHelpCoverSheetHtml(checkedPaper(), 'November 13, 2026')
    expect(textOf(cover)).toContain('The notary’s seal.')
    expect(cover).not.toContain('style="display:block"')
    expect(numsIn(lienHelpPictureHtml(''))).toEqual(['1', '2', '3', '4', '5', '6'])
  })

  it('the guide copy of a paper with its counties printed marks no county blank, and its marks still count 1, 2, 3', () => {
    const html = lienHelpGuideCopyHtml(filingDocHtml(buildLienAffidavitBlocks(fields({ signingCounty: 'Alder' }))), paper())
    expect(html.match(/<span class="lien-help-num">\d+<\/span>/g)?.map((m) => m.replace(/\D/g, '')).sort()).toEqual(['1', '1', '2', '2', '3', '3', '4', '4', '5', '5', '6', '6', '6'])
    expect(html).toContain('<p><span class="lien-help-num">1</span>The signer signs here, in front of the notary.</p>')
    expect(html).not.toContain('The county you sign in.')
    expect(html).not.toContain('The same county as mark 1.')
  })

  it('the batch sheet counts the clear, the ones with a question and the ones not printed, and each row says what to ask', () => {
    const papers = [checkedPaper(), checkedPaper(late, { propertyAddress: '77 Mock Ave, Fenwick, TX 75002' }), checkedPaper(clear, { propertyAddress: '18 SAMPLE LN., Marlow TX 75001' })]
    expect([...lienHelpBatchAsks(papers).entries()]).toEqual([
      [1, [`Notices. ${late.noticeLines[0]}`]],
      [2, ['Same property as paper 1.']],
    ])
    expect(lienHelpBatchSummary({ papers: 3, asks: 2, leftOut: 1 })).toBe('1 clear to sign. 2 with a question: ask first. 1 not printed.')
    expect(lienHelpBatchSummary({ papers: 3, asks: 1, leftOut: 0 })).toBe('2 clear to sign. 1 with a question: ask first.')
    expect(lienHelpBatchSummary({ papers: 4, asks: 0, leftOut: 0 })).toBe('4 clear to sign.')
    const html = lienHelpBatchSheetHtml({ papers, leftOut: [{ jobLabel: '430 · Town Hall', reason: 'The owner is a public body. A mechanic’s lien does not attach to public property.' }], printedOn: 'November 11, 2026' })
    const text = textOf(html)
    expect(html).toContain('data-lien-help-batch-checks')
    expect(text).toContain('1 clear to sign. 2 with a question: ask first. 1 not printed.')
    expect(text).toContain(`Ask first. Notices. ${late.noticeLines[0]}`)
    expect(text).toContain('Ask first. Same property as paper 1.')
    expect(text).toContain('Not printed. The owner is a public body.')
    expect(text).not.toContain('Call the office first')
    // One paper nobody checked, and the sheet keeps the list a reader checks by eye.
    expect(textOf(lienHelpBatchSheetHtml({ papers: [checkedPaper(), paper({ propertyAddress: '77 Mock Ave, Fenwick, TX 75002' })], printedOn: 'November 11, 2026' }))).toContain('Call the office first')
  })
})

// Changes 6 to 11 of the best-we-can-do pass (punch list #314): the owner, *I like them all, please make those changes*.
describe('changes 6 to 11 · the picture, the clerks, who to ask, lines to write on, the stripe and the code', () => {
  const clear = { propertyKind: 'residential', homestead: false, noticeLines: [] as string[] }
  const clerk = { where: '100 Court St, Marlow', fee: '$26 first page, $4 each more', hours: '8 to 5' }
  const ASK = 'Not sure? Ask Pat Sample, 555-0100, or Robin Sample, 555-0199.'
  const full = (over: Partial<LienAffidavitFields> = {}, extra: { clerk?: typeof clerk; ask?: string } = { clerk, ask: ASK }) =>
    lienHelpPaperFromFields({ jobLabel: '412 · Ridgeway Builders', fileBy: 'November 16, 2026', claimWords: '$2,650.00', fields: fields(over), checked: clear, ...extra })
  const CODE = '<img alt="" src="data:image/png;base64,AAAA"/>'

  it('6 · a small picture of the paper numbers its spots as the list does: six with blank counties, four with them printed', () => {
    const nums = (html: string) => html.match(/<span class="lien-help-num">\d+<\/span>/g)?.map((m) => m.replace(/\D/g, ''))
    expect(nums(lienHelpPictureHtml(''))).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(nums(lienHelpPictureHtml('Alder County'))).toEqual(['1', '2', '3', '4'])
    expect(lienHelpPictureHtml('Alder County').match(/COUNTY OF ALDER/g)).toHaveLength(2)
    expect(lienHelpPictureHtml('')).not.toContain('COUNTY OF ALDER')
    // It sits beside the list on the cover sheet and on the batch sheet.
    expect(lienHelpCoverSheetHtml(full({ signingCounty: 'Alder' }), 'November 11, 2026')).toContain('data-lien-help-picture')
    expect(lienHelpBatchSheetHtml({ papers: [full()], printedOn: 'November 11, 2026' })).toContain('data-lien-help-picture')
  })

  it('7 · the batch sheet gives each clerk a row above its papers, with a count and the clerk’s typed facts', () => {
    expect(lienHelpClerkGroupWords('Alder', 2)).toBe('ALDER COUNTY CLERK · 2 papers')
    expect(lienHelpClerkGroupWords('Cedar', 1, '4 Square Plaza, Fenwick')).toBe('CEDAR COUNTY CLERK · 1 paper · 4 Square Plaza, Fenwick')
    expect(lienHelpClerkGroupWords('', 1)).toBe('THE CLERK OF THE PROPERTY’S COUNTY · 1 paper')
    // In clerk order, as the desk prints them: one row for each clerk.
    const papers = [full(), full({ propertyAddress: '22 Sample Ln, Marlow, TX 75001' }), full({ county: 'Cedar', propertyAddress: '77 Mock Ave, Fenwick, TX 75002' }, { ask: ASK })]
    const html = lienHelpBatchSheetHtml({ papers, printedOn: 'November 11, 2026' })
    expect(html.match(/data-lien-help-clerk="[^"]*"/g)).toEqual(['data-lien-help-clerk="Alder"', 'data-lien-help-clerk="Cedar"'])
    const text = textOf(html)
    expect(text).toContain('ALDER COUNTY CLERK · 2 papers · 100 Court St, Marlow · $26 first page, $4 each more · open 8 to 5')
    expect(text).toContain('CEDAR COUNTY CLERK · 1 paper 3 412')
    expect(text).toContain('After the notary, one trip for each clerk')
  })

  it('9 · names the lien leader or the dev, one of them alone when the other is unknown or the same person', () => {
    expect(lienHelpAskWords({ name: 'Pat Sample', phone: '555-0100' }, { name: 'Robin Sample', phone: '555-0199' })).toBe(ASK)
    expect(lienHelpAskWords({ name: 'Pat Sample' }, { name: 'Robin Sample', phone: ' ' })).toBe('Not sure? Ask Pat Sample, or Robin Sample.')
    expect(lienHelpAskWords(null, { name: 'Robin Sample', phone: '555-0199' })).toBe('Not sure? Ask Robin Sample, 555-0199.')
    expect(lienHelpAskWords({ name: 'Robin Sample', phone: '555-0199' }, { name: 'robin sample' })).toBe('Not sure? Ask Robin Sample, 555-0199.')
    expect(lienHelpAskWords(null, null)).toBe('')
    expect(lienHelpAskWords({ name: '  ' }, undefined)).toBe('')
    // On the cover sheet it ends the reader's check; on a batch whose papers all name the same people, once.
    expect(textOf(lienHelpCoverSheetHtml(full(), 'November 11, 2026'))).toContain(`A signed paper is never fixed by hand. ${ASK}`)
    const batch = lienHelpBatchSheetHtml({ papers: [full(), full({ propertyAddress: '22 Sample Ln, Marlow, TX 75001' })], printedOn: 'November 11, 2026' })
    expect(batch.match(/Not sure\? Ask/g)).toHaveLength(1)
    // Two leaders in one batch: each row carries its own.
    const two = lienHelpBatchSheetHtml({ papers: [full(), full({ propertyAddress: '22 Sample Ln, Marlow, TX 75001' }, { ask: 'Not sure? Ask Lee Sample.' })], printedOn: 'November 11, 2026' })
    expect(textOf(two)).toContain('Not sure? Ask Lee Sample.')
    expect(two.match(/Not sure\? Ask/g)).toHaveLength(2)
    // A paper the app knows nobody for prints no name.
    expect(lienHelpCoverSheetHtml(full({}, {}), 'November 11, 2026')).not.toContain('Not sure?')
  })

  it('10 · the steps have lines to write on, and the clerk’s facts print only when the office typed them', () => {
    expect(lienHelpClerkLine(clerk)).toBe('100 Court St, Marlow · $26 first page, $4 each more · open 8 to 5')
    expect(lienHelpClerkLine({ where: '', fee: '$26', hours: '' })).toBe('$26')
    expect(lienHelpClerkLine(undefined)).toBe('')
    const typed = lienHelpAfterSteps('Alder', true, lienHelpClerkLine(clerk))
    expect(typed[0]).toContain('100 Court St, Marlow · $26 first page, $4 each more · open 8 to 5')
    expect(typed[0]).not.toContain('The clerk charges a fee for each paper.')
    expect(lienHelpAfterSteps('Alder', true)[0]).toContain('The clerk charges a fee for each paper.')
    expect(typed.join(' ').match(/<span class="lien-help-write"><\/span>/g)).toHaveLength(3)
    expect(textOf(typed[1] as string)).toBe('Write on the stamped copy, and here. Recording number Filed on')
    // Record service takes the day, and since change 5 each copy's certified mail number and a photo of its receipt. The sheet says what the form asks.
    expect(typed.join(' ')).not.toContain('tracking')
    expect(textOf(typed[4] as string)).toBe('Press Record service… and set the day the copies were mailed. Type each certified mail number and take a photo of each receipt.')
    expect(lienHelpBatchSheetHtml({ papers: [full()], printedOn: 'November 11, 2026' })).toContain('<th>Recording no. · day filed</th>')
    for (const step of [...lienHelpAfterSteps('Alder', true), ...lienHelpAfterSteps('', false)]) expect(plainWordsFailures(textOf(step)), step).toEqual([])
  })

  it('11 · every help sheet has a striped edge, the guide copy says GUIDE COPY across its paper, and the code prints when the caller draws one', () => {
    const cover = lienHelpCoverSheetHtml(full(), 'November 11, 2026', { guideCode: CODE })
    const batch = lienHelpBatchSheetHtml({ papers: [full()], printedOn: 'November 11, 2026', extras: { guideCode: CODE } })
    const guide = lienHelpGuideCopyHtml(filingDocHtml(buildLienAffidavitBlocks(fields())), full(), { guideCode: CODE })
    for (const html of [cover, batch, guide]) {
      expect(html).toContain('<div class="lien-help-stripe"></div>')
      expect(html).toContain(`<span data-lien-help-code>${CODE}</span>`)
      expect(html).toContain(CODE)
      expect(textOf(html)).toContain('Scan for the full guide')
    }
    expect(guide).toContain(`data-lien-help-watermark aria-hidden="true">${GUIDE_WATERMARK}</div>`)
    expect(cover).not.toContain('data-lien-help-watermark')
    // No code handed in, no code and no words about one.
    expect(lienHelpCoverSheetHtml(full(), 'November 11, 2026')).not.toContain('Scan for the full guide')
    // The fills print whatever the print window's own box says.
    expect(LIEN_HELP_STYLES).toContain('print-color-adjust: exact')
  })

  it('5 · the code to record sits beside the steps after the notary, and the steps say to scan it', () => {
    const RECORD = '<img alt="" src="data:image/png;base64,BBBB"/>'
    const cover = lienHelpCoverSheetHtml(full(), 'November 11, 2026', { guideCode: CODE, recordCode: RECORD })
    const batch = lienHelpBatchSheetHtml({ papers: [full()], printedOn: 'November 11, 2026', extras: { guideCode: CODE, recordCode: RECORD } })
    // One code on each sheet, in the box of steps, with what it opens under it.
    expect(cover.match(/data-lien-help-record-code/g)).toHaveLength(1)
    expect(batch.match(/data-lien-help-record-code/g)).toHaveLength(1)
    // The cover's hangs from the last step, the one corner of the page with room; the batch's sits in the box's top corner and says what it opens.
    expect(cover).toContain(`<li><div class="lien-help-record lien-help-record-corner" data-lien-help-record-code>${RECORD}<strong>Scan to record</strong></div><span class="lien-help-tick"></span> Keep the clerk’s stamped copy`)
    expect(batch).toContain(`<div class="lien-help-record" data-lien-help-record-code>${RECORD}<strong>Scan to record</strong><br/>Opens the Affidavits list</div><h3>After the notary, one trip for each clerk</h3>`)
    // The guide's code keeps its corner.
    expect(cover).toContain(`<span data-lien-help-code>${CODE}</span>`)
    // The steps name the scan, and a computer keeps the desk's own door.
    const coded = lienHelpAfterSteps('Alder', true, '', true)
    // A press's bold ends before the full stop; read the step as a reader does.
    const read = (step: string) => textOf(step).replace(/ ([.,])/g, '$1')
    expect(read(coded[2] as string)).toBe('The same day, scan the code with a phone. On a computer, open the job on the Lien desk and press Open the affidavit tab ›. Press Record filing… and type both.')
    expect(textOf(coded[4] as string)).toBe('Scan the code again. Press Record service… and set the day the copies were mailed. Type each certified mail number and take a photo of each receipt.')
    expect(read(lienHelpBatchAfterSteps(true)[1] as string)).toBe('The same day, scan the code with a phone. It opens the Affidavits list. On each job press Open the affidavit tab ›, then Record filing…, and type both.')
    expect(textOf(lienHelpBatchAfterSteps(true)[3] as string)).toContain('Scan the code again. On each job press Record service…')
    for (const step of [...coded, ...lienHelpBatchAfterSteps(true), ...lienHelpBatchAfterSteps()]) expect(plainWordsFailures(textOf(step)), step).toEqual([])
    // No code handed in: no code, and no step that sends a reader to one.
    const bare = lienHelpCoverSheetHtml(full(), 'November 11, 2026', { guideCode: CODE })
    expect(bare).not.toContain('data-lien-help-record-code')
    expect(textOf(bare)).not.toContain('scan the code')
    expect(textOf(lienHelpBatchSheetHtml({ papers: [full()], printedOn: 'November 11, 2026' }))).not.toContain('scan the code')
    // The guide copy is a page to learn from: nothing is recorded off it.
    expect(lienHelpGuideCopyHtml(filingDocHtml(buildLienAffidavitBlocks(fields())), full(), { guideCode: CODE, recordCode: RECORD })).not.toContain('data-lien-help-record-code')
  })
})

describe('the § 53.056 notice’s help sheet (punch list #314, the notices)', () => {
  // Made-up names and addresses throughout.
  const noticeOf = (over: Partial<LienHelpNotice> = {}): LienHelpNotice => ({
    jobLabel: '412 · Ridgeway Builders',
    propertyAddress: '18 Larkspur Lane, Alder, TX 70001',
    claim: '$2,650.00',
    mailBy: 'December 15, 2026',
    mailByPassed: false,
    signer: 'Dana Okafor',
    ownerName: 'Larkspur Holdings LLC',
    ownerAddress: '4 Quarry Road, Alder, TX 70001',
    contractorName: 'Ridgeway Builders',
    contractorAddress: '77 Mill Street, Alder, TX 70002',
    invoices: 2,
    ...over,
  })
  const read = (step: string) => textOf(step).replace(/ ([.,])/g, '$1')

  it('the last day to mail is the earliest of the months’ days, and passes the day after', () => {
    // A house: the 15th of the second month after the work. A commercial property: the third.
    expect(lienHelpNoticeMailBy(['2026-10', '2026-09'], 'residential', '2026-11-12')).toEqual({ ymd: '2026-11-16', passed: false })
    expect(lienHelpNoticeMailBy(['2026-09'], 'non_residential', '2026-11-12')).toEqual({ ymd: '2026-12-15', passed: false })
    expect(lienHelpNoticeMailBy(['2026-09'], 'residential', '2026-11-17')).toEqual({ ymd: '2026-11-16', passed: true })
    expect(lienHelpNoticeMailBy([], 'residential', '2026-11-12')).toEqual({ ymd: '', passed: false })
  })

  it('checks the two mailing addresses, the day and the invoices, and asks first on what is missing or late', () => {
    expect(lienHelpNoticeChecks(noticeOf()).map((c) => [c.state, c.lead])).toEqual([['ok', 'Owner.'], ['ok', 'Original contractor.'], ['ok', 'Mail by.'], ['ok', 'Invoices.']])
    const bad = lienHelpNoticeChecks(noticeOf({ ownerAddress: '', contractorName: '', mailByPassed: true, invoices: 0 }))
    expect(bad.map((c) => c.state)).toEqual(['ask', 'ask', 'ask', 'ok'])
    expect(bad[0]?.words).toBe('Larkspur Holdings LLC has no mailing address in the app.')
    expect(bad[2]?.words).toBe('The last day to mail was December 15, 2026. It has passed.')
    expect(bad[3]?.words).toBe('No invoice prints behind this notice.')
    expect(lienHelpNoticeChecks(noticeOf({ mailBy: '', invoices: 1 })).slice(2).map((c) => c.words)).toEqual(['The app has no last day to mail for this job.', '1 invoice prints behind this notice.'])
  })

  it('the words follow the plain-words rules, and name the Lien window’s presses by their own words', () => {
    const sentences = [
      LIEN_HELP_NOTICE_ASK_FIRST,
      ...lienHelpNoticeChecks(noticeOf()).map((c) => c.words),
      ...lienHelpNoticeChecks(noticeOf({ ownerAddress: '', contractorAddress: '', mailByPassed: true })).map((c) => c.words),
      ...lienHelpNoticeChecks(noticeOf({ ownerName: '', contractorName: '', mailBy: '' })).map((c) => c.words),
      ...lienHelpNoticeSteps(noticeOf(), true).map(textOf),
      ...lienHelpNoticeSteps(noticeOf({ signer: '', mailBy: '' })).map(textOf),
    ]
    for (const s of sentences) expect(plainWordsFailures(s), s).toEqual([])
    const steps = lienHelpNoticeSteps(noticeOf(), true).map(read)
    expect(steps[1]).toBe('Dana Okafor signs the notice in each set, in ink.')
    expect(steps[3]).toBe('Send both by certified mail with a return receipt. Mail by December 15, 2026.')
    expect(steps[5]).toContain('scan the code with a phone')
    expect(steps[6]).toBe('Press Save & record sends… and type both numbers. Then press Record both sends.')
    // A day that has passed is not printed as a day to mail by.
    expect(read(lienHelpNoticeSteps(noticeOf({ mailByPassed: true }))[3] ?? '')).toBe('Send both by certified mail with a return receipt. The app shows the last day to mail.')
    expect(read(lienHelpNoticeSteps(noticeOf())[5] ?? '')).not.toContain('scan')
  })

  it('the sheet says it is not the notice, and carries the facts, the checks, the two envelopes and the steps', () => {
    const html = lienHelpNoticeSheetHtml(noticeOf({ ask: 'Not sure? Ask Dana Okafor.' }), 'November 12, 2026', { guideCode: '<img alt="" src="data:guide"/>', recordCode: '<img alt="" src="data:record"/>' })
    const text = textOf(html)
    expect(html).toContain('data-lien-help="notice"')
    expect(html).toContain('class="lien-help-stripe"')
    expect(text).toContain('Help sheet · do not mail this page')
    expect(text).toContain('§ 53.056 notice: before you mail')
    expect(text).toContain('Mail by December 15, 2026')
    expect(text).toContain('What the app checked on this notice')
    expect(text).toContain('Envelope 1 · the owner Larkspur Holdings LLC 4 Quarry Road, Alder, TX 70001')
    expect(text).toContain('Envelope 2 · the original contractor Ridgeway Builders 77 Mill Street, Alder, TX 70002')
    expect(text).toContain('Not sure? Ask Dana Okafor.')
    expect(text).toContain('The notice is the next page')
    expect((html.match(/class="lien-help-tick"/g) ?? []).length).toBe(8)
    // Both codes: the guide's in the band, the one to record in the steps box with what it opens.
    expect(html).toContain('<span data-lien-help-code><img alt="" src="data:guide"/></span>')
    expect(html).toMatch(/data-lien-help-record-code><img alt="" src="data:record"\/><strong>Scan to record<\/strong><br\/>Opens the notice tab<\/div><h3>From the printer to the mail<\/h3>/)
    expect(html).not.toContain('data-lien-help-ask>')
    // A question puts ASK FIRST above the reader's check, in the notice's own words; no code, no code block.
    const asked = lienHelpNoticeSheetHtml(noticeOf({ ownerAddress: '<none>' , mailByPassed: true }), '')
    expect(asked).toContain(`<strong class="lien-help-ask-tag">ASK FIRST</strong> ${LIEN_HELP_NOTICE_ASK_FIRST}`)
    expect(asked).toContain('&lt;none&gt;')
    expect(asked).not.toContain('data-lien-help-record-code')
    expect(textOf(lienHelpNoticeSheetHtml(noticeOf({ mailBy: '', ownerName: '', ownerAddress: '' }), ''))).toContain('Mail by see the Lien desk')
  })

  it('goes first in the notice’s print sheet, and the notice’s own HTML is untouched after it', () => {
    const paperHtml = filingDocPrintHtml(buildLienAffidavitBlocks(fields()), 'A paper', filingDocFooter('notice_53_056'))
    const printed = prependToFilingPrintHtml(paperHtml, lienHelpNoticeSheetHtml(noticeOf(), 'November 12, 2026'), LIEN_HELP_STYLES)
    expect(printed.indexOf('data-lien-help="notice"')).toBeGreaterThan(-1)
    expect(printed.indexOf('data-lien-help="notice"')).toBeLessThan(printed.indexOf('</section>'))
    expect(printed.replace(/<section class="lien-help"[\s\S]*?<\/section>/, '').replace(LIEN_HELP_STYLES, '')).toBe(paperHtml)
  })
})
