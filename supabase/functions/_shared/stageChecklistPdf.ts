/**
 * A filed stage checklist as a PDF (punch list #237, PR 3): the paper the office's Print draws
 * (src/lib/jobs/stageChecklistRecord.ts, buildChecklistPaperHtml), drawn with pdf-lib from the record's snapshot so
 * the photo-save sweep can file it in the job's Drive folder, each version its own file. The header names the job, the
 * stage, the record id and when it filed; every row its glyph, words, pick, name and time, the note, the photo's
 * standing; a signed row its mark: the drawn ink embedded from the bucket's PNG, or the printed name in italic; the
 * company questions left off this job; and the foot that says what filing did. Letter, as the hours statement.
 *
 * pdf-lib is passed in (the `jobContractPdf.ts` precedent): the function imports it from esm.sh, vitest from
 * node_modules. Pure over its input: the ink bytes come in as a map by storage path, read by the caller.
 */
import type { PdfLibLike } from './jobContractPdf.ts'
import { pdfSafeText } from './hoursStatementPdf.ts'
import { APP_CALENDAR_TZ } from './appTimeZone.ts'

type FontLike = { widthOfTextAtSize(text: string, size: number): number }
type PageLike = {
  drawText(text: string, opts: { x: number; y: number; size: number; font: FontLike; color?: unknown }): void
  drawLine(opts: { start: { x: number; y: number }; end: { x: number; y: number }; thickness: number; color?: unknown }): void
  drawImage(img: unknown, opts: { x: number; y: number; width: number; height: number }): void
}
type DocLike = {
  addPage(size: [number, number]): PageLike
  embedFont(name: string): Promise<FontLike>
  embedPng(bytes: Uint8Array): Promise<{ width: number; height: number }>
  setTitle(t: string): void
  save(): Promise<Uint8Array>
}

/** One row of the record's snapshot, as the table keeps it (`stage_checklist_records.snapshot.rows[]`). */
export interface RecordPdfRow {
  words: string
  sheet?: string | null
  pick: 'yes' | 'no' | 'not_here'
  note?: string | null
  by?: string | null
  at?: string | null
  signature?: { mode: 'type' | 'draw'; printedName: string; signedAt: string; storagePath?: string | null } | null
  photo?: { fileName: string; driveFileId?: string | null } | null
}

export interface RecordPdfInput {
  recordId: string
  version: number
  stageName: string
  filedAtIso: string
  job: { number: string; name: string; customer: string | null; address: string | null }
  rows: RecordPdfRow[]
  skipped: Array<{ words: string; by?: string | null; why?: string | null }>
  answerCount: number
  signedCount: number
  noCount: number
  /** The drawn marks' PNG bytes by storage path; a path not here prints the name in italic instead. */
  inks: ReadonlyMap<string, Uint8Array>
  /** The company's calendar for the stamps. */
  timeZone?: string
}

const PAGE_W = 612
const PAGE_H = 792
const MARGIN = 42
const CONTENT_W = PAGE_W - MARGIN * 2
const FOOTER_RESERVE = 30

const PICK_WORDS = { yes: 'Yes', no: 'No', not_here: 'Not here' } as const
const PICK_GLYPH = { yes: 'Yes', no: 'NO', not_here: '-' } as const

/** *Nov 1 · 9:14 am* in the company's calendar, or '' without a time. */
export function pdfStampWhen(iso: string | null | undefined, timeZone: string = APP_CALENDAR_TZ): string {
  const ms = iso ? Date.parse(iso) : NaN
  if (!Number.isFinite(ms)) return ''
  const d = new Date(ms)
  const day = new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' }).format(d)
  const clock = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(d).toLowerCase()
  return `${day} · ${clock}`
}

/** *Luis Ortega · Nov 1 · 9:14 am*; *someone* without a name. */
export function pdfStampWords(name: string | null | undefined, iso: string | null | undefined, timeZone?: string): string {
  const who = (name ?? '').trim() || 'someone'
  const when = pdfStampWhen(iso, timeZone)
  return when ? `${who} · ${when}` : who
}

/** The foot's words, the same as the paper's (`filedFootWords`). */
export function pdfFootWords(stageName: string, noCount: number): string {
  const ready = `${stageName} now reads ready on the Pipeline.`
  if (noCount === 0) return ready
  return `${ready} ${noCount === 1 ? 'One check reads No' : `${noCount} checks read No`}; the office acts on that.`
}

function wrap(text: string, font: FontLike, size: number, width: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean)
    if (words.length === 0) continue
    let line = ''
    for (const w of words) {
      const candidate = line ? `${line} ${w}` : w
      if (font.widthOfTextAtSize(candidate, size) <= width || !line) line = candidate
      else {
        out.push(line)
        line = w
      }
    }
    if (line) out.push(line)
  }
  return out
}

