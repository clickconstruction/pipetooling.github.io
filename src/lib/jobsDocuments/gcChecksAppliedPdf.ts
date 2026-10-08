/**
 * "Where the checks went" — the sheet as a PDF (v2.4913, punch list #55 piece 3). The sheet used
 * to print from a blank window, so the browser wrote "about:blank" in the page footer unless
 * Headers and footers was unticked. A PDF carries no browser footer, as the unpaid invoices print
 * does (`gcUnpaidInvoicePrintIo.ts`). The cells are `gcChecksSheetModel`'s; this file only draws
 * them: tables with their header row again on each new page, a row kept whole on one page, and
 * the sheet's name with the page count at the foot of every page.
 */
import type { GcChecksReport } from '../jobs/gcChecksApplied'
import { loadJsPDF } from '../loadJsPDF'
import { gcChecksSheetModel, type SheetCell, type SheetRun, type SheetTable, type SheetTone } from './gcChecksAppliedReport'

type Doc = import('jspdf').jsPDF
type Rgb = [number, number, number]

const PAGE_W = 215.9
const PAGE_H = 279.4
const MARGIN = 14
const WIDTH = PAGE_W - MARGIN * 2
/** Below this y (mm) a new page starts; the page footer sits under it. */
const MAX_Y = PAGE_H - 16
const FOOTER_Y = PAGE_H - 8

const BODY_PT = 8.5
const SMALL_PT = 7.25
const PT_MM = 0.3528
const lineHeight = (pt: number) => pt * PT_MM * 1.32
const PAD_X = 1.6
const PAD_Y = 1.3
const INDENT = 3
/** Room between a line's words and its amount at the cell's right edge. */
const AMOUNT_GAP = 2.5
const GROUP_GAP = 1.3

const INK: Rgb = [31, 41, 55]
const COLORS: Record<SheetTone, Rgb> = { ink: INK, bold: INK, muted: [75, 85, 99], green: [21, 128, 61], red: [185, 28, 28], amber: [180, 83, 9] }
const BORDER: Rgb = [204, 204, 204]
const HEAD_FILL: Rgb = [245, 245, 245]
const TOTAL_FILL: Rgb = [249, 250, 251]
const SUMMARY_FILL: Rgb = [250, 250, 247]

function setTone(doc: Doc, tone: SheetTone, pt: number) {
  doc.setFont('helvetica', tone === 'ink' || tone === 'muted' ? 'normal' : 'bold')
  doc.setFontSize(pt)
  doc.setTextColor(...COLORS[tone])
}

/** A run of words placed on a line, `x` from the line's start. */
type Piece = { text: string; tone: SheetTone; x: number }

/** Words in several tones wrapped to a width; a word wider than the width is broken. */
function wrapRuns(doc: Doc, runs: SheetRun[], width: number, pt: number): Piece[][] {
  const lines: Piece[][] = [[]]
  let x = 0
  let space = ''
  const place = (word: string, tone: SheetTone) => {
    const line = lines[lines.length - 1]!
    const last = line[line.length - 1]
    if (last && last.tone === tone) last.text += space + word
    else line.push({ text: word, tone, x })
    x += doc.getTextWidth(word)
    space = ''
  }
  for (const run of runs) {
    const tone = run.tone ?? 'ink'
    setTone(doc, tone, pt)
    for (const token of run.text.split(/(\s+)/)) {
      if (!token) continue
      if (/^\s+$/.test(token)) {
        if (x > 0) {
          x += doc.getTextWidth(token)
          space += token
        }
        continue
      }
      let word = token
      while (word) {
        const w = doc.getTextWidth(word)
        if (x + w <= width) {
          place(word, tone)
          break
        }
        if (x > 0) {
          lines.push([])
          x = 0
          space = ''
          continue
        }
        // Longer than the whole width: as many characters as fit, the rest on the next line.
        let n = word.length - 1
        while (n > 1 && doc.getTextWidth(word.slice(0, n)) > width) n--
        place(word.slice(0, n), tone)
        lines.push([])
        x = 0
        word = word.slice(n)
      }
    }
  }
  return lines
}

/** One drawn line of a cell: its pieces, the amount on its first line, where it sits from the cell's top. */
type VisualLine = { pieces: Piece[]; amount?: string; pt: number; indent: number; top: number; height: number }
type LaidCell = { cell: SheetCell; x: number; w: number; lines: VisualLine[]; height: number }
type LaidRow = { cells: LaidCell[]; height: number }

