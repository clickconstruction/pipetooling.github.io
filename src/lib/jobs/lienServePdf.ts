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
import { LIEN_CERTIFIED_NUMBER_DIGITS, LIEN_CERTIFIED_NUMBER_GROUPS, LIEN_SERVE_DIVIDER_WORDS, lienServeDivider, type LienServeSheet, type LienServeSheetRow } from './lienServePackets'
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

/** `pages` are the lien's own papers, the file kept on its job. `dividers` are the divider pages the stack puts in front of its envelopes; they are in the stack alone. */
export type LienServePdfBuilt = { key: string; blob: Blob; pages: number; dividers: number }
export type LienServePdfOut = {
  /** The whole run: the mail sheet, then every lien's papers. Null when no lien's papers could be built. */
  stack: Blob | null
  /** Each lien's own papers, as they are in the stack: the file kept on its job. */
  jobs: LienServePdfBuilt[]
  /** The liens left out, each with its reason. */
  failed: Array<{ key: string; reason: string }>
}

/**
 * What the file asks of a print window that listens: one side of the paper, since an envelope's pages are in order and
 * may be an odd number, and each page at its own size, so a stamped page is not shrunk to fit. A hint, not a lock: the
 * screen says *Print on one side of the paper* too.
 */
function printAsItIs(doc: PDFDocument, lib: Awaited<ReturnType<typeof loadPdfLib>>): void {
  const prefs = doc.catalog.getOrCreateViewerPreferences()
  prefs.setDuplex(lib.Duplex.Simplex)
  prefs.setPrintScaling(lib.PrintScaling.None)
}

/** One lien's papers as a PDF of their own: for each envelope the letter, then every page of the stamped copy. */
export async function buildLienServeJobPdf(job: LienServePdfJob): Promise<Uint8Array> {
  return (await buildJobPapers(job)).bytes
}

/** The same, with how many pages each envelope takes, in order, so the stack can put a divider in front of each. */
async function buildJobPapers(job: LienServePdfJob): Promise<{ bytes: Uint8Array; envelopePages: number[] }> {
  const envelopePages: number[] = []
  const lib = await loadPdfLib()
  const out = await lib.PDFDocument.create()
  out.setTitle(job.title)
  printAsItIs(out, lib)
  const scan = job.copy.kind === 'pdf' ? await lib.PDFDocument.load(job.copy.bytes) : null
  const picture = job.copy.kind === 'jpeg' ? await out.embedJpg(job.copy.bytes) : job.copy.kind === 'png' ? await out.embedPng(job.copy.bytes) : null
  if (job.envelopes.length === 0) throw new Error('This lien has no envelope.')
  for (const envelope of job.envelopes) {
    const before = out.getPageCount()
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
    envelopePages.push(out.getPageCount() - before)
  }
  return { bytes: await out.save(), envelopePages }
}

/**
 * The whole run. `sheet` is asked for once the liens' own papers are built, with the ones that could not be, so the
 * mail sheet lists exactly the envelopes behind it. `autoPrint` has the PDF ask for the print window when it opens.
 */
