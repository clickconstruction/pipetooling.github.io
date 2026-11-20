/**
 * The PDF of a signed paper of plain words or clauses (punch list #376). A form has made a PDF since the forms train:
 * the filled form itself. A paper whose body is words, or is built from clauses, made none, so the signer left with
 * nothing to keep and the office had only the record on the screen. This draws one: the letterhead, the paper's name,
 * who it is for, the words as they were signed, and the signature block with its e-sign audit line.
 *
 * Built on pdf-lib, which is passed in, as `jobContractPdf.ts` does, so the Deno function and the vitest test share
 * this file. The words come from the row: `clause_versions` when the paper was signed as clauses (the freeze the
 * signing kept), else `signing_body_html` in its format.
 */
import { contractBodyToPlainText, type PdfLibLike } from './jobContractPdf.ts'

const PAGE_W = 612
const PAGE_H = 792
const MARGIN = 54
const CONTENT_W = PAGE_W - MARGIN * 2

type FontLike = { widthOfTextAtSize(text: string, size: number): number }

// Helvetica holds WinAnsi only: ASCII, Latin-1 and a few typographic marks. Anything else is dropped, never thrown on.
const UNSAFE = /[^\x20-\x7E -ÿ–—‘’“”•…]/g

/** One line of text the standard fonts can draw. */
export function paperPdfSafe(s: string): string {
  return (s ?? '')
    .replace(/−/g, '-')
    .replace(/[\t\r\n]+/g, ' ')
    .replace(UNSAFE, '')
}

function wrap(text: string, font: FontLike, size: number, width: number): string[] {
  const words = paperPdfSafe(text).split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']
  const out: string[] = []
  let line = ''
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w
    if (!line || font.widthOfTextAtSize(candidate, size) <= width) line = candidate
    else {
      out.push(line)
      line = w
    }
  }
  if (line) out.push(line)
  return out
}

/** A signed paper's row as far as its words read it. */
export interface PaperWordsRow {
  signing_body_html?: string | null
  signing_body_format?: string | null
  clause_versions?: unknown
}

type KeptLine = { n?: unknown; text?: unknown }

function keptLines(v: unknown): Array<{ n: number; text: string }> {
  if (!Array.isArray(v)) return []
  return (v as KeptLine[])
    .map((l) => ({ n: Number(l?.n), text: typeof l?.text === 'string' ? l.text.trim() : '' }))
    .filter((l) => l.text !== '')
    .map((l) => ({ n: Number.isFinite(l.n) ? l.n : 0, text: l.text }))
}

/**
 * The paper's words as paragraphs, in order. A paper signed as clauses reads from what the signing kept: the between
 * line, each numbered clause, then the exhibit under its heading. Any other reads its body as plain text, a paragraph
 * per blank line. Empty when the paper has no words of its own (a link to a file, or a form).
 */
export function paperParagraphs(row: PaperWordsRow): string[] {
  const kept = row.clause_versions && typeof row.clause_versions === 'object' && !Array.isArray(row.clause_versions) ? (row.clause_versions as Record<string, unknown>) : null
  if (kept) {
    const clauses = keptLines(kept.clauses)
    const exhibit = keptLines(kept.exhibit)
    if (clauses.length + exhibit.length > 0) {
      const out: string[] = []
      const between = typeof kept.between === 'string' ? kept.between.trim() : ''
      if (between) out.push(between)
      for (const c of clauses) out.push(c.n > 0 ? `${c.n}. ${c.text}` : c.text)
      if (exhibit.length > 0) {
        const trades = Array.isArray(kept.exhibitFor) ? (kept.exhibitFor as unknown[]).filter((t): t is string => typeof t === 'string' && t.trim() !== '').join(', ') : ''
        const spanish = kept.lang === 'es'
        out.push(trades ? (spanish ? `Anexo de ${trades}` : `Exhibit for ${trades}`) : spanish ? 'Anexo' : 'Exhibit')
        for (const c of exhibit) out.push(c.n > 0 ? `${c.n}. ${c.text}` : c.text)
      }
      return out
    }
  }
  const text = contractBodyToPlainText(row.signing_body_html, row.signing_body_format)
  if (!text) return []
  return text
    .split(/\n{2,}/)
    .flatMap((block) => block.split('\n'))
    .map((p) => p.trim())
    .filter(Boolean)
}

