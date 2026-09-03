/**
 * The signed job-contract PDF (Contract Desk, v2.2696): one Letter document
 * with the letterhead, heading, scope, price & payment, the terms, and the
 * signature block with the e-sign audit line — the same sections the page
 * and the office preview show. Built on pdf-lib, which is passed in so the
 * Deno function (esm.sh) and the vitest parity test (node_modules) share
 * this file without either runtime's import syntax.
 */

export type PdfLibLike = {
  PDFDocument: {
    create(): Promise<PdfDocLike>
  }
  StandardFonts: { Helvetica: string; HelveticaBold: string; TimesRomanItalic: string }
  rgb(r: number, g: number, b: number): unknown
}
type PdfFontLike = { widthOfTextAtSize(text: string, size: number): number }
type PdfPageLike = {
  drawText(text: string, opts: { x: number; y: number; size: number; font: PdfFontLike; color?: unknown }): void
  drawLine(opts: { start: { x: number; y: number }; end: { x: number; y: number }; thickness: number; color?: unknown }): void
  drawImage(img: unknown, opts: { x: number; y: number; width: number; height: number }): void
  drawRectangle(opts: { x: number; y: number; width: number; height: number; borderColor?: unknown; borderWidth?: number; color?: unknown }): void
}
type PdfDocLike = {
  addPage(size: [number, number]): PdfPageLike
  embedFont(name: string): Promise<PdfFontLike>
  embedPng(bytes: Uint8Array): Promise<{ width: number; height: number }>
  setTitle(t: string): void
  save(): Promise<Uint8Array>
}

export type JobContractPdfInput = {
  heading: string
  jobNumber: string
  jobAddress: string | null
  customerName: string | null
  recipientName: string | null
  dateLabel: string
  revision: number
  templateName: string | null
  scopeLines: string[]
  exclusions: string
  note: string
  amountCents: number | null
  paymentLine: string
  dates: string
  /** Plain-text terms (see contractBodyToPlainText). */
  termsText: string
  issuer: { companyName: string; addressText: string; phone: string; email: string; tagline: string; licenseLine: string } | null
  signature: {
    printedName: string
    auditLine: string
    /** Drawn signature PNG bytes, when the customer drew. */
    png?: Uint8Array | null
    /** Short record ID printed inside the frame (J922-1B0C4D). */
    recordId?: string | null
    /** Stamp beside the name, e.g. "Sep 2, 2026, 7:14 PM CT". */
    whenLabel?: string | null
  }
}

/** html | markdown | plain → readable plain text for the PDF (tags out, entities back, blank lines kept). */
export function contractBodyToPlainText(body: string | null | undefined, format: string | null | undefined): string {
  const raw = (body ?? '').replace(/\r\n/g, '\n')
  if (!raw.trim()) return ''
  if ((format ?? 'plain') === 'plain') return raw.trim()
  let t = raw
  if (format === 'markdown') {
    t = t
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^[ \t]*[-*+][ \t]+/gm, '• ')
  }
  t = t
    .replace(/<\s*(br|BR)\s*\/?>/g, '\n')
    .replace(/<\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
  return t.trim()
}

export function formatPdfMoney(cents: number): string {
  const abs = Math.abs(cents)
  const dollars = Math.floor(abs / 100)
  const rest = String(abs % 100).padStart(2, '0')
  return `${cents < 0 ? '-' : ''}$${dollars.toLocaleString('en-US')}.${rest}`
}

const PAGE_W = 612
const PAGE_H = 792
const MARGIN = 54
const CONTENT_W = PAGE_W - MARGIN * 2

