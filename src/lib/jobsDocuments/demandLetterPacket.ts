/**
 * The demand letter's packet (v2.3429): the letter, then its exhibits — the
 * invoice as the customer received it (Exhibit A, always), the signed
 * agreement when one exists (Exhibit B), the delivery record (Exhibit C) —
 * merged into one PDF with pdf-lib, every exhibit page stamped with its
 * label. One file, one print, and the record names what went out.
 */

export type DemandExhibitLabel = 'A' | 'B' | 'C'

/** What the letter names and the record stores. */
export type DemandExhibit = {
  label: DemandExhibitLabel
  /** "Invoice #867-2608180928, as sent August 18, 2026" */
  title: string
  pages: number
}

export type DemandExhibitInput = {
  label: DemandExhibitLabel
  title: string
  /** A rendered PDF (any page count). */
  blob: Blob
}

export type DemandLetterPacket = {
  blob: Blob
  letterPages: number
  exhibits: DemandExhibit[]
  totalPages: number
}

/** "Enclosures: Exhibit A — Invoice #… (1 page) · Exhibit C — Delivery record (1 page)". */
export function enclosuresLine(exhibits: readonly Pick<DemandExhibit, 'label' | 'title' | 'pages'>[]): string {
  if (exhibits.length === 0) return ''
  return `Enclosure${exhibits.length > 1 ? 's' : ''}: ${exhibits
    .map((e) => `Exhibit ${e.label} — ${e.title}${e.pages > 0 ? ` (${e.pages} page${e.pages === 1 ? '' : 's'})` : ''}`)
    .join(' · ')}`
}

/** The sentence under the statement: which exhibit is which. */
export function exhibitsSentence(exhibits: readonly Pick<DemandExhibit, 'label' | 'title'>[]): string {
  const a = exhibits.find((e) => e.label === 'A')
  const b = exhibits.find((e) => e.label === 'B')
  const c = exhibits.find((e) => e.label === 'C')
  const parts: string[] = []
  if (a) parts.push('The invoice is enclosed as Exhibit A')
  if (b) parts.push(`${a ? 'the' : 'The'} signed agreement as Exhibit B`)
  if (c) parts.push(`${a || b ? 'the' : 'The'} delivery record as Exhibit C`)
  if (parts.length === 0) return ''
  if (parts.length === 1) return `${parts[0]}.`
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}.`
}

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

/** Merge the letter and its exhibits; stamp every exhibit page. */
export async function buildDemandLetterPacket(
  letter: Blob,
  exhibits: readonly DemandExhibitInput[],
  loadPdfLib: () => Promise<PdfLibLike> = async () => (await import('pdf-lib')) as unknown as PdfLibLike,
): Promise<DemandLetterPacket> {
  const lib = await loadPdfLib()
  const out = await lib.PDFDocument.create()
  const bold = await out.embedFont(lib.StandardFonts.HelveticaBold)
  const regular = await out.embedFont(lib.StandardFonts.Helvetica)

  const letterDoc = await lib.PDFDocument.load(await letter.arrayBuffer(), { ignoreEncryption: true })
  const letterPages = await out.copyPages(letterDoc, letterDoc.getPageIndices())
  for (const p of letterPages) out.addPage(p)

  const recorded: DemandExhibit[] = []
  const stampInk = lib.rgb(0.54, 0.11, 0.11)
  for (const ex of exhibits) {
    const src = await lib.PDFDocument.load(await ex.blob.arrayBuffer(), { ignoreEncryption: true })
    const pages = await out.copyPages(src, src.getPageIndices())
    const count = pages.length
    pages.forEach((page, i) => {
      out.addPage(page)
      const w = page.getWidth()
      const h = page.getHeight()
      const stamp = `EXHIBIT ${ex.label}`
      const size = 11
      const textW = bold.widthOfTextAtSize(stamp, size)
      const padX = 7
      const boxW = textW + padX * 2
      const boxH = 20
      const x = w - 36 - boxW
      const y = h - 30 - boxH
      page.drawRectangle({ x, y, width: boxW, height: boxH, borderColor: stampInk, borderWidth: 1.2, color: lib.rgb(1, 1, 1), opacity: 0.85 })
      page.drawText(stamp, { x: x + padX, y: y + 6, size, font: bold, color: stampInk })
      const foot = `Exhibit ${ex.label} · ${ex.title} · page ${i + 1} of ${count}`
      page.drawText(foot, { x: 36, y: 16, size: 7, font: regular, color: lib.rgb(0.45, 0.45, 0.45) })
    })
    recorded.push({ label: ex.label, title: ex.title, pages: count })
  }

  const bytes = await out.save()
  return {
    blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }),
    letterPages: letterPages.length,
    exhibits: recorded,
    totalPages: out.getPageCount(),
  }
}
