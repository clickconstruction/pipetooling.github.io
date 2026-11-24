/**
 * The sample a GC downloads (punch list #389, step 5): the paper for a job's settings, with made-up names and SAMPLE
 * across each page (the owner's call of 2026-11-17, settled 2). The words are the database's own assembly for the
 * job's picks, the same one a signer reads, so the sample and a signed copy cannot disagree. It has no signature
 * block: it is not for signing.
 *
 * Built on pdf-lib, which is passed in, as `jobContractPdf.ts` and `personPaperPdf.ts` do, so the Deno function and
 * the vitest test share this file. It imports nothing.
 */

/** The made-up party a sample goes to, and its mark. The same words as the Contract Book's own sample (`src/lib/contracts/paperSummary.ts`), held in step by a test. */
export const JOB_PAPER_SAMPLE_PARTY = { company: 'Sample Sub LLC', signer: 'Jordan Sample', job: 'Job J0000, a sample' } as const
export const JOB_PAPER_SAMPLE_MARK = 'SAMPLE'

/** *Standard, aligned with regular businesses*, the name alone, or a mix of its own. */
export function samplePdfLevelLine(level: { label: string; alignedWith: string } | null): string {
  if (!level || !level.label.trim()) return 'A mix of its own'
  const aligned = level.alignedWith.trim()
  return aligned ? `${level.label.trim()}, ${aligned.charAt(0).toLowerCase()}${aligned.slice(1)}` : level.label.trim()
}

/** The stamp at the foot of the sample's words: that it is one, its level, and its revision. */
export function samplePdfStamp(level: { label: string; alignedWith: string } | null, revision: number): string {
  return `SAMPLE, not for signature. ${samplePdfLevelLine(level)}. Revision ${revision}.`
}

/** The facts under the sample's title: a made-up job and signer, never the real ones. */
export function samplePdfFacts(): Array<[string, string]> {
  return [
    ['The job', JOB_PAPER_SAMPLE_PARTY.job],
    ['Signer', `${JOB_PAPER_SAMPLE_PARTY.signer}, ${JOB_PAPER_SAMPLE_PARTY.company}`],
  ]
}

/** The assembled paper's clauses as numbered paragraphs, the exhibit's after the base ones. */
export function samplePdfParagraphs(paper: { clauses?: unknown; exhibit?: unknown } | null | undefined): string[] {
  const lines = (v: unknown): string[] =>
    (Array.isArray(v) ? v : []).flatMap((x) => {
      const c = typeof x === 'object' && x !== null ? (x as { n?: unknown; text?: unknown }) : null
      const text = typeof c?.text === 'string' ? c.text.trim() : ''
      if (!text) return []
      return [typeof c?.n === 'number' ? `${c.n}. ${text}` : text]
    })
  return [...lines(paper?.clauses), ...lines(paper?.exhibit)]
}

