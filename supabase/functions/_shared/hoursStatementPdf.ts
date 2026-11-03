/**
 * The signed hours statement as a PDF with its form (punch list #212, PR 3): the Letter paper `buildHoursStatementHtml`
 * prints, drawn with pdf-lib so it can be a Contract Form — sent by `send-contract-for-signature`, filled and signed on
 * `/contract/accept`, flattened by `accept-contract`, opened through `open-contract-form-pdf`. The builder records a
 * `FormSchema` as it draws: the stated rows the worker types (three blank rows after any the office stated), the
 * printed name, the signature box and the date. So the PDF and the schema are produced together and cannot disagree,
 * as `scripts/forms/author/lib.ts` does for the forms Click authors itself.
 *
 * pdf-lib is passed in (the `jobContractPdf.ts` precedent): the function imports it from esm.sh, vitest from
 * node_modules. Nothing on the paper says how a row was recorded, by the owner's call of 2026-10-29.
 */
import type { PdfLibLike } from './jobContractPdf.ts'
import type { FormBox, FormPage, FormRect, FormSchema } from './formSchema.ts'
import { hoursStatementHours, hoursStatementMoney, type HoursStatement } from './hoursStatement.ts'
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

export type HoursStatementPdf = { bytes: Uint8Array; schema: FormSchema; pageCount: number }

export const HS_PDF_PAGE: FormPage = { width: 612, height: 792 }
const PAGE_W = HS_PDF_PAGE.width
const PAGE_H = HS_PDF_PAGE.height
const MARGIN = 42
const CONTENT_W = PAGE_W - MARGIN * 2
const FOOTER_RESERVE = 34
const STATED_ROW_H = 20

/** The box keys of the signature block. */
export const HS_FORM_KEYS = { printedName: 'printed_name', signature: 'signature', signedOn: 'signed_on' } as const

