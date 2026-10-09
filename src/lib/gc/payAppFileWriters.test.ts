/**
 * Owner Billing's O4a: our pay application through the app's own AIA filler, with the GC form's options, and
 * as a PDF. The draft is Fair Oaks D's in the test state, the one `ownerBillingRest.direct.test.ts` pins.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { AIA_G702_SHEET, AIA_G703_SHEET } from '../aiaG702G703Template'
import { ownerPayAppForm, ownerPayAppParties } from './ownerBilling'
import { payAppCells } from './payAppFile'
import { payAppFillerLines, payAppPdf, payAppWorkbook } from './payAppFileWriters'
import { initialGcState } from './schedule/testState'
import type { GcState } from './types'

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..')
const templatePath = join(repoRoot, 'public', 'templates', 'aia-g702-g703-mission-hills.xlsx')

function template(): ArrayBuffer {
  const buf = readFileSync(templatePath)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
}

async function sheets(out: ArrayBuffer) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(out)
  return { g702: wb.getWorksheet(AIA_G702_SHEET)!, g703: wb.getWorksheet(AIA_G703_SHEET)! }
}

/** A cell's number, written or cached under its formula. */
function numberOf(value: ExcelJS.CellValue): number | null {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'result' in value && typeof value.result === 'number') return value.result
  return null
}

function draftOf(s: GcState) {
  const p = s.projects.find((x) => x.id === 'fairoaksd')!
  const form = ownerPayAppForm(s, p, 'draft')!
  return { form, parties: ownerPayAppParties(s, p, form) }
}

describe('our pay application as a file', () => {
  it('fills the template for the customer: who it goes to, who certifies, the notary, line 7 and the rows', async () => {
    const { form, parties } = draftOf(initialGcState())
    const cells = payAppCells(form.app, parties)
    const { g702, g703 } = await sheets(await payAppWorkbook(template(), form.app, parties))
    expect(g702.getCell('A5').value).toBe('TO CUSTOMER:')
    expect(g702.getCell('J44').value).toBe('ARCHITECT:')
    expect(String(g702.getCell('J26').value)).toMatch(/^State of: Texas/)
    expect(g702.getCell('D6').value).toBe('Cibolo Creek Partners')
    expect(g702.getCell('H40').value).toBe(cells.previousCertificates)
    const first = cells.rows[0]!
    expect(g703.getCell('C13').value).toBe(first.description)
    expect(g703.getCell('D13').value).toBe(first.scheduled)
    // One rate: the row keeps the template's H × C28.
    expect(g703.getCell('K13').formula).toBeTruthy()
    expect(numberOf(g703.getCell('K13').value)).toBeCloseTo(((first.previous + first.thisPeriod + first.stored) * 10) / 100, 2)
  })

  it('writes each row its own retainage when a step lowers it partway, and the totals follow', async () => {
    const s = initialGcState()
    const p = s.projects.find((x) => x.id === 'fairoaksd')!
    p.ownerRetainageStep = { atPct: 50, toPct: 5, way: 'after' }
    const { form, parties } = draftOf(s)
    const cells = payAppCells(form.app, parties)
    const filler = payAppFillerLines(cells)
    expect(filler.rowRetainage).toBeDefined()
    const { g703 } = await sheets(await payAppWorkbook(template(), form.app, parties))
    const first = cells.rows[0]!
    expect(g703.getCell('K13').value).toBe(first.retainage)
    const total = cells.rows.reduce((t, r) => t + (r.retainage ?? 0), 0)
    expect(numberOf(g703.getCell('K49').value)).toBeCloseTo(total, 2)
  })

  it('draws the PDF', async () => {
    const { form, parties } = draftOf(initialGcState())
    const pdf = new Uint8Array(await payAppPdf(form.app, parties))
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-')
    expect(pdf.byteLength).toBeGreaterThan(2000)
  })
})
