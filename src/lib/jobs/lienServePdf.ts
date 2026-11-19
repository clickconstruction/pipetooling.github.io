/**
 * The print of a filed lien's copies as PDF (v2.7916): the mail sheet, then for each envelope its cover letter and the
 * clerk's stamped copy behind it. The stamped copy's pages are the saved file's own pages, copied into the print as
 * they are and never drawn again, so the page in the envelope is the page the clerk stamped. A saved copy that is a
 * picture goes on a page of its own, whole.
 *
 * The run is built with `pdf-lib`, loaded when first wanted. Each lien's papers are built as a PDF of their own
 * first: that file is what is kept on the job, so what is filed on the job is what went in the envelope, page for
 * page. The stack is the sheet and then every lien's file in order. A lien whose papers cannot be put together is
 * left out and named with its reason, and the rest are built (`lienServePackets.ts` holds the rule).
 *
 * The rules a saved copy is read by are `lienStampedCopy.ts`; the sheet's words are `lienServeMailSheet`.
 */
import type { PDFDocument, PDFFont, PDFPage } from 'pdf-lib'
import type { LienServeSheet } from './lienServePackets'
import { LIEN_COPY_BROKEN_HOLD, LIEN_COPY_NOT_PRINTABLE_HOLD, lienCopyKind, type LienCopyKind, type LienCopyRead } from './lienStampedCopy'
import { formatErrorMessage } from '../../utils/errorHandling'

const loadPdfLib = () => import('pdf-lib')

/** US letter, in points. */
const PAGE_W = 612
const PAGE_H = 792

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  try {
    const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource)
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return ''
  }
}

/**
 * What a saved copy's bytes are: a PDF with its pages counted, or one picture. A file that is neither is held, and so
 * is a PDF that does not open (damaged, or locked with a password, whose pages would copy as noise).
 */
export async function inspectLienCopy(bytes: Uint8Array): Promise<LienCopyRead> {
  const kind = lienCopyKind(bytes)
  if (!kind) return { state: 'held', hold: LIEN_COPY_NOT_PRINTABLE_HOLD }
  let pages = 1
  if (kind === 'pdf') {
    try {
      const lib = await loadPdfLib()
      pages = (await lib.PDFDocument.load(bytes)).getPageCount()
    } catch {
      return { state: 'held', hold: LIEN_COPY_BROKEN_HOLD }
    }
    if (pages < 1) return { state: 'held', hold: LIEN_COPY_BROKEN_HOLD }
  }
  return { state: 'ok', file: { kind, pages, bytes: bytes.length, sha256: await sha256Hex(bytes) } }
}

/** One lien's papers for the print: a letter for each envelope (null prints the copy alone), and the stamped copy. */
export type LienServePdfJob = { key: string; title: string; envelopes: ReadonlyArray<{ letter: Blob | null }>; copy: { kind: LienCopyKind; bytes: Uint8Array } }

export type LienServePdfBuilt = { key: string; blob: Blob; pages: number }
export type LienServePdfOut = {
  /** The whole run: the mail sheet, then every lien's papers. Null when no lien's papers could be built. */
  stack: Blob | null
  /** Each lien's own papers, as they are in the stack: the file kept on its job. */
  jobs: LienServePdfBuilt[]
  /** The liens left out, each with its reason. */
  failed: Array<{ key: string; reason: string }>
}

/** One lien's papers as a PDF of their own: for each envelope the letter, then every page of the stamped copy. */
export async function buildLienServeJobPdf(job: LienServePdfJob): Promise<Uint8Array> {
  const lib = await loadPdfLib()
  const out = await lib.PDFDocument.create()
  out.setTitle(job.title)
  const scan = job.copy.kind === 'pdf' ? await lib.PDFDocument.load(job.copy.bytes) : null
  const picture = job.copy.kind === 'jpeg' ? await out.embedJpg(job.copy.bytes) : job.copy.kind === 'png' ? await out.embedPng(job.copy.bytes) : null
  if (job.envelopes.length === 0) throw new Error('This lien has no envelope.')
  for (const envelope of job.envelopes) {
    if (envelope.letter) {
      const letter = await lib.PDFDocument.load(await envelope.letter.arrayBuffer())
      for (const page of await out.copyPages(letter, letter.getPageIndices())) out.addPage(page)
    }
    if (scan) {
      for (const page of await out.copyPages(scan, scan.getPageIndices())) out.addPage(page)
    } else if (picture) {
      // The whole picture on a letter page, as large as it fits inside a quarter-inch edge, its shape kept.
      const page = out.addPage([PAGE_W, PAGE_H])
      const room = { w: PAGE_W - 36, h: PAGE_H - 36 }
      const scale = Math.min(room.w / picture.width, room.h / picture.height)
      const w = picture.width * scale
      const h = picture.height * scale
      page.drawImage(picture, { x: (PAGE_W - w) / 2, y: (PAGE_H - h) / 2, width: w, height: h })
    }
  }
  return out.save()
}

/**
 * The whole run. `sheet` is asked for once the liens' own papers are built, with the ones that could not be, so the
 * mail sheet lists exactly the envelopes behind it. `autoPrint` has the PDF ask for the print window when it opens.
 */
