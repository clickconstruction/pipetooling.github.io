/**
 * GC mode, the real build, PR 1b: the sheet index as one table, moved word for word from the GC
 * mode prototype (branch spike/gc-mode, `gcNewProject.ts`; the owner, 2026-10-04: "build 1, 4 and 5
 * for the sheet index"). Rows from a plan PDF, a paste or typing; the disciplines a sheet can be
 * put in; a sheet's number and title read from its page's title block. pdf.js itself stays in the
 * screen: the kernel takes its text items. The plan: to-dos/gc-mode/NEW_PROJECT_REAL_BUILD.md on
 * branch spike/gc-mode.
 */
import type { PlanSheet } from './types'
import { TRADE_TEMPLATES, sheetDiscipline, sheetIndexInText, tradeOrder } from './plans'

/** The disciplines a sheet can be put in when its number's letters do not say. */
export const SHEET_DISCIPLINES = ['General', 'Civil', 'Landscape', 'Architectural', 'Interiors', 'Structural', 'Fire protection', 'Plumbing', 'Mechanical', 'Electrical', 'Technology']

/** A sheet's discipline: the office's pick, else read from its number's letters. */
export function disciplineOf(sheet: PlanSheet): string {
  return sheet.discipline ?? sheetDiscipline(sheet.id)
}

/**
 * The trades the sheets suggest, with each sheet the office put in a discipline its letters do not
 * say added to that discipline's trades. `guesses` is what `tradesForPlans` or `tradesForSheets` said.
 */
export function withPickedDisciplines<T extends { trade: string; from: string[] }>(guesses: T[], sheets: PlanSheet[], blank: (trade: string) => T): T[] {
  const picked = sheets.filter((s) => s.discipline && s.discipline !== sheetDiscipline(s.id))
  if (picked.length === 0) return guesses
  const out = new Map(guesses.map((g) => [g.trade, { ...g, from: [...g.from] }]))
  for (const s of picked) {
    for (const t of TRADE_TEMPLATES) {
      if (!t.disciplines.includes(s.discipline ?? '')) continue
      const g = out.get(t.trade) ?? blank(t.trade)
      if (!g.from.includes(s.id)) g.from = [...g.from, s.id]
      out.set(t.trade, g)
    }
  }
  return [...out.values()].sort((a, b) => tradeOrder(a.trade) - tradeOrder(b.trade))
}

/** One row of the sheet table while the office works on it. */
export interface SheetIndexRow {
  key: string
  id: string
  title: string
  discipline?: string
  page?: number
  from: 'pdf' | 'paste' | 'typed'
  /** Why the row could not be read, for a page of a PDF: shown until the office fixes it. */
  problem?: string
}

/** What is wrong with each row, by key: no number yet, or a number another row has. */
export function rowProblems(rows: SheetIndexRow[]): Record<string, string> {
  const out: Record<string, string> = {}
  const seen = new Map<string, string>()
  for (const r of rows) {
    const bare = r.id.toUpperCase().replace(/[-.\s]/g, '')
    if (bare === '') out[r.key] = r.problem ?? 'Give it a sheet number.'
    else if (seen.has(bare)) out[r.key] = `Sheet ${r.id.trim()} is listed twice.`
    else seen.set(bare, r.key)
  }
  return out
}

/** The sheets the table holds: each row with a number, the first of any repeated number. */
export function sheetsOfRows(rows: SheetIndexRow[]): PlanSheet[] {
  const problems = rowProblems(rows)
  return rows
    .filter((r) => !problems[r.key])
    .map((r) => ({
      id: r.id.trim().toUpperCase(),
      title: r.title.trim(),
      ...(r.discipline && r.discipline !== sheetDiscipline(r.id) ? { discipline: r.discipline } : {}),
      ...(r.page ? { page: r.page } : {}),
    }))
}

/** The number after this one, for + Add sheet: A-101 gives A-102, A1.01 gives A1.02, E-9 gives E-10. */
export function nextSheetNumber(id: string): string {
  const m = id.trim().toUpperCase().match(/^(.*?)(\d+)[A-Z]?$/)
  if (!m) return ''
  const digits = m[2] ?? ''
  const next = String(Number(digits) + 1).padStart(digits.length, '0')
  return `${m[1] ?? ''}${next}`
}

/** One pasted line, read or skipped with why. */
export interface PastedLine {
  line: string
  sheet: PlanSheet | null
  why: string | null
}

const SHEET_NUMBER_AT_END = /^(.*?[A-Za-z].*?)[\s.\-–—:]+([A-Za-z]{1,2}(?:-\d{1,3}(?:\.\d{1,3})?|-?\d\.\d{2}|\d{3})[A-Za-z]?)\s*$/

/**
 * A pasted sheet list read line by line (any layout: tabs, dot leaders, dashes, capitals, the
 * number before the title or after it). Each line is read, or skipped with why, so nothing goes
 * missing unsaid. `already` holds the numbers the table has, so a repeat says so.
 */
