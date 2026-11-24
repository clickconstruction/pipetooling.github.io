import { describe, expect, it } from 'vitest'
import type { LienAffidavitFields } from '../jobsDocuments/lienFilingDocuments'
import { plainWordsFailures } from '../plainWords'
import { plainSentence } from '../valuesInPlace'
import { lienAffidavitBatchHelpSheet, lienAffidavitPrintRun, type LienAffidavitPrintPaper } from './lienAffidavitBatch'
import type { RunNotice } from './lienDeskRun'
import { lienRunReadyPacket } from './lienRunPacket'
import { LIEN_STACK_CLASS, lienRunStackHtml, lienStackBrowserCan, lienStackDividerWords, lienStackOrderWords, lienStackParts } from './lienRunStack'

const NF = { noticeDate: '2026-09-14', projectDescription: 'ZZ Sample Shop, 12 Sample Rd', claimantName: 'ZZ Plumbing', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'ZZ Builder', contractedWithIfDifferent: '', claimAmount: '500.00', contactPerson: 'Rosa', claimantAddress: '1 Sample St, Sample, TX 78000' }
const notice = (i: number): RunNotice =>
  ({
    itemId: `it${i}`,
    jobId: `j${i}`,
    kind: 'notice_53_056',
    label: `${1000 + i} · ZZ Shop ${i}`,
    jobNumber: String(1000 + i),
    months: ['2026-07'],
    amount: 500 + i,
    fields: { ...NF, projectDescription: `ZZ Shop ${i}, ${10 + i} Sample Rd` },
    extras: { refItems: [`Job #${1000 + i}`] },
    coverLetter: null,
    coverNote: 'This is a routine notice.',
    ownerUnconfirmed: false,
    recipients: [
      { key: 'owner', label: 'Owner of record', name: `ZZ Holdings ${i} LLC`, address: `${i} Example Way, Sample, TX 78000`, email: '', method: 'certified_mail', tracking: '' },
      { key: 'original_contractor', label: 'Original contractor', name: 'ZZ Builder', address: '29 Example Cir, Sample, TX 78000', email: '', method: 'certified_mail', tracking: '' },
    ],
  }) as RunNotice
const af = (addr: string, county: string): LienAffidavitFields =>
  ({ county, claimantPersonName: 'Rey Master, Master Plumber', claimantCompany: 'ZZ Plumbing LLC', claimantAddress: '1 Shop Rd, Sample, TX 78201', legalDescription: 'CB 1 BLK B LOT 7', propertyAddress: addr, contractedWithName: 'ZZ Builder', workDescription: 'Plumbing labor and materials', workStart: '', workEnd: '', ownerName: 'Pat Owner', ownerAddress: '4 Owner Ct, Sample, TX 78209', originalContractorName: 'ZZ Builder', originalContractorAddress: '9 Yard St, Sample TX 78016', contractAmount: '5000.00', paidAmount: '0.00', unpaidAmount: '2000.00', includeNoticesSworn: true, form: 'short', isSub: true, workMonthsWords: 'July and August 2026', noticesSentWords: 'certified mail on September 14, 2026' }) as LienAffidavitFields

const PAPERS: LienAffidavitPrintPaper[] = [
  { jobId: 'job-1', jobNumber: 'J700', fields: af('12 Sample Rd, Sample, TX 78209', 'Marlow'), label: '700 · ZZ Sample' },
  { jobId: 'job-2', jobNumber: 'J701', fields: af('14 Other Ln, Sample, TX 78209', 'Hill'), label: '701 · ZZ Other' },
]
/** The two real documents, as each press prints them alone. */
const noticesHtml = () => lienRunReadyPacket({ notices: [notice(1), notice(2)], todayYmd: '2026-09-14', issuer: null, enclosures: { invoiceDocsByJob: {}, payByJob: {} } })!.html
const affidavitsHtml = () => lienAffidavitPrintRun(PAPERS, lienAffidavitBatchHelpSheet(PAPERS, [], 'September 14, 2026')).html
const DIVIDER = lienStackDividerWords({ notices: 2, affidavits: 2, dayWords: 'September 14, 2026' })

