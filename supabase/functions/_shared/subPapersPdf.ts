/**
 * The three sub papers as PDFs (punch list #350), on the signed hours statement's pattern: the caller hands in
 * pdf-lib (`PdfLibLike`), so the app and an edge function draw the same bytes from the same model
 * (`subPapers.ts`). Letter size, Helvetica, one column. It adds no number of its own.
 *
 * A sentence that waits on counsel prints in a violet box headed "§ Draft wording. It waits on counsel and is not
 * final.", as the HTML print does.
 */
import type { PdfLibLike } from './jobContractPdf.ts'
import { paperMoney, statementAddsWords, type CounselSentence, type PaperCompany, type PaperParty, type PaymentRecord, type StatementOfAccount, type StatementRange, type WorkStatement } from './subPapers.ts'

type Font = { widthOfTextAtSize(text: string, size: number): number }
type Page = {
  drawText(text: string, opts: { x: number; y: number; size: number; font: Font; color?: unknown }): void
  drawLine(opts: { start: { x: number; y: number }; end: { x: number; y: number }; thickness: number; color?: unknown }): void
  drawRectangle(opts: { x: number; y: number; width: number; height: number; borderColor?: unknown; borderWidth?: number; color?: unknown }): void
}
type Doc = { addPage(size: [number, number]): Page; embedFont(name: string): Promise<Font>; setTitle(title: string): void; save(): Promise<Uint8Array> }

const W = 612
const H = 792
const M = 48
const RIGHT = W - M
/** Where a box that runs over a page ends on one page and starts on the next: above the foot's rule, over the first line. */
const BOX_FOOT = M + 22
const BOX_HEAD = H - M + 10

/** Helvetica holds WinAnsi only: a true minus and a tick are not in it. */
export function subPaperPdfSafe(s: string): string {
  return s
    .replace(/−/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/✓/g, '')
    .replace(/[^\x20-\x7E -ÿ–—•]/g, '')
}

type Col = { x: number; w: number; right?: boolean }