export async function buildLienServeStackPdf(input: { jobs: ReadonlyArray<LienServePdfJob>; sheet: (failed: ReadonlyArray<{ key: string; reason: string }>) => LienServeSheet; title: string; autoPrint?: boolean }): Promise<LienServePdfOut> {
  const lib = await loadPdfLib()
  const built: Array<LienServePdfBuilt & { bytes: Uint8Array; envelopePages: number[] }> = []
  const failed: Array<{ key: string; reason: string }> = []
  for (const job of input.jobs) {
    try {
      const { bytes, envelopePages } = await buildJobPapers(job)
      const pages = (await lib.PDFDocument.load(bytes)).getPageCount()
      built.push({ key: job.key, bytes, pages, dividers: 0, envelopePages, blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }) })
    } catch (e) {
      failed.push({ key: job.key, reason: formatErrorMessage(e, 'its papers could not be put together') })
    }
  }
  if (built.length === 0) return { stack: null, jobs: [], failed }
  const stack = await lib.PDFDocument.create()
  stack.setTitle(input.title)
  printAsItIs(stack, lib)
  const sheet = input.sheet(failed)
  await drawLienMailSheet(stack, sheet)
  // A divider in front of each envelope, drawn from the sheet's own line for it, so its number and its face are the
  // sheet's. They are drawn only when the sheet lists exactly the envelopes behind it: a divider with another
  // envelope's address would be worse than none.
  const dividers = sheet.rows.length === built.reduce((n, job) => n + job.envelopePages.length, 0)
  let row = 0
  for (const job of built) {
    const doc = await lib.PDFDocument.load(job.bytes)
    let at = 0
    for (const count of job.envelopePages) {
      if (dividers) {
        await drawLienEnvelopeDivider(stack, sheet.rows[row]!, sheet)
        job.dividers += 1
      }
      row += 1
      const indices = Array.from({ length: count }, (_, i) => at + i)
      for (const page of await stack.copyPages(doc, indices)) stack.addPage(page)
      at += count
    }
  }
  if (input.autoPrint) stack.catalog.set(lib.PDFName.of('OpenAction'), stack.context.obj({ Type: 'Action', S: 'Named', N: 'Print' }))
  const bytes = await stack.save()
  return { stack: new Blob([bytes as BlobPart], { type: 'application/pdf' }), jobs: built.map(({ key, blob, pages, dividers }) => ({ key, blob, pages, dividers })), failed }
}

// ── The mail sheet, drawn ───────────────────────────────────────────────────────────────────────────────────────

const MARGIN = 36
const INK: [number, number, number] = [0.07, 0.09, 0.15]
const MUTED: [number, number, number] = [0.42, 0.45, 0.5]
const RULE: [number, number, number] = [0.8, 0.82, 0.85]
const FLAG: [number, number, number] = [0.6, 0.11, 0.11]
const BAND: [number, number, number] = [0.95, 0.96, 0.97]

/** Column widths in points, in the order of `LienServeSheet.columns`; they add up to the page's width less its margins. */
const COLS = [18, 100, 56, 30, 64, 272] as const

/** The boxes for a certified mail number under an envelope's line: one for each group of four digits, wide enough to write in. */
const NUMBER_BOX = { w: 54, h: 15, gap: 7 } as const
/** The name's size, and the smallest it shrinks to before it wraps: a long name stays on one line, as the envelope carries it. */
const NAME_SIZE = 8.5
const NAME_SMALLEST = 7

