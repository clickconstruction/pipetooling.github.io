import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as pdfLib from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import type { PdfLibLike } from '../../../supabase/functions/_shared/jobContractPdf'
import { buildPaymentRecord, buildStatementOfAccount, buildWorkStatement, paperSendings, type PaperContext, type PaperSheet } from '../../../supabase/functions/_shared/subPapers'
import { buildPaymentRecordPdf, buildStatementOfAccountPdf, buildWorkStatementPdf, subPaperPdfSafe } from '../../../supabase/functions/_shared/subPapersPdf'

// Made-up figures: the mock-up's set.
const line = (id: string, amount: number, ymd: string, o: Partial<PaperSheet['money'][number]> = {}): PaperSheet['money'][number] => ({ id, amount, ymd, recorded: false, at: `${ymd}T16:00:00Z`, how: '', memo: '', sendingId: null, sendingNo: null, fromCredit: false, creditKept: 0, clientDirect: false, ...o })
const SHEETS: PaperSheet[] = [
  { id: 'a', number: 'WS-2033-1', revision: 1, replacesCopyOf: '', jobNumber: '2033', jobName: 'Alder Court Remodel', address: '15 Alder Ct', day: '2026-09-22', lines: [{ label: 'Repipe, two baths', amount: 1800 }], money: [line('p212', 1800, '2026-10-03', { how: 'Check 1167', sendingId: 's212', sendingNo: 212 })], confirm: null },
  {
    id: 'b', number: 'WS-2041-1', revision: 2, replacesCopyOf: '2026-10-29', jobNumber: '2041', jobName: 'Cedar Hollow Clinic', address: '418 Larkspur Ln', day: '2026-10-28',
    lines: [{ label: 'Rough-in', amount: 2400 }, { label: 'Top-out', amount: 1800 }],
    money: [line('p226', 1500, '2026-10-31', { how: 'Check 1182', sendingId: 's226', sendingNo: 226 }), line('b1', -100, '2026-11-10', { memo: 'cleanup after top-out' }), line('p231a', 1000, '2026-11-12', { how: 'Zelle 8841', sendingId: 's231', sendingNo: 231, memo: 'Trim is paid in full. The rest of the rough-in goes out when the clinic’s draw lands.' })],
    confirm: { revision: 1, amount: 4200, at: 'Nov 7, 2026 at 3:12 pm', from: 'their portal' },
  },
  { id: 'c', number: 'WS-2057-1', revision: 1, replacesCopyOf: '', jobNumber: '2057', jobName: 'Ridgeway Builders, Lot 12', address: '77 Quarry Rd', day: '2026-11-03', lines: [{ label: 'Slab sleeves', amount: 2500 }], money: [], confirm: null },
  { id: 'd', number: 'WS-2041-2', revision: 1, replacesCopyOf: '', jobNumber: '2041', jobName: 'Cedar Hollow Clinic', address: '418 Larkspur Ln', day: '2026-11-06', lines: [{ label: 'Trim', amount: 1200 }], money: [line('p231b', 1200, '2026-11-12', { how: 'Zelle 8841', sendingId: 's231', sendingNo: 231 })], confirm: null },
]
const CTX: PaperContext = { company: { name: 'Your Company Name', lines: ['100 Example Way, Suite 4', '(555) 010-0100'] }, sub: { name: 'Harlan Mechanical', lines: ['22 Foundry Row'] }, today: '2026-11-13', preparedAt: 'Nov 13, 2026 at 2:40 pm', zone: 'Central time' }
const lib = pdfLib as unknown as PdfLibLike
const RANGE = { from: '2026-10-01', to: '2026-11-13' }