class Writer {
  pages: Page[] = []
  page: Page
  y = H - M
  constructor(
    private doc: Doc,
    private font: Font,
    private bold: Font,
    public c: { ink: unknown; muted: unknown; rule: unknown; red: unknown; green: unknown; violet: unknown; shade: unknown },
    private footLeft: string,
  ) {
    this.page = doc.addPage([W, H])
    this.pages.push(this.page)
  }
  need(h: number) {
    if (this.y - h < M + 28) {
      this.page = this.doc.addPage([W, H])
      this.pages.push(this.page)
      this.y = H - M
    }
  }
  wrap(text: string, size: number, width: number, font: Font = this.font): string[] {
    const out: string[] = []
    for (const para of subPaperPdfSafe(text).split('\n')) {
      let line = ''
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word
        if (font.widthOfTextAtSize(next, size) > width && line) {
          out.push(line)
          line = word
        } else line = next
      }
      out.push(line)
    }
    return out
  }
  text(s: string, x: number, size: number, o: { bold?: boolean; color?: unknown; right?: number } = {}) {
    const font = o.bold ? this.bold : this.font
    const t = subPaperPdfSafe(s)
    this.page.drawText(t, { x: o.right != null ? o.right - font.widthOfTextAtSize(t, size) : x, y: this.y, size, font, color: o.color ?? this.c.ink })
  }
  para(s: string, size: number, o: { color?: unknown; x?: number; width?: number; bold?: boolean } = {}) {
    const x = o.x ?? M
    for (const line of this.wrap(s, size, o.width ?? RIGHT - x, o.bold ? this.bold : this.font)) {
      this.need(size + 4)
      this.text(line, x, size, { color: o.color, bold: o.bold })
      this.y -= size + 4
    }
  }
  rule(color: unknown = this.c.rule, thickness = 0.6) {
    this.page.drawLine({ start: { x: M, y: this.y }, end: { x: RIGHT, y: this.y }, thickness, color })
  }
  label(s: string, x = M) {
    this.text(s.toUpperCase(), x, 7.5, { color: this.c.muted })
  }
  /** One table row: each cell wraps in its column; the row is as tall as its tallest cell. */
  row(cols: readonly Col[], cells: ReadonlyArray<{ t: string; bold?: boolean; color?: unknown; sub?: string }>, size = 9.5, o: { head?: boolean; total?: boolean } = {}) {
    const wrapped = cells.map((c, i) => this.wrap(c.t, o.head ? 7.5 : size, cols[i]!.w - 6, c.bold || o.total ? this.bold : this.font))
    const subs = cells.map((c, i) => (c.sub ? this.wrap(c.sub, 8, cols[i]!.w - 6) : []))
    const lines = Math.max(...wrapped.map((w, i) => w.length + subs[i]!.length))
    const lh = size + 3.5
    this.need(lines * lh + 9)
    // The first line's baseline is `top`; the row ends under its last line's descenders.
    const top = this.y
    if (o.total) this.page.drawLine({ start: { x: M, y: top + size + 3 }, end: { x: RIGHT, y: top + size + 3 }, thickness: 0.9, color: this.c.ink })
    cells.forEach((c, i) => {
      const col = cols[i]!
      this.y = top
      for (const line of wrapped[i]!) {
        const s = o.head ? line.toUpperCase() : line
        this.text(s, col.x + 3, o.head ? 7.5 : size, { bold: c.bold || o.total, color: o.head ? this.c.muted : c.color, right: col.right ? col.x + col.w - 3 : undefined })
        this.y -= lh
      }
      for (const line of subs[i]!) {
        this.text(line, col.x + 3, 8, { color: this.c.muted })
        this.y -= lh
      }
    })
    const bottom = top - (lines - 1) * lh - 5
    if (!o.total) this.page.drawLine({ start: { x: M, y: bottom }, end: { x: RIGHT, y: bottom }, thickness: 0.4, color: this.c.rule })
    this.y = bottom - size - 4
  }
  big(left: string, right: string) {
    this.need(40)
    this.y -= 6
    this.page.drawRectangle({ x: M, y: this.y - 20, width: RIGHT - M, height: 30, borderColor: this.c.ink, borderWidth: 1.4 })
    this.y -= 10
    this.text(left, M + 10, 10.5, { bold: true })
    this.text(right, 0, 14, { bold: true, right: RIGHT - 10 })
    this.y -= 26
  }
  /**
   * A titled box round what `body` draws. A body that runs over a page gets a box on each page it is on: one from
   * the title to that page's foot, one from the next page's head to the last line. One rectangle from the first
   * page's top to the last page's bottom would be drawn upside down on the last page, round nothing.
   */
  boxed(title: string, body: () => void) {
    this.need(34)
    this.y -= 6
    const top = this.y + 10
    const first = this.pages.length - 1
    this.label(title, M + 8)
    this.y -= 13
    body()
    const bottom = this.y + 4
    const last = this.pages.length - 1
    for (let i = first; i <= last; i += 1) {
      const from = i === first ? top : BOX_HEAD
      const to = i === last ? bottom : BOX_FOOT
      this.pages[i]!.drawRectangle({ x: M, y: to, width: RIGHT - M, height: from - to, borderColor: this.c.rule, borderWidth: 0.7 })
    }
    this.y -= 10
  }
  counsel(list: readonly CounselSentence[]) {
    for (const s of list) {
      const lines = this.wrap(s.text, 8.5, RIGHT - M - 16)
      const h = lines.length * 12 + (s.pending ? 14 : 4)
      this.need(h + 8)
      const top = this.y + 9
      if (s.pending) {
        this.text('§ Draft wording. It waits on counsel and is not final.', M + 8, 7.5, { bold: true, color: this.c.violet })
        this.y -= 12
      }
      for (const line of lines) {
        this.text(line, M + 8, 8.5, { color: s.pending ? this.c.violet : this.c.ink })
        this.y -= 12
      }
      if (s.pending) this.page.drawRectangle({ x: M, y: this.y + 6, width: RIGHT - M, height: top - (this.y + 6), borderColor: this.c.violet, borderWidth: 0.7 })
      this.y -= 8
    }
  }
  letterhead(company: PaperCompany, title: string, lines: string[]) {
    this.text(company.name, M, 14, { bold: true })
    this.text(title, 0, 13, { bold: true, right: RIGHT })
    this.y -= 13
    const left = this.wrap(company.lines.join(' · '), 8.5, 300)
    const n = Math.max(left.length, lines.filter(Boolean).length)
    for (let i = 0; i < n; i += 1) {
      if (left[i]) this.text(left[i]!, M, 8.5, { color: this.c.muted })
      const r = lines.filter(Boolean)[i]
      if (r) this.text(r, 0, 9, { color: this.c.muted, right: RIGHT })
      this.y -= 12
    }
    this.y += 4
    this.rule(this.c.ink, 1.4)
    this.y -= 18
  }
  parties(a: { label: string; p: PaperParty }, b: { label: string; name: string; lines: string[] }) {
    const mid = M + (RIGHT - M) / 2
    const top = this.y
    this.label(a.label)
    this.y -= 12
    this.text(a.p.name, M, 10.5, { bold: true })
    this.y -= 12
    for (const l of a.p.lines) {
      this.text(l, M, 9, { color: this.c.muted })
      this.y -= 11
    }
    const leftEnd = this.y
    this.y = top
    this.label(b.label, mid)
    this.y -= 12
    for (const l of this.wrap(b.name, 10.5, RIGHT - mid, this.bold)) {
      this.text(l, mid, 10.5, { bold: true })
      this.y -= 12
    }
    for (const l of b.lines.filter(Boolean)) {
      this.text(l, mid, 9, { color: this.c.muted })
      this.y -= 11
    }
    this.y = Math.min(this.y, leftEnd) - 8
  }
  finish() {
    this.pages.forEach((p, i) => {
      p.drawLine({ start: { x: M, y: M + 14 }, end: { x: RIGHT, y: M + 14 }, thickness: 0.5, color: this.c.rule })
      const page = `Page ${i + 1} of ${this.pages.length}`
      p.drawText(subPaperPdfSafe(this.footLeft), { x: M, y: M, size: 8, font: this.font, color: this.c.muted })
      p.drawText(page, { x: RIGHT - this.font.widthOfTextAtSize(page, 8), y: M, size: 8, font: this.font, color: this.c.muted })
    })
  }
}

