import type { Cell, CellValue, Workbook } from 'exceljs'
import { type AiaPreviewMath, buildAiaPreview } from './aiaG702G703Preview'
import { AIA_G703_FIRST_ROW, AIA_G703_MAX_ROWS, type PayApplicationLine, printRowsOf } from './aiaPayApplicationLines'
import {
  AIA_FIELD_DEFS,
  AIA_G702_SHEET,
  AIA_G703_G702_MIRROR_CELLS,
  AIA_G703_SHEET,
  type AiaFieldValues,
  aiaContractorBlockRows,
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

/**
 * The template prints PROJECT: in a column ten characters wide with nothing under it (its own job's
 * name sat in the application number box). Move the label left to H5, where four empty columns run
 * to the application block, and dress H6:K8 like the owner's boxes so the project's name and
 * address have a home.
 */
function placeProjectBlock(wb: Workbook): void {
  const ws = wb.getWorksheet(AIA_G702_SHEET)
  if (!ws) return
  const oldLabel = ws.getCell('J5')
  const label = ws.getCell('H5')
  label.value = 'PROJECT:'
  label.style = { ...oldLabel.style }
  oldLabel.value = null
  for (const row of [6, 7, 8]) {
    const like = ws.getCell(`D${row}`).style
    for (const col of ['H', 'I', 'J', 'K']) ws.getCell(`${col}${row}`).style = { ...like }
  }
}

/**
 * The contractor block (v2.4506): the name, the address a line per row as Settings holds it, then
 * the license line. Three rows sit where the template has them (D10:D12). A fourth has no row
 * below (13 is the ruled line), so the block starts one row up, beside FROM, dressed like row 10.
 */
function placeContractorBlock(wb: Workbook, values: AiaFieldValues): void {
  const ws = wb.getWorksheet(AIA_G702_SHEET)
  if (!ws) return
  const name = String(values.g702_d10_contractor_name ?? '').trim()
  const under = aiaContractorBlockRows(String(values.g702_d11_contractor_address ?? ''), String(values.g702_d12_contractor_license ?? ''))
  const rows = [name, ...under]
  const firstRow = rows.length > 3 ? 9 : 10
  if (firstRow === 9) for (const col of ['D', 'E', 'F']) ws.getCell(`${col}9`).style = { ...ws.getCell(`${col}10`).style }
  for (let row = firstRow; row <= 12; row++) {
    const text = rows[row - firstRow] ?? ''
    ws.getCell(`D${row}`).value = text === '' ? null : text
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
  // The item rows: a printed row's own results, and nothing (0, no percent) on the rows left empty.
  for (let i = 0; i < AIA_G703_MAX_ROWS; i++) {
    const row = AIA_G703_FIRST_ROW + i
    const r = math.rows[i]
    stamp(AIA_G703_SHEET, `H${row}`, r ? r.totalToDate : 0)
    stamp(AIA_G703_SHEET, `I${row}`, r ? r.pctComplete : null)
    stamp(AIA_G703_SHEET, `J${row}`, r ? r.balanceToFinish : 0)
    stamp(AIA_G703_SHEET, `K${row}`, r ? r.retainage : 0)
  }
  // Row 49 sums each column.
  const { line } = math
  stamp(AIA_G703_SHEET, 'D49', line.scheduledValue)
  stamp(AIA_G703_SHEET, 'E49', line.fromPrevious)
  stamp(AIA_G703_SHEET, 'F49', line.thisPeriod)
  stamp(AIA_G703_SHEET, 'G49', line.materialsStored)
  stamp(AIA_G703_SHEET, 'H49', line.totalToDate)
  stamp(AIA_G703_SHEET, 'I49', line.pctComplete)
  stamp(AIA_G703_SHEET, 'J49', line.balanceToFinish)
  stamp(AIA_G703_SHEET, 'K49', line.retainage)
  wb.calcProperties.fullCalcOnLoad = true
}

/**
 * The application has more printed rows than the sheet has item rows. Nothing is written: a
 * download that silently dropped lines would ask the GC for the wrong amount.
 */
export class AiaTooManyRows extends Error {
  constructor(public readonly rows: number) {
    super(`The continuation sheet holds ${AIA_G703_MAX_ROWS} rows and this application has ${rows}. Group some lines to generate it.`)
    this.name = 'AiaTooManyRows'
  }
}

export type AiaFillOptions = { splitLaborMaterial?: boolean }

/**
 * The application's lines onto the G703's item rows (13–46): description, scheduled value, work
 * from previous applications, work this period, material stored. Every item row is written, a
 * row with no line as blank: the template's own first row was saved from a real job.
 */
function writeLines(wb: Workbook, lines: ReadonlyArray<PayApplicationLine>, split: boolean): void {
  const ws = wb.getWorksheet(AIA_G703_SHEET)
  if (!ws) return
  const rows = printRowsOf(lines, split)
  if (rows.length > AIA_G703_MAX_ROWS) throw new AiaTooManyRows(rows.length)
  for (let i = 0; i < AIA_G703_MAX_ROWS; i++) {
    const n = AIA_G703_FIRST_ROW + i
    const r = rows[i]
    ws.getCell(`C${n}`).value = r && r.label.trim() ? r.label : null
    ws.getCell(`D${n}`).value = r ? r.scheduledValue : 0
    ws.getCell(`E${n}`).value = r ? r.fromPrevious : 0
    ws.getCell(`F${n}`).value = r ? r.thisPeriod : 0
    ws.getCell(`G${n}`).value = r ? r.stored : 0
  }
}

/**
 * Write the form and the lines onto the bundled workbook. A box the form leaves empty is cleared:
 * the template was saved from a real job, and none of that job's values may reach another job's
 * download.
 */
export async function fillAiaG702G703Workbook(
  templateArrayBuffer: ArrayBuffer,
  values: AiaFieldValues,
  lines: ReadonlyArray<PayApplicationLine> = [],
  options: AiaFillOptions = {},
): Promise<ArrayBuffer> {
  const ExcelJS = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(templateArrayBuffer)
  applyG702LayoutTweaks(wb)
  placeProjectBlock(wb)

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

  placeContractorBlock(wb, values)
  writeLines(wb, lines, options.splitLaborMaterial === true)
  materializeG703Mirrors(wb)
  stampFormulaResults(wb, buildAiaPreview(values, lines, options).math)

  const wbout = (await wb.xlsx.writeBuffer()) as unknown as ArrayBuffer | Uint8Array
  if (wbout instanceof ArrayBuffer) return wbout.slice(0)
  const ab = new ArrayBuffer(wbout.byteLength)
  new Uint8Array(ab).set(wbout)
  return ab
}

export async function fetchAndFillAiaTemplate(
  templateUrl: string,
  values: AiaFieldValues,
  lines: ReadonlyArray<PayApplicationLine> = [],
  options: AiaFillOptions = {},
): Promise<ArrayBuffer> {
  const res = await fetch(templateUrl)
  if (!res.ok) {
    throw new Error(`Could not load AIA template (${res.status})`)
  }
  const ab = await res.arrayBuffer()
  return fillAiaG702G703Workbook(ab, values, lines, options)
}
