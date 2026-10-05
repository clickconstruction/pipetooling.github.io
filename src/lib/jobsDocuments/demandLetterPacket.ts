/**
 * The demand letter's packet (v2.3429): the letter, then its exhibits — each
 * invoice as the customer received it, the signed agreement when one exists,
 * the delivery record — merged into one PDF with pdf-lib, every exhibit page
 * stamped with its label. One file, one print, and the record names what went
 * out. The labels run in order with no gap (`exhibitLabels`): several
 * invoices are A-1, A-2, …, and the next paper takes the next letter.
 */

export type DemandExhibitKind = 'invoice' | 'agreement' | 'delivery'

/** "A", "A-2", "B". Letters recorded before the labels ran in order are A (invoice), B (agreement), C (delivery record). */
export type DemandExhibitLabel = string

/** What the letter names and the record stores. */
export type DemandExhibit = {
  label: DemandExhibitLabel
  /** Absent on letters recorded before the labels ran in order; `exhibitKind` reads those by their letter. */
  kind?: DemandExhibitKind
  /** "Invoice #867-2608180928, as sent August 18, 2026" */
  title: string
  pages: number
}

export type DemandExhibitInput = {
  label: DemandExhibitLabel
  kind?: DemandExhibitKind
  title: string
  /** A rendered PDF (any page count). */
  blob: Blob
  /** The stamp text; defaults to "EXHIBIT <label>". A § 53.056 notice stamps its invoice "INVOICE" (v2.3437). */
  stamp?: string
}

export type DemandLetterPacket = {
  blob: Blob
  letterPages: number
  exhibits: DemandExhibit[]
  totalPages: number
}

/** What an exhibit is: its recorded kind, else its letter the way older letters used them. */
export function exhibitKind(e: Pick<DemandExhibit, 'label' | 'kind'>): DemandExhibitKind {
  if (e.kind) return e.kind
  const letter = e.label.trim().charAt(0).toUpperCase()
  return letter === 'A' ? 'invoice' : letter === 'B' ? 'agreement' : 'delivery'
}

/**
 * The labels a packet's exhibits wear, in the order they are bound: one
 * invoice is A, several are A-1 … A-n; the signed agreement and the delivery
 * record take the next letters, so a packet with no agreement never skips B.
 */
export function exhibitLabels(input: { invoices: number; agreement: boolean; delivery: boolean }): { invoices: string[]; agreement: string; delivery: string } {
  const n = Math.max(0, Math.floor(input.invoices))
  const invoices = n === 1 ? ['A'] : Array.from({ length: n }, (_, i) => `A-${i + 1}`)
  let next = n > 0 ? 1 : 0
  const letter = () => String.fromCharCode(65 + next++)
  const agreement = input.agreement ? letter() : ''
  const delivery = input.delivery ? letter() : ''
  return { invoices, agreement, delivery }
}

/** One line per exhibit: "Exhibit A-1 — Invoice #… (1 page)". */
export function enclosureItems(exhibits: readonly Pick<DemandExhibit, 'label' | 'title' | 'pages'>[]): string[] {
  return exhibits.map((e) => `Exhibit ${e.label} — ${e.title}${e.pages > 0 ? ` (${e.pages} page${e.pages === 1 ? '' : 's'})` : ''}`)
}

/** The same list as two columns, for a page that draws no dash: the exhibit's label, then what it is. */
export function enclosureEntries(exhibits: readonly Pick<DemandExhibit, 'label' | 'title' | 'pages'>[]): Array<{ label: string; text: string }> {
  return exhibits.map((e) => ({ label: `Exhibit ${e.label}`, text: `${e.title}${e.pages > 0 ? ` (${e.pages} page${e.pages === 1 ? '' : 's'})` : ''}` }))
}

/** "Enclosures: Exhibit A — Invoice #… (1 page) · Exhibit B — Delivery record (1 page)". */
export function enclosuresLine(exhibits: readonly Pick<DemandExhibit, 'label' | 'title' | 'pages'>[]): string {
  if (exhibits.length === 0) return ''
  return `Enclosure${exhibits.length > 1 ? 's' : ''}: ${enclosureItems(exhibits).join(' · ')}`
}

/** The sentence under the statement: which exhibit is which. */
export function exhibitsSentence(exhibits: readonly Pick<DemandExhibit, 'label' | 'kind' | 'title'>[]): string {
  const invoices = exhibits.filter((e) => exhibitKind(e) === 'invoice')
  const b = exhibits.find((e) => exhibitKind(e) === 'agreement')
  const c = exhibits.find((e) => exhibitKind(e) === 'delivery')
  const a = invoices.length > 0
  const parts: string[] = []
  if (invoices.length === 1) parts.push(`The invoice is enclosed as Exhibit ${invoices[0]!.label}`)
  else if (invoices.length === 2) parts.push(`The invoices are enclosed as Exhibits ${invoices[0]!.label} and ${invoices[1]!.label}`)
  else if (invoices.length > 2) parts.push(`The invoices are enclosed as Exhibits ${invoices[0]!.label} to ${invoices[invoices.length - 1]!.label}`)
  if (b) parts.push(`${a ? 'the' : 'The'} signed agreement as Exhibit ${b.label}`)
  if (c) parts.push(`${a || b ? 'the' : 'The'} delivery record as Exhibit ${c.label}`)
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
      const stamp = (ex.stamp ?? '').trim() || `EXHIBIT ${ex.label}`
      const size = 11
      const textW = bold.widthOfTextAtSize(stamp, size)
      const padX = 7
      const boxW = textW + padX * 2
      const boxH = 20
      const x = w - 36 - boxW
      const y = h - 30 - boxH
      page.drawRectangle({ x, y, width: boxW, height: boxH, borderColor: stampInk, borderWidth: 1.2, color: lib.rgb(1, 1, 1), opacity: 0.85 })
      page.drawText(stamp, { x: x + padX, y: y + 6, size, font: bold, color: stampInk })
      const foot = `${(ex.stamp ?? '').trim() ? ex.title : `Exhibit ${ex.label} · ${ex.title}`} · page ${i + 1} of ${count}`
      page.drawText(foot, { x: 36, y: 16, size: 7, font: regular, color: lib.rgb(0.45, 0.45, 0.45) })
    })
    recorded.push({ label: ex.label, ...(ex.kind ? { kind: ex.kind } : {}), title: ex.title, pages: count })
  }

  const bytes = await out.save()
  return {
    blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }),
    letterPages: letterPages.length,
    exhibits: recorded,
    totalPages: out.getPageCount(),
  }
}

/** Concatenate PDFs in order, no stamps, no footers (v2.3482: the cover letter in front of an emailed notice). */
export async function mergePdfBlobs(blobs: readonly Blob[], loadPdfLib: () => Promise<PdfLibLike> = async () => (await import('pdf-lib')) as unknown as PdfLibLike): Promise<Blob> {
  const lib = await loadPdfLib()
  const out = await lib.PDFDocument.create()
  for (const b of blobs) {
    const src = await lib.PDFDocument.load(await b.arrayBuffer(), { ignoreEncryption: true })
    const pages = await out.copyPages(src, src.getPageIndices())
    for (const p of pages) out.addPage(p)
  }
  const bytes = await out.save()
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}
