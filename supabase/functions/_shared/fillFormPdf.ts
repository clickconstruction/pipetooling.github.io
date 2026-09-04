/**
 * Contract forms — the PDF executor (v2.2788, Contract Forms PR 1).
 *
 * Runs a `FillOp[]` plan (see formSchema.ts) against the uploaded template
 * bytes with pdf-lib, then flattens so the answers become page content nobody
 * can edit afterward. pdf-lib is passed in, the jobContractPdf.ts precedent:
 * the Deno function imports it from esm.sh, the browser and vitest from
 * node_modules, and this file stays runtime-neutral.
 *
 * `readPdfFields` is the other half — what the Form Studio and
 * `scripts/forms/inspect.ts` call to turn a PDF's own AcroForm fields into
 * `PdfFieldInfo[]` for `draftSchemaFromPdfFields`.
 */

import { fitFontSize, type FillOp, type FormPage, type FormRect, type PdfFieldInfo } from './formSchema.ts'

type FontLike = { widthOfTextAtSize(text: string, size: number): number; heightAtSize?(size: number): number }
type ImageLike = { width: number; height: number; scale(f: number): { width: number; height: number } }
type PageLike = {
  getSize(): { width: number; height: number }
  drawText(text: string, opts: { x: number; y: number; size: number; font: FontLike; color?: unknown }): void
  drawImage(img: ImageLike, opts: { x: number; y: number; width: number; height: number }): void
  drawRectangle(opts: { x: number; y: number; width: number; height: number; borderColor?: unknown; borderWidth?: number; color?: unknown; opacity?: number }): void
}
type WidgetLike = { getRectangle(): { x: number; y: number; width: number; height: number }; P(): unknown }
type FieldLike = {
  getName(): string
  acroField: { getWidgets(): WidgetLike[] }
  getMaxLength?(): number | undefined
  constructor: { name: string }
}
type TextFieldLike = { setText(t: string): void; setFontSize?(n: number): void; getText(): string | undefined; enableReadOnly?(): void }
type CheckBoxLike = { check(): void; isChecked(): boolean }
type FormLike = {
  getFields(): FieldLike[]
  getTextField(name: string): TextFieldLike
  getCheckBox(name: string): CheckBoxLike
  flatten(): void
  updateFieldAppearances?(font?: FontLike): void
}
type DocLike = {
  getPages(): Array<PageLike & { ref: unknown }>
  getPageCount(): number
  getForm(): FormLike
  embedFont(nameOrBytes: string | Uint8Array, opts?: { subset?: boolean }): Promise<FontLike>
  embedPng(bytes: Uint8Array): Promise<ImageLike>
  registerFontkit?(fk: unknown): void
  save(opts?: { updateFieldAppearances?: boolean }): Promise<Uint8Array>
}

export type FormPdfLibLike = {
  PDFDocument: { load(bytes: Uint8Array | ArrayBuffer, opts?: { ignoreEncryption?: boolean; updateMetadata?: boolean }): Promise<unknown> }
  StandardFonts: { Helvetica: string; HelveticaBold: string; TimesRomanItalic: string }
  rgb(r: number, g: number, b: number): unknown
}

export type ReadPdfFieldsResult = { pages: FormPage[]; fields: PdfFieldInfo[] }

/** Page sizes and every fillable field with its first widget's rectangle and page. */
export async function readPdfFields(lib: FormPdfLibLike, bytes: Uint8Array | ArrayBuffer): Promise<ReadPdfFieldsResult> {
  const doc = (await lib.PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false })) as DocLike
  const pages = doc.getPages()
  const pageInfos: FormPage[] = pages.map((p) => {
    const s = p.getSize()
    return { width: round2(s.width), height: round2(s.height) }
  })
  const fields: PdfFieldInfo[] = []
  for (const f of doc.getForm().getFields()) {
    const widget = f.acroField.getWidgets()[0]
    if (!widget) continue
    const r = widget.getRectangle()
    const pageIdx = pages.findIndex((p) => p.ref === widget.P())
    const ctor = f.constructor.name
    const kind: PdfFieldInfo['kind'] = ctor === 'PDFTextField' ? 'text' : ctor === 'PDFCheckBox' ? 'checkbox' : 'other'
    const maxLength = kind === 'text' && typeof f.getMaxLength === 'function' ? f.getMaxLength() : undefined
    fields.push({
      name: f.getName(),
      kind,
      page: pageIdx >= 0 ? pageIdx + 1 : 1,
      rect: { x: round2(r.x), y: round2(r.y), w: round2(r.width), h: round2(r.height) },
      ...(maxLength ? { maxLength } : {}),
    })
  }
  return { pages: pageInfos, fields }
}