async function start(lib: PdfLibLike, title: string, footLeft: string): Promise<{ doc: Doc; w: Writer }> {
  const doc = (await lib.PDFDocument.create()) as unknown as Doc
  doc.setTitle(subPaperPdfSafe(title))
  const font = await doc.embedFont(lib.StandardFonts.Helvetica)
  const bold = await doc.embedFont(lib.StandardFonts.HelveticaBold)
  const w = new Writer(doc, font, bold, { ink: lib.rgb(0.07, 0.09, 0.15), muted: lib.rgb(0.42, 0.45, 0.5), rule: lib.rgb(0.82, 0.84, 0.86), red: lib.rgb(0.73, 0.11, 0.11), green: lib.rgb(0.09, 0.4, 0.2), violet: lib.rgb(0.3, 0.11, 0.58), shade: lib.rgb(0.97, 0.97, 0.98) }, footLeft)
  return { doc, w }
}

const two: Col[] = [{ x: M, w: RIGHT - M - 110 }, { x: RIGHT - 110, w: 110, right: true }]
const four: Col[] = [{ x: M, w: RIGHT - M - 270 }, { x: RIGHT - 270, w: 90, right: true }, { x: RIGHT - 180, w: 90, right: true }, { x: RIGHT - 90, w: 90, right: true }]
const pay: Col[] = [{ x: M, w: 190 }, { x: M + 190, w: 130 }, { x: M + 320, w: 96 }, { x: RIGHT - 100, w: 100, right: true }]

