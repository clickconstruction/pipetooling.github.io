import { filingDocFooter, filingDocPdfBlob, type FilingDocBlock } from '../jobsDocuments/lienFilingDocuments'
import { buildLienWaiverPdfBlob } from '../jobsDocuments/lienWaiverRelease'
import type { NoticeRelease } from './lienNoticeRelease'
import { lienExportDraftStamp, lienExportRecipe, type LienExportDraftStamp, type LienExportPageKey } from './lienPageExport'

/**
 * Drawing one page of a monthly notice as its own PDF (v2.7432). `lienPageExport.ts` holds the rules. Each page is
 * made by the builder the run uses for that part, then finished on the made file: the PDF takes the file's name as
 * its title, so the browser's tab reads it, and a draft takes its line at the foot. Finishing draws on the finished
 * PDF, so the filing builder and the waiver's builder are not changed and what mails is not changed.
 */
export type LienExportParts = {
  coverBlocks: ReadonlyArray<FilingDocBlock>
  /** The notice as the packet prints it: no ghost lines for what is optional. Built on the press. */
  noticeBlocks: () => FilingDocBlock[]
  payBlocks: ReadonlyArray<FilingDocBlock>
  release: Pick<NoticeRelease, 'formType' | 'fields' | 'signature'> | null
}

/** The page as the run makes it, before the title and the draft line. Throws when the pane holds no such page. */
export async function buildLienPagePdf(key: LienExportPageKey, parts: LienExportParts): Promise<Blob> {
  const recipe = lienExportRecipe(key)
  if (recipe.builder === 'waiver') {
    if (!parts.release) throw new Error('This notice has no conditional release.')
    return buildLienWaiverPdfBlob(parts.release.formType, parts.release.fields, parts.release.signature)
  }
  const blocks = key === 'cover' ? [...parts.coverBlocks] : key === 'pay' ? [...parts.payBlocks] : parts.noticeBlocks()
  if (blocks.length === 0) throw new Error('This page has nothing on it yet.')
  return filingDocPdfBlob(blocks, {
    ...(recipe.citation ? { footer: filingDocFooter('notice_53_056') } : null),
    ...(recipe.fit ? { fit: recipe.fit } : null),
  })
}

/** The part of pdf-lib the finish uses, so a test can stand in for it. */
type FinishFont = { widthOfTextAtSize: (text: string, size: number) => number }
type FinishPage = { getHeight: () => number; drawText: (text: string, opts: { x: number; y: number; size: number; font: FinishFont; color: unknown }) => void }
type FinishDoc = {
  setTitle: (title: string, opts?: { showInWindowTitleBar?: boolean }) => void
  embedFont: (name: string) => Promise<FinishFont>
  getPages: () => FinishPage[]
  save: () => Promise<Uint8Array>
}
export type FinishPdfLib = {
  PDFDocument: { load: (bytes: ArrayBuffer, opts?: { ignoreEncryption?: boolean }) => Promise<FinishDoc> }
  StandardFonts: { HelveticaBold: string }
  rgb: (r: number, g: number, b: number) => unknown
}

const MM = 72 / 25.4
const DRAFT_SIZE_PT = 7
/** The draft line's ink: a dark amber that reads on white paper and prints as a mid grey. */
const DRAFT_INK: [number, number, number] = [138 / 255, 90 / 255, 0]

/**
 * The made PDF with its title and, on a draft, the draft line on every page. `draftLine` empty leaves the pages as
 * they were drawn.
 */
export async function finishLienPagePdf(
  blob: Blob,
  opts: { title: string; draftLine: string; stamp: LienExportDraftStamp },
  loadPdfLib: () => Promise<FinishPdfLib> = async () => (await import('pdf-lib')) as unknown as FinishPdfLib,
): Promise<Blob> {
  const lib = await loadPdfLib()
  const doc = await lib.PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true })
  doc.setTitle(opts.title, { showInWindowTitleBar: true })
  if (opts.draftLine) {
    const font = await doc.embedFont(lib.StandardFonts.HelveticaBold)
    const width = font.widthOfTextAtSize(opts.draftLine, DRAFT_SIZE_PT)
    const color = lib.rgb(...DRAFT_INK)
    for (const page of doc.getPages()) {
      const x = opts.stamp.xMm * MM - (opts.stamp.align === 'center' ? width / 2 : 0)
      page.drawText(opts.draftLine, { x, y: page.getHeight() - opts.stamp.baselineMm * MM, size: DRAFT_SIZE_PT, font, color })
    }
  }
  const bytes = await doc.save()
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}

/** One page, made and finished: the file both presses hand over. */
export async function lienPageExportBlob(key: LienExportPageKey, parts: LienExportParts, opts: { title: string; draftLine: string }): Promise<Blob> {
  return finishLienPagePdf(await buildLienPagePdf(key, parts), { ...opts, stamp: lienExportDraftStamp(key) })
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Open a PDF built after the press in a new tab, in the browser's own viewer. The tab opens on the press, before any
 * wait, or a popup blocker takes it. It reads `building` until the file lands. 'blocked' when the tab was refused.
 * When the file cannot be made the tab is shut and the reason is thrown, for the caller to word.
 */
export async function openPdfInNewTab(build: () => Promise<Blob>, building: string): Promise<'opened' | 'blocked'> {
  const win = window.open('', '_blank')
  if (!win) return 'blocked'
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(building)}</title></head><body style="font:14px system-ui,sans-serif;margin:2rem;color:#4b5563">${esc(building)}</body></html>`)
  win.document.close()
  try {
    const url = URL.createObjectURL(await build())
    win.location.href = url
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    return 'opened'
  } catch (e) {
    win.close()
    throw e
  }
}