function layoutCell(doc: Doc, cell: SheetCell, x: number, w: number): LaidCell {
  const lines: VisualLine[] = []
  let top = 0
  for (const line of cell.lines) {
    const pt = line.small ? SMALL_PT : BODY_PT
    const indent = line.indent ? INDENT : 0
    setTone(doc, 'ink', pt)
    const amountW = line.amount ? doc.getTextWidth(line.amount) + AMOUNT_GAP : 0
    if (line.gapBefore && lines.length > 0) top += GROUP_GAP
    const wrapped = wrapRuns(doc, line.runs, Math.max(4, w - PAD_X * 2 - indent - amountW), pt)
    wrapped.forEach((pieces, i) => {
      lines.push({ pieces, ...(i === 0 && line.amount ? { amount: line.amount } : {}), pt, indent, top, height: lineHeight(pt) })
      top += lineHeight(pt)
    })
  }
  return { cell, x, w, lines, height: Math.max(top, lineHeight(BODY_PT)) + PAD_Y * 2 }
}

function layoutRow(doc: Doc, widths: number[], cells: SheetCell[]): LaidRow {
  const laid: LaidCell[] = []
  let col = 0
  let x = MARGIN
  for (const cell of cells) {
    const span = cell.span ?? 1
    const w = widths.slice(col, col + span).reduce((t, f) => t + f, 0) * WIDTH
    laid.push(layoutCell(doc, cell, x, w))
    x += w
    col += span
  }
  return { cells: laid, height: Math.max(...laid.map((c) => c.height)) }
}

/** The width a line's pieces take, for a right-aligned cell. */
function piecesWidth(doc: Doc, pieces: Piece[], pt: number): number {
  const last = pieces[pieces.length - 1]
  if (!last) return 0
  setTone(doc, last.tone, pt)
  return last.x + doc.getTextWidth(last.text)
}

function drawRow(doc: Doc, row: LaidRow, y: number, fill: Rgb | null) {
  for (const c of row.cells) {
    if (fill) {
      doc.setFillColor(...fill)
      doc.rect(c.x, y, c.w, row.height, 'F')
    }
    for (const l of c.lines) {
      const baseline = y + PAD_Y + l.top + l.height * 0.76
      const start = c.cell.align === 'right' ? c.x + c.w - PAD_X - piecesWidth(doc, l.pieces, l.pt) : c.x + PAD_X + l.indent
      for (const p of l.pieces) {
        setTone(doc, p.tone, l.pt)
        doc.text(p.text, start + p.x, baseline)
      }
      if (l.amount) {
        setTone(doc, 'ink', l.pt)
        doc.text(l.amount, c.x + c.w - PAD_X, baseline, { align: 'right' })
      }
    }
    doc.setDrawColor(...BORDER)
    doc.setLineWidth(0.2)
    doc.rect(c.x, y, c.w, row.height, 'S')
  }
}

/** The lines of a row that fit in `room`, and the rest moved up to start a new page. */
function splitRow(row: LaidRow, room: number): [LaidRow, LaidRow] {
  const cut = room - PAD_Y * 2
  const later = row.cells.flatMap((c) => c.lines.filter((l) => l.top + l.height > cut))
  const shift = later.length > 0 ? Math.min(...later.map((l) => l.top)) : 0
  const now = { cells: row.cells.map((c) => ({ ...c, lines: c.lines.filter((l) => l.top + l.height <= cut) })), height: room }
  const restCells = row.cells.map((c) => {
    const lines = c.lines.filter((l) => l.top + l.height > cut).map((l) => ({ ...l, top: l.top - shift }))
    const bottom = lines.reduce((t, l) => Math.max(t, l.top + l.height), 0)
    return { ...c, lines, height: Math.max(bottom, lineHeight(BODY_PT)) + PAD_Y * 2 }
  })
  return [now, { cells: restCells, height: Math.max(...restCells.map((c) => c.height)) }]
}

