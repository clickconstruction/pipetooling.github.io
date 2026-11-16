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
  it('runs to a second page when the sheets do, and numbers both', async () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ ...SHEETS[2]!, id: `m${i}`, number: `WS-2057-${i + 1}`, day: `2026-10-${String((i % 28) + 1).padStart(2, '0')}` }))
    const bytes = await buildStatementOfAccountPdf(lib, buildStatementOfAccount(many, { from: null, to: null }, CTX), { from: null, to: null })
    expect(await pages(bytes)).toBeGreaterThan(1)
  })
  it('keeps to the letters Helvetica has: a true minus becomes a hyphen', () => {
    expect(subPaperPdfSafe('−$100.00 ✓ “done”')).toBe('-$100.00  "done"')
  })
})