export function readSheetLines(text: string, already: string[] = []): PastedLine[] {
  const bare = (x: string) => x.toUpperCase().replace(/[-.\s]/g, '')
  const seen = new Set(already.map(bare))
  const out: PastedLine[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\t/g, '  ').trim()
    if (line === '') continue
    if (!/\d/.test(line)) {
      out.push({ line, sheet: null, why: 'A heading, with no sheet number.' })
      continue
    }
    // A list number or a bullet in front, a "Sheet" word, and a date or a dot leader after the title are not part of it.
    const plain = line
      .replace(/^(?:\d{1,3}[.)]\s+|\d{1,3}\s+(?=[A-Za-z]{1,2}[-.\s]?\d)|[-•*·]\s+)/, '')
      .replace(/^sheet\s+(?:no\.?\s*)?/i, '')
      .replace(/\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s*$/, '')
    let sheet = sheetIndexInText(plain).sheets[0] ?? null
    if (!sheet) {
      const flipped = plain.match(SHEET_NUMBER_AT_END)
      if (flipped?.[1] && flipped[2]) sheet = sheetIndexInText(`${flipped[2]}  ${flipped[1].replace(/[\s.\-–—:]+$/, '')}`).sheets[0] ?? null
    }
    if (sheet) sheet = { ...sheet, title: sheet.title.replace(/\s*\.{3,}.*$/, '').trim() }
    if (!sheet) {
      out.push({ line, sheet: null, why: 'No sheet number at the start or the end of the line.' })
      continue
    }
    if (seen.has(bare(sheet.id))) {
      out.push({ line, sheet: null, why: `Sheet ${sheet.id} is already in the list.` })
      continue
    }
    seen.add(bare(sheet.id))
    out.push({ line, sheet, why: null })
  }
  return out
}

/** One piece of text on a PDF page: where it sits (from the bottom-left, in points) and how big it is. */
export interface PdfTextItem {
  str: string
  x: number
  y: number
  size: number
}

/** A page's text with the pieces of one line of words joined ("FIRST" and "FLOOR PLAN" read as one title). */
function textRuns(items: PdfTextItem[]): PdfTextItem[] {
  const pieces = items.map((i) => ({ ...i, str: i.str.replace(/\s+/g, ' ') })).filter((i) => i.str.trim() !== '')
  pieces.sort((a, b) => b.y - a.y || a.x - b.x)
  const runs: (PdfTextItem & { end: number })[] = []
  for (const p of pieces) {
    const last = runs[runs.length - 1]
    const width = p.str.length * p.size * 0.5
    if (last && Math.abs(last.y - p.y) < p.size * 0.3 && Math.abs(last.size - p.size) < 0.5 && p.x - last.end < p.size * 1.2 && p.x >= last.x) {
      last.str = `${last.str}${/\s$/.test(last.str) || /^\s/.test(p.str) ? '' : ' '}${p.str}`
      last.end = p.x + width
    } else {
      runs.push({ ...p, end: p.x + width })
    }
  }
  return runs.map(({ end: _end, ...r }) => ({ ...r, str: r.str.trim() }))
}

const LONE_SHEET_NUMBER = /^[A-Za-z]{1,2}(?:-\d{1,3}(?:\.\d{1,3})?|-?\d\.\d{2}|\d{3})[A-Za-z]?$/
const BLOCK_LABEL = /^(sheet(\s*(title|no\.?|number|name))?|title|drawing( title)?|project|issued?|date|scale|drawn( by)?|checked( by)?|revisions?|job( no\.?)?)\s*:?$/i

/**
 * A sheet's number and title read from its page's title block. The number is the biggest lone sheet
 * number in the bottom-right of the page (anywhere, if the corner has none). The title is the text
 * under a "Sheet title" label, else the nearest text above the number that is not a label. Null:
 * no sheet number on the page, so the office types it.
 */
export function readTitleBlock(items: PdfTextItem[], width: number, height: number): PlanSheet | null {
  const text = textRuns(items)
  const numbers = text.filter((i) => LONE_SHEET_NUMBER.test(i.str))
  if (numbers.length === 0) return null
  const inCorner = (i: PdfTextItem) => i.x > width * 0.55 && i.y < height * 0.5
  const pool = numbers.some(inCorner) ? numbers.filter(inCorner) : numbers
  const number = [...pool].sort((a, b) => b.size - a.size || a.y - b.y)[0]
  if (!number) return null
  const words = text.filter((i) => i !== number && /[A-Za-z]{2}/.test(i.str) && !BLOCK_LABEL.test(i.str) && !LONE_SHEET_NUMBER.test(i.str))
  const label = text.find((i) => /^(sheet\s*title|drawing\s*title|title)\s*:?$/i.test(i.str))
  const below = label ? words.filter((i) => i.y < label.y && Math.abs(i.x - label.x) < width * 0.25).sort((a, b) => b.y - a.y)[0] : undefined
  const above = words.filter((i) => i.y > number.y && Math.abs(i.x - number.x) < width * 0.3).sort((a, b) => a.y - b.y)[0]
  // A title under its label may run onto the lines below it, in the same size of type.
  const lines = below ? [below] : above ? [above] : []
  for (let last = below; last; ) {
    const from: PdfTextItem = last
    const next: PdfTextItem | undefined = words
      .filter((i) => i.y < from.y && from.y - i.y < from.size * 1.6 && Math.abs(i.size - from.size) < 0.5 && Math.abs(i.x - from.x) < from.size * 2)
      .sort((a, b) => b.y - a.y)[0]
    if (next) lines.push(next)
    last = next
  }
  const title = lines.map((i) => i.str).join(' ')
  return sheetIndexInText(`${number.str}  ${title}`).sheets[0] ?? { id: number.str.toUpperCase(), title }
}