export type FillFormPdfOptions = {
  /** TTF bytes for typed signatures (Great Vibes). Falls back to Times Italic when absent. */
  cursiveFontBytes?: Uint8Array | null
  /** `@pdf-lib/fontkit` instance, required to embed a custom TTF. */
  fontkit?: unknown
  /** Default true: fields become page content after filling. Tests pass false to read values back. */
  flatten?: boolean
  /** Studio calibration: outline every drawn/bound rect in red. */
  debugBoxes?: boolean
}

/**
 * Apply a fill plan to the template bytes. Bound ops that name a field the PDF
 * does not have are skipped (the studio may have been drafted against another
 * revision), and returned in `skipped` so callers can surface them.
 */
export async function fillFormPdf(
  lib: FormPdfLibLike,
  templateBytes: Uint8Array | ArrayBuffer,
  plan: FillOp[],
  opts: FillFormPdfOptions = {},
): Promise<{ bytes: Uint8Array; skipped: string[] }> {
  const doc = (await lib.PDFDocument.load(templateBytes, { ignoreEncryption: true, updateMetadata: false })) as DocLike
  const pages = doc.getPages()
  const form = doc.getForm()
  const body = await doc.embedFont(lib.StandardFonts.Helvetica)
  let cursive: FontLike | null = null
  if (opts.cursiveFontBytes && opts.fontkit && typeof doc.registerFontkit === 'function') {
    try {
      doc.registerFontkit(opts.fontkit)
      cursive = await doc.embedFont(opts.cursiveFontBytes, { subset: true })
    } catch {
      cursive = null
    }
  }
  if (!cursive) cursive = await doc.embedFont(lib.StandardFonts.TimesRomanItalic)
  const red = lib.rgb(0.86, 0.15, 0.15)
  const black = lib.rgb(0, 0, 0)
  const skipped: string[] = []
  const fieldNames = new Set(form.getFields().map((f) => f.getName()))

  for (const op of plan) {
    if (op.kind === 'setText') {
      if (!fieldNames.has(op.bind)) {
        skipped.push(op.bind)
        continue
      }
      const tf = form.getTextField(op.bind)
      if (op.fontSize && typeof tf.setFontSize === 'function') tf.setFontSize(op.fontSize)
      tf.setText(op.text)
      continue
    }
    if (op.kind === 'check') {
      if (!fieldNames.has(op.bind)) {
        skipped.push(op.bind)
        continue
      }
      form.getCheckBox(op.bind).check()
      continue
    }
    const page = pages[op.page - 1]
    if (!page) {
      skipped.push(`page ${op.page}`)
      continue
    }
    if (op.kind === 'drawImage') {
      const img = await doc.embedPng(op.png)
      const scale = Math.min(op.rect.w / img.width, op.rect.h / img.height)
      const w = img.width * scale
      const h = img.height * scale
      page.drawImage(img, { x: op.rect.x, y: op.rect.y + (op.rect.h - h) / 2, width: w, height: h })
      if (opts.debugBoxes) outline(page, op.rect, red)
      continue
    }
    const font = op.font === 'cursive' ? cursive : body
    const start = Math.min(op.fontSize, Math.max(FORM_MIN_DRAW_SIZE, op.rect.h * 0.8))
    const size = fitFontSize(op.text, Math.max(1, op.rect.w - 2), start, (t, s) => font.widthOfTextAtSize(t, s))
    const textWidth = font.widthOfTextAtSize(op.text, size)
    const x = op.align === 'center' ? op.rect.x + (op.rect.w - textWidth) / 2 : op.align === 'right' ? op.rect.x + op.rect.w - textWidth - 1 : op.rect.x + 1
    // Baseline: sit the text a little above the bottom of the box, centred for short boxes.
    const y = op.rect.y + Math.max(1, (op.rect.h - size * 0.72) / 2)
    page.drawText(op.text, { x, y, size, font, color: black })
    if (opts.debugBoxes) outline(page, op.rect, red)
  }

  if (opts.flatten !== false) {
    try {
      if (typeof form.updateFieldAppearances === 'function') form.updateFieldAppearances(body)
    } catch {
      /* some PDFs lack a default appearance; flatten still works */
    }
    form.flatten()
  }
  const bytes = await doc.save({ updateFieldAppearances: opts.flatten === false })
  return { bytes, skipped }
}

const FORM_MIN_DRAW_SIZE = 5

function outline(page: PageLike, r: FormRect, color: unknown) {
  page.drawRectangle({ x: r.x, y: r.y, width: r.w, height: r.h, borderColor: color, borderWidth: 0.6, opacity: 0 })
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
