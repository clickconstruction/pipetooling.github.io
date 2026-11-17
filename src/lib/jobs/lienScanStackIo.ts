/**
 * A scanned stack's bytes (punch list #366): how many pages it has, and one lien's pages cut out as a PDF of their
 * own. Both run in the browser with `pdf-lib`, loaded when first wanted, so the stack itself is never uploaded and a
 * large one is fine: only each lien's piece meets the job folder's limit.
 */
type PdfLibDoc = { getPageCount(): number; copyPages(src: PdfLibDoc, indices: number[]): Promise<unknown[]>; addPage(page: unknown): void; save(): Promise<Uint8Array> }
type PdfLib = { PDFDocument: { load(bytes: ArrayBuffer, opts?: { ignoreEncryption?: boolean }): Promise<PdfLibDoc>; create(): Promise<PdfLibDoc> } }

const loadPdfLib = async (): Promise<PdfLib> => (await import('pdf-lib')) as unknown as PdfLib

/** How many pages a picked PDF has; null when it cannot be read as one (a picture, or a file that is not a PDF inside). */
export async function lienScanPageCount(file: Blob, load: () => Promise<PdfLib> = loadPdfLib): Promise<number | null> {
  try {
    const lib = await load()
    return (await lib.PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })).getPageCount()
  } catch {
    return null
  }
}

/**
 * The named pages of a stack as a PDF of their own, in the order given. Pages are 1-based; one that the stack does
 * not have is an error, since a piece missing a page would be saved as a lien's whole affidavit.
 */
export async function cutLienScanPages(stack: Blob, pages: ReadonlyArray<number>, name: string, load: () => Promise<PdfLib> = loadPdfLib): Promise<File> {
  const lib = await load()
  const src = await lib.PDFDocument.load(await stack.arrayBuffer(), { ignoreEncryption: true })
  const count = src.getPageCount()
  if (pages.length === 0) throw new Error('No page was picked for this lien.')
  const missing = pages.find((p) => !Number.isInteger(p) || p < 1 || p > count)
  if (missing !== undefined) throw new Error(`The stack has no page ${missing}. Pick the file again.`)
  const out = await lib.PDFDocument.create()
  for (const page of await out.copyPages(src, pages.map((p) => p - 1))) out.addPage(page)
  const bytes = await out.save()
  return new File([bytes as BlobPart], name.toLowerCase().endsWith('.pdf') ? name : `${name}.pdf`, { type: 'application/pdf' })
}