// Helvetica's WinAnsi encoding: ASCII, Latin-1, and the few typographic marks the kernel's words use.
const SAFE_RE = /[^\x20-\x7E -ÿ–—‘’“”•…€™]/g
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
  const withPay = s.withPay && s.kind !== 'schedule'
  const isSheet = s.kind === 'sheet'
  const title = s.withPay && s.pay ? 'Statement of hours worked and paid' : 'Statement of hours worked'
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

  // ── Title and the facts ───────────────────────────────────────────────────────
  text(title, 15, bold)
  gap(4)
  const standing = worker.company ? `${worker.standing}, ${worker.company}` : worker.standing
  const meta: Array<[string, string]> = [
    ['Worker', `${worker.name} (${standing})`],
    ['Period', s.periodLabel],
    ['Job', `${job.number} · ${job.name}`],
    ['Customer', job.customer && !job.isOfficeJob ? job.customer : ''],
    ['Site', `${job.site}${job.isOfficeJob ? ' (the company’s office)' : ''}`],
    ['Approved by', ctx.approvedBy ?? ''],
  ]
  const colW = CONTENT_W / 2
  for (let i = 0; i < meta.length; i += 2) {
    ensure(13)
    for (let c = 0; c < 2; c += 1) {
      const m = meta[i + c]
      if (!m || !m[1]) continue
      const x = MARGIN + c * colW
      const label = `${m[0]} · `
      page.drawText(pdfSafeText(label), { x, y: y - 9, size: 9, font, color: muted })
      const lw = font.widthOfTextAtSize(pdfSafeText(label), 9)
      const value = wrap(m[1], bold, 9, colW - lw - 8)[0] ?? ''
      page.drawText(value, { x: x + lw, y: y - 9, size: 9, font: bold, color: ink })
    }
    y -= 13
  }
  gap(6)

  // ── The table ─────────────────────────────────────────────────────────────────
  const fixed: Col[] = isSheet
    ? [{ key: 'sheet', label: 'Sheet', w: 72 }, { key: 'day', label: 'Day', w: 64 }, { key: 'note', label: 'Line', w: 0 }, { key: 'hours', label: 'Hours', w: 38, align: 'right' }]
    : [{ key: 'day', label: 'Day', w: 64 }, { key: 'in', label: 'In', w: 50 }, { key: 'out', label: 'Out', w: 50 }, { key: 'hours', label: 'Hours', w: 38, align: 'right' }, { key: 'note', label: 'What they were working on', w: 0 }]
  const cols: Col[] = withPay ? [...fixed, { key: 'rate', label: 'Rate', w: 48, align: 'right' }, { key: 'amount', label: 'Amount', w: 62, align: 'right' }] : fixed
  const flexW = CONTENT_W - cols.reduce((sum, c) => sum + c.w, 0)
  for (const c of cols) if (c.w === 0) c.w = flexW
  const colX = (idx: number) => MARGIN + cols.slice(0, idx).reduce((sum, c) => sum + c.w, 0)

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
  const row = (cells: Record<string, string>, opts: { bold?: boolean; shaded?: boolean; italic?: boolean; topRule?: boolean } = {}) => {
    const f = opts.bold ? bold : opts.italic ? italic : font
    const wrapped = cols.map((c) => wrap(cells[c.key] ?? '', f, tableSize, c.w - 4))
    const lines = Math.max(1, ...wrapped.map((w) => w.length))
    const h = lines * lineH + 4
    if (y - h < MARGIN + FOOTER_RESERVE) {
      newPage()
      drawHeader()
    }
    if (opts.shaded) page.drawRectangle({ x: MARGIN, y: y - h, width: CONTENT_W, height: h, color: shade })
    if (opts.topRule) page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1.2, color: ink })
    cols.forEach((c, i) => {
      const ls = wrapped[i] ?? []
      ls.forEach((line, li) => {
        const ty = y - 2 - (li + 1) * lineH + 2
        const x = c.align === 'right' ? colX(i) + c.w - f.widthOfTextAtSize(line, tableSize) - 2 : colX(i) + 2
        page.drawText(line, { x, y: ty, size: tableSize, font: f, color: opts.italic ? muted : ink })
      })
    })
    y -= h
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.4, color: rule })
  }

  drawHeader()
  let rowCount = 0
  for (const g of s.groups) {
    const cells: Record<string, string> = { hours: hoursStatementHours(g.hours) }
    cells[isSheet ? 'sheet' : 'day'] = g.label
    if (withPay && g.amount != null) cells.amount = hoursStatementMoney(g.amount)
    row(cells, { bold: true, shaded: true })
    for (const d of g.days) {
      rowCount += 1
      if (d.pending) {
        row({ day: d.dayLabel, note: d.words }, { italic: true })
        continue
      }
      const c: Record<string, string> = { day: d.dayLabel, hours: hoursStatementHours(d.hours), note: d.note }
      if (isSheet) c.sheet = g.label.split(' · ')[0] ?? g.label
      else {
        c.in = d.inLabel ?? ''
        c.out = d.outLabel ?? ''
      }
      if (withPay) {
        c.rate = d.rate == null ? '' : hoursStatementMoney(d.rate)
        c.amount = d.amount == null ? '' : hoursStatementMoney(d.amount)
      }
      row(c)
    }
  }
  if (rowCount === 0) row({ note: 'Nothing recorded on this job for the period.' }, { italic: true })
  const total: Record<string, string> = { hours: hoursStatementHours(s.totals.hours) }
  total[isSheet ? 'sheet' : 'day'] = s.totals.label
  if (!isSheet) total.note = s.totals.daysWords
  if (withPay && s.totals.amount != null) total.amount = hoursStatementMoney(s.totals.amount)
  row(total, { bold: true, topRule: true })
  gap(10)

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

  // ── Paid ──────────────────────────────────────────────────────────────────────
  if (s.pay) {
    ensure(40)
    text('Paid', 9.5, bold)
    gap(2)
    if (s.pay.lines.length === 0) text('Nothing recorded as paid for this period.', 8.5, italic, muted)
    for (const l of s.pay.lines) text(l.words, 8.5, font, ink, MARGIN, CONTENT_W, 1.3)
    gap(2)
    text(s.pay.note, 8, font, muted)
    if (s.pay.lines.some((l) => l.rateSource === 'current')) text('A day no pay report has priced yet is shown at the current wage.', 8, font, muted)
    gap(8)
  }

  // ── The attestation and the signature block, kept on one page ─────────────────
  const attestLines = wrap(s.attestation, font, 9.5, CONTENT_W)
  ensure(attestLines.length * 13 + 118)
  hr(ink, 0.8)
  gap(4)
  for (const line of attestLines) {
    page.drawText(line, { x: MARGIN, y: y - 9.5, size: 9.5, font, color: ink })
    y -= 13
  }
  gap(34)
  const ruleY = y
  const sigW = 260
  const nameX = MARGIN + sigW + 20
  const nameW = 150
  const dateX = nameX + nameW + 20
  const dateW = PAGE_W - MARGIN - dateX
  page.drawLine({ start: { x: MARGIN, y: ruleY }, end: { x: MARGIN + sigW, y: ruleY }, thickness: 0.8, color: ink })
  page.drawLine({ start: { x: nameX, y: ruleY }, end: { x: nameX + nameW, y: ruleY }, thickness: 0.8, color: ink })
  page.drawLine({ start: { x: dateX, y: ruleY }, end: { x: PAGE_W - MARGIN, y: ruleY }, thickness: 0.8, color: ink })
  const sigLabel = worker.company ? `Signature of the worker for ${worker.company}` : 'Signature of the worker'
  page.drawText(pdfSafeText(sigLabel), { x: MARGIN, y: ruleY - 10, size: 7.5, font, color: muted })
  page.drawText('Printed name', { x: nameX, y: ruleY - 10, size: 7.5, font, color: muted })
  page.drawText('Date', { x: dateX, y: ruleY - 10, size: 7.5, font, color: muted })
  boxes.push({ key: HS_FORM_KEYS.signature, type: 'signature', page: pageNo(), rect: { x: MARGIN, y: round2(ruleY + 1), w: sigW, h: 34 }, order: 910, label: 'Your signature', labelEs: 'Su firma', required: true })
  boxes.push({ key: HS_FORM_KEYS.printedName, type: 'text', page: pageNo(), rect: { x: nameX, y: round2(ruleY + 1), w: nameW, h: 16 }, order: 900, label: 'Your name, printed', labelEs: 'Su nombre, en letra de imprenta', required: true, prefill: 'person_name', maxLength: 80, fontSize: 10 })
  boxes.push({ key: HS_FORM_KEYS.signedOn, type: 'date', page: pageNo(), rect: { x: dateX, y: round2(ruleY + 1), w: round2(dateW), h: 16 }, order: 920, label: 'Date', labelEs: 'Fecha', dateMode: 'today', fontSize: 10 })
  y = ruleY - 40
  const prepY = y
  page.drawLine({ start: { x: MARGIN, y: prepY }, end: { x: MARGIN + sigW + 20 + nameW, y: prepY }, thickness: 0.6, color: ink })
  page.drawText(pdfSafeText(`Prepared from the company’s records by ${ctx.preparedBy}, ${ctx.preparedOn}`), { x: MARGIN, y: prepY - 10, size: 7.5, font, color: muted })
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
  return { bytes, schema, pageCount: pages.length }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
