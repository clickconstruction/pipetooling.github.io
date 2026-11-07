/**
 * The signed hours statement as a PDF with its form (punch list #212, PR 3): the Letter paper `buildHoursStatementHtml`
 * prints, drawn with pdf-lib so it can be a Contract Form — sent by `send-contract-for-signature`, filled and signed on
 * `/contract/accept`, flattened by `accept-contract`, opened through `open-contract-form-pdf`. The builder records a
 * `FormSchema` as it draws: the stated rows the worker types (three blank rows after any the office stated), the
 * printed name, the signature box and the date. So the PDF and the schema are produced together and cannot disagree,
 * as `scripts/forms/author/lib.ts` does for the forms Click authors itself.
 *
 * Since v2.6629 the PDF follows the print's full-width layout (v2.6412) and its charged basis (v2.6446), so the paper a
 * worker signs is the paper the office printed: the facts as one band across the width, the rate stated once in it when
 * it is the same all period (`hoursStatementUniformRate`) and a Rate column only when it changes; the table full width —
 * Day · In – Out · Hours · What they were working on · Amount (a sheet: Day · Line · Hours · Amount) — one line per day,
 * hours to two decimals, a long note on its own line under its day, each week's subtotals, the column header on every
 * page and no row split; *Statement of hours charged* with the Charged band in place of Paid on the charged basis; the
 * attestation and the two signature lines as full-width bands. The HTML and this file read one kernel for every word
 * and number; what each draws is only the shape.
 *
 * pdf-lib is passed in (the `jobContractPdf.ts` precedent): the function imports it from esm.sh, vitest from
 * node_modules. Nothing on the paper says how a row was recorded, by the owner's call of 2026-10-29.
 */
import type { PdfLibLike } from './jobContractPdf.ts'
import type { FormBox, FormPage, FormRect, FormSchema } from './formSchema.ts'
import { HOURS_STATEMENT_NOTE_FITS, HOURS_STATEMENT_NOTE_FITS_WITH_RATE, hoursStatementHours2, hoursStatementMoney, hoursStatementUniformRate, type HoursStatement, type HoursStatementDay } from './hoursStatement.ts'
import { HOURS_STATEMENT_BLANK_STATED_ROWS, STATED_DAY_MAX, STATED_HOURS_MAX, STATED_NOTE_MAX, statedBoxKeys } from './hoursStatementForm.ts'
import { PAY_REPORT_ADDRESS, PAY_REPORT_EIN, PAY_REPORT_EMPLOYER_NAME } from './payReportEmployerHeader.ts'

type FontLike = { widthOfTextAtSize(text: string, size: number): number }
type PageLike = {
  drawText(text: string, opts: { x: number; y: number; size: number; font: FontLike; color?: unknown }): void
  drawLine(opts: { start: { x: number; y: number }; end: { x: number; y: number }; thickness: number; color?: unknown; dashArray?: number[] }): void
  drawRectangle(opts: { x: number; y: number; width: number; height: number; borderColor?: unknown; borderWidth?: number; color?: unknown; borderDashArray?: number[] }): void
}
type DocLike = {
  addPage(size: [number, number]): PageLike
  embedFont(name: string): Promise<FontLike>
  setTitle(t: string): void
  save(): Promise<Uint8Array>
}

/** The facts around the statement, as the HTML print takes them (`HoursStatementHtmlContext`). */
export type HoursStatementPdfContext = {
  statement: HoursStatement
  /** `HS-1042-0007`; a statement is sent only once saved, so it is never null here. */
  recordId: string
  worker: { name: string; standing: string; company?: string | null }
  job: { number: string; name: string; customer: string | null; site: string; isOfficeJob?: boolean }
  approvedBy: string | null
  preparedBy: string
  preparedOn: string
  asOf: string
  company?: { name: string; ein: string | null; address: string }
}

/**
 * The drawn paper, its schema, and the shape it took — the title, the facts in the band and the table's column heads —
 * so a test can read the layout without extracting text from the PDF.
 */
export type HoursStatementPdf = { bytes: Uint8Array; schema: FormSchema; pageCount: number; title: string; facts: Array<[string, string]>; columns: string[] }