export async function buildLienServeStackPdf(input: { jobs: ReadonlyArray<LienServePdfJob>; sheet: (failed: ReadonlyArray<{ key: string; reason: string }>) => LienServeSheet; title: string; autoPrint?: boolean }): Promise<LienServePdfOut> {
  const lib = await loadPdfLib()
  const built: Array<LienServePdfBuilt & { bytes: Uint8Array }> = []
  const failed: Array<{ key: string; reason: string }> = []
  for (const job of input.jobs) {
    try {
      const bytes = await buildLienServeJobPdf(job)
      const pages = (await lib.PDFDocument.load(bytes)).getPageCount()
      built.push({ key: job.key, bytes, pages, blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }) })
    } catch (e) {
      failed.push({ key: job.key, reason: formatErrorMessage(e, 'its papers could not be put together') })
    }
  }
  if (built.length === 0) return { stack: null, jobs: [], failed }
  const stack = await lib.PDFDocument.create()
  stack.setTitle(input.title)
  await drawLienMailSheet(stack, input.sheet(failed))
  for (const job of built) {
    const doc = await lib.PDFDocument.load(job.bytes)
    for (const page of await stack.copyPages(doc, doc.getPageIndices())) stack.addPage(page)
  }
  if (input.autoPrint) stack.catalog.set(lib.PDFName.of('OpenAction'), stack.context.obj({ Type: 'Action', S: 'Named', N: 'Print' }))
  const bytes = await stack.save()
  return { stack: new Blob([bytes as BlobPart], { type: 'application/pdf' }), jobs: built.map(({ key, blob, pages }) => ({ key, blob, pages })), failed }
}

// ── The mail sheet, drawn ───────────────────────────────────────────────────────────────────────────────────────

const MARGIN = 36
const INK: [number, number, number] = [0.07, 0.09, 0.15]
const MUTED: [number, number, number] = [0.42, 0.45, 0.5]
const RULE: [number, number, number] = [0.8, 0.82, 0.85]
const FLAG: [number, number, number] = [0.6, 0.11, 0.11]
const BAND: [number, number, number] = [0.95, 0.96, 0.97]

/** Column widths in points, in the order of `LienServeSheet.columns`; they add up to the page's width less its margins. */
const COLS = [18, 104, 60, 162, 32, 50, 114] as const

/** Text the standard fonts can draw: a letter with an accent loses it, and anything else unknown reads `?`. */
function fontSafe(font: PDFFont, text: string): string {
  let out = ''
  for (const ch of (text ?? '').replace(/\s+/g, ' ')) {
    if (canDraw(font, ch)) out += ch
    else {
      const plain = ch.normalize('NFKD').replace(/[̀-ͯ]/g, '')
      out += plain && [...plain].every((c) => canDraw(font, c)) ? plain : '?'
    }
  }
  return out
}
function canDraw(font: PDFFont, ch: string): boolean {
  try {
    font.widthOfTextAtSize(ch, 1)
    return true
  } catch {
    return false
  }
}

/** `text` in lines no wider than `width`. A word wider than the line is cut. */
function wrap(font: PDFFont, text: string, size: number, width: number): string[] {
  const words = fontSafe(font, text).trim().split(' ').filter(Boolean)
  const lines: string[] = []
  let line = ''
  const push = () => {
    if (line) lines.push(line)
    line = ''
  }
  for (let word of words) {
    while (font.widthOfTextAtSize(word, size) > width) {
      let cut = word.length - 1
      while (cut > 1 && font.widthOfTextAtSize(word.slice(0, cut), size) > width) cut -= 1
      push()
      lines.push(word.slice(0, cut))
      word = word.slice(cut)
    }
    const next = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(next, size) > width) {
      push()
      line = word
    } else line = next
  }
  push()
  return lines
}

