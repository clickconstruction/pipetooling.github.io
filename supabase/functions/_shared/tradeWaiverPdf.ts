/**
 * GC mode, the trade partner portal's P5a-2 (to-dos/gc-mode/mockups/portal-p5a.md): the lien waiver a trade signs in its
 * portal, kept as a signed PDF. The paper is the app's own form (`lienWaiverWords.ts`, the Release of Lien window's words),
 * never new words: the conditional form with a pay application, the unconditional one after we pay, each the final form
 * on the final draw. The typed name sits on the signature line in the cursive face when the caller has it, with the day
 * signed, the audit sentence and the e-sign statute line under it. pdf-lib is passed in, as `jobContractPdf.ts` takes it,
 * so the Deno function (esm.sh) and the vitest test (node_modules) share this file.
 */
import { APP_CALENDAR_TZ } from './appTimeZone.ts'
import { buildLienWaiverFoot, buildLienWaiverParagraphs, LIEN_WAIVER_ESIGN_LINE, lienWaiverDate, lienWaiverTitle, type LienWaiverFields, type LienWaiverFoot, type LienWaiverFormType } from './lienWaiverWords.ts'

/** The kinds that sign a waiver, and the form each signs: the final form on the final draw. */
export function tradeWaiverPaperFor(kind: 'unconditional_waiver' | 'pay_app' | 'final_pay_app', final: boolean): LienWaiverFormType {
  if (kind === 'pay_app') return 'conditional_progress'
  if (kind === 'final_pay_app') return 'conditional_final'
  return final ? 'unconditional_final' : 'unconditional_progress'
}

export interface TradeWaiverPdfInput {
  paper: LienWaiverFormType
  /** What we paid or will pay: the draw's net. */
  amount: number
  /** The last day its pay application covers, for a progress form. */
  through: string
  company: string
  project: { name: string; address: string }
  signer: string
  /** The app's day it was signed. */
  signedYmd: string
  /** Who the check is from on a conditional form: us. */
  checkFrom: string
  /** When it was signed, for the audit sentence. */
  signedAt: Date
}

export interface TradeWaiverPdfModel {
  title: string
  paragraphs: string[]
  foot: LienWaiverFoot
  audit: string
  esign: string
}

/** The form's fields from the draw and the signature, as the window fills them. */
export function tradeWaiverFields(i: TradeWaiverPdfInput): LienWaiverFields {
  return {
    companyName: i.company,
    checkFrom: i.checkFrom,
    amount: String(i.amount),
    projectDescription: [i.project.name, i.project.address]
      .map((s) => s.trim())
      .filter((s) => s !== '')
      .join(', '),
    throughDate: i.through,
    signedDate: i.signedYmd,
    signerName: i.signer,
    signerTitle: '',
  }
}

/** The audit sentence under the signature, as the Release of Lien window words a typed signature. */
export function tradeWaiverAuditLine(signer: string, company: string, at: Date): string {
  const day = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, month: 'short', day: 'numeric', year: 'numeric' }).format(at)
  const clock = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, hour: 'numeric', minute: '2-digit' }).format(at)
  return `Typed by ${signer.trim()} in ${company.trim()}’s portal on ${day} at ${clock} CT, consent recorded.`
}

/** The paper as the PDF lays it out: the form's title and paragraphs, the signed foot, the audit and statute lines. */
export function tradeWaiverPdfModel(i: TradeWaiverPdfInput): TradeWaiverPdfModel {
  const fields = tradeWaiverFields(i)
  return {
    title: lienWaiverTitle(i.paper),
    paragraphs: buildLienWaiverParagraphs(i.paper, fields),
    foot: buildLienWaiverFoot(fields, { printedName: i.signer, signedYmd: i.signedYmd }),
    audit: tradeWaiverAuditLine(i.signer, i.company, i.signedAt),
    esign: LIEN_WAIVER_ESIGN_LINE,
  }
}

/** The PDF's name in Drive: `Unconditional Waiver and Release on Progress Payment - Electrical - draw 2 - signed 2026-10-10.pdf`. */
export function tradeWaiverPdfName(paper: LienWaiverFormType, trade: string, drawNumber: number, signedYmd: string): string {
  return `${lienWaiverTitle(paper)} - ${trade.replace(/[\\/:*?"<>|]/g, '-').trim()} - draw ${drawNumber} - signed ${signedYmd}.pdf`
}