export const HS_PDF_PAGE: FormPage = { width: 612, height: 792 }
const PAGE_W = HS_PDF_PAGE.width
const PAGE_H = HS_PDF_PAGE.height
const MARGIN = 42
const CONTENT_W = PAGE_W - MARGIN * 2
const FOOTER_RESERVE = 34
const STATED_ROW_H = 20
/** The print's Date column on the signature lines, 1.6in. */
const SIG_DATE_W = 115

/** The box keys of the signature block. */
export const HS_FORM_KEYS = { printedName: 'printed_name', signature: 'signature', signedOn: 'signed_on' } as const

/** The paper's title by its basis and its pay, as `buildHoursStatementHtml` heads the print. */
export function hoursStatementPaperTitle(s: Pick<HoursStatement, 'basis' | 'charged' | 'withPay' | 'pay'>): string {
  if (s.basis === 'charged' && s.charged != null) return 'Statement of hours charged'
  return s.withPay && s.pay ? 'Statement of hours worked and paid' : 'Statement of hours worked'
}

// Helvetica's WinAnsi encoding: ASCII, Latin-1, and the few typographic marks the kernel's words use.
const SAFE_RE = /[^\x20-\x7E -ÿ–—‘’“”•…€™]/g
/** Text pdf-lib's standard fonts can encode; anything else is dropped rather than throwing mid-draw. */
export function pdfSafeText(s: string): string {
  return (s ?? '').replace(/\s+/g, ' ').replace(SAFE_RE, '')
}

function wrap(text: string, font: FontLike, size: number, width: number): string[] {
  const out: string[] = []
  for (const para of pdfSafeText(text).split('\n')) {
    const words = para.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      out.push('')
      continue
    }
    let line = ''
    for (const w of words) {
      const candidate = line ? `${line} ${w}` : w
      if (font.widthOfTextAtSize(candidate, size) <= width || !line) line = candidate
      else {
        out.push(line)
        line = w
      }
    }
    out.push(line)
  }
  return out
}

type Col = { key: string; label: string; w: number; align?: 'left' | 'right' }

/**
 * Draw the statement and record its form. The stated block, when the statement has one, carries every day already
 * stated as a seeded row and `HOURS_STATEMENT_BLANK_STATED_ROWS` blank rows after them, each cell a text box.
 */