/** Every selector of a sheet, at any depth. */
const selectors = (css: string) => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{/g)].map((m) => m[1]!.trim()).filter(Boolean)
const cssOf = (html: string) => /<style>([\s\S]*?)<\/style>/.exec(html)![1]!

describe('lienStackParts reads only a document it knows', () => {
  it('both real documents are the shape the merge knows', () => {
    const n = lienStackParts(noticesHtml())
    const a = lienStackParts(affidavitsHtml())
    expect(n).not.toBeNull()
    expect(a).not.toBeNull()
    expect(n!.body).toContain('ZZ Shop 1')
    expect(a!.body).toContain('12 Sample Rd')
  })

  it('refuses a rule on a bare element, a second style block, a style block in the body, and a document with no body', () => {
    const doc = (css: string, body = '<p>x</p>', extra = '') => `<!doctype html><html><head><style>${css}</style>${extra}</head><body>${body}</body></html>`
    expect(lienStackParts(doc('body { margin: 0; } .a { color: red; }'))).not.toBeNull()
    expect(lienStackParts(doc('p { margin: 0; }'))).toBeNull()
    expect(lienStackParts(doc('.a, td { margin: 0; }'))).toBeNull()
    expect(lienStackParts(doc('@media print { table { width: 100%; } }'))).toBeNull()
    expect(lienStackParts(doc('@font-face { font-family: x; }'))).toBeNull()
    expect(lienStackParts(doc('.a { color: red; }', '<p>x</p>', '<style>.b { color: blue; }</style>'))).toBeNull()
    expect(lienStackParts(doc('.a { color: red; }', '<style>.b { color: blue; }</style><p>x</p>'))).toBeNull()
    expect(lienStackParts('<p>no document</p>')).toBeNull()
  })
})

describe('lienRunStackHtml', () => {
  it('one part alone is that part’s own document, byte for byte', () => {
    const n = noticesHtml()
    const a = affidavitsHtml()
    expect(lienRunStackHtml({ noticesHtml: n, affidavitsHtml: null, divider: DIVIDER, title: 'The run' })).toBe(n)
    expect(lienRunStackHtml({ noticesHtml: null, affidavitsHtml: a, divider: DIVIDER, title: 'The run' })).toBe(a)
    expect(lienRunStackHtml({ noticesHtml: null, affidavitsHtml: null, divider: DIVIDER, title: 'The run' })).toBeNull()
  })

  it('both parts keep their bodies whole, in order, with the divider between', () => {
    const n = noticesHtml()
    const a = affidavitsHtml()
    const html = lienRunStackHtml({ noticesHtml: n, affidavitsHtml: a, divider: DIVIDER, title: 'The run — September 14, 2026' })!
    const nBody = lienStackParts(n)!.body
    const aBody = lienStackParts(a)!.body
    expect(html).toContain(`<div class="${LIEN_STACK_CLASS.notices}">${nBody}</div>`)
    expect(html).toContain(`<div class="${LIEN_STACK_CLASS.affidavits}">${aBody}</div>`)
    const at = (needle: string) => html.indexOf(needle)
    expect(at(`class="${LIEN_STACK_CLASS.notices}"`)).toBeLessThan(at(`class="${LIEN_STACK_CLASS.divider}"`))
    expect(at(`class="${LIEN_STACK_CLASS.divider}"`)).toBeLessThan(at(`class="${LIEN_STACK_CLASS.affidavits}"`))
    expect(html).toContain('<title>The run — September 14, 2026</title>')
    expect(html).toContain('2 lien affidavits follow this page, in county clerk order.')
  })

  it('each part keeps its own page: the notices the printer’s margins, the affidavits a named page with none', () => {
    const html = lienRunStackHtml({ noticesHtml: noticesHtml(), affidavitsHtml: affidavitsHtml(), divider: DIVIDER, title: 'The run' })!
    const css = cssOf(html)
    const sels = selectors(css)
    // One unnamed page, the notices’, with no margin of its own; one named page, the affidavits’, with none at all.
    expect(sels.filter((s) => s === '@page')).toHaveLength(1)
    expect(css).toMatch(/@page \{ size: Letter; \}/)
    expect(css).toMatch(/@page lienStackAffidavits \{ size: letter; margin: 0; \}/)
    expect(css).toContain(`.${LIEN_STACK_CLASS.affidavits} { page: lienStackAffidavits; }`)
    // No part’s body rule is left on the body: each sits on its wrapper. The one body rule is the merge’s own reset.
    expect(sels.filter((s) => s === 'body')).toEqual([])
    expect(sels.filter((s) => s === 'html, body')).toHaveLength(1)
    expect(sels.filter((s) => s === `.${LIEN_STACK_CLASS.notices}`).length).toBeGreaterThanOrEqual(2)
    expect(sels.filter((s) => s === `.${LIEN_STACK_CLASS.affidavits}`).length).toBeGreaterThanOrEqual(2)
    // The affidavits’ sheet gap and tight leading come through untouched.
    expect(css).toContain('.filing-tight { line-height: 1.45; }')
    expect(css).toContain('.filing-next-paper { break-before: page; page-break-before: always;')
  })

  it('answers null when either document is not a shape it knows, so the caller prints them one at a time', () => {
    const odd = '<!doctype html><html><head><style>p { margin: 0; }</style></head><body><p>x</p></body></html>'
    expect(lienRunStackHtml({ noticesHtml: odd, affidavitsHtml: affidavitsHtml(), divider: DIVIDER, title: 'The run' })).toBeNull()
    expect(lienRunStackHtml({ noticesHtml: noticesHtml(), affidavitsHtml: odd, divider: DIVIDER, title: 'The run' })).toBeNull()
  })

  it('the two documents share no class, so neither sheet’s rules reach the other paper', () => {
    const classes = (html: string) => new Set(selectors(lienStackParts(html)!.css).flatMap((s) => [...s.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]!)))
    const n = classes(noticesHtml())
    const a = classes(affidavitsHtml())
    expect([...n].filter((c) => a.has(c))).toEqual([])
  })
})

