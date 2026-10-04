import type { Cell, CellValue, Workbook } from 'exceljs'
import { type AiaPreviewMath, buildAiaPreview } from './aiaG702G703Preview'
import {
  AIA_FIELD_DEFS,
  AIA_G702_SHEET,
  AIA_G703_G702_MIRROR_CELLS,
  AIA_G703_MATERIALIZE_IF_FORMULA_REFS,
  AIA_G703_SHEET,
  type AiaFieldValues,
} from './aiaG702G703Template'

function cellHasFormula(cell: Cell): boolean {
  const f = (cell as { formula?: unknown }).formula
  return typeof f === 'string' && f.length > 0
}

/** Normalize ExcelJS cell payload to a primitive we can assign without leaving formula + NaN on write. */
function toWritableValueFromCell(cell: Cell): string | number | Date | boolean {
  const v = cell.value as unknown
  if (v == null) {
    const t = typeof cell.text === 'string' ? cell.text.trim() : ''
    return t
  }
  if (typeof v === 'number') {
    return Number.isFinite(v) ? v : ''
  }
  if (typeof v === 'boolean' || typeof v === 'string') {
    return v
  }
  if (v instanceof Date) {
    return v
  }
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    if ('result' in o) {
      const r = o.result
      if (typeof r === 'number' && Number.isFinite(r)) return r
      if (typeof r === 'string') return r
      if (typeof r === 'boolean') return r
      if (r instanceof Date) return r
    }
    if ('richText' in o && typeof cell.text === 'string') {
      return cell.text
    }
    if ('text' in o && typeof o.text === 'string') {
      return o.text
    }
    const t = typeof cell.text === 'string' ? cell.text.trim() : ''
    if (t) return t
  }
  return ''
}

/** G702 (`Page 1 G702`) row heights in points applied on every export. */
const G702_ROW_HEIGHTS_PT: readonly { row: number; heightPt: number }[] = [
  { row: 1, heightPt: 15 },
  { row: 15, heightPt: 15 },
  { row: 32, heightPt: 15 },
  { row: 44, heightPt: 13 },
]

function applyG702LayoutTweaks(wb: Workbook): void {
  const ws = wb.getWorksheet(AIA_G702_SHEET)
  if (!ws) return
  for (const { row, heightPt } of G702_ROW_HEIGHTS_PT) {
    ws.getRow(row).height = heightPt
  }
}

function materializeG703Mirrors(wb: Workbook): void {
  const g703 = wb.getWorksheet(AIA_G703_SHEET)
  const g702 = wb.getWorksheet(AIA_G702_SHEET)
  if (!g703 || !g702) return

  for (const spec of AIA_G703_G702_MIRROR_CELLS) {
    const dest = g703.getCell(spec.destRef)
    if (!cellHasFormula(dest)) continue

    if (spec.kind === 'self_formula_result') {
      dest.value = toWritableValueFromCell(dest)
      continue
    }

    const src = g702.getCell(spec.sourceRef)
    dest.value = toWritableValueFromCell(src)
  }
}

function materializeG703FormulaCells(wb: Workbook): void {
  const g703 = wb.getWorksheet(AIA_G703_SHEET)
  if (!g703) return
  for (const ref of AIA_G703_MATERIALIZE_IF_FORMULA_REFS) {
    const cell = g703.getCell(ref)
    if (!cellHasFormula(cell)) continue
    cell.value = toWritableValueFromCell(cell)
  }
}

/** G703 header boxes that are formulas onto the G702 page: left empty they keep the formula, and `materializeG703Mirrors` copies the G702 box. */
const G703_FOLLOWS_G702_REFS: ReadonlySet<string> = new Set(
  AIA_G703_G702_MIRROR_CELLS.filter((m) => m.kind === 'g702_cell').map((m) => m.destRef),
)

/**
 * The workbook's formula cells carry the result Excel cached when the template was saved, and a
 * viewer that does not recalculate (a phone's mail preview, Quick Look) shows that number. Put
 * this application's own result beside each formula so every viewer reads the same sheet.
 */