function wrap(text: string, font: PdfFontLike, size: number, width: number): string[] {
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

export async function buildJobContractPdf(lib: PdfLibLike, input: JobContractPdfInput): Promise<Uint8Array> {
  const doc = await lib.PDFDocument.create()
  doc.setTitle(input.heading)
  const font = await doc.embedFont(lib.StandardFonts.Helvetica)
  const bold = await doc.embedFont(lib.StandardFonts.HelveticaBold)
  const italic = await doc.embedFont(lib.StandardFonts.TimesRomanItalic)
  const ink = lib.rgb(0.07, 0.1, 0.15)
  const muted = lib.rgb(0.42, 0.45, 0.5)
  const accent = lib.rgb(0.76, 0.25, 0.05)
  const rule = lib.rgb(0.85, 0.87, 0.9)

  const pages: PdfPageLike[] = []
  let page: PdfPageLike = doc.addPage([PAGE_W, PAGE_H])
  pages.push(page)
  let y = PAGE_H - MARGIN

  const footerReserve = 40
  const ensure = (h: number) => {
    if (y - h < MARGIN + footerReserve) {
      page = doc.addPage([PAGE_W, PAGE_H])
      pages.push(page)
      y = PAGE_H - MARGIN
    }
  }
  const text = (t: string, size: number, f: PdfFontLike, color: unknown = ink, x = MARGIN, maxW = CONTENT_W, lineGap = 1.35) => {
    for (const line of wrap(t, f, size, maxW)) {
      ensure(size * lineGap)
      if (line) page.drawText(line, { x, y: y - size, size, font: f, color })
      y -= size * lineGap
    }
  }
  const gap = (h: number) => {
    y -= h
  }
  const label = (t: string) => {
    gap(10)
    ensure(14)
    page.drawText(t.toUpperCase(), { x: MARGIN, y: y - 8, size: 8, font: bold, color: accent })
    y -= 16
  }
  const hr = () => {
    ensure(6)
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.6, color: rule })
    y -= 6
  }

  // Letterhead
  const issuer = input.issuer
  if (issuer?.companyName) {
    text(issuer.companyName, 13, bold, lib.rgb(0.49, 0.18, 0.07))
    const sub = [issuer.addressText, issuer.phone, issuer.email].filter(Boolean).join('  ·  ')
    if (sub) text(sub, 8.5, font, muted)
  }
  gap(4)
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1.5, color: accent })
  gap(14)

  // Heading + facts
  text(input.heading, 17, bold)
  gap(2)
  const who = input.customerName || input.recipientName || 'Customer'
  text(`Job #${input.jobNumber}  ·  for ${who}  ·  ${input.dateLabel}${input.revision > 1 ? `  ·  rev ${input.revision}` : ''}`, 9.5, font, muted)
  if (input.jobAddress) text(`Property: ${input.jobAddress}`, 9.5, font, muted)
  if (input.note.trim()) {
    gap(6)
    text(input.note.trim(), 10, font)
  }

  // Scope
  label("Work we'll do")
  const scope = input.scopeLines.map((l) => l.trim()).filter(Boolean)
  if (scope.length === 0) text('Scope as discussed.', 10, font, muted)
  for (const l of scope) text(`•  ${l}`, 10, font, ink, MARGIN + 6, CONTENT_W - 6)
  if (input.exclusions.trim()) {
    gap(3)
    text(`Not included: ${input.exclusions.trim()}`, 9, font, muted)
  }
  if (input.dates.trim()) text(input.dates.trim(), 9, font, muted)

  // Price & payment
  label('Price & payment')
  hr()
  ensure(20)
  const amountLabel = input.amountCents != null ? formatPdfMoney(input.amountCents) : 'Billed at completion (time and materials)'
  page.drawText('Contract amount', { x: MARGIN, y: y - 13, size: 12, font: bold, color: ink })
  const aw = bold.widthOfTextAtSize(amountLabel, 12)
  page.drawText(amountLabel, { x: PAGE_W - MARGIN - aw, y: y - 13, size: 12, font: bold, color: ink })
  y -= 22
  text(input.paymentLine, 9.5, font)

  // Terms
  label(`Terms${input.templateName ? ` · ${input.templateName}` : ''}`)
  text(input.termsText || 'Terms as agreed.', 9, font, ink, MARGIN, CONTENT_W, 1.4)

  // Signature block (v2.2724 "Option A"): a framed mark tagged SIGNED
  // ELECTRONICALLY with the record ID, printed name + time to the right, the
  // audit line below.
  gap(18)
  ensure(120)
  label('Customer signature')
  const sig = input.signature
  const frameX = MARGIN
  const frameW = 250
  const innerPad = 12
  let markH = 34
  let img: { width: number; height: number } | null = null
  let imgW = 0
  let imgH = 0
  if (sig.png && sig.png.length > 0) {
    try {
      img = await doc.embedPng(sig.png)
      const scale = Math.min((frameW - innerPad * 2) / img.width, 56 / img.height, 1)
      imgW = img.width * scale
      imgH = img.height * scale
      markH = imgH
    } catch {
      img = null
    }
  }
  const frameH = markH + innerPad * 2 + 6
  const frameTop = y - 8
  const frameBottom = frameTop - frameH
  page.drawRectangle({ x: frameX, y: frameBottom, width: frameW, height: frameH, borderColor: accent, borderWidth: 1.2 })
  // Tag on the top edge (white gap behind it).
  const tag = 'SIGNED ELECTRONICALLY'
  const tagW = bold.widthOfTextAtSize(tag, 6.5)
  page.drawRectangle({ x: frameX + 10, y: frameTop - 3.5, width: tagW + 8, height: 8, color: lib.rgb(1, 1, 1) })
  page.drawText(tag, { x: frameX + 14, y: frameTop - 2.4, size: 6.5, font: bold, color: accent })
  // The mark.
  if (img) {
    page.drawImage(img, { x: frameX + innerPad, y: frameBottom + innerPad + 3, width: imgW, height: imgH })
  } else {
    page.drawText(sig.printedName || '—', { x: frameX + innerPad, y: frameBottom + innerPad + 10, size: 24, font: italic, color: ink })
  }
  // Record ID on the bottom edge.
  if (sig.recordId) {
    const idW = font.widthOfTextAtSize(sig.recordId, 7)
    page.drawRectangle({ x: frameX + frameW - idW - 18, y: frameBottom - 4, width: idW + 8, height: 8, color: lib.rgb(1, 1, 1) })
    page.drawText(sig.recordId, { x: frameX + frameW - idW - 14, y: frameBottom - 2.5, size: 7, font, color: muted })
  }
  // Printed name + time, right-aligned to the content edge.
  const nameW = bold.widthOfTextAtSize(sig.printedName || '—', 10.5)
  page.drawText(sig.printedName || '—', { x: PAGE_W - MARGIN - nameW, y: frameBottom + innerPad + 14, size: 10.5, font: bold, color: ink })
  if (sig.whenLabel) {
    const whenW = font.widthOfTextAtSize(sig.whenLabel, 8.5)
    page.drawText(sig.whenLabel, { x: PAGE_W - MARGIN - whenW, y: frameBottom + innerPad + 2, size: 8.5, font, color: muted })
  }
  y = frameBottom - 14
  text(sig.auditLine, 8.5, font, muted)

  // Footer on every page
  const footer = issuer ? [issuer.tagline, issuer.companyName, issuer.addressText, issuer.phone ? `Ph: ${issuer.phone}` : '', issuer.licenseLine].filter(Boolean).join('  ·  ') : ''
  pages.forEach((p, i) => {
    const pn = `Page ${i + 1} of ${pages.length}`
    const pw = font.widthOfTextAtSize(pn, 7.5)
    p.drawText(pn, { x: PAGE_W - MARGIN - pw, y: MARGIN - 18, size: 7.5, font, color: muted })
    if (footer) {
      const lines = wrap(footer, font, 7, CONTENT_W - pw - 12)
      p.drawText(lines[0] ?? '', { x: MARGIN, y: MARGIN - 18, size: 7, font, color: muted })
    }
  })

  return doc.save()
}
