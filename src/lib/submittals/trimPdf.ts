/**
 * Trim a dropped vendor PDF down to the pages that landed on submittal rows
 * (Submittals stage 3): the rest of the 31-page catalog goes, the kept pages
 * stay in their original order, and the returned map renumbers the sheet
 * assignments (see ./sheetAssignment remapAfterTrim). pdf-lib is loaded
 * lazily the way src/lib/jobsDocuments/demandLetterPacket.ts does, so the
 * bundle stays small until someone actually trims.
 */

export type TrimResult = {
  bytes: Uint8Array
  /** old page → new page, 1-based, kept pages only. */
  map: Record<number, number>
  kept: number
  dropped: number
}

type PdfLib = typeof import('pdf-lib')
export type LoadPdfLib = () => Promise<PdfLib>

const defaultLoad: LoadPdfLib = async () => await import('pdf-lib')

/** Number of pages in the file. */
export async function pageCount(bytes: Uint8Array | ArrayBuffer, loadPdfLib: LoadPdfLib = defaultLoad): Promise<number> {
  const lib = await loadPdfLib()
  const doc = await lib.PDFDocument.load(bytes, { ignoreEncryption: true })
  return doc.getPageCount()
}

/** 1-based, any order; duplicates and out-of-range pages ignored; output in ascending original order. */
export async function trimPdf(
  bytes: Uint8Array | ArrayBuffer,
  keepPages: ReadonlyArray<number>,
  loadPdfLib: LoadPdfLib = defaultLoad,
): Promise<TrimResult> {
  if (keepPages.length === 0) throw new Error('nothing to keep')
  const lib = await loadPdfLib()
  const src = await lib.PDFDocument.load(bytes, { ignoreEncryption: true })
  const total = src.getPageCount()
  const keep = [...new Set(keepPages.filter((p) => Number.isInteger(p) && p >= 1 && p <= total))].sort((a, b) => a - b)
  if (keep.length === 0) throw new Error('nothing to keep')

  const out = await lib.PDFDocument.create()
  const pages = await out.copyPages(
    src,
    keep.map((p) => p - 1),
  )
  const map: Record<number, number> = {}
  pages.forEach((page, i) => {
    out.addPage(page)
    const oldPage = keep[i]
    if (oldPage !== undefined) map[oldPage] = i + 1
  })
  const saved = await out.save()
  return { bytes: saved, map, kept: keep.length, dropped: total - keep.length }
}
