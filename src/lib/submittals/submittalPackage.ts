/**
 * The submittal package PDF (Submittals stage 2c): a cover table — one line
 * per row, in tag order, with the package page its cut sheet starts on — then
 * every row's sheet pages copied out of the dropped vendor PDFs, each page
 * stamped with its tag and status. Two kernels: the cover is a jsPDF render
 * of a pure model (`buildCoverModel`), the merge is pdf-lib
 * (`buildSubmittalPackage`, the demand-letter packet's primitive). The plan
 * (`planPackage`) is pure and tested without a PDF in sight.
 */
import { loadJsPDF } from '../loadJsPDF'
import { STATUS_LABELS, type ProductStatus } from './productStatus'

export type PackageRowInput = {
  tag: string
  status: ProductStatus
  specified: string
  submitted: string
  house: string | null
  reason: string
  leadTime: string
  /** Index into the revision's source files, and the 1-based pages there. */
  sheetFile: number | null
  sheetPages: number[]
}

export type PackagePlanRow = PackageRowInput & {
  /** 1-based page in the package where this row's sheet starts; null when it has none. */
  startPage: number | null
}

export type PackagePlan = {
  rows: PackagePlanRow[]
  coverPages: number
  sheetPages: number
  totalPages: number
  rowsWithSheet: number
  rowsWithoutSheet: string[]
}

/** Lay the sheets out behind the cover, in row order; missing rows never carry a sheet. */
export function planPackage(rows: ReadonlyArray<PackageRowInput>, coverPages: number): PackagePlan {
  let next = coverPages + 1
  const out: PackagePlanRow[] = []
  const without: string[] = []
  let withSheet = 0
  for (const r of rows) {
    const has = r.sheetFile != null && r.sheetPages.length > 0
    if (has) {
      out.push({ ...r, startPage: next })
      next += r.sheetPages.length
      withSheet += 1
    } else {
      out.push({ ...r, startPage: null })
      if (r.status !== 'missing') without.push(r.tag.trim() || 'accessory')
    }
  }
  return { rows: out, coverPages, sheetPages: next - 1 - coverPages, totalPages: next - 1, rowsWithSheet: withSheet, rowsWithoutSheet: without }
}

export type CoverInput = {
  companyName: string
  companyTagline: string
  officePhone: string
  /** "B398 · ZZ Test" */
  bidLabel: string
  projectAddress: string | null
  gcName: string | null
  revNumber: number
  /** "September 15, 2026" */
  dateLabel: string
  note: string | null
}