type Drawn = { texts: Array<{ text: string; y: number }>; rects: Array<{ y: number; height: number; borderWidth?: number }> }
/** A stand-in for pdf-lib that keeps what each page was asked to draw, so a test can read where a box landed. */
function recordingLib(): { lib: PdfLibLike; pagesDrawn: Drawn[] } {
  const pagesDrawn: Drawn[] = []
  const font = { widthOfTextAtSize: (text: string, size: number) => text.length * size * 0.5 }
  const doc = {
    addPage: () => {
      const page: Drawn = { texts: [], rects: [] }
      pagesDrawn.push(page)
      return {
        drawText: (text: string, o: { y: number }) => void page.texts.push({ text, y: o.y }),
        drawLine: () => undefined,
        drawImage: () => undefined,
        drawRectangle: (o: { y: number; height: number; borderWidth?: number }) => void page.rects.push({ y: o.y, height: o.height, borderWidth: o.borderWidth }),
      }
    },
    embedFont: async () => font,
    setTitle: () => undefined,
    save: async () => new Uint8Array(),
  }
  const lib = { PDFDocument: { create: async () => doc }, StandardFonts: { Helvetica: 'Helvetica', HelveticaBold: 'Helvetica-Bold', TimesRomanItalic: 'Times-Italic' }, rgb: (r: number, g: number, b: number) => [r, g, b] }
  return { lib: lib as unknown as PdfLibLike, pagesDrawn }
}

async function pages(bytes: Uint8Array): Promise<number> {
  return (await pdfLib.PDFDocument.load(bytes)).getPageCount()
}
/** `SUB_PAPERS_OUT=<folder>` keeps the three files, to look at them. */
function keep(name: string, bytes: Uint8Array) {
  const out = process.env.SUB_PAPERS_OUT
  if (!out) return
  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, name), bytes)
}