/** The PDF's file name: *CL-1042-1 Trim Set checklist.pdf*, the same name the record row keeps. */
export function recordPdfFileName(recordId: string, stageName: string): string {
  return `${recordId} ${stageName} checklist.pdf`.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function buildStageChecklistPdf(lib: PdfLibLike, input: RecordPdfInput): Promise<Uint8Array> {
  const doc = (await lib.PDFDocument.create()) as unknown as DocLike
  doc.setTitle(`${input.recordId} · ${input.stageName} checklist`)
  const font = await doc.embedFont(lib.StandardFonts.Helvetica)
  const bold = await doc.embedFont(lib.StandardFonts.HelveticaBold)
  const italic = await doc.embedFont(lib.StandardFonts.TimesRomanItalic)
  const ink = lib.rgb(0.07, 0.09, 0.15)
  const muted = lib.rgb(0.35, 0.35, 0.35)
  const red = lib.rgb(0.72, 0.11, 0.11)
  const green = lib.rgb(0.09, 0.4, 0.2)
  const rule = lib.rgb(0.85, 0.85, 0.85)
  const safe = (s: string) => pdfSafeText(s)

  let pageNo = 0
  let page = doc.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - MARGIN
  const footer = () => {
    pageNo += 1
    page.drawText(safe(`${input.recordId} · v${input.version} · page ${pageNo}`), { x: MARGIN, y: MARGIN - 14, size: 8, font, color: muted })
  }
  const need = (h: number) => {
    if (y - h < MARGIN + FOOTER_RESERVE) {
      footer()
      page = doc.addPage([PAGE_W, PAGE_H])
      y = PAGE_H - MARGIN
    }
  }
  const text = (s: string, size: number, f: FontLike, color: unknown, x = MARGIN, width = CONTENT_W - (x - MARGIN)) => {
    for (const line of wrap(safe(s), f, size, width)) {
      need(size + 4)
      page.drawText(line, { x, y: y - size, size, font: f, color })
      y -= size + 4
    }
  }
  const hr = (color = rule) => {
    need(6)
    page.drawLine({ start: { x: MARGIN, y: y - 2 }, end: { x: PAGE_W - MARGIN, y: y - 2 }, thickness: 0.6, color })
    y -= 6
  }

  // The header.
  text('Stage checklist', 15, bold, ink)
  text([`Job ${input.job.number}`, input.job.name, input.job.customer, input.job.address].filter((s) => s && s.trim()).join(' · '), 9.5, font, muted)
  y -= 4
  text(`${input.stageName} · Record ${input.recordId} · v${input.version}`, 12, bold, ink)
  const counts = `${input.answerCount === 1 ? '1 answer' : `${input.answerCount} answers`}${input.signedCount > 0 ? `, ${input.signedCount} signed` : ''}${input.noCount > 0 ? ` · ${input.noCount} No` : ''}`
  text(`Filed ${pdfStampWhen(input.filedAtIso, input.timeZone)} · ${counts}`, 9.5, font, muted)
  y -= 6
  hr(muted)

  // The rows.
  for (let i = 0; i < input.rows.length; i += 1) {
    const r = input.rows[i]!
    need(40)
    const glyphColor = r.pick === 'no' ? red : ink
    page.drawText(PICK_GLYPH[r.pick], { x: MARGIN, y: y - 10.5, size: 10.5, font: bold, color: glyphColor })
    const x = MARGIN + 30
    text(`${i + 1}. ${r.words}${r.sheet ? ` · ${r.sheet}` : ''}`, 10.5, font, ink, x)
    text(`${PICK_WORDS[r.pick]} · ${pdfStampWords(r.by, r.at, input.timeZone)}`, 8.5, font, muted, x)
    if (r.signature) {
      const png = r.signature.storagePath ? input.inks.get(r.signature.storagePath) : undefined
      if (png) {
        try {
          const img = await doc.embedPng(png)
          const h = 26
          const w = Math.min(160, (img.width / Math.max(1, img.height)) * h)
          need(h + 6)
          page.drawImage(img, { x, y: y - h, width: w, height: h })
          y -= h + 2
        } catch {
          text(`Signed: ${r.signature.printedName}`, 12, italic, ink, x)
        }
      } else {
        text(`Signed: ${r.signature.printedName}`, 12, italic, ink, x)
      }
      text(`Signed by ${pdfStampWords(r.signature.printedName, r.signature.signedAt, input.timeZone)}`, 8.5, font, muted, x)
    }
    if (r.photo) text(r.photo.driveFileId ? "Photo in the job's Drive folder" : 'Photo on its way to Drive', 8.5, font, muted, x)
    if (r.note && r.note.trim()) text(`"${r.note.trim()}"`, 8.5, italic, r.pick === 'no' ? red : muted, x)
    y -= 4
    hr()
  }
  if (input.rows.length === 0) text('No questions on this stage.', 9.5, font, muted)

  // The company questions left off this job, then the foot.
  if (input.skipped.length > 0) {
    text(`Not on this job: ${input.skipped.map((s) => `${s.words.replace(/\?$/, '')} (${(s.why ?? '').trim()}${s.by ? `, ${s.by}` : ''})`).join(' · ')}`, 8.5, font, muted)
    y -= 4
    hr()
  }
  y -= 2
  text(pdfFootWords(input.stageName, input.noCount), 9.5, bold, input.noCount > 0 ? red : green)
  y -= 6
  text("Every answer is stamped with the person's name and the time. A signed answer is the person's own act under their sign-in, bound to the answer as given.", 8, font, muted)
  footer()
  return await doc.save()
}