/** A file name for the download: the paper's name with nothing a file system refuses. */
export function samplePdfFilename(paperName: string): string {
  const name = paperName.replace(/[\\/:*?"<>|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
  return `Sample - ${name || 'paper'}.pdf`
}

/** The words a refused download reads. Plain text: the press opens a new tab. */
export const SAMPLE_REFUSALS = {
  missing: 'Missing link details.',
  inactive: 'This link is no longer active. Please contact our office for a new one.',
  none: 'This sample is not available.',
  notReady: 'This paper is not ready yet, so it has no sample. Please contact our office.',
  failed: 'Could not make the sample right now. Please try again.',
} as const

/**
 * Who may download a job's sample: the GC on that job, through a link that shows the jobs they are the GC on, for a
 * paper the job requires now and that is built from settings. Null when they may, else the words to answer.
 */
export function sampleRefusal(
  link: { customer_id: string; audience: string; revoked_at: string | null } | null,
  row: { removed_at: string | null; settings: unknown; book_document_id: string | null } | null,
  job: { gc_customer_id: string | null } | null,
): string | null {
  if (!link || link.revoked_at) return SAMPLE_REFUSALS.inactive
  if (link.audience !== 'gc' && link.audience !== 'all') return SAMPLE_REFUSALS.none
  if (!row || row.removed_at || row.settings == null || typeof row.settings !== 'object' || !row.book_document_id) return SAMPLE_REFUSALS.none
  if (!job || !job.gc_customer_id || job.gc_customer_id !== link.customer_id) return SAMPLE_REFUSALS.none
  return null
}

type FontLike = { widthOfTextAtSize(text: string, size: number): number }
type PageLike = {
  drawText(text: string, opts: { x: number; y: number; size: number; font: FontLike; color?: unknown; rotate?: unknown; opacity?: number }): void
  drawLine(opts: { start: { x: number; y: number }; end: { x: number; y: number }; thickness: number; color?: unknown }): void
}
type DocLike = {
  addPage(size: [number, number]): PageLike
  embedFont(name: string): Promise<FontLike>
  setTitle(t: string): void
  save(): Promise<Uint8Array>
}
/** The few pieces of pdf-lib this draws with. `degrees` turns the mark. */
export type SamplePdfLib = {
  PDFDocument: { create(): Promise<DocLike> }
  StandardFonts: { Helvetica: string; HelveticaBold: string }
  rgb(r: number, g: number, b: number): unknown
  degrees(angle: number): unknown
}

export interface JobPaperSamplePdfInput {
  /** The paper's name. */
  title: string
  /** Our company, on the letterhead. */
  company: string
  /** Under the title, a label and its value a line. */
  facts: Array<[string, string]>
  /** The paper's words, a paragraph a clause. */
  paragraphs: string[]
  /** The line at the foot of the words. */
  stamp: string
  /** Across every page. */
  mark: string
}

const PAGE_W = 612
const PAGE_H = 792
const MARGIN = 54
const CONTENT_W = PAGE_W - MARGIN * 2

// Helvetica holds WinAnsi only: ASCII, Latin-1 and a few typographic marks. Anything else is dropped, never thrown on.
const UNSAFE = /[^\x20-\x7E -ÿ–—‘’“”•…]/g
export function samplePdfSafe(s: string): string {
  return (s ?? '')
    .replace(/−/g, '-')
    .replace(/[\t\r\n]+/g, ' ')
    .replace(UNSAFE, '')
}

function wrap(text: string, font: FontLike, size: number, width: number): string[] {
  const words = samplePdfSafe(text).split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']
  const out: string[] = []
  let line = ''
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w
    if (!line || font.widthOfTextAtSize(candidate, size) <= width) line = candidate
    else {
      out.push(line)
      line = w
    }
  }
  if (line) out.push(line)
  return out
}

/** Draw the sample. Letter size, as every paper the app prints. */
export async function buildJobPaperSamplePdf(lib: SamplePdfLib, input: JobPaperSamplePdfInput): Promise<Uint8Array> {
  const doc = await lib.PDFDocument.create()
  doc.setTitle(samplePdfSafe(`${input.mark} ${input.title}`.trim()) || 'Sample')
  const font = await doc.embedFont(lib.StandardFonts.Helvetica)
  const bold = await doc.embedFont(lib.StandardFonts.HelveticaBold)
  const ink = lib.rgb(0.07, 0.1, 0.15)
  const muted = lib.rgb(0.42, 0.45, 0.5)
  const accent = lib.rgb(0.6, 0.36, 0.17)
  const faint = lib.rgb(0.55, 0.58, 0.63)

  let page = doc.addPage([PAGE_W, PAGE_H])
  const pages = [page]
  let y = PAGE_H - MARGIN
  const footerReserve = 34
  const ensure = (h: number) => {
    if (y - h < MARGIN + footerReserve) {
      page = doc.addPage([PAGE_W, PAGE_H])
      pages.push(page)
      y = PAGE_H - MARGIN
    }
  }
  const text = (t: string, size: number, f: FontLike = font, color: unknown = ink, lineGap = 1.4) => {
    for (const line of wrap(t, f, size, CONTENT_W)) {
      ensure(size * lineGap)
      if (line) page.drawText(line, { x: MARGIN, y: y - size, size, font: f, color })
      y -= size * lineGap
    }
  }

  // Letterhead
  text(input.company, 13, bold, accent)
  y -= 4
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1.5, color: accent })
  y -= 16

  // The paper's name, and the made-up facts
  text(input.title.trim() || 'Sample', 17, bold)
  y -= 4
  for (const [label, value] of input.facts) text(`${label}: ${value}`, 10, font, muted)
  y -= 12

  // The words, as a signer would read them
  for (const p of input.paragraphs) {
    text(p, 10.5)
    y -= 6
  }

  // The stamp
  y -= 8
  text(input.stamp, 9.5, bold, muted)

  // The mark across each page and the page numbers, drawn last so every page has them.
  const mark = samplePdfSafe(input.mark) || 'SAMPLE'
  const markSize = 118
  const markW = bold.widthOfTextAtSize(mark, markSize)
  const turn = (32 * Math.PI) / 180
  pages.forEach((p, i) => {
    // Centred on the page: the text's start is half its turned length back from the middle.
    const x = PAGE_W / 2 - (markW / 2) * Math.cos(turn) + (markSize / 3) * Math.sin(turn)
    const yMark = PAGE_H / 2 - (markW / 2) * Math.sin(turn) - (markSize / 3) * Math.cos(turn)
    p.drawText(mark, { x, y: yMark, size: markSize, font: bold, color: faint, rotate: lib.degrees(32), opacity: 0.16 })
    const foot = `${mark} · Page ${i + 1} of ${pages.length}`
    p.drawText(foot, { x: PAGE_W - MARGIN - font.widthOfTextAtSize(foot, 8), y: MARGIN - 14, size: 8, font, color: muted })
  })

  return await doc.save()
}