/** Whether a signed paper is one this draws: it has words of its own and is not a form, which has its own PDF. */
export function paperMakesAPdf(row: PaperWordsRow & { status?: string | null; form_template_id?: string | null }): boolean {
  if (row.status !== 'signed' || row.form_template_id) return false
  return paperParagraphs(row).length > 0
}

/** Where a paper's PDF is kept, in the forms' bucket beside a form's `signed.pdf`. */
export function paperPdfPath(documentId: string): string {
  return `${documentId}/signed-paper.pdf`
}

/** The audit line under the signature: how it was signed, when, and from where. */
export function paperAuditLine(args: { drawn: boolean; consentedLabel: string | null; ip: string | null }): string {
  const how = args.drawn ? 'Signed electronically with a drawn signature' : 'Signed electronically with a typed name'
  const when = args.consentedLabel ? ` on ${args.consentedLabel}` : ''
  const ip = (args.ip ?? '').trim()
  return `${how}${when}${ip ? ` · IP ${ip}` : ''}. The signer agreed to sign electronically before signing.`
}

export interface PersonPaperPdfInput {
  /** The paper's name. */
  title: string
  /** Our company, on the letterhead. */
  company: string
  /** One line under the company: its address, phone and email, as the office keeps them. */
  companyLine?: string | null
  /** Who the paper is for: the person, or the party and who signs. */
  forWords: string
  paragraphs: string[]
  signature: {
    printedName: string
    /** *Purchasing Manager, for Lone Pine Supply*, when the paper kept a title or a business. */
    capacity?: string | null
    /** The day it was signed, in words. */
    signedLabel: string
    auditLine: string
    /** Drawn signature PNG bytes, when the signer drew. */
    png?: Uint8Array | null
    /** A short record id printed on the frame. */
    recordId?: string | null
  }
}