export type CoverModel = {
  title: string
  subtitle: string
  meta: string[]
  countsLine: string
  header: string[]
  rows: string[][]
  notes: string[]
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/** The words on the cover, from the plan — what the renderer draws and the test reads. */
export function buildCoverModel(input: CoverInput, plan: PackagePlan): CoverModel {
  const by: Record<ProductStatus, number> = { as_specified: 0, superseded: 0, equal: 0, alternate: 0, design_change: 0, missing: 0, accessory: 0 }
  for (const r of plan.rows) by[r.status] += 1
  const counts: string[] = [plural(plan.rows.length, 'row', 'rows')]
  if (by.as_specified) counts.push(`${by.as_specified} as specified`)
  if (by.superseded) counts.push(`${by.superseded} superseded`)
  if (by.equal) counts.push(`${by.equal} equal`)
  if (by.alternate) counts.push(plural(by.alternate, 'alternate', 'alternates'))
  if (by.design_change) counts.push(plural(by.design_change, 'design change', 'design changes'))
  if (by.missing) counts.push(`${by.missing} missing`)
  if (by.accessory) counts.push(plural(by.accessory, 'accessory', 'accessories'))
  counts.push(`${plan.rowsWithSheet} cut sheet${plan.rowsWithSheet === 1 ? '' : 's'} attached`)
  const notes: string[] = []
  if (plan.rowsWithoutSheet.length > 0) notes.push(`Cut sheets to follow for: ${plan.rowsWithoutSheet.join(', ')}.`)
  if (by.accessory > 0) notes.push('Accessories are required by the fixtures and left to the contractor by the schedule; they are listed for the record.')
  if (input.note?.trim()) notes.push(input.note.trim())
  return {
    title: `SUBMITTAL · Rev ${input.revNumber}`,
    subtitle: 'Plumbing fixtures & equipment',
    meta: [input.bidLabel, input.projectAddress ?? '', input.gcName ? `To: ${input.gcName}` : '', input.dateLabel].filter(Boolean),
    countsLine: counts.join(' · '),
    header: ['Tag', 'Specified', 'Submitted', 'Status', 'Reason', 'Lead time', 'Sheet'],
    rows: plan.rows.map((r) => [
      r.tag.trim() || '—',
      r.specified || (r.tag.trim() ? '—' : 'not on the schedule'),
      r.submitted ? `${r.submitted}${r.house ? ` · ${r.house}` : ''}` : '—',
      STATUS_LABELS[r.status],
      r.reason || '—',
      r.leadTime || '—',
      r.startPage != null ? `p. ${r.startPage}${r.sheetPages.length > 1 ? `–${r.startPage + r.sheetPages.length - 1}` : ''}` : r.status === 'missing' ? '—' : 'to follow',
    ]),
    notes,
  }
}

// ---------- the cover, rendered ----------

const PAGE_W = 279.4
const PAGE_H = 215.9
const MARGIN = 12
const CONTENT_W = PAGE_W - 2 * MARGIN
const BOTTOM = PAGE_H - 12
const COPPER: [number, number, number] = [176, 102, 47]
const INK: [number, number, number] = [22, 40, 60]
const MUTED: [number, number, number] = [90, 107, 126]
const HAIR: [number, number, number] = [221, 214, 200]
/** Tag · Specified · Submitted · Status · Reason · Lead time · Sheet (mm, sums to CONTENT_W). */
const COL_W = [18, 56, 62, 24, 61, 16, 18.4]

export async function renderCoverPdf(model: CoverModel, input: Pick<CoverInput, 'companyName' | 'companyTagline' | 'officePhone'>): Promise<{ blob: Blob; pages: number }> {
  const JsPDF = await loadJsPDF()
  const doc = new JsPDF({ unit: 'mm', format: 'letter', orientation: 'landscape' })
  let y = MARGIN
  const ink = () => doc.setTextColor(INK[0], INK[1], INK[2])
  const muted = () => doc.setTextColor(MUTED[0], MUTED[1], MUTED[2])

  const header = () => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    ink()
    doc.text(input.companyName.toUpperCase(), MARGIN, y + 5)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    muted()
    doc.text([input.companyTagline, input.officePhone].filter(Boolean).join(' · ').toUpperCase(), MARGIN, y + 9.5)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    ink()
    doc.text(model.title, MARGIN + CONTENT_W, y + 5, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    muted()
    doc.text(model.meta.join(' · '), MARGIN + CONTENT_W, y + 9.5, { align: 'right' })
    y += 13
    doc.setDrawColor(COPPER[0], COPPER[1], COPPER[2])
    doc.setLineWidth(0.7)
    doc.line(MARGIN, y, MARGIN + CONTENT_W, y)
    doc.setLineWidth(0.2)
    y += 6
  }

  const tableHead = () => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(COPPER[0], COPPER[1], COPPER[2])
    let x = MARGIN
    model.header.forEach((h, i) => {
      doc.text(h.toUpperCase(), x, y)
      x += COL_W[i] ?? 20
    })
    y += 1.5
    doc.setDrawColor(HAIR[0], HAIR[1], HAIR[2])
    doc.line(MARGIN, y, MARGIN + CONTENT_W, y)
    y += 4
    ink()
  }

  header()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  ink()
  doc.text(model.subtitle, MARGIN, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  muted()
  doc.text(model.countsLine, MARGIN, y)
  y += 6
  tableHead()

  doc.setFontSize(8)
  for (const row of model.rows) {
    const cells = row.map((text, i) => doc.splitTextToSize(text, (COL_W[i] ?? 20) - 2) as string[])
    const lines = Math.max(1, ...cells.map((c) => c.length))
    const rowH = lines * 3.6 + 2
    if (y + rowH > BOTTOM) {
      doc.addPage()
      y = MARGIN
      header()
      tableHead()
      doc.setFontSize(8)
    }
    let x = MARGIN
    cells.forEach((c, i) => {
      doc.setFont('helvetica', i === 0 ? 'bold' : 'normal')
      ink()
      c.forEach((line, li) => doc.text(line, x, y + li * 3.6))
      x += COL_W[i] ?? 20
    })
    y += rowH
    doc.setDrawColor(HAIR[0], HAIR[1], HAIR[2])
    doc.line(MARGIN, y - 1.5, MARGIN + CONTENT_W, y - 1.5)
  }

  if (model.notes.length > 0) {
    y += 3
    doc.setFontSize(8)
    for (const n of model.notes) {
      const lines = doc.splitTextToSize(n, CONTENT_W) as string[]
      if (y + lines.length * 3.8 > BOTTOM) {
        doc.addPage()
        y = MARGIN
        header()
      }
      doc.setFont('helvetica', 'normal')
      muted()
      for (const line of lines) {
        doc.text(line, MARGIN, y)
        y += 3.8
      }
      y += 1
    }
  }

  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    muted()
    doc.text(`${model.title} · cover ${p} of ${pages}`, MARGIN + CONTENT_W, PAGE_H - 6, { align: 'right' })
  }
  return { blob: doc.output('blob'), pages }
}

