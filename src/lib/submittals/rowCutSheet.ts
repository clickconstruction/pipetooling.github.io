/**
 * One row's cut sheet as a PDF of its own (Submittals step 3, *Save PDF* on a row): the pages the
 * row carries, cut out of the vendor's file, to attach to an email or a text. It is the same
 * choice of pages the package makes for the row (`packageSheets`): a row whose parts carry their
 * own pages gives those, part by part; any other row gives its own. Nothing is stamped on them —
 * these are the maker's pages as the house sent them.
 *
 * pdf-lib is loaded lazily, the way `trimPdf` does.
 */
import { submittedParts, type SubmittalPartRow } from './itemParts'
import type { SubmittalItemRow } from './submittalRevision'

export type CutSheetSegment = { fileIndex: number; pages: number[] }

type PlanItem = Pick<SubmittalItemRow, 'sheet_file' | 'sheet_pages'>
type PlanPart = Pick<SubmittalPartRow, 'on_submittal' | 'sequence_order' | 'sheet_file' | 'sheet_pages'>

const cleanPages = (pages: ReadonlyArray<number> | null | undefined): number[] => [...new Set((pages ?? []).filter((p) => Number.isInteger(p) && p >= 1))].sort((a, b) => a - b)

/** The pages to cut, in the order they are saved. Empty when the row has no cut sheet yet. */
export function rowCutSheetPlan(item: PlanItem, parts: ReadonlyArray<PlanPart> = []): CutSheetSegment[] {
  const partSheets = submittedParts(parts)
    .filter((p) => p.sheet_file != null && cleanPages(p.sheet_pages).length > 0)
    .map((p) => ({ fileIndex: p.sheet_file as number, pages: cleanPages(p.sheet_pages) }))
  if (partSheets.length > 0) return partSheets
  const own = cleanPages(item.sheet_pages)
  return item.sheet_file != null && own.length > 0 ? [{ fileIndex: item.sheet_file, pages: own }] : []
}

/** How many pages the plan saves. */
export const cutSheetPageCount = (plan: ReadonlyArray<CutSheetSegment>): number => plan.reduce((n, s) => n + s.pages.length, 0)

/** "LAV-1 cut sheet.pdf" — the tag with whatever a file name cannot hold taken out; an untagged row is an accessory. */
export function cutSheetFileName(tag: string): string {
  const name = tag.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Accessory'
  return `${name} cut sheet.pdf`
}

/**
 * The line after a cut sheet is saved. v2.5027 (the owner's call of 2026-10-09): it is for reading,
 * or for the GC's own system, never an invitation to email it; a submittal leaves only through
 * Share or Send the link.
 */
export function cutSheetSavedLine(name: string, pages: number): string {
  return `Saved ${name} · ${pages} page${pages === 1 ? '' : 's'}, to read or to file in the GC’s own system.`
}

type PdfLib = typeof import('pdf-lib')
export type LoadPdfLib = () => Promise<PdfLib>
const defaultLoad: LoadPdfLib = async () => await import('pdf-lib')

/**
 * The plan's pages as one PDF. `readFile` hands back a vendor file's bytes by its index; each
 * file is read once however many segments use it. A page past the end of its file is skipped.
 */
export async function buildRowCutSheet(
  plan: ReadonlyArray<CutSheetSegment>,
  readFile: (fileIndex: number) => Promise<Uint8Array | ArrayBuffer>,
  loadPdfLib: LoadPdfLib = defaultLoad,
): Promise<{ bytes: Uint8Array; pages: number }> {
  if (cutSheetPageCount(plan) === 0) throw new Error('This row has no cut sheet yet.')
  const lib = await loadPdfLib()
  const out = await lib.PDFDocument.create()
  const loaded = new Map<number, Awaited<ReturnType<PdfLib['PDFDocument']['load']>>>()
  for (const seg of plan) {
    let src = loaded.get(seg.fileIndex)
    if (!src) {
      src = await lib.PDFDocument.load(await readFile(seg.fileIndex), { ignoreEncryption: true })
      loaded.set(seg.fileIndex, src)
    }
    const total = src.getPageCount()
    const keep = seg.pages.filter((p) => p >= 1 && p <= total)
    for (const page of await out.copyPages(src, keep.map((p) => p - 1))) out.addPage(page)
  }
  if (out.getPageCount() === 0) throw new Error('Those pages are not in the vendor file any more.')
  return { bytes: await out.save(), pages: out.getPageCount() }
}