describe('the sub papers as PDFs', () => {
  it('draws the work statement on one page', async () => {
    const bytes = await buildWorkStatementPdf(lib, buildWorkStatement(SHEETS[1]!, CTX))
    keep('work-statement.pdf', bytes)
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
    expect(await pages(bytes)).toBe(1)
  })
  it('draws the payment record on one page', async () => {
    const snd = paperSendings(SHEETS).find((s) => s.number === 'PR-0231')!
    const bytes = await buildPaymentRecordPdf(lib, buildPaymentRecord(snd, SHEETS, CTX))
    keep('payment-record.pdf', bytes)
    expect(await pages(bytes)).toBe(1)
  })
  it('draws the statement of account on one page', async () => {
    const bytes = await buildStatementOfAccountPdf(lib, buildStatementOfAccount(SHEETS, RANGE, CTX, { number: 'SA-0058' }), RANGE)
    keep('statement-of-account.pdf', bytes)
    expect(await pages(bytes)).toBe(1)
  })
  it('says a payment was recorded after the last statement, beside it and under How it adds up', async () => {
    // The last statement was made on Nov 1 at 10:00. A payment dated Oct 20 was typed after it.
    const since = { from: '2026-11-01', to: '2026-11-13', lateAfter: '2026-11-01T16:00:00Z' }
    const sheets = SHEETS.map((sh, i) => (i === 0 ? { ...sh, money: [...sh.money, line('late', 120, '2026-10-20', { at: '2026-11-05T16:00:00Z' })] } : sh))
    const paper = buildStatementOfAccount(sheets, since, CTX)
    expect(paper.late).toEqual({ payments: 1, backcharges: 0, sheets: 0 })
    const rec = recordingLib()
    await buildStatementOfAccountPdf(rec.lib, paper, since)
    const texts = rec.pagesDrawn.flatMap((pg) => pg.texts.map((t) => t.text))
    expect(texts).toContain('recorded after the last statement')
    expect(texts.join(' ')).toContain('1 payment dated before this period was recorded after the last statement was made')
    // A statement that carries nothing draws neither.
    const plain = recordingLib()
    await buildStatementOfAccountPdf(plain.lib, buildStatementOfAccount(SHEETS, RANGE, CTX), RANGE)
    expect(plain.pagesDrawn.flatMap((pg) => pg.texts.map((t) => t.text)).join(' ')).not.toContain('recorded after the last statement')
  })

  it('runs to a second page when the sheets do, and numbers both', async () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ ...SHEETS[2]!, id: `m${i}`, number: `WS-2057-${i + 1}`, day: `2026-10-${String((i % 28) + 1).padStart(2, '0')}` }))
    const bytes = await buildStatementOfAccountPdf(lib, buildStatementOfAccount(many, { from: null, to: null }, CTX), { from: null, to: null })
    expect(await pages(bytes)).toBeGreaterThan(1)
  })
  it('boxes Last payments on each page it runs over, never upside down', async () => {
    // 45 payments on one sheet: the Last payments box starts on the first page and ends on the second.
    const money = Array.from({ length: 45 }, (_, i) => line(`q${i}`, 50, `2026-10-${String((i % 28) + 1).padStart(2, '0')}`, { how: 'Check 1200' }))
    const sheets: PaperSheet[] = [{ ...SHEETS[2]!, id: 'long', lines: [{ label: 'Slab sleeves', amount: 2500 }], money }]
    const { lib: rec, pagesDrawn } = recordingLib()
    await buildStatementOfAccountPdf(rec, buildStatementOfAccount(sheets, { from: null, to: null }, CTX), { from: null, to: null })
    expect(pagesDrawn.length).toBe(2)
    const boxes = pagesDrawn.map((p) => p.rects.filter((r) => r.borderWidth === 0.7))
    // Every box stands the right way up and inside the page, above the foot's rule.
    for (const r of boxes.flat()) {
      expect(r.height).toBeGreaterThan(0)
      expect(r.y).toBeGreaterThanOrEqual(48 + 14)
      expect(r.y + r.height).toBeLessThanOrEqual(792 - 48 + 12)
    }
    // The first page's box holds the payments drawn on it, and the second page's holds the rest and the total.
    const paidOn = (i: number) => pagesDrawn[i]!.texts.filter((t) => t.text === '$50.00')
    expect(paidOn(0).length + paidOn(1).length).toBe(45)
    expect(paidOn(0).length).toBeGreaterThan(0)
    expect(paidOn(1).length).toBeGreaterThan(0)
    for (const i of [0, 1]) {
      const box = boxes[i]!.find((r) => paidOn(i).every((t) => t.y > r.y && t.y < r.y + r.height))
      expect(box, `page ${i + 1} has a box round its payments`).toBeTruthy()
    }
    const total = pagesDrawn[1]!.texts.find((t) => t.text === 'Paid in this period')!
    expect(boxes[1]!.some((r) => total.y > r.y && total.y < r.y + r.height)).toBe(true)
  })
  it('breaks the payment record’s open statements over a page, and never draws past the foot', async () => {
    // 60 open sheets after one payment: After this payment is longer than a page.
    const open = Array.from({ length: 60 }, (_, i) => ({ ...SHEETS[2]!, id: `o${i}`, number: `WS-2057-${i + 1}`, day: '2026-10-01', money: i === 0 ? [line('one', 100, '2026-10-05', { how: 'Check 1201', sendingId: 's300', sendingNo: 300 })] : [] }))
    const snd = paperSendings(open)[0]!
    const { lib: rec, pagesDrawn } = recordingLib()
    await buildPaymentRecordPdf(rec, buildPaymentRecord(snd, open, CTX))
    expect(pagesDrawn.length).toBeGreaterThan(1)
    for (const p of pagesDrawn) for (const t of p.texts) expect(t.y, t.text).toBeGreaterThanOrEqual(48)
    for (const p of pagesDrawn) for (const r of p.rects.filter((x) => x.borderWidth === 0.7)) expect(r.height).toBeGreaterThan(0)
  })
  it('keeps to the letters Helvetica has: a true minus becomes a hyphen', () => {
    expect(subPaperPdfSafe('−$100.00 ✓ “done”')).toBe('-$100.00  "done"')
  })
})