export async function buildHoursStatementPdf(lib: PdfLibLike, ctx: HoursStatementPdfContext): Promise<HoursStatementPdf> {
  const { statement: s, worker, job } = ctx
  const company = ctx.company ?? { name: PAY_REPORT_EMPLOYER_NAME, ein: PAY_REPORT_EIN, address: PAY_REPORT_ADDRESS }
  const chargedPaper = s.basis === 'charged' && s.charged != null
  const chargedPriced = chargedPaper && s.charged != null && s.charged.total != null
  // The money columns: with the pay, or on the charged basis once the days are priced (punch list #251).
  const withPay = (s.withPay && s.kind !== 'schedule') || chargedPriced
  const isSheet = s.kind === 'sheet'
  const title = hoursStatementPaperTitle(s)
  const uniformRate = hoursStatementUniformRate(s)
  const rateCol = withPay && uniformRate == null
  const noteFits = rateCol ? HOURS_STATEMENT_NOTE_FITS_WITH_RATE : HOURS_STATEMENT_NOTE_FITS
  const stamp = `Made by ClickTooling from the clock, the pay reports and the payments as of ${ctx.asOf}. Record ${ctx.recordId}.`

  const doc = (await lib.PDFDocument.create()) as unknown as DocLike
  doc.setTitle(pdfSafeText(`${title} · ${worker.name} · Job ${job.number} · ${s.periodLabel}`))
  const font = await doc.embedFont(lib.StandardFonts.Helvetica)
  const bold = await doc.embedFont(lib.StandardFonts.HelveticaBold)
  const italic = await doc.embedFont(lib.StandardFonts.TimesRomanItalic)
  const ink = lib.rgb(0.07, 0.07, 0.07)
  const muted = lib.rgb(0.33, 0.33, 0.33)
  const rule = lib.rgb(0.75, 0.75, 0.75)
  const shade = lib.rgb(0.95, 0.95, 0.95)
  const white = lib.rgb(1, 1, 1)

  const pages: PageLike[] = []
  const boxes: FormBox[] = []
  let page = doc.addPage([PAGE_W, PAGE_H])
  pages.push(page)
  let y = PAGE_H - MARGIN
  const pageNo = () => pages.length

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H])
    pages.push(page)
    y = PAGE_H - MARGIN
  }
  const ensure = (h: number) => {
    if (y - h < MARGIN + FOOTER_RESERVE) newPage()
  }
  const text = (t: string, size: number, f: FontLike, color: unknown = ink, x = MARGIN, maxW = CONTENT_W, lineGap = 1.35) => {
    for (const line of wrap(t, f, size, maxW)) {
      ensure(size * lineGap)
      if (line) page.drawText(line, { x, y: y - size, size, font: f, color })
      y -= size * lineGap
    }
  }
  const gap = (h: number) => {
    y -= h
  }
  const hr = (color: unknown = rule, thickness = 0.6) => {
    ensure(4)
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness, color })
    y -= 4
  }
  const rightText = (t: string, size: number, f: FontLike, color: unknown, rightX: number, atY: number) => {
    const safe = pdfSafeText(t)
    page.drawText(safe, { x: rightX - f.widthOfTextAtSize(safe, size), y: atY, size, font: f, color })
  }
  /** A band's small uppercase heading (the print's `.band h2`). */
  const bandHeading = (words: string) => {
    ensure(24)
    hr(ink, 0.8)
    gap(3)
    page.drawText(pdfSafeText(words.toUpperCase()), { x: MARGIN, y: y - 8, size: 7.5, font: bold, color: muted })
    y -= 13
  }
  /** A pay or charged line: the label in bold, the rest of the kernel's words after it (the print's `payLine`). */
  const bandLine = (l: { label: string; words: string }) => {
    const rest = l.words.startsWith(l.label) ? l.words.slice(l.label.length).replace(/^ · /, '') : l.words
    const labelW = Math.min(bold.widthOfTextAtSize(pdfSafeText(l.label), 8.5) + 10, CONTENT_W * 0.45)
    const lines = wrap(rest, font, 8.5, CONTENT_W - labelW)
    ensure(Math.max(1, lines.length) * 11.5)
    page.drawText(pdfSafeText(l.label), { x: MARGIN, y: y - 8.5, size: 8.5, font: bold, color: ink })
    lines.forEach((line, i) => page.drawText(line, { x: MARGIN + labelW, y: y - 8.5 - i * 11.5, size: 8.5, font, color: ink }))
    y -= Math.max(1, lines.length) * 11.5
  }

  // ── Letterhead ────────────────────────────────────────────────────────────────
  page.drawText(pdfSafeText(company.name), { x: MARGIN, y: y - 12, size: 12, font: bold, color: ink })
  rightText(`Statement ${ctx.recordId}`, 8, font, muted, PAGE_W - MARGIN, y - 10)
  y -= 16
  if (company.ein) page.drawText(pdfSafeText(`EIN ${company.ein}`), { x: MARGIN, y: y - 8, size: 8, font, color: muted })
  rightText(`Prepared ${ctx.preparedOn} by ${ctx.preparedBy}`, 8, font, muted, PAGE_W - MARGIN, y - 8)
  y -= 11
  page.drawText(pdfSafeText(company.address), { x: MARGIN, y: y - 8, size: 8, font, color: muted })
  rightText(`From the company’s records as of ${ctx.asOf}`, 8, font, muted, PAGE_W - MARGIN, y - 8)
  y -= 14
  hr(ink, 1.5)
  gap(8)

  // ── Title and the facts as one band across the width ─────────────────────────
  text(title, 15, bold)
  gap(4)
  const standing = worker.company ? `${worker.standing}, ${worker.company}` : worker.standing
  const facts: Array<[string, string]> = (
    [
      ['Worker', `${worker.name} (${standing})`],
      ['Period', s.periodLabel],
      ['Rate', uniformRate != null ? `${hoursStatementMoney(uniformRate)} an hour` : ''],
      ['Job', `${job.number} · ${job.name}`],
      ['Customer', job.customer && !job.isOfficeJob ? job.customer : ''],
      ['Approved by', ctx.approvedBy ?? ''],
    ] as Array<[string, string]>
  ).filter((f) => f[1])
  const site: [string, string] = ['Site', `${job.site}${job.isOfficeJob ? ' (the company’s office)' : ''}`]
  const factCols = [CONTENT_W * 0.4, CONTENT_W * 0.33, CONTENT_W * 0.27]
  const factX = (c: number) => MARGIN + factCols.slice(0, c).reduce((a, b) => a + b, 0)
  const factRows = Math.ceil(facts.length / 3) + 1
  ensure(factRows * 13 + 14)
  hr(ink, 0.8)
  gap(3)
  const drawFact = (f: [string, string], x: number, maxW: number) => {
    const label = `${f[0]} · `
    page.drawText(pdfSafeText(label), { x, y: y - 9, size: 9, font, color: muted })
    const lw = font.widthOfTextAtSize(pdfSafeText(label), 9)
    const value = wrap(f[1], bold, 9, maxW - lw - 8)[0] ?? ''
    page.drawText(value, { x: x + lw, y: y - 9, size: 9, font: bold, color: ink })
  }
  for (let i = 0; i < facts.length; i += 3) {
    for (let c = 0; c < 3; c += 1) {
      const f = facts[i + c]
      if (f) drawFact(f, factX(c), factCols[c] ?? 0)
    }
    y -= 13
  }
  drawFact(site, MARGIN, CONTENT_W)
  y -= 13
  gap(2)
  hr(ink, 0.8)
  gap(6)

  // ── The table ─────────────────────────────────────────────────────────────────
  const fixed: Col[] = isSheet
    ? [{ key: 'day', label: 'Day', w: 64 }, { key: 'note', label: 'Line', w: 0 }, { key: 'hours', label: 'Hours', w: 42, align: 'right' }]
    : [{ key: 'day', label: 'Day', w: 64 }, { key: 'io', label: 'In – Out', w: 96 }, { key: 'hours', label: 'Hours', w: 42, align: 'right' }, { key: 'note', label: 'What they were working on', w: 0 }]
  const cols: Col[] = [...fixed, ...(rateCol ? [{ key: 'rate', label: 'Rate', w: 50, align: 'right' } as Col] : []), ...(withPay ? [{ key: 'amount', label: 'Amount', w: 62, align: 'right' } as Col] : [])]
  const flexW = CONTENT_W - cols.reduce((sum, c) => sum + c.w, 0)
  for (const c of cols) if (c.w === 0) c.w = flexW
  const colX = (idx: number) => MARGIN + cols.slice(0, idx).reduce((sum, c) => sum + c.w, 0)
  const colIdx = (key: string) => cols.findIndex((c) => c.key === key)

  const tableSize = 8.5
  const lineH = 10.5
  const drawHeader = () => {
    ensure(14)
    cols.forEach((c, i) => {
      const label = pdfSafeText(c.label.toUpperCase())
      const x = c.align === 'right' ? colX(i) + c.w - font.widthOfTextAtSize(label, 7) - 2 : colX(i) + 2
      page.drawText(label, { x, y: y - 9, size: 7, font: bold, color: muted })
    })
    y -= 12
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.8, color: ink })
    y -= 2
  }
  type RowOpts = { bold?: boolean; shaded?: boolean; italic?: boolean; topRule?: boolean; span?: { from: string; to: string }; noRule?: boolean }
  /** The cells wrapped to their columns and the row's height, so a row and the line under it can be kept together. */
  const measure = (cells: Record<string, string>, opts: RowOpts) => {
    const f = opts.bold ? bold : opts.italic ? italic : font
    const spanFrom = opts.span ? colIdx(opts.span.from) : -1
    const spanTo = opts.span ? colIdx(opts.span.to) : -1
    const widthOf = (i: number) => (i === spanFrom && spanTo > spanFrom ? cols.slice(spanFrom, spanTo + 1).reduce((sum, c) => sum + c.w, 0) : cols[i]?.w ?? 0)
    const wrapped = cols.map((c, i) => (spanFrom >= 0 && i > spanFrom && i <= spanTo ? [] : wrap(cells[c.key] ?? '', f, tableSize, widthOf(i) - 4)))
    const lines = Math.max(1, ...wrapped.map((w) => w.length))
    return { f, wrapped, widthOf, h: lines * lineH + 4 }
  }
  const drawRow = (cells: Record<string, string>, opts: RowOpts, m = measure(cells, opts)) => {
    if (opts.shaded) page.drawRectangle({ x: MARGIN, y: y - m.h, width: CONTENT_W, height: m.h, color: shade })
    if (opts.topRule) page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1.2, color: ink })
    cols.forEach((c, i) => {
      const ls = m.wrapped[i] ?? []
      ls.forEach((line, li) => {
        const ty = y - 2 - (li + 1) * lineH + 2
        const x = c.align === 'right' ? colX(i) + m.widthOf(i) - m.f.widthOfTextAtSize(line, tableSize) - 2 : colX(i) + 2
        page.drawText(line, { x, y: ty, size: tableSize, font: m.f, color: opts.italic ? muted : ink })
      })
    })
    y -= m.h
    if (!opts.noRule) page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.4, color: rule })
  }
  type Block = { cells: Record<string, string>; opts: RowOpts; next?: Block }
  const heightOf = (b: Block): number => measure(b.cells, b.opts).h + (b.next ? heightOf(b.next) : 0)
  /**
   * One row, on a new page with the header when it would not fit: a block's `next` row (a long note's own line) is drawn
   * with it on the same page, and `keepH` is the height of what must follow it on that page (a week heading's first row).
   */
  const row = (b: Block, keepH = 0) => {
    if (y - heightOf(b) - keepH < MARGIN + FOOTER_RESERVE) {
      newPage()
      drawHeader()
    }
    drawRow(b.cells, b.opts)
    if (b.next) drawRow(b.next.cells, b.next.opts)
  }
  const moneyCells = (d: Extract<HoursStatementDay, { pending: false }>): Record<string, string> => {
    const out: Record<string, string> = {}
    if (rateCol) out.rate = d.rate == null ? '' : hoursStatementMoney(d.rate)
    if (withPay) out.amount = d.amount == null ? '' : hoursStatementMoney(d.amount)
    return out
  }
  const lastKey = cols[cols.length - 1]?.key ?? 'note'
  const secondKey = cols[1]?.key ?? 'day'

  drawHeader()
  let rowCount = 0
  for (const g of s.groups) {
    const wk: Record<string, string> = { day: g.label, hours: hoursStatementHours2(g.hours) }
    if (withPay) wk.amount = g.amount == null ? '' : hoursStatementMoney(g.amount)
    const blocks: Block[] = g.days.map((d) => {
      if (d.pending) return { cells: { day: d.dayLabel, [secondKey]: d.words }, opts: { italic: true, span: { from: secondKey, to: lastKey } } }
      const long = d.note.length > noteFits
      const cells: Record<string, string> = { day: d.dayLabel, hours: hoursStatementHours2(d.hours), note: long ? '' : d.note, ...moneyCells(d) }
      if (!isSheet) cells.io = [d.inLabel, d.outLabel].filter((t) => t).join(' – ')
      // A long note: the day keeps its one line and the note takes its own line under it, the two kept together.
      return long ? { cells, opts: { noRule: true }, next: { cells: { [secondKey]: d.note }, opts: { span: { from: secondKey, to: lastKey } } } } : { cells, opts: {} }
    })
    // A week heading never ends a page without its first row under it.
    row({ cells: wk, opts: { bold: true, shaded: true, span: { from: 'day', to: secondKey } } }, blocks[0] ? heightOf(blocks[0]) : 0)
    for (const b of blocks) {
      rowCount += 1
      row(b)
    }
  }
  if (rowCount === 0) row({ cells: { day: 'Nothing recorded on this job for the period.' }, opts: { italic: true, span: { from: 'day', to: lastKey } } })
  const total: Record<string, string> = { day: s.totals.label, hours: hoursStatementHours2(s.totals.hours) }
  if (!isSheet) total.note = s.totals.daysWords
  if (withPay) total.amount = s.totals.amount == null ? '' : hoursStatementMoney(s.totals.amount)
  row({ cells: total, opts: { bold: true, topRule: true, span: { from: 'day', to: secondKey }, noRule: true } })
  gap(10)

  // ── Charged (the charged basis), then Paid ────────────────────────────────────
  if (chargedPaper && s.charged) {
    bandHeading('Charged')
    if (s.charged.lines.length === 0) text('Nothing recorded on this job for the period.', 8.5, italic, muted)
    for (const l of s.charged.lines) bandLine(l)
    gap(3)
    text(s.charged.totalWords, 8.5, bold)
    gap(2)
    text(s.charged.note, 8, font, muted)
    if (s.charged.leftOut.length) text(s.charged.leftOut.join(' '), 8, font, muted)
    gap(8)
  }
  if (s.pay) {
    bandHeading('Paid')
    if (s.pay.lines.length === 0) text('Nothing recorded as paid for this period.', 8.5, italic, muted)
    for (const l of s.pay.lines) bandLine(l)
    gap(3)
    text(s.pay.note, 8, font, muted)
    if (s.pay.lines.some((l) => l.rateSource === 'current')) text('A day no pay report has priced yet is shown at the current wage.', 8, font, muted)
    gap(8)
  }

  // ── The stated block, as boxes the worker fills ───────────────────────────────
  if (s.stated) {
    const seeded = s.stated.rows
    const count = seeded.length + HOURS_STATEMENT_BLANK_STATED_ROWS
    const headWords = wrap(s.stated.words, font, 8.5, CONTENT_W - 16)
    ensure(14 + headWords.length * 11 + 16 + (count + 1) * STATED_ROW_H + 14)
    const top = y
    text(s.stated.heading, 9.5, bold, ink, MARGIN + 8, CONTENT_W - 16)
    for (const line of headWords) {
      page.drawText(line, { x: MARGIN + 8, y: y - 8.5, size: 8.5, font, color: ink })
      y -= 11
    }
    gap(4)
    const scols: Col[] = [{ key: 'day', label: 'Day', w: 78 }, { key: 'hours', label: 'Hours', w: 46 }, { key: 'note', label: 'What they were working on', w: 0 }, { key: 'by', label: 'Stated by', w: 118 }]
    const sInner = CONTENT_W - 16
    const sflex = sInner - scols.reduce((sum, c) => sum + c.w, 0)
    for (const c of scols) if (c.w === 0) c.w = sflex
    const scolX = (idx: number) => MARGIN + 8 + scols.slice(0, idx).reduce((sum, c) => sum + c.w, 0)
    scols.forEach((c, i) => page.drawText(pdfSafeText(c.label.toUpperCase()), { x: scolX(i) + 2, y: y - 8, size: 7, font: bold, color: muted }))
    y -= 11
    page.drawLine({ start: { x: MARGIN + 8, y }, end: { x: PAGE_W - MARGIN - 8, y }, thickness: 0.8, color: ink })
    for (let i = 1; i <= count; i += 1) {
      const seed = seeded[i - 1]
      const rowBottom = y - STATED_ROW_H
      const keys = statedBoxKeys(i)
      const cell = (idx: number): FormRect => ({ x: round2(scolX(idx) + 1), y: round2(rowBottom + 1.5), w: round2((scols[idx]?.w ?? 0) - 2), h: round2(STATED_ROW_H - 3) })
      const order = 100 + i * 10
      boxes.push({ key: keys.day, type: 'text', page: pageNo(), rect: cell(0), order, label: `Day ${i}`, labelEs: `Día ${i}`, help: 'As a date, like 9/15/2025.', helpEs: 'Como fecha, por ejemplo 15/9/2025.', maxLength: STATED_DAY_MAX, fontSize: 9 })
      boxes.push({ key: keys.hours, type: 'text', page: pageNo(), rect: cell(1), order: order + 1, label: `Hours on day ${i}`, labelEs: `Horas del día ${i}`, maxLength: STATED_HOURS_MAX, fontSize: 9, align: 'right' })
      boxes.push({ key: keys.note, type: 'text', page: pageNo(), rect: cell(2), order: order + 2, label: `What you were working on, day ${i}`, labelEs: `En qué trabajaba, día ${i}`, maxLength: STATED_NOTE_MAX, fontSize: 9 })
      if (seed?.statedBy) {
        const by = wrap(seed.statedBy, font, 7.5, (scols[3]?.w ?? 0) - 4)[0] ?? ''
        page.drawText(by, { x: scolX(3) + 2, y: rowBottom + 6, size: 7.5, font, color: muted })
      }
      page.drawLine({ start: { x: MARGIN + 8, y: rowBottom }, end: { x: PAGE_W - MARGIN - 8, y: rowBottom }, thickness: 0.5, color: lib.rgb(0.55, 0.55, 0.55) })
      y = rowBottom
    }
    gap(8)
    page.drawRectangle({ x: MARGIN, y, width: CONTENT_W, height: top - y, borderColor: lib.rgb(0.45, 0.45, 0.45), borderWidth: 1, borderDashArray: [3, 2] })
    gap(10)
  }

  // ── The attestation and the two signature lines, full-width bands kept on one page ──
  const attestLines = wrap(s.attestation, font, 9.5, CONTENT_W)
  ensure(attestLines.length * 13 + 130)
  hr(ink, 0.8)
  gap(4)
  for (const line of attestLines) {
    page.drawText(line, { x: MARGIN, y: y - 9.5, size: 9.5, font, color: ink })
    y -= 13
  }
  gap(34)
  // The worker's line: the signature and the printed name on one rule across the width, the date in the print's 1.6in column.
  const ruleY = y
  const dateX = PAGE_W - MARGIN - SIG_DATE_W
  const lineW = dateX - 24 - MARGIN
  const sigW = Math.round(lineW * 0.6)
  const nameX = MARGIN + sigW + 16
  const nameW = MARGIN + lineW - nameX
  page.drawLine({ start: { x: MARGIN, y: ruleY }, end: { x: MARGIN + lineW, y: ruleY }, thickness: 0.8, color: ink })
  page.drawLine({ start: { x: dateX, y: ruleY }, end: { x: PAGE_W - MARGIN, y: ruleY }, thickness: 0.8, color: ink })
  const sigLabel = worker.company ? `Signature of the worker for ${worker.company} · printed name` : 'Signature of the worker · printed name'
  page.drawText(pdfSafeText(sigLabel), { x: MARGIN, y: ruleY - 10, size: 7.5, font, color: muted })
  page.drawText('Date', { x: dateX, y: ruleY - 10, size: 7.5, font, color: muted })
  boxes.push({ key: HS_FORM_KEYS.signature, type: 'signature', page: pageNo(), rect: { x: MARGIN, y: round2(ruleY + 1), w: sigW, h: 34 }, order: 910, label: 'Your signature', labelEs: 'Su firma', required: true })
  boxes.push({ key: HS_FORM_KEYS.printedName, type: 'text', page: pageNo(), rect: { x: nameX, y: round2(ruleY + 1), w: round2(nameW), h: 16 }, order: 900, label: 'Your name, printed', labelEs: 'Su nombre, en letra de imprenta', required: true, prefill: 'person_name', maxLength: 80, fontSize: 10 })
  boxes.push({ key: HS_FORM_KEYS.signedOn, type: 'date', page: pageNo(), rect: { x: dateX, y: round2(ruleY + 1), w: SIG_DATE_W, h: 16 }, order: 920, label: 'Date', labelEs: 'Fecha', dateMode: 'today', fontSize: 10 })
  y = ruleY - 44
  // The company's line, the same shape: what it was prepared from and by whom, and a Date column.
  const prepY = y
  page.drawLine({ start: { x: MARGIN, y: prepY }, end: { x: MARGIN + lineW, y: prepY }, thickness: 0.6, color: ink })
  page.drawLine({ start: { x: dateX, y: prepY }, end: { x: PAGE_W - MARGIN, y: prepY }, thickness: 0.6, color: ink })
  page.drawText(pdfSafeText(`${s.preparedWords || 'Prepared from the company’s records'} by ${ctx.preparedBy}`), { x: MARGIN, y: prepY - 10, size: 7.5, font, color: muted })
  page.drawText('Date', { x: dateX, y: prepY - 10, size: 7.5, font, color: muted })
  y = prepY - 20

  // ── Footer on every page ──────────────────────────────────────────────────────
  pages.forEach((p, i) => {
    const pn = `Page ${i + 1} of ${pages.length}`
    const pw = font.widthOfTextAtSize(pn, 7)
    p.drawText(pn, { x: PAGE_W - MARGIN - pw, y: MARGIN - 16, size: 7, font, color: muted })
    const line = wrap(stamp, font, 6.5, CONTENT_W - pw - 12)[0] ?? ''
    p.drawRectangle({ x: MARGIN, y: MARGIN - 20, width: CONTENT_W - pw - 8, height: 10, color: white })
    p.drawText(line, { x: MARGIN, y: MARGIN - 16, size: 6.5, font, color: muted })
  })

  const bytes = await doc.save()
  const schema: FormSchema = { version: 1, pages: pages.map(() => ({ ...HS_PDF_PAGE })), boxes, groups: [], oneOfs: [] }
  return { bytes, schema, pageCount: pages.length, title, facts: [...facts, site], columns: cols.map((c) => c.label) }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