// ---------- the merge ----------

type PdfLibLike = {
  PDFDocument: {
    create(): Promise<PdfDocLike>
    load(bytes: ArrayBuffer | Uint8Array, opts?: { ignoreEncryption?: boolean }): Promise<PdfDocLike>
  }
  StandardFonts: { HelveticaBold: string; Helvetica: string }
  rgb(r: number, g: number, b: number): unknown
}
type PdfPageLike = {
  getWidth(): number
  getHeight(): number
  drawText(text: string, opts: Record<string, unknown>): void
  drawRectangle(opts: Record<string, unknown>): void
}
type PdfFontLike = { widthOfTextAtSize(text: string, size: number): number }
type PdfDocLike = {
  getPageCount(): number
  getPageIndices(): number[]
  copyPages(src: PdfDocLike, indices: number[]): Promise<PdfPageLike[]>
  addPage(page: PdfPageLike): PdfPageLike
  embedFont(name: string): Promise<PdfFontLike>
  save(): Promise<Uint8Array>
}

export type PackageSheetInput = {
  tag: string
  status: ProductStatus
  /** The line under the stamp: the submitted product. */
  title: string
  /** Index into `files`. */
  fileIndex: number
  /** 1-based pages of that file. */
  pages: number[]
}

export type SubmittalPackageResult = {
  blob: Blob
  coverPages: number
  sheetPages: number
  totalPages: number
  /** One entry per sheet that made it in, in order: the package pages it occupies. */
  manifest: Array<{ tag: string; status: ProductStatus; pages: number[] }>
  /** Sheets whose file or pages could not be read (kept out, named). */
  skipped: string[]
}

const STAMP_INK: Record<ProductStatus, [number, number, number]> = {
  as_specified: [0.12, 0.48, 0.23],
  superseded: [0.11, 0.31, 0.85],
  equal: [0.11, 0.31, 0.85],
  alternate: [0.71, 0.4, 0.09],
  design_change: [0.73, 0.14, 0.14],
  missing: [0.73, 0.14, 0.14],
  accessory: [0.42, 0.45, 0.5],
}

