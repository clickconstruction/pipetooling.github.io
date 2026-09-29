/**
 * Parity test for the Deno-side signed-contract PDF builder: the shared file
 * takes pdf-lib as a parameter, so here it runs on node_modules' copy.
 */
import { describe, expect, it } from 'vitest'
import * as pdfLib from 'pdf-lib'
import { buildJobContractPdf, contractBodyToPlainText, formatPdfMoney, parseStatutoryRuns, STATUTORY_SIZE, TERMS_SIZE, UNSIGNED_BLOCK, wrapRuns, type PdfLibLike } from '../../../supabase/functions/_shared/jobContractPdf'

const input = {
  heading: 'Service agreement for 138 W Pat Dolan',
  jobNumber: '922',
  jobAddress: '138 W Pat Dolan, Blanco TX 78606',
  customerName: 'Michael Palmer',
  recipientName: 'Michael Palmer',
  dateLabel: 'Sep 3, 2026',
  revision: 2,
  templateName: 'Built-in service agreement terms',
  scopeLines: ['Replace water heater (40 gal electric) in garage closet', 'Repair fascia at front entry; replace exterior vent', 'Haul off old unit'],
  exclusions: 'Drywall repair, painting, permits by others',
  note: '',
  amountCents: 500000,
  paymentLine: '50% down ($2,500.00) to begin work, balance due on completion.',
  dates: 'Start: 2026-09-04  ·  Estimated completion: 2026-09-12',
  termsText: Array.from({ length: 12 }, (_, i) => `${i + 1}. Clause ${i + 1}. ` + 'Words words words words words words words words words words words words words words words words words words words words words words words words words words words words. '.repeat(3)).join('\n\n'),
  issuer: { companyName: 'Click Plumbing and Electrical', addressText: '12925 FM 20, Kingsbury, TX 78638', phone: '512-360-0599', email: '', tagline: 'Reliable service today, innovative solutions for tomorrow.', licenseLine: 'Malachi Whites RMP M-41130' },
  signature: { printedName: 'Michael Palmer', auditLine: 'Signed electronically by Michael Palmer (typed) · Sep 3, 2026, 7:14 PM CT · consent recorded', png: null },
}

describe('statutory runs (v2.4150)', () => {
  const fake = { widthOfTextAtSize: (t: string, size: number) => t.length * size }
  it('splits a paragraph into runs at the terms size and the statutory size, asterisks dropped; a lone ** stays', () => {
    expect(parseStatutoryRuns('Waivers are conditional. **Customer waives the list.** Texas law governs.')).toEqual([
      { text: 'Waivers are conditional. ', size: TERMS_SIZE },
      { text: 'Customer waives the list.', size: STATUTORY_SIZE },
      { text: ' Texas law governs.', size: TERMS_SIZE },
    ])
    expect(parseStatutoryRuns('a ** b')).toEqual([{ text: 'a ** b', size: TERMS_SIZE }])
    expect(parseStatutoryRuns('')).toEqual([])
  })
  it('wraps sized words to the width, measuring each word at its own size', () => {
    const lines = wrapRuns(parseStatutoryRuns('aa bb **cc dd** ee', 9, 10), fake, 60)
    // aa(18)+sp(9)+bb(18)=45; +sp(9)+cc(20)=74 > 60 → break; cc(20)+sp(10)+dd(20)=50; +sp(10)+ee(18)=78 > 60 → break
    expect(lines.map((l) => l.map((w) => `${w.word}@${w.size}`))).toEqual([['aa@9', 'bb@9'], ['cc@10', 'dd@10'], ['ee@9']])
  })
  it('a plain body keeps its tokens for the PDF builder, and the PDF still builds and parses with one', async () => {
    expect(contractBodyToPlainText('x **y** z', 'plain')).toBe('x **y** z')
    const bytes = await buildJobContractPdf(pdfLib as unknown as PdfLibLike, { ...input, termsText: '11. General terms. Waivers are conditional. **Customer waives the list under § 53.256.** Texas law governs.' })
    const doc = await pdfLib.PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(1)
  })
})

describe('contractBodyToPlainText', () => {
  it('passes plain text through and flattens html / markdown', () => {
    expect(contractBodyToPlainText('1. Scope.\n\n2. Changes.', 'plain')).toBe('1. Scope.\n\n2. Changes.')
    expect(contractBodyToPlainText('<p>One &amp; two</p><ul><li>a</li><li>b</li></ul>', 'html')).toBe('One & two\n• a\n• b')
    expect(contractBodyToPlainText('# Terms\n\n**Bold** and *it*\n\n- x\n- y', 'markdown')).toBe('Terms\n\nBold and it\n\n• x\n• y')
    expect(contractBodyToPlainText('', 'html')).toBe('')
  })
  it('formats money', () => {
    expect(formatPdfMoney(500000)).toBe('$5,000.00')
    expect(formatPdfMoney(-250)).toBe('-$2.50')
  })
})

describe('buildJobContractPdf', () => {
  it('builds a multi-page PDF with the heading as title and a page-count footer', async () => {
    const bytes = await buildJobContractPdf(pdfLib as unknown as PdfLibLike, input)
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-')
    const doc = await pdfLib.PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2)
    expect(doc.getTitle()).toBe(input.heading)
  })

  it('embeds a drawn signature PNG when given one', async () => {
    const tiny = await pdfLib.PDFDocument.create()
    // A 1×1 PNG (transparent) — enough for embedPng to accept.
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0))
    await tiny.embedPng(png)
    const bytes = await buildJobContractPdf(pdfLib as unknown as PdfLibLike, { ...input, termsText: 'Short.', signature: { ...input.signature, png } })
    const doc = await pdfLib.PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(1)
  })

  it('renders the UNSIGNED variant (v2.3527): the same document with pen rules, and it parses', async () => {
    const bytes = await buildJobContractPdf(pdfLib as unknown as PdfLibLike, { ...input, termsText: 'Short.', signature: null })
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-')
    const doc = await pdfLib.PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(1)
    expect(doc.getTitle()).toBe(input.heading)
    // The words the block prints are the shared constant — the guide and the page agree.
    expect(UNSIGNED_BLOCK.signLabel).toBe('Sign')
    expect(UNSIGNED_BLOCK.dateLabel).toBe('Date')
    expect(UNSIGNED_BLOCK.hint).toMatch(/Sign and date here/)
  })

  it('the signed and unsigned variants are different documents', async () => {
    const signed = await buildJobContractPdf(pdfLib as unknown as PdfLibLike, { ...input, termsText: 'Short.' })
    const unsigned = await buildJobContractPdf(pdfLib as unknown as PdfLibLike, { ...input, termsText: 'Short.', signature: null })
    expect(unsigned.length).not.toBe(signed.length)
  })
})
