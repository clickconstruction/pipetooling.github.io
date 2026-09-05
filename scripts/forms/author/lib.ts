/**
 * Authoring helpers for Click's own forms (Contract Forms PR 10). A small
 * page model on top of pdf-lib that draws a Letter page — letterhead, title,
 * wrapped paragraphs, labelled boxes, signature lines — and records every box
 * it draws into a FormSchema, so the PDF and the schema can never disagree.
 *
 *   npm run forms:author            # writes docs/forms/authored/*.pdf + *.schema.json
 *
 * Coordinates are PDF points, origin bottom-left, like the rest of the kernel.
 */
import { writeFileSync } from 'node:fs'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { FormBox, FormSchema } from '../../../supabase/functions/_shared/formSchema'

export const PAGE = { width: 612, height: 792 } as const
export const MARGIN = 54
export const INK = rgb(0.086, 0.157, 0.235) // #16283c
export const MUTED = rgb(0.353, 0.42, 0.494) // #5a6b7e
export const HAIR = rgb(0.6, 0.6, 0.6)

export class AuthoredPage {
  readonly boxes: FormBox[] = []
  private order = 0
  y: number
  private groups: FormSchema['groups'] = []
  private oneOfs: FormSchema['oneOfs'] = []

  constructor(
    readonly doc: PDFDocument,
    readonly page: PDFPage,
    readonly pageNo: number,
    readonly fonts: { body: PDFFont; bold: PDFFont },
  ) {
    this.y = PAGE.height - MARGIN
  }

  nextOrder(): number {
    this.order += 10
    return this.order
  }

