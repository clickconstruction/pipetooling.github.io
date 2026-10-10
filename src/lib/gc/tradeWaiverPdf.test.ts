/**
 * The trade's signed waiver as a PDF (P5a-2, `_shared/tradeWaiverPdf.ts`): the form each press signs, the paper the same
 * as the portal shows (`tradeWaiverPaper.ts`), the audit sentence, the name in Drive, and a PDF that opens.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as pdfLib from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { buildTradeWaiverPdf, tradeWaiverAuditLine, tradeWaiverPaperFor, tradeWaiverPdfModel, tradeWaiverPdfName, type TradeWaiverPdfInput, type TradeWaiverPdfLib } from '../../../supabase/functions/_shared/tradeWaiverPdf'
import { tradePayAppWaiverPaper, tradeWaiverPaper } from './tradeWaiverPaper'
import type { Draw } from './types'

const job = { name: 'Sample Dental Office', address: '3 Sample Ln, Fair Oaks Ranch' }
const at = new Date('2026-10-10T18:42:00Z')
const input = (change: Partial<TradeWaiverPdfInput> = {}): TradeWaiverPdfInput => ({
  paper: 'unconditional_progress',
  amount: 13122,
  through: '2026-09-24',
  company: 'Sample Electric Co.',
  project: job,
  signer: 'Dana Ortiz',
  signedYmd: '2026-10-10',
  checkFrom: 'Click Construction',
  signedAt: at,
  ...change,
})

describe('the signed waiver PDF (P5a-2)', () => {
  it('signs the form each press signs: the final form on the final draw', () => {
    expect(tradeWaiverPaperFor('unconditional_waiver', false)).toBe('unconditional_progress')
    expect(tradeWaiverPaperFor('unconditional_waiver', true)).toBe('unconditional_final')
    expect(tradeWaiverPaperFor('pay_app', false)).toBe('conditional_progress')
    expect(tradeWaiverPaperFor('final_pay_app', true)).toBe('conditional_final')
  })

  it('lays out the same paper the portal shows the trade before it signs', () => {
    const draw = { id: 'd1', number: 1, requestedOn: '2026-09-24', net: 13122, payApp: { periodTo: '2026-09-24' } } as Draw
    const shown = tradeWaiverPaper(draw, job, 'Sample Electric Co.', 'Dana Ortiz', '2026-10-10')
    const model = tradeWaiverPdfModel(input())
    expect(model.title).toBe(shown.title)
    expect(model.paragraphs).toEqual(shown.paragraphs)
    const conditional = tradePayAppWaiverPaper({ final: false, amount: 5248.8, periodTo: '2026-10-05' }, job, 'Sample Electric Co.', 'Dana Ortiz', '2026-10-10')
    expect(tradeWaiverPdfModel(input({ paper: 'conditional_progress', amount: 5248.8, through: '2026-10-05' })).paragraphs).toEqual(conditional.paragraphs)
  })

  it('signs the foot with the typed name and the day, under the audit and statute lines', () => {
    const model = tradeWaiverPdfModel(input())
    expect(model.foot).toEqual({ name: 'Dana Ortiz', company: 'Sample Electric Co.', title: null, signed: 'Signed October 10, 2026' })
    expect(model.audit).toBe(tradeWaiverAuditLine('Dana Ortiz', 'Sample Electric Co.', at))
    expect(model.audit).toBe('Typed by Dana Ortiz in Sample Electric Co.’s portal on Oct 10, 2026 at 1:42 PM CT, consent recorded.')
    expect(model.esign).toContain('ESIGN Act')
  })

  it('names the PDF by its form, trade, draw and day', () => {
    expect(tradeWaiverPdfName('unconditional_final', 'Electrical / Low voltage', 5, '2026-11-02')).toBe(
      'Unconditional Waiver and Release on Final Payment - Electrical - Low voltage - draw 5 - signed 2026-11-02.pdf',
    )
  })

  it('makes a PDF that opens, one Letter page', async () => {
    const bytes = await buildTradeWaiverPdf(pdfLib as unknown as TradeWaiverPdfLib, tradeWaiverPdfModel(input()))
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('%PDF')
    const doc = await pdfLib.PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(1)
    expect(doc.getTitle()).toBe('Unconditional Waiver and Release on Progress Payment')
    expect(doc.getPage(0).getSize()).toEqual({ width: 612, height: 792 })
  })

  it('signs in the cursive face when the function has it, as contract-form-paper-entry loads it', async () => {
    const font = new Uint8Array(readFileSync('public/fonts/GreatVibes-Regular.ttf'))
    const final = tradeWaiverPdfModel(input({ paper: 'conditional_final', checkFrom: 'Click Construction' }))
    const bytes = await buildTradeWaiverPdf(pdfLib as unknown as TradeWaiverPdfLib, final, { bytes: font, fontkit })
    const doc = await pdfLib.PDFDocument.load(bytes)
    expect(doc.getTitle()).toBe('Conditional Waiver and Release on Final Payment')
    expect(bytes.length).toBeGreaterThan(5000)
  })
})
