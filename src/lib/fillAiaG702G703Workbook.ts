import type { Cell, Workbook } from 'exceljs'
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

/** Apply user values onto the Mission Hills template; leaves other cells (formulas, layout) unchanged. */
export async function fillAiaG702G703Workbook(
  templateArrayBuffer: ArrayBuffer,
  values: AiaFieldValues,
): Promise<ArrayBuffer> {
  const ExcelJS = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(templateArrayBuffer)
  applyG702LayoutTweaks(wb)

  for (const def of AIA_FIELD_DEFS) {
    const raw = values[def.key]
    if (raw === undefined || raw === '') continue

    const ws = wb.getWorksheet(def.sheetName)
    if (!ws) continue

    const cell = ws.getCell(def.cellRef)
    if (def.kind === 'number' || def.kind === 'percent') {
      const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, ''))
      if (!Number.isFinite(n)) continue
      cell.value = def.kind === 'percent' ? n / 100 : n
    } else {
      cell.value = String(raw)
    }
  }

  materializeG703Mirrors(wb)
  materializeG703FormulaCells(wb)

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
