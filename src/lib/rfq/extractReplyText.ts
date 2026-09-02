/**
 * File-reply extraction (RFQ Round 2 Rung E, v2.2651 — "RFQ Desk" canvas
 * artboard 9). Turns a vendor's .xlsx / .csv / .pdf reply into plain text
 * that flows through the SAME pipeline as a paste: the text lands in the
 * Plug-in modal's paste box (visible, editable provenance) and the existing
 * `parseVendorReply` does the matching.
 *
 * The extended-price trap (the review rule): vendor sheets carry unit AND
 * extended price columns, and the parser prefers the LAST number on a line —
 * so `flattenSheetRows` is header-aware and DROPS columns whose header reads
 * ext / total / amount before the text ever reaches the parser.
 *
 * Parsers load lazily (exceljs is already a dependency; pdf.js becomes its
 * own chunk like jsPDF) so none of this weighs the Bids chunk.
 */

export const MAX_SHEET_ROWS = 500

/** Column headers that mean "not the unit price" — dropped before flattening. */
const EXT_HEADER_RE = /\b(ext(ended)?|total|amount|line\s*total|net\s*amount)\b/i

type Cell = string | number | null | undefined

/** True when a row looks like the header row: mostly words, few numbers. */
function looksLikeHeader(row: ReadonlyArray<Cell>): boolean {
  const filled = row.filter((c) => c != null && String(c).trim() !== '')
  if (filled.length < 2) return false
  const wordy = filled.filter((c) => typeof c === 'string' && !/^\s*[\d$.,%-]+\s*$/.test(c))
  return wordy.length >= Math.ceil(filled.length * 0.6)
}

/**
 * Flatten sheet rows to parser-ready lines. Finds the header row among the
 * first 5 rows, drops ext/total/amount columns everywhere, joins cells with
 * two spaces, skips empty rows, caps at {@link MAX_SHEET_ROWS}.
 */
export function flattenSheetRows(rows: ReadonlyArray<ReadonlyArray<Cell>>): { lines: string[]; droppedColumns: string[] } {
  let dropIdx = new Set<number>()
  const droppedColumns: string[] = []
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const row = rows[i] ?? []
    if (!looksLikeHeader(row)) continue
    row.forEach((c, idx) => {
      if (typeof c === 'string' && EXT_HEADER_RE.test(c)) {
        dropIdx.add(idx)
        droppedColumns.push(c.trim())
      }
    })
    break
  }
  const lines: string[] = []
  for (const row of rows.slice(0, MAX_SHEET_ROWS)) {
    const cells = row
      .map((c, idx) => (dropIdx.has(idx) ? '' : c == null ? '' : String(c).trim()))
      .filter((c) => c !== '')
    if (cells.length === 0) continue
    lines.push(cells.join('  '))
  }
  return { lines, droppedColumns }
}

/** Minimal CSV split honoring double-quoted cells. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else inQuotes = false
      } else cell += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',' || ch === '\t' || ch === ';') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      cell = ''
      rows.push(row)
      row = []
    } else cell += ch
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

export type ExtractResult =
  | { ok: true; text: string; meta: string }
  | { ok: false; error: string }

/** Dispatch by extension; every path ends as plain text for the paste box. */
export async function extractReplyText(file: File): Promise<ExtractResult> {
  const name = file.name.toLowerCase()
  try {
    if (name.endsWith('.csv') || name.endsWith('.txt')) {
      const text = await file.text()
      const { lines, droppedColumns } = flattenSheetRows(parseCsv(text))
      if (lines.length === 0) return { ok: false, error: 'That file came out empty.' }
      return { ok: true, text: lines.join('\n'), meta: metaLine(file.name, lines.length, droppedColumns) }
    }
    if (name.endsWith('.xlsx')) {
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(await file.arrayBuffer())
      const ws = wb.worksheets[0]
      if (!ws) return { ok: false, error: 'No sheets in that workbook.' }
      const rows: Cell[][] = []
      ws.eachRow({ includeEmpty: false }, (r) => {
        const vals = (r.values as Cell[]).slice(1) // exceljs is 1-indexed
        rows.push(vals.map((v) => (typeof v === 'object' && v != null ? String((v as { text?: unknown }).text ?? '') : (v as Cell))))
      })
      const { lines, droppedColumns } = flattenSheetRows(rows)
      if (lines.length === 0) return { ok: false, error: 'The first sheet came out empty.' }
      return { ok: true, text: lines.join('\n'), meta: metaLine(`${file.name} — first sheet`, lines.length, droppedColumns) }
    }
    if (name.endsWith('.pdf')) {
      const pdfjs = await import('pdfjs-dist')
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
      const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
      const pageLines: string[] = []
      for (let p = 1; p <= Math.min(doc.numPages, 20); p++) {
        const page = await doc.getPage(p)
        const content = await page.getTextContent()
        // Group items into lines by their y position (PDF text has no line breaks).
        const byY = new Map<number, Array<{ x: number; str: string }>>()
        for (const item of content.items) {
          if (!('str' in item) || !item.str.trim()) continue
          const y = Math.round((item.transform?.[5] ?? 0) / 2) * 2
          ;(byY.get(y) ?? byY.set(y, []).get(y)!).push({ x: item.transform?.[4] ?? 0, str: item.str })
        }
        const ys = [...byY.keys()].sort((a, b) => b - a)
        for (const y of ys) {
          const line = byY.get(y)!.sort((a, b) => a.x - b.x).map((i) => i.str).join(' ').trim()
          if (line) pageLines.push(line)
        }
      }
      const text = pageLines.join('\n').trim()
      if (text.replace(/\s/g, '').length < 20) {
        return { ok: false, error: 'This PDF has no readable text (probably a scan) — copy/paste it for now.' }
      }
      return { ok: true, text, meta: metaLine(file.name, pageLines.length, []) }
    }
    return { ok: false, error: 'Drop a .xlsx, .csv, or .pdf — or just paste the text.' }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? `Couldn’t read that file: ${err.message}` : 'Couldn’t read that file.' }
  }
}

function metaLine(source: string, lineCount: number, dropped: string[]): string {
  const droppedNote = dropped.length > 0 ? ` · dropped ${dropped.join('/')} column${dropped.length === 1 ? '' : 's'} (unit prices only)` : ''
  return `[file: ${source} — ${lineCount} lines${droppedNote}]`
}