/** The mail sheet's pages at the front of `doc`, as `lienServeMailSheet` words them. */
export async function drawLienMailSheet(doc: PDFDocument, sheet: LienServeSheet): Promise<void> {
  const lib = await loadPdfLib()
  const regular = await doc.embedFont(lib.StandardFonts.Helvetica)
  const bold = await doc.embedFont(lib.StandardFonts.HelveticaBold)
  const rgb = (c: [number, number, number]) => lib.rgb(c[0], c[1], c[2])
  const width = PAGE_W - MARGIN * 2
  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - MARGIN
  const pages: PDFPage[] = [page]
  const text = (s: string, x: number, at: number, opt: { font?: PDFFont; size?: number; color?: [number, number, number] } = {}) => {
    const font = opt.font ?? regular
    page.drawText(fontSafe(font, s), { x, y: at, size: opt.size ?? 8.5, font, color: rgb(opt.color ?? INK) })
  }
  const rule = (at: number, color = RULE) => page.drawLine({ start: { x: MARGIN, y: at }, end: { x: PAGE_W - MARGIN, y: at }, thickness: 0.6, color: rgb(color) })
  const colX = (i: number) => MARGIN + COLS.slice(0, i).reduce((n, w) => n + w, 0)
  const tableHead = () => {
    page.drawRectangle({ x: MARGIN, y: y - 15, width, height: 15, color: rgb(BAND) })
    sheet.columns.forEach((c, i) => text(c.toUpperCase(), colX(i) + 3, y - 10.5, { font: bold, size: 6.2, color: MUTED }))
    y -= 15
    rule(y)
  }
  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H])
    pages.push(page)
    y = PAGE_H - MARGIN
    tableHead()
  }
  const room = (needed: number) => {
    if (y - needed < MARGIN + 22) newPage()
  }

  // The band: what the page is, and when it was printed.
  page.drawRectangle({ x: MARGIN, y: y - 4, width, height: 4, color: rgb(INK) })
  y -= 18
  text(sheet.tag.toUpperCase(), MARGIN, y, { font: bold, size: 7, color: MUTED })
  const right = (s: string, at: number) => text(s, PAGE_W - MARGIN - regular.widthOfTextAtSize(fontSafe(regular, s), 8), at, { size: 8, color: MUTED })
  if (sheet.printed) right(sheet.printed, y)
  y -= 18
  text(sheet.title, MARGIN, y, { font: bold, size: 15 })
  right(sheet.statute, y + 4)
  y -= 14

  // The steps, each with a box to tick.
  const stepLines = sheet.steps.map((s) => wrap(regular, s, 9, width - 40))
  const boxH = 24 + stepLines.reduce((n, l) => n + l.length * 11.5 + 3, 0)
  page.drawRectangle({ x: MARGIN, y: y - boxH, width, height: boxH, borderColor: rgb(RULE), borderWidth: 0.8 })
  y -= 15
  text(sheet.stepsHead, MARGIN + 10, y, { font: bold, size: 9.5 })
  y -= 5
  for (const lines of stepLines) {
    y -= 11.5
    page.drawRectangle({ x: MARGIN + 10, y: y - 1.5, width: 8, height: 8, borderColor: rgb(MUTED), borderWidth: 0.8 })
    lines.forEach((line, i) => text(line, MARGIN + 26, y - i * 11.5, { size: 9 }))
    y -= (lines.length - 1) * 11.5 + 3
  }
  y -= 16

  // The envelopes, in the stack's order.
  tableHead()
  for (const row of sheet.rows) {
    const job = wrap(bold, row.job, 8.5, COLS[1] - 6)
    const to = wrap(regular, row.to, 8.5, COLS[2] - 6)
    const name = wrap(bold, row.name, 8.5, COLS[3] - 6)
    const address = wrap(regular, row.address, 8.5, COLS[3] - 6)
    const lines = Math.max(job.length, to.length, name.length + address.length, 2)
    const h = lines * 10.5 + 9
    room(h)
    const top = y - 11.5
    text(String(row.n), colX(0) + 3, top)
    job.forEach((l, i) => text(l, colX(1) + 3, top - i * 10.5, { font: bold }))
    to.forEach((l, i) => text(l, colX(2) + 3, top - i * 10.5))
    name.forEach((l, i) => text(l, colX(3) + 3, top - i * 10.5, { font: bold }))
    address.forEach((l, i) => text(l, colX(3) + 3, top - (name.length + i) * 10.5))
    text(row.pages, colX(4) + 3, top)
    text(row.mailBy, colX(5) + 3, top, row.mailBy.includes('late') ? { font: bold, color: FLAG } : {})
    y -= h
    rule(y)
  }

  // What was left out, with its reason.
  if (sheet.held.length > 0) {
    room(15 + 30)
    page.drawRectangle({ x: MARGIN, y: y - 15, width, height: 15, color: rgb(BAND) })
    text(sheet.heldHead.toUpperCase(), MARGIN + 3, y - 10.5, { font: bold, size: 6.6, color: MUTED })
    y -= 15
    rule(y)
    const wide = width - COLS[0] - COLS[1] - 6
    for (const h of sheet.held) {
      const job = wrap(regular, h.job, 8.5, COLS[1] - 6)
      const why = wrap(bold, h.words, 8.5, wide)
      const act = wrap(regular, h.act, 8.5, wide)
      const lines = Math.max(job.length, why.length + act.length)
      const height = lines * 10.5 + 9
      room(height)
      const top = y - 11.5
      job.forEach((l, i) => text(l, colX(1) + 3, top - i * 10.5))
      why.forEach((l, i) => text(l, colX(2) + 3, top - i * 10.5, { font: bold, color: FLAG }))
      act.forEach((l, i) => text(l, colX(2) + 3, top - (why.length + i) * 10.5))
      y -= height
      rule(y)
    }
  }

  // The foot of every page of the sheet.
  pages.forEach((p, i) => {
    page = p
    const left = pages.length > 1 ? `${sheet.foot[0]} · page ${i + 1} of ${pages.length}` : sheet.foot[0]
    text(left, MARGIN, MARGIN - 8, { size: 7, color: MUTED })
    if (i === pages.length - 1) text(sheet.foot[1], PAGE_W - MARGIN - regular.widthOfTextAtSize(fontSafe(regular, sheet.foot[1]), 7), MARGIN - 8, { size: 7, color: MUTED })
  })
}