describe('the words around the stack', () => {
  it('the divider counts both papers and keeps to plain words', () => {
    const d = lienStackDividerWords({ notices: 6, affidavits: 10, dayWords: 'November 15, 2026' })
    expect(d.lead).toBe('10 lien affidavits follow this page, in county clerk order.')
    expect(d.lines).toEqual(['The 6 notices before this page go in their envelopes.', 'The papers after it are signed before a notary, then filed with the county clerk.', 'Printed November 15, 2026.'])
    const one = lienStackDividerWords({ notices: 1, affidavits: 1, dayWords: 'November 15, 2026' })
    expect(one.lead).toBe('1 lien affidavit follows this page, in county clerk order.')
    expect(one.lines[0]).toBe('The notice before this page goes in its envelopes.')
    for (const line of [d.lead, ...d.lines, one.lead, ...one.lines]) expect(plainWordsFailures(line)).toEqual([])
  })

  it('the order reads as one sentence with each count a value', () => {
    expect(plainSentence(lienStackOrderWords(6, 10))).toBe('One stack, in this order: 6 notices by envelope, a divider page, then 10 affidavits by county clerk.')
    expect(plainSentence(lienStackOrderWords(1, 0))).toBe('One stack: 1 notice by envelope.')
    expect(plainSentence(lienStackOrderWords(0, 1))).toBe('One stack: 1 affidavit by county clerk.')
    expect(lienStackOrderWords(0, 0)).toBe('')
    // Where the two kinds print apart the line does not call them one stack.
    expect(plainSentence(lienStackOrderWords(6, 10, false))).toBe('Two prints: 6 notices by envelope, then 10 affidavits by county clerk.')
    expect(plainSentence(lienStackOrderWords(0, 1, false))).toBe('One stack: 1 affidavit by county clerk.')
  })

  it('a browser that does not know a named page cannot hold both papers in one print', () => {
    expect(lienStackBrowserCan((p, v) => p === 'page' && v === 'lienStackAffidavits')).toBe(true)
    expect(lienStackBrowserCan(() => false)).toBe(false)
    expect(lienStackBrowserCan(null)).toBe(false)
    expect(lienStackBrowserCan(() => { throw new Error('no') })).toBe(false)
  })
})
