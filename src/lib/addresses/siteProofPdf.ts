/**
 * The proof's packet as one PDF (punch list #439, piece 5, part 5b's **Download**): the list of everyone bound, then
 * the signed copies. The list is drawn here with pdf-lib's own fonts. Each signed copy is the paper's own PDF, the one
 * **Open the PDF** opens on its record, fetched by the caller.
 *
 * It does what is ready. A copy that cannot be had (a form, whose PDF is its own, a paper with no words of its own, a
 * refusal, a lost signal) is left out, the list says so beside its company, and the others are still attached.
 *
 * `proofPdfLines` is pure. `buildProofPacket` takes pdf-lib and the copies' fetch as arguments, so a test hands both.
 */
import { countedLabel, pluralNoun } from '../batchWords'
import { plainSentence } from '../valuesInPlace'
import { formatErrorMessage } from '../../utils/errorHandling'
import { pdfSafeText } from '../../../supabase/functions/_shared/hoursStatementPdf'
import { type ProofLine, type SiteProof, SITE_PROOF_WORDS as W, asOfWords, proofCountSentence, proofHeading } from './siteProof'

const COPY = ['signed copy', 'signed copies'] as const

/** What the packet is made from. */
export type ProofPacketInput = {
  proof: SiteProof
  clientName?: string | null
  siteName?: string | null
  /** The packet's words about our own people, or null when they are not asked (`ownPeopleWords`). */
  ownWords: string | null
  todayYmd: string
}

/** A signed copy that was not attached, and why, in the words the fetch gave. */
export type ProofCopyHeld = { id: string; company: string; paper: string; reason: string }

/** One line of the list page, before it is drawn. */
export type ProofPdfLine =
  | { kind: 'title' | 'muted' | 'part' | 'body'; text: string }
  | { kind: 'row'; company: string; right: string; subs: string[] }
  | { kind: 'rule' | 'gap' }

/** The **Download** press: it names how many signed copies it goes for. With none signed it downloads the list. */
export function downloadLabel(proof: SiteProof, busy: boolean): string {
  if (busy) return 'Making the PDF…'
  return proof.signed.length === 0 ? 'Download the list' : countedLabel('Download with', proof.signed.length, COPY)
}

/** What the window says after a download: what was attached, and each copy that was not with its reason. */
export function downloadOutcomeWords(attached: number, held: ReadonlyArray<ProofCopyHeld>): string {
  const total = attached + held.length
  if (total === 0) return 'Downloaded the list.'
  if (held.length === 0) return `Downloaded, with ${attached} ${pluralNoun(COPY, attached)} attached.`
  const names = held.map((h) => `${h.company}: ${h.reason}`).join(' ')
  return `Downloaded, with ${attached} of ${total} ${pluralNoun(COPY, total)} attached. Not attached: ${names}`
}

/** The file's name: *The proof - Old Quarry Ranch.pdf*, with nothing a file system refuses. */
export function proofFileName(siteName: string | null | undefined): string {
  const site = (siteName ?? '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()
  return site ? `The proof - ${site}.pdf` : 'The proof.pdf'
}

/** The list page's foot: the day, and how many signed copies follow it. */
export function copiesFollowWords(todayYmd: string, attached: number): string {
  const follow = attached === 0 ? 'No signed copy is attached.' : attached === 1 ? 'The 1 signed copy follows.' : `The ${attached} signed copies follow.`
  return `${asOfWords(todayYmd)} ${follow}`.trim()
}

const rowOf = (l: ProofLine, signerLabel: string, dayLabel: string, note: string): ProofPdfLine => ({
  kind: 'row',
  company: l.company,
  right: l.day ? `${dayLabel} ${l.day}` : '',
  subs: [l.signer ? `${signerLabel} ${l.signer}` : '', l.paper, note].filter(Boolean),
})

/**
 * The list page, line by line. Each signed line says its copy is attached, or why it is not. `held` is the copies
 * that could not be had. `attachedIds` is the ones that were.
 */
export function proofPdfLines(input: ProofPacketInput, attachedIds: ReadonlySet<string>, held: ReadonlyArray<ProofCopyHeld>): ProofPdfLine[] {
  const { proof } = input
  const why = new Map(held.map((h) => [h.id, h.reason]))
  const out: ProofPdfLine[] = [{ kind: 'title', text: proofHeading(input.clientName) }]
  const site = (input.siteName ?? '').trim()
  if (site) out.push({ kind: 'muted', text: site })
  out.push({ kind: 'muted', text: plainSentence(proofCountSentence(proof)) }, { kind: 'gap' }, { kind: 'part', text: W.signed })
  if (proof.signed.length === 0) out.push({ kind: 'muted', text: W.nobodySigned })
  for (const l of proof.signed) {
    const note = attachedIds.has(l.id) ? 'Signed copy attached.' : why.has(l.id) ? `Copy not attached. ${why.get(l.id)}` : ''
    out.push({ kind: 'rule' }, rowOf(l, W.columns.signer, W.columns.signedDay, note))
  }
  if (proof.asked.length > 0) {
    out.push({ kind: 'gap' }, { kind: 'part', text: W.asked })
    for (const l of proof.asked) out.push({ kind: 'rule' }, rowOf(l, W.columns.askedOf, W.columns.sentDay, ''))
  }
  if (input.ownWords) out.push({ kind: 'gap' }, { kind: 'part', text: W.ownPeople }, { kind: 'body', text: input.ownWords })
  out.push({ kind: 'gap' }, { kind: 'rule' }, { kind: 'muted', text: copiesFollowWords(input.todayYmd, attachedIds.size) })
  return out
}

// ── Drawing ──────────────────────────────────────────────────────────────────────────

type PdfFontLike = { widthOfTextAtSize(text: string, size: number): number }
type PdfPageLike = { drawText(text: string, opts: Record<string, unknown>): void; drawLine(opts: Record<string, unknown>): void }
type PdfDocLike = {
  addPage(page?: [number, number] | PdfPageLike): PdfPageLike
  getPageIndices(): number[]
  copyPages(src: PdfDocLike, indices: number[]): Promise<PdfPageLike[]>
  embedFont(name: string): Promise<PdfFontLike>
  save(): Promise<Uint8Array>
}
export type ProofPdfLib = {
  PDFDocument: { create(): Promise<PdfDocLike>; load(bytes: ArrayBuffer | Uint8Array, opts?: { ignoreEncryption?: boolean }): Promise<PdfDocLike> }
  StandardFonts: { HelveticaBold: string; Helvetica: string }
  rgb(r: number, g: number, b: number): unknown
}

/** Letter, with a three-quarter inch margin. */
const PAGE = { width: 612, height: 792, margin: 54 } as const

function wrap(text: string, font: PdfFontLike, size: number, width: number): string[] {
  const words = pdfSafeText(text).split(' ').filter(Boolean)
  const out: string[] = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (!line || font.widthOfTextAtSize(next, size) <= width) line = next
    else {
      out.push(line)
      line = w
    }
  }
  if (line) out.push(line)
  return out.length ? out : ['']
}