export async function gcChecksSheetPdfBlob(gcName: string, report: GcChecksReport, opts: { asOfYmd: string }): Promise<Blob> {
  const m = gcChecksSheetModel(gcName, report, opts)
  const JsPDF = await loadJsPDF()
  const doc = new JsPDF({ unit: 'mm', format: 'letter' }) as Doc
  let y = MARGIN
  const newPage = () => {
    doc.addPage()
    y = MARGIN
  }
  const para = (text: string, o: { tone?: SheetTone; pt: number; after: number }) => {
    const lh = lineHeight(o.pt)
    for (const pieces of wrapRuns(doc, [{ text, tone: o.tone ?? 'ink' }], WIDTH, o.pt)) {
      if (y + lh > MAX_Y) newPage()
      for (const p of pieces) {
        setTone(doc, p.tone, o.pt)
        doc.text(p.text, MARGIN + p.x, y + lh * 0.76)
      }
      y += lh
    }
    y += o.after
  }
  const paraHeight = (text: string, pt: number) => wrapRuns(doc, [{ text }], WIDTH, pt).length * lineHeight(pt)

  /** A heading is never the last thing on a page: it moves with its note, the header row and the first row. */
  const keepWith = (needed: number) => {
    if (y + needed > MAX_Y) newPage()
  }

  const table = (t: SheetTable) => {
    const headRow = layoutRow(doc, t.widths, t.head)
    const drawHead = () => {
      drawRow(doc, headRow, y, HEAD_FILL)
      y += headRow.height
    }
    drawHead()
    const rows = [...t.rows.map((cells) => ({ cells, fill: null })), { cells: t.total, fill: TOTAL_FILL }]
    for (const r of rows) {
      let laid = layoutRow(doc, t.widths, r.cells)
      if (y + laid.height > MAX_Y && laid.height <= MAX_Y - MARGIN - headRow.height) {
        newPage()
        drawHead()
      }
      // Taller than a whole page: it runs on, its header row drawn again over the rest.
      while (y + laid.height > MAX_Y) {
        const room = MAX_Y - y
        if (room < lineHeight(BODY_PT) * 2 + PAD_Y * 2) {
          newPage()
          drawHead()
          continue
        }
        const [now, rest] = splitRow(laid, room)
        drawRow(doc, now, y, r.fill)
        newPage()
        drawHead()
        laid = rest
      }
      drawRow(doc, laid, y, r.fill)
      y += laid.height
    }
  }
  const firstRowHeight = (t: SheetTable) => layoutRow(doc, t.widths, t.head).height + Math.min(layoutRow(doc, t.widths, t.rows[0] ?? t.total).height, 40)

  // Title, the period, the summary box
  para(m.title, { tone: 'bold', pt: 15, after: 0.8 })
  para(m.subtitle, { tone: 'muted', pt: 9.5, after: 3 })
  {
    const pt = 9.5
    const lh = lineHeight(pt)
    const gap = 7
    const placed: Array<{ pieces: Piece[]; x: number; line: number }> = []
    let line = 0
    let x = 0
    for (const item of m.summary) {
      const wrapped = wrapRuns(doc, item, WIDTH - 2 * 2.5, pt)
      const w = piecesWidth(doc, wrapped[0] ?? [], pt)
      if (wrapped.length > 1 || (x > 0 && x + w > WIDTH - 2 * 2.5)) {
        if (x > 0) line++
        x = 0
      }
      wrapped.forEach((pieces, i) => placed.push({ pieces, x: i === 0 ? x : 0, line: line + i }))
      line += wrapped.length - 1
      x = wrapped.length > 1 ? WIDTH : x + w + gap
    }
    const boxH = (line + 1) * lh + 2 * 2.2
    doc.setFillColor(...SUMMARY_FILL)
    doc.setDrawColor(...BORDER)
    doc.setLineWidth(0.2)
    doc.rect(MARGIN, y, WIDTH, boxH, 'FD')
    for (const p of placed) {
      for (const piece of p.pieces) {
        setTone(doc, piece.tone, pt)
        doc.text(piece.text, MARGIN + 2.5 + p.x + piece.x, y + 2.2 + p.line * lh + lh * 0.76)
      }
    }
    y += boxH + 2
  }

  // Each payment
  keepWith(lineHeight(11.5) + 3 + paraHeight(m.checks.note, BODY_PT) + firstRowHeight(m.checks.table))
  y += 3
  para(m.checks.heading, { tone: 'bold', pt: 11.5, after: 0.6 })
  para(m.checks.note, { tone: 'muted', pt: BODY_PT, after: 1.2 })
  table(m.checks.table)
  if (m.checks.earlier) {
    y += 1
    para(m.checks.earlier, { tone: 'muted', pt: BODY_PT, after: 0 })
  }

  // Each job
  const firstJobs = m.jobs.open ?? m.jobs.paid
  keepWith(lineHeight(11.5) + 4 + paraHeight(m.jobs.note, BODY_PT) + (firstJobs ? lineHeight(9.5) + 2 + firstRowHeight(firstJobs) : 0))
  y += 4
  para(m.jobs.heading, { tone: 'bold', pt: 11.5, after: 0.6 })
  para(m.jobs.note, { tone: 'muted', pt: BODY_PT, after: 0.6 })
  for (const [label, t] of [['Open', m.jobs.open], ['Paid in full', m.jobs.paid]] as const) {
    if (!t) continue
    keepWith(lineHeight(9.5) + 2 + firstRowHeight(t))
    y += 1.6
    para(label, { tone: 'muted', pt: 9.5, after: 0.4 })
    table(t)
  }

  // The foot
  keepWith(4 + paraHeight(m.foot, BODY_PT))
  y += 3
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.2)
  doc.line(MARGIN, y, MARGIN + WIDTH, y)
  y += 1.5
  para(m.foot, { tone: 'muted', pt: BODY_PT, after: 0 })

  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    setTone(doc, 'muted', SMALL_PT)
    doc.text(doc.splitTextToSize(m.title, WIDTH - 30)[0] as string, MARGIN, FOOTER_Y)
    doc.text(`Page ${p} of ${pages}`, MARGIN + WIDTH, FOOTER_Y, { align: 'right' })
  }
  return doc.output('blob')
}