function stampFormulaResults(wb: Workbook, math: AiaPreviewMath): void {
  const stamp = (sheetName: string, ref: string, result: number | null) => {
    const cell = wb.getWorksheet(sheetName)?.getCell(ref)
    if (!cell) return
    const v = cell.value as unknown
    if (!v || typeof v !== 'object' || (!('formula' in v) && !('sharedFormula' in v))) return
    cell.value = { ...(v as object), result: result ?? { error: '#DIV/0!' } } as CellValue
  }
  const g702: Record<string, number> = {
    H20: math.netChangeByChangeOrders,
    H22: math.contractSumToDate,
    H24: math.totalCompletedAndStored,
    F28: math.retainageOfCompletedWork,
    F31: math.retainageOfStoredMaterial,
    H34: math.totalRetainage,
    H36: math.totalEarnedLessRetainage,
    M41: math.currentPaymentDue,
    H42: math.currentPaymentDue,
    F45: math.balanceToFinish,
    F51: math.changeOrders.additions,
    G51: 0,
    H51: math.changeOrders.deductions,
    H52: math.changeOrders.net,
  }
  for (const [ref, n] of Object.entries(g702)) stamp(AIA_G702_SHEET, ref, n)
  const { line } = math
  // Row 13 is the one line the form fills; row 49 sums the column, and every other row is 0.
  for (const row of [13, 49]) {
    if (row === 49) {
      stamp(AIA_G703_SHEET, 'D49', line.scheduledValue)
      stamp(AIA_G703_SHEET, 'E49', line.fromPrevious)
      stamp(AIA_G703_SHEET, 'F49', line.thisPeriod)
      stamp(AIA_G703_SHEET, 'G49', line.materialsStored)
    }
    stamp(AIA_G703_SHEET, `H${row}`, line.totalToDate)
    stamp(AIA_G703_SHEET, `I${row}`, line.pctComplete)
    stamp(AIA_G703_SHEET, `J${row}`, line.balanceToFinish)
    stamp(AIA_G703_SHEET, `K${row}`, line.retainage)
  }
  wb.calcProperties.fullCalcOnLoad = true
}

/**
 * Write the form onto the bundled workbook. A box the form leaves empty is cleared: the template
 * was saved from a real job, and none of that job's values may reach another job's download.
 */
export async function fillAiaG702G703Workbook(
  templateArrayBuffer: ArrayBuffer,
  values: AiaFieldValues,
): Promise<ArrayBuffer> {
  const ExcelJS = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(templateArrayBuffer)
  applyG702LayoutTweaks(wb)

  for (const def of AIA_FIELD_DEFS) {
    const ws = wb.getWorksheet(def.sheetName)
    if (!ws) continue
    const cell = ws.getCell(def.cellRef)

    const raw = values[def.key]
    if (raw === undefined || raw === '') {
      if (!(def.sheetName === AIA_G703_SHEET && G703_FOLLOWS_G702_REFS.has(def.cellRef))) cell.value = null
      continue
    }

    if (def.kind === 'number' || def.kind === 'percent') {
      const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, ''))
      cell.value = !Number.isFinite(n) ? null : def.kind === 'percent' ? n / 100 : n
    } else {
      cell.value = String(raw)
    }
  }

  materializeG703Mirrors(wb)
  materializeG703FormulaCells(wb)
  stampFormulaResults(wb, buildAiaPreview(values).math)

  const wbout = (await wb.xlsx.writeBuffer()) as unknown as ArrayBuffer | Uint8Array
  if (wbout instanceof ArrayBuffer) return wbout.slice(0)
  const ab = new ArrayBuffer(wbout.byteLength)
  new Uint8Array(ab).set(wbout)
  return ab
}

export async function fetchAndFillAiaTemplate(templateUrl: string, values: AiaFieldValues): Promise<ArrayBuffer> {
  const res = await fetch(templateUrl)
  if (!res.ok) {
    throw new Error(`Could not load AIA template (${res.status})`)
  }
  const ab = await res.arrayBuffer()
  return fillAiaG702G703Workbook(ab, values)
}