  /** Company letterhead: wordmark, tagline, a rule. */
  letterhead(company: string, tagline: string, rightLines: string[] = []) {
    this.page.drawText(company, { x: MARGIN, y: this.y - 18, size: 18, font: this.fonts.bold, color: INK })
    this.page.drawText(tagline.toUpperCase(), { x: MARGIN, y: this.y - 31, size: 7, font: this.fonts.body, color: MUTED })
    let ry = this.y - 12
    for (const line of rightLines) {
      const w = this.fonts.body.widthOfTextAtSize(line, 8)
      this.page.drawText(line, { x: PAGE.width - MARGIN - w, y: ry, size: 8, font: this.fonts.body, color: MUTED })
      ry -= 10
    }
    this.y -= 40
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE.width - MARGIN, y: this.y }, thickness: 1.5, color: INK })
    this.y -= 18
  }

  title(text: string, size = 15) {
    this.page.drawText(text, { x: MARGIN, y: this.y - size, size, font: this.fonts.bold, color: INK })
    this.y -= size + 10
  }

  subtitle(text: string) {
    this.page.drawText(text, { x: MARGIN, y: this.y - 9, size: 9, font: this.fonts.body, color: MUTED })
    this.y -= 18
  }

  /** Wrapped paragraph. Returns nothing; advances y. `bold` sets the face. */
  paragraph(text: string, opts: { size?: number; bold?: boolean; gapAfter?: number; indent?: number } = {}) {
    const size = opts.size ?? 9.5
    const font = opts.bold ? this.fonts.bold : this.fonts.body
    const maxW = PAGE.width - MARGIN * 2 - (opts.indent ?? 0)
    for (const line of wrap(text, font, size, maxW)) {
      this.y -= size * 1.35
      this.page.drawText(line, { x: MARGIN + (opts.indent ?? 0), y: this.y, size, font, color: INK })
    }
    this.y -= opts.gapAfter ?? 6
  }

  /**
   * A row of labelled fill-in boxes. Each cell gets a label above, a box below
   * (drawn as a bottom rule), and a FormBox in the schema. Widths are fractions.
   */
  fieldRow(cells: Array<{ box: Omit<FormBox, 'page' | 'rect' | 'order'>; label: string; frac: number; height?: number }>, opts: { gapAfter?: number } = {}) {
    const totalW = PAGE.width - MARGIN * 2
    const gap = 10
    const h = Math.max(...cells.map((c) => c.height ?? 16))
    let x = MARGIN
    this.y -= 9
    const labelY = this.y
    this.y -= h + 2
    for (const c of cells) {
      const w = totalW * c.frac - gap * (1 - c.frac)
      this.page.drawText(c.label, { x, y: labelY, size: 7.5, font: this.fonts.body, color: MUTED })
      this.page.drawLine({ start: { x, y: this.y }, end: { x: x + w, y: this.y }, thickness: 0.6, color: HAIR })
      this.boxes.push({ ...c.box, page: this.pageNo, rect: { x: r2(x), y: r2(this.y + 1), w: r2(w), h }, order: this.nextOrder() })
      x += w + gap
    }
    this.y -= opts.gapAfter ?? 10
  }

  /** Inline checkboxes on one line: "☐ Checking   ☐ Savings", each a schema checkbox in `group`. */
  checkRow(lead: string, items: Array<{ key: string; label: string; labelEs?: string; sample?: string; party?: FormBox['party'] }>, group: string, groupLabel: string, required: boolean, opts: { exactlyOne?: boolean } = {}) {
    this.y -= 14
    let x = MARGIN
    if (lead) {
      this.page.drawText(lead, { x, y: this.y, size: 9.5, font: this.fonts.body, color: INK })
      x += this.fonts.body.widthOfTextAtSize(lead, 9.5) + 8
    }
    for (const it of items) {
      this.page.drawRectangle({ x, y: this.y - 1.5, width: 10, height: 10, borderColor: INK, borderWidth: 0.8 })
      this.boxes.push({ key: it.key, type: 'checkbox', page: this.pageNo, rect: { x: r2(x), y: r2(this.y - 1.5), w: 10, h: 10 }, order: this.nextOrder(), label: it.label, ...(it.labelEs ? { labelEs: it.labelEs } : {}), group, ...(it.sample ? { sample: it.sample } : {}), ...(it.party ? { party: it.party } : {}) })
      this.page.drawText(it.label, { x: x + 14, y: this.y, size: 9.5, font: this.fonts.body, color: INK })
      x += 14 + this.fonts.body.widthOfTextAtSize(it.label, 9.5) + 18
    }
    if (!this.groups.some((g) => g.key === group)) this.groups.push({ key: group, label: groupLabel, exactlyOne: opts.exactlyOne ?? true, required })
    this.y -= 8
  }

  /** Signature block: signature box + date box (+ optional printed name / title boxes) with rules. */
  signatureBlock(keys: { signature: string; date: string; printedName?: string; title?: string }, labels: { signature: string; date: string; printedName?: string; title?: string }, party?: FormBox['party'], labelsEs?: Partial<typeof labels>) {
    const totalW = PAGE.width - MARGIN * 2
    const sigW = totalW * 0.62
    const dateW = totalW * 0.34
    this.y -= 34
    const lineY = this.y
    this.page.drawLine({ start: { x: MARGIN, y: lineY }, end: { x: MARGIN + sigW, y: lineY }, thickness: 0.8, color: INK })
    this.page.drawLine({ start: { x: PAGE.width - MARGIN - dateW, y: lineY }, end: { x: PAGE.width - MARGIN, y: lineY }, thickness: 0.8, color: INK })
    this.page.drawText(labels.signature, { x: MARGIN, y: lineY - 10, size: 7.5, font: this.fonts.body, color: MUTED })
    this.page.drawText(labels.date, { x: PAGE.width - MARGIN - dateW, y: lineY - 10, size: 7.5, font: this.fonts.body, color: MUTED })
    this.boxes.push({ key: keys.signature, type: 'signature', page: this.pageNo, rect: { x: r2(MARGIN), y: r2(lineY + 2), w: r2(sigW), h: 22 }, order: this.nextOrder(), label: labels.signature, ...(labelsEs?.signature ? { labelEs: labelsEs.signature } : {}), ...(party ? { party } : {}) })
    this.boxes.push({ key: keys.date, type: 'date', page: this.pageNo, rect: { x: r2(PAGE.width - MARGIN - dateW), y: r2(lineY + 2), w: r2(dateW), h: 16 }, order: this.nextOrder(), label: labels.date, dateMode: 'today', ...(labelsEs?.date ? { labelEs: labelsEs.date } : {}), ...(party ? { party } : {}) })
    this.y -= 16
    if (keys.printedName && labels.printedName) {
      this.y -= 22
      const ly = this.y
      this.page.drawLine({ start: { x: MARGIN, y: ly }, end: { x: MARGIN + sigW, y: ly }, thickness: 0.6, color: HAIR })
      this.page.drawText(labels.printedName, { x: MARGIN, y: ly - 10, size: 7.5, font: this.fonts.body, color: MUTED })
      this.boxes.push({ key: keys.printedName, type: 'text', page: this.pageNo, rect: { x: r2(MARGIN), y: r2(ly + 2), w: r2(sigW), h: 16 }, order: this.nextOrder(), label: labels.printedName, ...(labelsEs?.printedName ? { labelEs: labelsEs.printedName } : {}), ...(party ? { party } : {}) })
      if (keys.title && labels.title) {
        this.page.drawLine({ start: { x: PAGE.width - MARGIN - dateW, y: ly }, end: { x: PAGE.width - MARGIN, y: ly }, thickness: 0.6, color: HAIR })
        this.page.drawText(labels.title, { x: PAGE.width - MARGIN - dateW, y: ly - 10, size: 7.5, font: this.fonts.body, color: MUTED })
        this.boxes.push({ key: keys.title, type: 'text', page: this.pageNo, rect: { x: r2(PAGE.width - MARGIN - dateW), y: r2(ly + 2), w: r2(dateW), h: 16 }, order: this.nextOrder(), label: labels.title, ...(labelsEs?.title ? { labelEs: labelsEs.title } : {}), ...(party ? { party } : {}) })
      }
      this.y -= 16
    }
  }

  footer(text: string) {
    this.page.drawText(text, { x: MARGIN, y: 30, size: 7, font: this.fonts.body, color: MUTED })
  }

  schema(pages: number): FormSchema {
    return { version: 1, pages: Array.from({ length: pages }, () => ({ width: PAGE.width, height: PAGE.height })), boxes: this.boxes, groups: this.groups, oneOfs: this.oneOfs }
  }
}

