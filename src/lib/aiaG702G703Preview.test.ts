import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { AIA_FIELD_DEFS, AIA_G702_SHEET, AIA_G703_SHEET, type AiaFieldKey } from './aiaG702G703Template'
import {
  AIA_TEMPLATE_FROM_PREVIOUS_APPLICATION,
  AIA_TEMPLATE_LESS_PREVIOUS_CERTIFICATES,
  buildAiaPreview,
  formatAiaMoney,
  formatAiaPercent,
} from './aiaG702G703Preview'
import { fillAiaG702G703Workbook } from './fillAiaG702G703Workbook'

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
  })

  it('still reads 0 in the two cells the math uses and the form has no box for', async () => {
    const wb = await loadWorkbook(templateArrayBuffer())
    expect(held(wb, AIA_G703_SHEET, 'E13')).toBe(AIA_TEMPLATE_FROM_PREVIOUS_APPLICATION)
    expect(held(wb, AIA_G702_SHEET, 'H40')).toBe(AIA_TEMPLATE_LESS_PREVIOUS_CERTIFICATES)
  })
})

describe('buildAiaPreview', () => {
  it('agrees with Excel on the job the template was saved from', async () => {
    const wb = await loadWorkbook(templateArrayBuffer())
    const { math } = buildAiaPreview({
      g702_h18_original_contract_sum: 123600,
      g702_c28_retainage_percent: 5,
      g703_d13_scheduled_value: 123600,
      g703_f13_this_period: 68000,
      g703_g13_materials_stored: 18228,
    })
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
      g702_h18_original_contract_sum: 48500,
      g702_c28_retainage_percent: 10,
      g703_d13_scheduled_value: 48500,
      g703_f13_this_period: 19400,
    }
    const preview = buildAiaPreview(typed)
    expect(preview.cells.g702_n5_project).toEqual({ text: 'Water Sample Test', source: 'typed' })
    expect(preview.cells.g702_h18_original_contract_sum).toEqual({ text: '$48,500.00', source: 'typed' })
    expect(preview.cells.g702_n7_project_no).toEqual({ text: '', source: 'blank' })
    expect(preview.cells.g703_g13_materials_stored).toEqual({ text: '', source: 'blank' })
    expect(preview.math.currentPaymentDue).toBe(17460)

    const out = await loadWorkbook(await fillAiaG702G703Workbook(templateArrayBuffer(), typed))
    expect(held(out, AIA_G702_SHEET, 'N5')).toBe('Water Sample Test')
    expect(held(out, AIA_G703_SHEET, 'K2')).toBe('Water Sample Test')
    expect(held(out, AIA_G702_SHEET, 'H18')).toBe(48500)
    expect(held(out, AIA_G702_SHEET, 'N7')).toBeNull()
    expect(held(out, AIA_G703_SHEET, 'G13')).toBeNull()
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
    const { math } = buildAiaPreview({
      g702_h18_original_contract_sum: 50000,
      g702_f50_this_month_change_order_additions: 2500,
      g702_h49_previous_month_change_order_deductions: 500,
      g702_c28_retainage_percent: 10,
      g702_c31_retainage_material_percent: 10,
      g703_d13_scheduled_value: 52000,
      g703_f13_this_period: 20000,
      g703_g13_materials_stored: 1000,
    })
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

  it('has no percent when the scheduled value is zero', () => {
    expect(buildAiaPreview({ g703_d13_scheduled_value: 0 }).math.line.pctComplete).toBeNull()
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