/** The largest size from `size` down to `smallest` at which `text` fits `width` on one line; `smallest` when none does. */
function fitSize(font: PDFFont, text: string, size: number, smallest: number, width: number): number {
  const safe = fontSafe(font, text)
  let at = size
  while (at > smallest && font.widthOfTextAtSize(safe, at) > width) at = Math.round((at - 0.25) * 100) / 100
  return at
}

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
    // The name and address take the last column: the name on one line, shrunk a little before it wraps, then the
    // street, then the city, state and ZIP, as the envelope carries them.
    const wide = COLS[5] - 6
    const nameSize = fitSize(bold, row.name, NAME_SIZE, NAME_SMALLEST, wide)
    const name = wrap(bold, row.name, nameSize, wide)
    const address = (row.addressLines.length > 0 ? row.addressLines : [row.address]).flatMap((l) => wrap(regular, l, 8.5, wide))
    const lines = Math.max(job.length, to.length, name.length + address.length, 2)
    const words = lines * 10.5 + 5
    // The envelope's line and its number boxes stay on one page.
    const h = words + NUMBER_BOX.h + 8
    room(h)
    const top = y - 11.5
    text(String(row.n), colX(0) + 3, top)
    job.forEach((l, i) => text(l, colX(1) + 3, top - i * 10.5, { font: bold }))
    to.forEach((l, i) => text(l, colX(2) + 3, top - i * 10.5))
    text(row.pages, colX(3) + 3, top)
    text(row.mailBy, colX(4) + 3, top, row.mailBy.includes('late') ? { font: bold, color: FLAG } : {})
    name.forEach((l, i) => text(l, colX(5) + 3, top - i * 10.5, { font: bold, size: nameSize }))
    address.forEach((l, i) => text(l, colX(5) + 3, top - (name.length + i) * 10.5))
    // Under it, the certified mail number: a box for each group of four digits, with a tick between the digits.
    const boxY = y - words - NUMBER_BOX.h
    const label = sheet.numberLabel.toUpperCase()
    const boxesW = LIEN_CERTIFIED_NUMBER_GROUPS * NUMBER_BOX.w + (LIEN_CERTIFIED_NUMBER_GROUPS - 1) * NUMBER_BOX.gap
    const boxX = PAGE_W - MARGIN - boxesW
    text(label, boxX - 8 - bold.widthOfTextAtSize(fontSafe(bold, label), 6.2), boxY + 5, { font: bold, size: 6.2, color: MUTED })
    for (let g = 0; g < LIEN_CERTIFIED_NUMBER_GROUPS; g += 1) {
      const x = boxX + g * (NUMBER_BOX.w + NUMBER_BOX.gap)
      page.drawRectangle({ x, y: boxY, width: NUMBER_BOX.w, height: NUMBER_BOX.h, borderColor: rgb(MUTED), borderWidth: 0.8 })
      const cell = NUMBER_BOX.w / LIEN_CERTIFIED_NUMBER_DIGITS
      for (let d = 1; d < LIEN_CERTIFIED_NUMBER_DIGITS; d += 1) page.drawLine({ start: { x: x + d * cell, y: boxY }, end: { x: x + d * cell, y: boxY + 4 }, thickness: 0.5, color: rgb(RULE) })
    }
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

// ── The divider in front of an envelope, drawn ──────────────────────────────────────────────────────────────────

/** The envelope's face on the divider: the height of a business envelope against the page's width, in points. */
const FACE_H = 223

/**
 * One divider page at the end of `doc`: a black band along the top edge so it shows in the stack, the envelope's
 * number large as the mail sheet lists it, *Do not mail this page* and where the envelope's pages stop, the envelope's
 * face to copy by eye (the return address, the certified mail line, the name and address as `row` carries them), and
 * three things to tick. It is the lien copies' twin of the notice run's divider (`runDividerHtml`).
 */