export async function buildWorkStatementPdf(lib: PdfLibLike, a: WorkStatement): Promise<Uint8Array> {
  const { doc, w } = await start(lib, `${a.title} · ${a.sub.name} · ${a.number || a.job.label}`, a.foot)
  const c = w.c
  w.letterhead(a.company, a.title, [a.number ? `No. ${a.number}` : 'Not numbered yet', `Issued ${a.issued}`])
  w.parties({ label: 'Work done by', p: a.sub }, { label: 'Job', name: a.job.label, lines: [a.job.address, a.job.day ? `work dated ${a.job.day}` : ''] })
  w.row(two, [{ t: 'Work' }, { t: 'Amount' }], 9.5, { head: true })
  for (const l of a.lines) w.row(two, [{ t: l.label }, { t: paperMoney(l.amount) }])
  if (a.reconstructed) w.row(two, [{ t: 'No priced lines. The total is read back from the money moved.', color: c.muted }, { t: '' }])
  w.row(two, [{ t: 'Agreed for this work' }, { t: paperMoney(a.agreed) }], 9.5, { total: true })
  for (const b of a.backcharges) w.row(two, [{ t: `Back-charge, ${b.day}${b.reason ? ` · ${b.reason}` : ''}`, color: c.red }, { t: paperMoney(-b.amount), color: c.red }])
  if (a.backcharges.length) w.row(two, [{ t: 'This statement comes to' }, { t: paperMoney(a.comesTo) }], 9.5, { total: true })
  w.y -= 8
  if (a.payments.length) {
    w.row(pay, [{ t: 'Paid on this statement' }, { t: 'How' }, { t: 'Payment record' }, { t: 'Amount' }], 9.5, { head: true })
    for (const p of a.payments) w.row(pay, [{ t: `${p.day} · ${p.words}` }, { t: p.how || 'Not recorded' }, { t: p.recordNo || '—' }, { t: paperMoney(p.amount), color: c.green }])
    w.row(pay, [{ t: 'Paid so far' }, { t: '' }, { t: '' }, { t: paperMoney(a.paidSoFar) }], 9.5, { total: true })
  } else w.para('Nothing paid on this statement yet.', 9, { color: c.muted })
  w.big('Still open on this statement', paperMoney(a.stillOpen))
  if (a.over > 0) w.para(`Paid ${paperMoney(a.over)} past what this statement comes to. It is held as your credit.`, 9)
  w.counsel(a.sentences.filter((s) => s.key === 'notAnInvoice'))
  if (a.confirm) {
    w.boxed('Confirmed by the sub', () => w.para(a.confirm!.words, 9, { x: M + 8, width: RIGHT - M - 16 }))
    w.counsel(a.sentences.filter((s) => s.key === 'confirmMeans'))
  }
  w.counsel(a.sentences.filter((s) => s.key === 'workOrderTerms'))
  w.para('Something wrong? Reply to the message this came with, or call the office.', 9, { color: c.muted })
  w.finish()
  return doc.save()
}

export async function buildPaymentRecordPdf(lib: PdfLibLike, b: PaymentRecord): Promise<Uint8Array> {
  const { doc, w } = await start(lib, `${b.title} · ${b.sub.name} · ${b.number || b.sentOn}`, b.foot)
  const c = w.c
  w.letterhead(b.company, b.title, [b.number ? `No. ${b.number}` : 'Not numbered', `Sent ${b.sentOn}`])
  w.parties({ label: 'Paid to', p: b.sub }, { label: 'How it was sent', name: b.how, lines: [] })
  w.big('Amount sent', paperMoney(b.amountSent))
  w.row(four, [{ t: 'Applied to' }, { t: 'Open before' }, { t: 'This payment' }, { t: 'Open after' }], 9.5, { head: true })
  for (const x of b.applied) w.row(four, [{ t: `${x.sheetName} · ${x.job}`, bold: true, sub: `${x.day ? `work dated ${x.day} · ` : ''}${x.words}` }, { t: paperMoney(x.openBefore) }, { t: paperMoney(x.thisPayment), color: c.green }, { t: paperMoney(x.openAfter) }])
  if (b.creditKept > 0) w.row(four, [{ t: 'Kept as your credit', sub: 'Sent past what the statements needed. The next payment uses it first.' }, { t: '' }, { t: paperMoney(b.creditKept), color: c.green }, { t: '' }])
  w.row(four, [{ t: 'Applied' }, { t: '' }, { t: paperMoney(b.appliedTotal + b.creditKept) }, { t: '' }], 9.5, { total: true })
  w.boxed('After this payment', () => {
    if (b.after.length === 0) w.para('Nothing is still open.', 9, { x: M + 8 })
    for (const x of b.after) {
      w.need(14)
      w.text(`${x.sheetName} · ${x.job}`, M + 8, 9)
      w.text(paperMoney(x.open), 0, 9, { right: RIGHT - 8 })
      w.y -= 13
    }
    if (b.after.length) {
      w.need(14)
      w.text(`Still open across ${b.after.length} ${b.after.length === 1 ? 'statement' : 'statements'}`, M + 8, 9.5, { bold: true })
      w.text(paperMoney(b.stillOpenAfter), 0, 9.5, { bold: true, right: RIGHT - 8 })
      w.y -= 13
    }
  })
  if (b.note) w.para(`Note from the office: ${b.note}`, 9)
  w.counsel(b.sentences)
  w.boxed('Received', () => w.para(b.received, 9, { x: M + 8, width: RIGHT - M - 16, color: c.muted }))
  w.finish()
  return doc.save()
}

