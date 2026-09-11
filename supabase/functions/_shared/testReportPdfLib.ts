import type { TestReportBlock, TestReportColumn } from './testReport.ts'

/**
 * The test report as a Letter PDF, rendered server-side with pdf-lib (v2.3315)
 * — the same block model the browser's jsPDF renderer walks
 * (src/lib/jobsDocuments/testReportPdf.ts), so an auto-sent report (dial B)
 * reads like an office-sent one. pdf-lib is passed in, the jobContractPdf
 * precedent: the Deno function imports it from esm.sh, the vitest test from
 * node_modules, and this file stays free of either import syntax.
 */
export type TestReportPdfLibLike = {
  PDFDocument: { create(): Promise<TestReportPdfDoc> }
  StandardFonts: { Helvetica: string; HelveticaBold: string }
  rgb(r: number, g: number, b: number): unknown
}
export type TestReportPdfFont = { widthOfTextAtSize(text: string, size: number): number }
export type TestReportPdfPage = {
  drawText(text: string, opts: { x: number; y: number; size: number; font: TestReportPdfFont; color?: unknown }): void
  drawLine(opts: { start: { x: number; y: number }; end: { x: number; y: number }; thickness: number; color?: unknown }): void
}
export type TestReportPdfDoc = {
  addPage(size: [number, number]): TestReportPdfPage
  embedFont(name: string): Promise<TestReportPdfFont>
  setTitle(t: string): void
  save(): Promise<Uint8Array>
}

const PAGE_W = 612
const PAGE_H = 792
const MARGIN = 51 // 18 mm — the jsPDF renderer's margin
const CONTENT_W = PAGE_W - MARGIN * 2
const KV_LABEL_W = 96 // 34 mm

function wrap(text: string, font: TestReportPdfFont, size: number, width: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
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

export async function renderTestReportPdfLib(lib: TestReportPdfLibLike, blocks: TestReportBlock[], title: string): Promise<Uint8Array> {
  const doc = await lib.PDFDocument.create()
  doc.setTitle(title)
  const font = await doc.embedFont(lib.StandardFonts.Helvetica)
  const bold = await doc.embedFont(lib.StandardFonts.HelveticaBold)
  const ink = lib.rgb(22 / 255, 40 / 255, 60 / 255)
  const muted = lib.rgb(90 / 255, 107 / 255, 126 / 255)
  const copper = lib.rgb(176 / 255, 102 / 255, 47 / 255)
  const hair = lib.rgb(221 / 255, 214 / 255, 200 / 255)
  const green = lib.rgb(31 / 255, 122 / 255, 58 / 255)
  const red = lib.rgb(180 / 255, 35 / 255, 24 / 255)
  const body = lib.rgb(51 / 255, 51 / 255, 51 / 255)

  let page = doc.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - MARGIN

  const ensure = (h: number) => {
    if (y - h < MARGIN) {
      page = doc.addPage([PAGE_W, PAGE_H])
      y = PAGE_H - MARGIN
    }
  }
  /** Draw wrapped text at x with the given width; advances y by lines × lineH. */
  const text = (t: string, size: number, f: TestReportPdfFont, color: unknown, x: number, width: number, lineH: number) => {
    for (const line of wrap(t, f, size, width)) {
      ensure(lineH)
      if (line) page.drawText(line, { x, y: y - size, size, font: f, color })
      y -= lineH
    }
  }
  const rule = (x1: number, x2: number, thickness: number, color: unknown) => {
    page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color })
  }
  const sectionHead = (label: string, x: number, width: number) => {
    ensure(40)
    y -= 8
    page.drawText(label.toUpperCase(), { x, y: y - 8, size: 8, font: bold, color: copper })
    y -= 12
    rule(x, x + width, 0.5, hair)
    y -= 14
  }
  const kvRows = (rows: Array<{ label: string; value: string }>, x: number, width: number, labelW: number) => {
    for (const row of rows) {
      const lines = wrap(row.value, font, 10, width - labelW)
      ensure(14 * Math.max(1, lines.length))
      page.drawText(row.label, { x, y: y - 10, size: 10, font, color: muted })
      const f = row.label === 'Total' ? bold : font
      for (const line of lines) {
        page.drawText(line, { x: x + labelW, y: y - 10, size: 10, font: f, color: ink })
        y -= 14
      }
    }
  }
  const column = (col: TestReportColumn, x: number, width: number, top: number): number => {
    y = top
    page.drawText(col.heading.toUpperCase(), { x, y: y - 8, size: 8, font: bold, color: copper })
    y -= 12
    rule(x, x + width, 0.5, hair)
    y -= 14
    for (const line of col.lines ?? []) text(line, 10, font, ink, x, width, 14)
    kvRows(col.rows, x, width, 68)
    return y
  }

  for (const block of blocks) {
    switch (block.kind) {
      case 'letterhead': {
        page.drawText(block.companyName.toUpperCase(), { x: MARGIN, y: y - 20, size: 20, font: bold, color: ink })
        if (block.tagline.trim()) page.drawText(block.tagline.toUpperCase(), { x: MARGIN, y: y - 32, size: 8, font, color: muted })
        const tw = bold.widthOfTextAtSize(block.title, 12.5)
        page.drawText(block.title, { x: PAGE_W - MARGIN - tw, y: y - 20, size: 12.5, font: bold, color: ink })
        const meta = [block.dateLabel, block.jobLabel].filter(Boolean).join(' · ')
        const mw = font.widthOfTextAtSize(meta, 9)
        page.drawText(meta, { x: PAGE_W - MARGIN - mw, y: y - 32, size: 9, font, color: muted })
        y -= 42
        rule(MARGIN, PAGE_W - MARGIN, 2.3, copper)
        y -= 22
        break
      }
      case 'columns': {
        const colW = (CONTENT_W - 22) / 2
        const top = y
        const leftEnd = column(block.left, MARGIN, colW, top)
        const rightEnd = column(block.right, MARGIN + colW + 22, colW, top)
        y = Math.min(leftEnd, rightEnd) - 8
        break
      }
      case 'section':
        sectionHead(block.text, MARGIN, CONTENT_W)
        break
      case 'kv':
        kvRows(block.rows, MARGIN, CONTENT_W, KV_LABEL_W)
        y -= 3
        break
      case 'verdict': {
        ensure(22)
        const word = block.result.toUpperCase()
        page.drawText(word, { x: MARGIN, y: y - 12, size: 12, font: bold, color: block.result === 'pass' ? green : red })
        const w = bold.widthOfTextAtSize(word, 12)
        page.drawText(` — ${block.text}`, { x: MARGIN + w, y: y - 12, size: 10, font, color: ink })
        y -= 18
        break
      }
      case 'paragraph':
        if (block.label) {
          ensure(14)
          page.drawText(`${block.label}:`, { x: MARGIN, y: y - 10, size: 10, font: bold, color: ink })
          y -= 14
        }
        text(block.text, 10, font, ink, MARGIN, CONTENT_W, 14)
        y -= 4
        break
      case 'certification': {
        const paras = block.text.split('\n\n')
        paras.forEach((para, i) => {
          for (const line of para.split('\n')) text(line, 9.5, font, body, MARGIN, CONTENT_W, 13)
          if (i < paras.length - 1) y -= 7
        })
        break
      }
    }
  }
  return doc.save()
}
