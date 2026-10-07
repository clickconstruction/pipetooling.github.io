import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { AIA_FIELD_DEFS, AIA_G702_SHEET, AIA_G703_SHEET, type AiaFieldKey } from './aiaG702G703Template'
import {
  buildAiaPreview,
  formatAiaMoney,
  formatAiaPercent,
} from './aiaG702G703Preview'
import { AiaTooManyRows, fillAiaG702G703Workbook } from './fillAiaG702G703Workbook'
import { AIA_G703_MAX_ROWS, type PayApplicationLine } from './aiaPayApplicationLines'

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const templatePath = join(repoRoot, 'public', 'templates', 'aia-g702-g703-mission-hills.xlsx')

function templateArrayBuffer(): ArrayBuffer {
  const buf = readFileSync(templatePath)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

async function loadWorkbook(ab: ArrayBuffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(ab)
  return wb
}

/** A cell's value, or a formula's cached result (ExcelJS writes no result for a 0, so none reads as 0). */
function held(wb: ExcelJS.Workbook, sheet: string, ref: string): unknown {
  const v = wb.getWorksheet(sheet)!.getCell(ref).value as unknown
  if (v && typeof v === 'object' && !(v instanceof Date) && ('formula' in v || 'sharedFormula' in v)) {
    return (v as { result?: unknown }).result ?? 0
  }
  return v
}

/** One line of an application, for these tests. */
const line = (p: Partial<PayApplicationLine>): PayApplicationLine => ({ id: 'l1', label: '', scheduledValue: 0, labor: null, stage: null, fromPrevious: 0, thisPeriod: 0, stored: 0, ...p })

const MISSION_HILLS = ['Mission Hills', 'Harper', '1685 Farm', 'Buda', '240393cz', 'March 31st', 'Malachi', '15400']

describe('an empty form', () => {
  it('downloads none of the job the template was saved from', async () => {
    const out = await loadWorkbook(await fillAiaG702G703Workbook(templateArrayBuffer(), {}))
    for (const def of AIA_FIELD_DEFS) {
      const v = out.getWorksheet(def.sheetName)!.getCell(def.cellRef).value
      expect(v === null || v === '', `${def.key} holds ${JSON.stringify(v)}`).toBe(true)
    }
    const strings: string[] = []
    for (const ws of out.worksheets) {
      ws.eachRow((row) => row.eachCell((c) => void (typeof c.value === 'string' && strings.push(c.value))))
    }
    for (const word of MISSION_HILLS) expect(strings.filter((t) => t.includes(word)), word).toEqual([])
    // The totals a viewer shows without recalculating are this application's, not the template's.
    expect(held(out, AIA_G702_SHEET, 'H22')).toBe(0)
    expect(held(out, AIA_G702_SHEET, 'H24')).toBe(0)
    expect(held(out, AIA_G702_SHEET, 'H42')).toBe(0)
    expect(held(out, AIA_G703_SHEET, 'H49')).toBe(0)
    // The first item row was the template job's: its name is gone and its numbers are zero.
    expect(held(out, AIA_G703_SHEET, 'C13')).toBeNull()
    for (const ref of ['D13', 'E13', 'F13', 'G13']) expect(held(out, AIA_G703_SHEET, ref), ref).toBe(0)
  })
})

describe('buildAiaPreview', () => {
  it('agrees with Excel on the job the template was saved from', async () => {
    const wb = await loadWorkbook(templateArrayBuffer())
    const { math } = buildAiaPreview({ g702_h18_original_contract_sum: 123600, g702_c28_retainage_percent: 5 }, [
      line({ scheduledValue: 123600, thisPeriod: 68000, stored: 18228 }),
    ])
    expect(math.totalCompletedAndStored).toBe(held(wb, AIA_G702_SHEET, 'H24'))
    expect(math.contractSumToDate).toBe(held(wb, AIA_G702_SHEET, 'H22'))
    expect(math.retainageOfCompletedWork).toBe(held(wb, AIA_G702_SHEET, 'F28'))
    expect(math.totalRetainage).toBe(held(wb, AIA_G702_SHEET, 'H34'))
    expect(math.totalEarnedLessRetainage).toBe(held(wb, AIA_G702_SHEET, 'H36'))
    expect(math.currentPaymentDue).toBe(held(wb, AIA_G702_SHEET, 'H42'))
    expect(math.balanceToFinish).toBe(held(wb, AIA_G702_SHEET, 'F45'))
    expect(math.line.totalToDate).toBe(held(wb, AIA_G703_SHEET, 'H13'))
    expect(math.line.balanceToFinish).toBe(held(wb, AIA_G703_SHEET, 'J13'))
    expect(math.line.retainage).toBe(held(wb, AIA_G703_SHEET, 'K13'))
    expect(math.line.pctComplete).toBeCloseTo(Number(held(wb, AIA_G703_SHEET, 'I13')), 9)
  })

  it('reads a typed box as typed, an empty one as empty, and the download agrees', async () => {
    const typed = {
      g702_n5_project: 'Water Sample Test',
      g702_h6_project_name: 'Cedar Ridge Clubhouse',
      g702_h18_original_contract_sum: 48500,
      g702_c28_retainage_percent: 10,
    }
    const lines = [line({ label: 'Plumbing', scheduledValue: 48500, thisPeriod: 19400 })]
    const preview = buildAiaPreview(typed, lines)
    expect(preview.cells.g702_n5_project).toEqual({ text: 'Water Sample Test', source: 'typed' })
    expect(preview.cells.g702_h18_original_contract_sum).toEqual({ text: '$48,500.00', source: 'typed' })
    expect(preview.cells.g702_n7_project_no).toEqual({ text: '', source: 'blank' })
    expect(preview.math.rows).toHaveLength(1)
    expect(preview.math.rows[0]).toMatchObject({ lineId: 'l1', part: 'whole', label: 'Plumbing', totalToDate: 19400, retainage: 1940 })
    expect(preview.math.currentPaymentDue).toBe(17460)

    const out = await loadWorkbook(await fillAiaG702G703Workbook(templateArrayBuffer(), typed, lines))
    expect(held(out, AIA_G703_SHEET, 'C13')).toBe('Plumbing')
    expect(held(out, AIA_G703_SHEET, 'F13')).toBe(19400)
    expect(held(out, AIA_G702_SHEET, 'N5')).toBe('Water Sample Test')
    expect(held(out, AIA_G703_SHEET, 'K2')).toBe('Water Sample Test')
    // The project block: the label moved off its ten-character column, the name under it.
    expect(held(out, AIA_G702_SHEET, 'H5')).toBe('PROJECT:')
    expect(held(out, AIA_G702_SHEET, 'J5')).toBeNull()
    expect(held(out, AIA_G702_SHEET, 'H6')).toBe('Cedar Ridge Clubhouse')
    expect(out.getWorksheet(AIA_G702_SHEET)!.getCell('K6').style.fill).toEqual(out.getWorksheet(AIA_G702_SHEET)!.getCell('D6').style.fill)
    expect(held(out, AIA_G702_SHEET, 'H18')).toBe(48500)
    expect(held(out, AIA_G702_SHEET, 'N7')).toBeNull()
    expect(held(out, AIA_G703_SHEET, 'G13')).toBe(0)
    expect(held(out, AIA_G702_SHEET, 'H24')).toBe(19400)
    expect(held(out, AIA_G702_SHEET, 'H42')).toBe(preview.math.currentPaymentDue)
    expect(held(out, AIA_G702_SHEET, 'M41')).toBe(17460)
    expect(held(out, AIA_G703_SHEET, 'K49')).toBe(1940)
    expect(Number(held(out, AIA_G703_SHEET, 'I13'))).toBeCloseTo(0.4, 9)
  })

  it('carries a G702 box onto the G703 header unless the G703 box is typed', () => {
    const follows: AiaFieldKey = 'g703_k2_project'
    expect(buildAiaPreview({ g702_n5_project: '4' }).cells[follows]).toEqual({ text: '4', source: 'typed' })
    expect(buildAiaPreview({ g702_n5_project: '4', g703_k2_project: '5' }).cells[follows].text).toBe('5')
    expect(buildAiaPreview({}).cells[follows]).toEqual({ text: '', source: 'blank' })
  })

  it('does the nine lines for a typed application', () => {
    const { math } = buildAiaPreview(
      {
        g702_h18_original_contract_sum: 50000,
        g702_f50_this_month_change_order_additions: 2500,
        g702_h49_previous_month_change_order_deductions: 500,
        g702_c28_retainage_percent: 10,
        g702_c31_retainage_material_percent: 10,
      },
      [line({ scheduledValue: 52000, thisPeriod: 20000, stored: 1000 })],
    )
    expect(math.netChangeByChangeOrders).toBe(2000)
    expect(math.contractSumToDate).toBe(52000)
    expect(math.totalCompletedAndStored).toBe(21000)
    expect(math.retainageOfStoredMaterial).toBe(100)
    expect(math.retainageOfCompletedWork).toBe(2000)
    expect(math.totalRetainage).toBe(2100)
    expect(math.totalEarnedLessRetainage).toBe(18900)
    expect(math.currentPaymentDue).toBe(18900)
    expect(math.balanceToFinish).toBe(33100)
    expect(math.line.pctComplete).toBeCloseTo(21000 / 52000, 9)
  })

  it('carries a previous application: column D joins the total and line 7 comes off what is due', async () => {
    // Application 2 of a 48,500 contract: 19,400 before, 9,700 now, 17,460 certified before.
    const typed = {
      g702_n5_project: '2',
      g702_h18_original_contract_sum: 48500,
      g702_c28_retainage_percent: 10,
      g702_h40_less_previous_certificates: 17460,
    }
    const lines = [line({ scheduledValue: 48500, fromPrevious: 19400, thisPeriod: 9700 })]
    const { math } = buildAiaPreview(typed, lines)
    expect(math.rows[0]).toMatchObject({ fromPrevious: 19400, thisPeriod: 9700 })
    expect(math.line.totalToDate).toBe(29100)
    expect(math.totalRetainage).toBe(2910)
    expect(math.totalEarnedLessRetainage).toBe(26190)
    expect(math.lessPreviousCertificates).toBe(17460)
    expect(math.currentPaymentDue).toBe(8730)
    expect(math.balanceToFinish).toBe(22310)

    const out = await loadWorkbook(await fillAiaG702G703Workbook(templateArrayBuffer(), typed, lines))
    expect(held(out, AIA_G703_SHEET, 'E13')).toBe(19400)
    expect(held(out, AIA_G702_SHEET, 'H40')).toBe(17460)
    expect(held(out, AIA_G702_SHEET, 'H42')).toBe(8730)
    expect(held(out, AIA_G703_SHEET, 'H49')).toBe(29100)
  })

  it('has no percent when the scheduled value is zero', () => {
    expect(buildAiaPreview({}, [line({ scheduledValue: 0 })]).math.line.pctComplete).toBeNull()
    expect(buildAiaPreview({}).math.line.pctComplete).toBeNull()
  })

  // A 99,200 contract in six lines, as application 3: 48,000 before, 14,720 of work now, 4,800 stored.
  const SIX: PayApplicationLine[] = [
    line({ id: 'ug', label: 'Underground sanitary and storm', scheduledValue: 19200, labor: 8640, fromPrevious: 19200 }),
    line({ id: 'wg', label: 'Water and gas rough-in', scheduledValue: 14400, labor: 6480, fromPrevious: 14400 }),
    line({ id: 'to', label: 'Top-out', scheduledValue: 28800, labor: 12960, fromPrevious: 14400, thisPeriod: 11520 }),
    line({ id: 'tr', label: 'Fixtures and trim', scheduledValue: 24000, labor: 10800 }),
    line({ id: 'eq', label: 'Water heaters and equipment', scheduledValue: 9600, labor: 2400, stored: 4800 }),
    line({ id: 'co1', label: 'CO 1: Added hose bibbs', scheduledValue: 3200, thisPeriod: 3200 }),
  ]
  const SIX_HEADER = { g702_n5_project: '3', g702_h18_original_contract_sum: 96000, g702_f49_previous_month_change_order_additions: 3200, g702_c28_retainage_percent: 10, g702_h40_less_previous_certificates: 43200 }

  it('works a row per line and sums them for the G702', async () => {
    const { math } = buildAiaPreview(SIX_HEADER, SIX)
    expect(math.rows.map((r) => [r.label, r.totalToDate, r.balanceToFinish, r.retainage])).toEqual([
      ['Underground sanitary and storm', 19200, 0, 1920],
      ['Water and gas rough-in', 14400, 0, 1440],
      ['Top-out', 25920, 2880, 2592],
      ['Fixtures and trim', 0, 24000, 0],
      ['Water heaters and equipment', 4800, 4800, 480],
      ['CO 1: Added hose bibbs', 3200, 0, 320],
    ])
    expect(math.line).toMatchObject({ scheduledValue: 99200, fromPrevious: 48000, thisPeriod: 14720, materialsStored: 4800, totalToDate: 67520, balanceToFinish: 31680, retainage: 6752 })
    expect(math.contractSumToDate).toBe(99200)
    expect(math.totalEarnedLessRetainage).toBe(60768)
    expect(math.currentPaymentDue).toBe(17568)

    const out = await loadWorkbook(await fillAiaG702G703Workbook(templateArrayBuffer(), SIX_HEADER, SIX))
    expect(held(out, AIA_G703_SHEET, 'C15')).toBe('Top-out')
    expect(held(out, AIA_G703_SHEET, 'E15')).toBe(14400)
    expect(held(out, AIA_G703_SHEET, 'F15')).toBe(11520)
    expect(held(out, AIA_G703_SHEET, 'G17')).toBe(4800)
    expect(held(out, AIA_G703_SHEET, 'H15')).toBe(25920)
    expect(held(out, AIA_G703_SHEET, 'K18')).toBe(320)
    // The seventh item row has no line: no name, zeros.
    expect(held(out, AIA_G703_SHEET, 'C19')).toBeNull()
    expect(held(out, AIA_G703_SHEET, 'D19')).toBe(0)
    expect(held(out, AIA_G703_SHEET, 'H49')).toBe(67520)
    expect(held(out, AIA_G703_SHEET, 'K49')).toBe(6752)
    expect(held(out, AIA_G702_SHEET, 'H42')).toBe(17568)
  })

  it('prints labor and material on their own rows without moving a total', async () => {
    const whole = buildAiaPreview(SIX_HEADER, SIX).math
    const { math } = buildAiaPreview(SIX_HEADER, SIX, { splitLaborMaterial: true })
    // Five lines carry a split; the change order does not.
    expect(math.rows).toHaveLength(11)
    expect(math.rows.slice(4, 6).map((r) => [r.label, r.part, r.scheduledValue, r.fromPrevious, r.thisPeriod])).toEqual([
      ['Top-out, labor', 'labor', 12960, 6480, 5184],
      ['Top-out, material', 'material', 15840, 7920, 6336],
    ])
    // Stored material is material.
    expect(math.rows.find((r) => r.label === 'Water heaters and equipment, material')).toMatchObject({ stored: 4800 })
    expect(math.rows.find((r) => r.label === 'Water heaters and equipment, labor')).toMatchObject({ stored: 0 })
    expect(math.line).toEqual(whole.line)
    expect(math.currentPaymentDue).toBe(whole.currentPaymentDue)

    const out = await loadWorkbook(await fillAiaG702G703Workbook(templateArrayBuffer(), SIX_HEADER, SIX, { splitLaborMaterial: true }))
    expect(held(out, AIA_G703_SHEET, 'C17')).toBe('Top-out, labor')
    expect(held(out, AIA_G703_SHEET, 'C18')).toBe('Top-out, material')
    expect(held(out, AIA_G703_SHEET, 'H49')).toBe(67520)
  })

  it('will not generate more rows than the sheet holds', async () => {
    const many = Array.from({ length: AIA_G703_MAX_ROWS + 1 }, (_, i) => line({ id: `l${i}`, label: `Line ${i + 1}`, scheduledValue: 100 }))
    await expect(fillAiaG702G703Workbook(templateArrayBuffer(), {}, many)).rejects.toBeInstanceOf(AiaTooManyRows)
    // Exactly the sheet's count is fine, and the last item row is written.
    const out = await loadWorkbook(await fillAiaG702G703Workbook(templateArrayBuffer(), {}, many.slice(0, AIA_G703_MAX_ROWS)))
    expect(held(out, AIA_G703_SHEET, 'C46')).toBe(`Line ${AIA_G703_MAX_ROWS}`)
    expect(held(out, AIA_G703_SHEET, 'D49')).toBe(AIA_G703_MAX_ROWS * 100)
  })
})

describe('the workbook formats', () => {
  it('writes money and percents as the sheet does', () => {
    expect(formatAiaMoney(81916.6)).toBe('$81,916.60')
    expect(formatAiaMoney(-500)).toBe('($500.00)')
    expect(formatAiaMoney(0)).toBe('$0.00')
    expect(formatAiaPercent(0.6976375405)).toBe('70%')
  })
})