type PdfFontLike = { widthOfTextAtSize(text: string, size: number): number }
type PdfPageLike = {
  drawText(text: string, opts: { x: number; y: number; size: number; font: PdfFontLike; color?: unknown }): void
  drawLine(opts: { start: { x: number; y: number }; end: { x: number; y: number }; thickness: number; color?: unknown }): void
}
type PdfDocLike = {
  addPage(size: [number, number]): PdfPageLike
  embedFont(font: string | Uint8Array): Promise<PdfFontLike>
  registerFontkit?(fontkit: unknown): void
  setTitle(t: string): void
  save(): Promise<Uint8Array>
}
export type TradeWaiverPdfLib = {
  PDFDocument: { create(): Promise<PdfDocLike> }
  StandardFonts: { TimesRoman: string; TimesRomanBold: string; TimesRomanItalic: string; Helvetica: string }
  rgb(r: number, g: number, b: number): unknown
}

const PAGE_W = 612
const PAGE_H = 792
const MARGIN = 72
const CONTENT_W = PAGE_W - MARGIN * 2

function wrap(text: string, font: PdfFontLike, size: number, width: number): string[] {
  const out: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (line && font.widthOfTextAtSize(next, size) > width) {
      out.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) out.push(line)
  return out
}

/**
 * The signed paper as a PDF: one Letter page in the window's serif, the title centred, the paragraphs, then the typed
 * name on the line (cursive when `cursive` is given), the name and company, the day signed, and the audit and statute
 * lines in grey. A long form flows onto a second page.
 */
export async function buildTradeWaiverPdf(lib: TradeWaiverPdfLib, model: TradeWaiverPdfModel, cursive?: { bytes: Uint8Array; fontkit: unknown } | null): Promise<Uint8Array> {
  const doc = await lib.PDFDocument.create()
  doc.setTitle(model.title)
  const body = await doc.embedFont(lib.StandardFonts.TimesRoman)
  const bold = await doc.embedFont(lib.StandardFonts.TimesRomanBold)
  let sign = await doc.embedFont(lib.StandardFonts.TimesRomanItalic)
  if (cursive && doc.registerFontkit) {
    doc.registerFontkit(cursive.fontkit)
    sign = await doc.embedFont(cursive.bytes)
  }
  const small = await doc.embedFont(lib.StandardFonts.Helvetica)
  const ink = lib.rgb(0.1, 0.1, 0.1)
  const grey = lib.rgb(0.36, 0.38, 0.41)

  let page = doc.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - MARGIN
  const ensure = (h: number) => {
    if (y - h < MARGIN) {
      page = doc.addPage([PAGE_W, PAGE_H])
      y = PAGE_H - MARGIN
    }
  }
  const lines = (t: string, size: number, font: PdfFontLike, color: unknown, gap = 1.45) => {
    for (const l of wrap(t, font, size, CONTENT_W)) {
      ensure(size * gap)
      page.drawText(l, { x: MARGIN, y: y - size, size, font, color })
      y -= size * gap
    }
  }

  const title = model.title.toUpperCase()
  const titleSize = 13
  for (const l of wrap(title, bold, titleSize, CONTENT_W)) {
    page.drawText(l, { x: MARGIN + (CONTENT_W - bold.widthOfTextAtSize(l, titleSize)) / 2, y: y - titleSize, size: titleSize, font: bold, color: ink })
    y -= titleSize * 1.5
  }
  y -= 12
  for (const p of model.paragraphs) {
    lines(p, 11.5, body, ink)
    y -= 8
  }

  ensure(140)
  y -= 28
  const nameSize = cursive ? 26 : 18
  page.drawText(model.foot.name, { x: MARGIN, y: y - nameSize, size: nameSize, font: sign, color: ink })
  y -= nameSize + 6
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 300, y }, thickness: 0.8, color: ink })
  y -= 6
  lines(`${model.foot.name}, ${model.foot.company}`, 11, bold, ink, 1.4)
  if (model.foot.title) lines(model.foot.title, 10, body, grey, 1.4)
  lines(model.foot.signed ?? `Signed ${lienWaiverDate('')}`, 10, body, grey, 1.4)
  y -= 14
  lines(model.audit, 8.5, small, grey, 1.4)
  lines(model.esign, 8.5, small, grey, 1.4)
  return doc.save()
}