export async function drawLienEnvelopeDivider(doc: PDFDocument, row: LienServeSheetRow, sheet: Pick<LienServeSheet, 'rows' | 'from'>): Promise<void> {
  const lib = await loadPdfLib()
  const regular = await doc.embedFont(lib.StandardFonts.Helvetica)
  const bold = await doc.embedFont(lib.StandardFonts.HelveticaBold)
  const rgb = (c: [number, number, number]) => lib.rgb(c[0], c[1], c[2])
  const d = lienServeDivider(row, sheet.rows.length)
  const page = doc.addPage([PAGE_W, PAGE_H])
  const width = PAGE_W - MARGIN * 2
  const right = PAGE_W - MARGIN
  const text = (s: string, x: number, at: number, opt: { font?: PDFFont; size?: number; color?: [number, number, number] } = {}) => {
    const font = opt.font ?? regular
    page.drawText(fontSafe(font, s), { x, y: at, size: opt.size ?? 10, font, color: rgb(opt.color ?? INK) })
  }
  const textRight = (s: string, at: number, opt: { font?: PDFFont; size?: number; color?: [number, number, number] } = {}) => {
    const font = opt.font ?? regular
    text(s, right - font.widthOfTextAtSize(fontSafe(font, s), opt.size ?? 10), at, opt)
  }
  let y = PAGE_H - MARGIN

  // The band, then what the page is.
  page.drawRectangle({ x: MARGIN, y: y - 16, width, height: 16, color: rgb(INK) })
  y -= 34
  text(LIEN_SERVE_DIVIDER_WORDS.tag.toUpperCase(), MARGIN, y, { font: bold, size: 10, color: FLAG })

  // The number, large, with whose envelope it is beside it.
  y -= 62
  text(d.number, MARGIN, y, { font: bold, size: 64 })
  const numberW = bold.widthOfTextAtSize(d.number, 64)
  text(d.of, MARGIN + numberW + 12, y + 24, { size: 14, color: MUTED })
  text(`#${d.n} on the mail sheet`, MARGIN + numberW + 12, y + 6, { size: 10, color: MUTED })
  textRight(d.who, y + 34, { font: bold, size: 14 })
  const jobSize = fitSize(regular, d.job, 10, 7, width * 0.5)
  textRight(wrap(regular, d.job, jobSize, width * 0.5)[0] ?? '', y + 19, { size: jobSize })
  if (d.mailBy) textRight(d.mailBy, y + 4, d.late ? { font: bold, size: 10, color: FLAG } : { size: 10 })

  // Do not mail this page, and where the envelope's pages stop.
  y -= 22
  const stopH = 50
  page.drawRectangle({ x: MARGIN, y: y - stopH, width, height: stopH, borderColor: rgb(FLAG), borderWidth: 1.6 })
  text(d.stop, MARGIN + 12, y - 21, { font: bold, size: 15, color: FLAG })
  text(d.behind, MARGIN + 12, y - 39, { size: 11 })
  y -= stopH + 26

  // The envelope's face.
  text(LIEN_SERVE_DIVIDER_WORDS.face.toUpperCase(), MARGIN, y, { font: bold, size: 6.6, color: MUTED })
  y -= 8
  const faceTop = y
  page.drawRectangle({ x: MARGIN, y: faceTop - FACE_H, width, height: FACE_H, borderColor: rgb(MUTED), borderWidth: 1 })
  let at = faceTop - 20
  sheet.from.slice(0, 4).forEach((line, i) => {
    text(line, MARGIN + 14, at, i === 0 ? { font: bold, size: 9 } : { size: 9 })
    at -= 11.5
  })
  at -= 12
  text(LIEN_SERVE_DIVIDER_WORDS.certified, MARGIN + 14, at, { font: bold, size: 7.2 })
  text(LIEN_SERVE_DIVIDER_WORDS.article, MARGIN + 14, at - 11, { size: 7.5, color: MUTED })
  // The name and address sit right of the middle, as an envelope carries them.
  const toX = MARGIN + width * 0.36
  const toW = right - toX - 14
  let toY = faceTop - 104
  const nameSize = fitSize(bold, row.name, 13, 9, toW)
  for (const line of wrap(bold, row.name, nameSize, toW)) {
    text(line, toX, toY, { font: bold, size: nameSize })
    toY -= nameSize + 3.5
  }
  for (const line of (row.addressLines.length > 0 ? row.addressLines : [row.address]).flatMap((l) => wrap(regular, l, 12, toW))) {
    text(line, toX, toY, { size: 12 })
    toY -= 15.5
  }
  text(d.faceFoot, right - 10 - regular.widthOfTextAtSize(fontSafe(regular, d.faceFoot), 7), faceTop - FACE_H + 7, { size: 7, color: MUTED })
  y = faceTop - FACE_H - 30

  // Three things to tick.
  let x = MARGIN
  for (const tick of d.ticks) {
    page.drawRectangle({ x, y: y - 1.5, width: 10, height: 10, borderColor: rgb(MUTED), borderWidth: 0.9 })
    text(tick, x + 16, y, { size: 10 })
    x += 16 + regular.widthOfTextAtSize(fontSafe(regular, tick), 10) + 22
  }
  y -= 26
  page.drawLine({ start: { x: MARGIN, y }, end: { x: right, y }, thickness: 0.6, color: rgb(RULE) })
  y -= 16
  wrap(regular, d.pull, 9.5, width).forEach((line, i) => text(line, MARGIN, y - i * 12, { size: 9.5, color: MUTED }))

  // The foot: which divider this is, and that it stays.
  const footSize = 7
  const footLeft = wrap(regular, d.foot[0], footSize, width - 90)[0] ?? ''
  text(footLeft, MARGIN, MARGIN - 8, { size: footSize, color: MUTED })
  textRight(d.foot[1], MARGIN - 8, { size: footSize, color: MUTED })
}