export async function buildStatementOfAccountPdf(lib: PdfLibLike, s: StatementOfAccount, range: StatementRange): Promise<Uint8Array> {
  const { doc, w } = await start(lib, `${s.title} · ${s.sub.name} · ${s.period}`, s.foot)
  const c = w.c
  w.letterhead(s.company, s.title, [s.number ? `No. ${s.number}` : 'Not numbered yet', s.period])
  w.parties({ label: 'Account of', p: s.sub }, { label: 'Prepared', name: s.preparedOn, lines: [`All dates are ${s.zone}`] })
  w.big(`Still open on ${s.closingDay}`, paperMoney(s.stillOpen))
  if (s.credit > 0) w.para(`You also hold ${paperMoney(s.credit)} with us as credit. The next payment uses it first.`, 9)
  w.row(four, [{ t: 'Statement · job' }, { t: 'Comes to' }, { t: 'Paid' }, { t: 'Open' }], 9.5, { head: true })
  const forward = s.rows.filter((r) => r.section === 'forward')
  const period = s.rows.filter((r) => r.section === 'period')
  const draw = (r: StatementOfAccount['rows'][number]) => w.row(four, [{ t: `${r.sheetName} · ${r.job}`, bold: true, sub: r.words }, { t: paperMoney(r.comesTo) }, { t: r.paid > 0 ? paperMoney(r.paid) : '—' }, { t: paperMoney(r.open), bold: r.open > 0 }])
  if (forward.length) {
    w.row(four, [{ t: range.from ? 'Brought forward from before the period' : 'Brought forward' }, { t: '' }, { t: '' }, { t: '' }], 9.5, { head: true })
    forward.forEach(draw)
    if (period.length) w.row(four, [{ t: 'Work in this period' }, { t: '' }, { t: '' }, { t: '' }], 9.5, { head: true })
  }
  period.forEach(draw)
  if (s.rows.length === 0) w.para('No statements in this period.', 9, { color: c.muted })
  w.row(four, [{ t: 'Totals' }, { t: paperMoney(s.totals.comesTo) }, { t: paperMoney(s.totals.paid) }, { t: paperMoney(s.totals.open) }], 9.5, { total: true })
  w.boxed('Last payments', () => {
    if (s.lastPayments.length === 0) w.para('No payments in this period.', 9, { x: M + 8 })
    for (const p of s.lastPayments) {
      w.need(14)
      w.text(p.day, M + 8, 9)
      w.text(p.how, M + 150, 9)
      w.text(p.number || '—', M + 330, 9)
      w.text(paperMoney(p.amount), 0, 9, { right: RIGHT - 8, color: c.green })
      w.y -= 13
    }
    if (s.lastPayments.length) {
      w.need(14)
      w.text('Paid in this period', M + 8, 9.5, { bold: true })
      w.text(paperMoney(s.paidInPeriod), 0, 9.5, { bold: true, right: RIGHT - 8 })
      w.y -= 13
    }
  })
  w.boxed('How it adds up', () => w.para(statementAddsWords(s, range), 9, { x: M + 8, width: RIGHT - M - 16 }))
  if (s.undated > 0) w.para(`${s.undated} ${s.undated === 1 ? 'line has' : 'lines have'} no date and ${s.undated === 1 ? 'is' : 'are'} left off a statement for a period.`, 9, { color: c.muted })
  if (s.paidThisYear) {
    w.para(`Paid to ${s.sub.name} in ${s.paidThisYear.year} so far: ${paperMoney(s.paidThisYear.amount)}.`, 9)
    w.counsel(s.sentences.filter((x) => x.key === 'notATaxForm'))
  }
  w.counsel(s.sentences.filter((x) => x.key === 'openUnderTerms'))
  w.finish()
  return doc.save()
}
