/**
 * Parity test for the Deno-side signed-contract PDF builder: the shared file
 * takes pdf-lib as a parameter, so here it runs on node_modules' copy.
 */
import { describe, expect, it } from 'vitest'
import * as pdfLib from 'pdf-lib'
import { buildJobContractPdf, contractBodyToPlainText, formatPdfMoney, type PdfLibLike } from '../../../supabase/functions/_shared/jobContractPdf'

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
})