/** The cover, then every sheet's pages in order, each stamped "TAG · STATUS" and footed with the product. */
export async function buildSubmittalPackage(
  cover: Blob,
  files: ReadonlyArray<Uint8Array | ArrayBuffer>,
  sheets: ReadonlyArray<PackageSheetInput>,
  loadPdfLib: () => Promise<PdfLibLike> = async () => (await import('pdf-lib')) as unknown as PdfLibLike,
): Promise<SubmittalPackageResult> {
  const lib = await loadPdfLib()
  const out = await lib.PDFDocument.create()
  const bold = await out.embedFont(lib.StandardFonts.HelveticaBold)
  const regular = await out.embedFont(lib.StandardFonts.Helvetica)

  const coverDoc = await lib.PDFDocument.load(await cover.arrayBuffer(), { ignoreEncryption: true })
  const coverPages = await out.copyPages(coverDoc, coverDoc.getPageIndices())
  for (const p of coverPages) out.addPage(p)

  const docs = new Map<number, PdfDocLike | null>()
  const openFile = async (i: number): Promise<PdfDocLike | null> => {
    if (docs.has(i)) return docs.get(i) ?? null
    const bytes = files[i]
    let doc: PdfDocLike | null = null
    if (bytes) {
      try {
        doc = await lib.PDFDocument.load(bytes, { ignoreEncryption: true })
      } catch {
        doc = null
      }
    }
    docs.set(i, doc)
    return doc
  }

  const manifest: SubmittalPackageResult['manifest'] = []
  const skipped: string[] = []
  let sheetPages = 0
  for (const sheet of sheets) {
    const doc = await openFile(sheet.fileIndex)
    const total = doc?.getPageCount() ?? 0
    const wanted = [...new Set(sheet.pages)].filter((p) => Number.isInteger(p) && p >= 1 && p <= total).sort((a, b) => a - b)
    if (!doc || wanted.length === 0) {
      skipped.push(sheet.tag.trim() || 'accessory')
      continue
    }
    const pages = await out.copyPages(doc, wanted.map((p) => p - 1))
    const placed: number[] = []
    const stamp = `${sheet.tag.trim() || 'ACCESSORY'} · ${STATUS_LABELS[sheet.status]}`.toUpperCase()
    const ink = STAMP_INK[sheet.status]
    const color = lib.rgb(ink[0], ink[1], ink[2])
    pages.forEach((page, i) => {
      out.addPage(page)
      placed.push(out.getPageCount())
      const w = page.getWidth()
      const h = page.getHeight()
      const size = 10
      const textW = bold.widthOfTextAtSize(stamp, size)
      const padX = 6
      const boxW = textW + padX * 2
      const boxH = 18
      const x = w - 30 - boxW
      const y = h - 24 - boxH
      page.drawRectangle({ x, y, width: boxW, height: boxH, borderColor: color, borderWidth: 1.2, color: lib.rgb(1, 1, 1), opacity: 0.88 })
      page.drawText(stamp, { x: x + padX, y: y + 5.5, size, font: bold, color })
      page.drawText(`${sheet.tag.trim() || 'Accessory'} · ${sheet.title} · sheet page ${i + 1} of ${pages.length}`, { x: 30, y: 14, size: 7, font: regular, color: lib.rgb(0.45, 0.45, 0.45) })
    })
    sheetPages += pages.length
    manifest.push({ tag: sheet.tag, status: sheet.status, pages: placed })
  }

  const bytes = await out.save()
  return {
    blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }),
    coverPages: coverPages.length,
    sheetPages,
    totalPages: out.getPageCount(),
    manifest,
    skipped,
  }
}

/** "Submittal Rev 3 - B398 ZZ Test.pdf" */
export function packageFileName(revNumber: number, bidLabel: string): string {
  const base = `Submittal Rev ${revNumber} - ${bidLabel}`.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()
  return `${base}.pdf`
}