export function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean)
    let line = ''
    for (const w of words) {
      const candidate = line ? `${line} ${w}` : w
      if (font.widthOfTextAtSize(candidate, size) <= maxW) line = candidate
      else {
        if (line) out.push(line)
        line = w
      }
    }
    out.push(line)
  }
  return out
}

export async function newAuthoredDoc(): Promise<{ doc: PDFDocument; fonts: { body: PDFFont; bold: PDFFont }; addPage: (n: number) => AuthoredPage }> {
  const doc = await PDFDocument.create()
  const body = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const fonts = { body, bold }
  return { doc, fonts, addPage: (n: number) => new AuthoredPage(doc, doc.addPage([PAGE.width, PAGE.height]), n, fonts) }
}

export async function writeAuthored(doc: PDFDocument, schema: FormSchema, base: string, title: string) {
  doc.setTitle(title)
  doc.setProducer('ClickTooling Contract Forms')
  const bytes = await doc.save()
  writeFileSync(`${base}.pdf`, bytes)
  writeFileSync(`${base}.schema.json`, JSON.stringify(schema, null, 2))
  console.error(`wrote ${base}.pdf (${bytes.byteLength} bytes) + ${base}.schema.json (${schema.boxes.length} boxes)`)
}

function r2(n: number): number {
  return Math.round(n * 100) / 100
}