/** Draw the signed paper. Letter size, as every paper the app prints. */
export async function buildPersonPaperPdf(lib: PdfLibLike, input: PersonPaperPdfInput): Promise<Uint8Array> {
  const doc = await lib.PDFDocument.create()
  doc.setTitle(paperPdfSafe(input.title) || 'Agreement')
  const font = await doc.embedFont(lib.StandardFonts.Helvetica)
  const bold = await doc.embedFont(lib.StandardFonts.HelveticaBold)
  const italic = await doc.embedFont(lib.StandardFonts.TimesRomanItalic)
  const ink = lib.rgb(0.07, 0.1, 0.15)
  const muted = lib.rgb(0.42, 0.45, 0.5)
  const accent = lib.rgb(0.6, 0.36, 0.17)

  let page = doc.addPage([PAGE_W, PAGE_H])
  const pages = [page]
  let y = PAGE_H - MARGIN
  const footerReserve = 34
  const ensure = (h: number) => {
    if (y - h < MARGIN + footerReserve) {
      page = doc.addPage([PAGE_W, PAGE_H])
      pages.push(page)
      y = PAGE_H - MARGIN
    }
  }
  const text = (t: string, size: number, f: FontLike = font, color: unknown = ink, lineGap = 1.4) => {
    for (const line of wrap(t, f, size, CONTENT_W)) {
      ensure(size * lineGap)
      if (line) page.drawText(line, { x: MARGIN, y: y - size, size, font: f, color })
      y -= size * lineGap
    }
  }

  // Letterhead
  text(input.company, 13, bold, accent)
  if ((input.companyLine ?? '').trim()) text(input.companyLine!, 8.5, font, muted)
  y -= 4
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1.5, color: accent })
  y -= 16

  // The paper's name and who it is for
  text(input.title.trim() || 'Agreement', 17, bold)
  y -= 2
  if (input.forWords.trim()) text(`For ${input.forWords.trim()}`, 10, font, muted)
  y -= 12

  // The words, as signed
  for (const p of input.paragraphs) {
    text(p, 10.5)
    y -= 6
  }

  // The signature block. It never splits from its audit line across a page.
  const sig = input.signature
  y -= 12
  ensure(150)
  page.drawText('SIGNATURE', { x: MARGIN, y: y - 8, size: 8, font: bold, color: accent })
  y -= 18
  const frameW = 250
  const pad = 12
  let markH = 34
  let img: { width: number; height: number } | null = null
  let imgW = 0
  let imgH = 0
  if (sig.png && sig.png.length > 0) {
    try {
      img = await doc.embedPng(sig.png)
      const scale = Math.min((frameW - pad * 2) / img.width, 56 / img.height, 1)
      imgW = img.width * scale
      imgH = img.height * scale
      markH = imgH
    } catch {
      img = null
    }
  }
  const printed = paperPdfSafe(sig.printedName) || '-'
  const frameH = markH + pad * 2 + 6
  const frameTop = y - 8
  const frameBottom = frameTop - frameH
  page.drawRectangle({ x: MARGIN, y: frameBottom, width: frameW, height: frameH, borderColor: accent, borderWidth: 1.2 })
  const tag = 'SIGNED ELECTRONICALLY'
  const tagW = bold.widthOfTextAtSize(tag, 6.5)
  page.drawRectangle({ x: MARGIN + 10, y: frameTop - 3.5, width: tagW + 8, height: 8, color: lib.rgb(1, 1, 1) })
  page.drawText(tag, { x: MARGIN + 14, y: frameTop - 2.4, size: 6.5, font: bold, color: accent })
  if (img) page.drawImage(img, { x: MARGIN + pad, y: frameBottom + pad + 3, width: imgW, height: imgH })
  else page.drawText(printed, { x: MARGIN + pad, y: frameBottom + pad + 10, size: 24, font: italic, color: ink })
  const recordId = paperPdfSafe(sig.recordId ?? '')
  if (recordId) {
    const idW = font.widthOfTextAtSize(recordId, 7)
    page.drawRectangle({ x: MARGIN + frameW - idW - 18, y: frameBottom - 4, width: idW + 8, height: 8, color: lib.rgb(1, 1, 1) })
    page.drawText(recordId, { x: MARGIN + frameW - idW - 14, y: frameBottom - 2.5, size: 7, font, color: muted })
  }
  // The printed name, what they sign as, and the day, beside the frame.
  const sideX = MARGIN + frameW + 18
  const sideW = CONTENT_W - frameW - 18
  let sideY = frameTop - 6
  const side = (t: string, size: number, f: FontLike, color: unknown) => {
    for (const line of wrap(t, f, size, sideW)) {
      page.drawText(line, { x: sideX, y: sideY - size, size, font: f, color })
      sideY -= size * 1.35
    }
  }
  side(printed, 10.5, bold, ink)
  if ((sig.capacity ?? '').trim()) side(sig.capacity!, 8.5, font, muted)
  if (sig.signedLabel.trim()) side(`Signed ${sig.signedLabel.trim()}`, 8.5, font, muted)
  y = Math.min(frameBottom, sideY) - 14
  text(sig.auditLine, 8.5, font, muted)

  pages.forEach((p, i) => {
    const pn = `Page ${i + 1} of ${pages.length}`
    const pw = font.widthOfTextAtSize(pn, 7.5)
    p.drawText(pn, { x: PAGE_W - MARGIN - pw, y: MARGIN - 18, size: 7.5, font, color: muted })
    const foot = wrap(`${input.company} · ${input.title}`, font, 7, CONTENT_W - pw - 12)[0] ?? ''
    if (foot) p.drawText(foot, { x: MARGIN, y: MARGIN - 18, size: 7, font, color: muted })
  })

  return doc.save()
}