/** Draws the list onto as many Letter pages as it takes. */
async function drawList(lib: ProofPdfLib, doc: PdfDocLike, lines: ReadonlyArray<ProofPdfLine>): Promise<void> {
  const bold = await doc.embedFont(lib.StandardFonts.HelveticaBold)
  const regular = await doc.embedFont(lib.StandardFonts.Helvetica)
  const ink = lib.rgb(0.07, 0.09, 0.15)
  const grey = lib.rgb(0.4, 0.43, 0.49)
  const faint = lib.rgb(0.82, 0.84, 0.87)
  const width = PAGE.width - PAGE.margin * 2
  let page = doc.addPage([PAGE.width, PAGE.height])
  let y = PAGE.height - PAGE.margin
  const room = (need: number) => {
    if (y - need >= PAGE.margin) return
    page = doc.addPage([PAGE.width, PAGE.height])
    y = PAGE.height - PAGE.margin
  }
  const text = (words: string, font: PdfFontLike, size: number, color: unknown, maxWidth = width) => {
    for (const l of wrap(words, font, size, maxWidth)) {
      room(size + 4)
      y -= size + 4
      page.drawText(l, { x: PAGE.margin, y, size, font, color })
    }
  }
  for (const l of lines) {
    if (l.kind === 'gap') y -= 10
    else if (l.kind === 'rule') {
      room(8)
      y -= 6
      page.drawLine({ start: { x: PAGE.margin, y }, end: { x: PAGE.width - PAGE.margin, y }, thickness: 0.6, color: faint })
    } else if (l.kind === 'title') text(l.text, bold, 15, ink)
    else if (l.kind === 'muted') text(l.text, regular, 9.5, grey)
    else if (l.kind === 'part') text(l.text.toUpperCase(), bold, 9, ink)
    else if (l.kind === 'body') text(l.text, regular, 10, ink)
    else if (l.kind === 'row') {
      // A row stays whole on its page: the company with its day at the right, then what sits under it.
      room(16 + l.subs.length * 13)
      const right = pdfSafeText(l.right)
      const rightWidth = right ? regular.widthOfTextAtSize(right, 9.5) : 0
      const before = y
      text(l.company, bold, 10.5, ink, width - rightWidth - 12)
      if (right) page.drawText(right, { x: PAGE.width - PAGE.margin - rightWidth, y: before - 14.5, size: 9.5, font: regular, color: ink })
      for (const s of l.subs) text(s, regular, 9.5, grey)
    }
  }
}

/** The copies' fetch: one signed paper's own PDF, or a throw whose message says why not. */
export type ProofCopyFetch = (paperId: string) => Promise<Blob>

export type ProofPacket = { blob: Blob; attached: number; held: ProofCopyHeld[] }

const reasonOf = (e: unknown): string => {
  const words = formatErrorMessage(e, 'Its PDF could not be read just now.').trim() || 'Its PDF could not be read just now.'
  return /[.!?]$/.test(words) ? words : `${words}.`
}

/**
 * The packet: the list, then each signed copy that could be had, in the list's order. A copy that fails is held with
 * its reason and the rest go on. A copy that is not a PDF pdf-lib can read is held the same way.
 */
export async function buildProofPacket(
  input: ProofPacketInput,
  fetchCopy: ProofCopyFetch,
  loadPdfLib: () => Promise<ProofPdfLib> = async () => (await import('pdf-lib')) as unknown as ProofPdfLib,
): Promise<ProofPacket> {
  const lib = await loadPdfLib()
  const copies: Array<{ id: string; doc: PdfDocLike }> = []
  const held: ProofCopyHeld[] = []
  for (const l of input.proof.signed) {
    try {
      const blob = await fetchCopy(l.id)
      copies.push({ id: l.id, doc: await lib.PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true }) })
    } catch (e) {
      held.push({ id: l.id, company: l.company, paper: l.paper, reason: reasonOf(e) })
    }
  }
  const out = await lib.PDFDocument.create()
  await drawList(lib, out, proofPdfLines(input, new Set(copies.map((c) => c.id)), held))
  for (const c of copies) {
    for (const p of await out.copyPages(c.doc, c.doc.getPageIndices())) out.addPage(p)
  }
  const bytes = await out.save()
  return { blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }), attached: copies.length, held }
}
