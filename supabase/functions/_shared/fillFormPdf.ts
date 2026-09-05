/**
 * Contract forms — the PDF executor (v2.2788, Contract Forms PR 1; PR 7 order
 * and tolerance).
 *
 * Runs a `FillOp[]` plan (see formSchema.ts) against the uploaded template
 * bytes with pdf-lib in three phases:
 *
 *   1. field ops — `setText` / `check` on the PDF's own fields (dropdowns get
 *      the option selected when it exists);
 *   2. flatten (unless `flatten: false`) so the answers become page content;
 *   3. draw ops — unbound text, signatures, images.
 *
 * Drawing comes AFTER flattening on purpose: flatten paints every field's
 * appearance (a dropdown's white box included) and would otherwise cover what
 * was drawn over it — the I-9's State field taught us that. A field op that
 * fails (unknown name, maxLength overflow, an option the dropdown lacks) is
 * never fatal: it falls back to drawing the text at the box's rect when the
 * plan carries one, and is reported in `skipped` either way.
 *
 * Two-party forms (PR 7): the signer stage passes `flatten: false` +
 * `readOnlyFilled: true`, so the office can still fill its fields later; the
 * office stage fills the rest and flattens.
 *
 * pdf-lib is passed in, the jobContractPdf.ts precedent: the Deno function
 * imports it from esm.sh, the browser and vitest from node_modules, and this
 * file stays runtime-neutral. `readPdfFields` is the other half — what the
 * Form Studio and `scripts/forms/inspect.ts` call to turn a PDF's own
 * AcroForm fields into `PdfFieldInfo[]` for `draftSchemaFromPdfFields`.
 */

import { fitFontSize, type FillOp, type FormAlign, type FormPage, type FormRect, type PdfFieldInfo } from './formSchema.ts'

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
  /** Duck-typed kind detection — class names are mangled in pdf-lib's browser build. */
  setText?: unknown
  getText?: unknown
  check?: unknown
  isChecked?: unknown
  select?: unknown
  getOptions?: unknown
  enableReadOnly?(): void
}
type TextFieldLike = { setText(t: string): void; setFontSize?(n: number): void; getText(): string | undefined; enableReadOnly?(): void }
type CheckBoxLike = { check(): void; isChecked(): boolean; enableReadOnly?(): void }
type DropdownLike = { select(v: string): void; getOptions(): string[]; getSelected(): string[]; isEditable?(): boolean; setFontSize?(n: number): void; enableReadOnly?(): void }
type FormLike = {
  getFields(): FieldLike[]
  getTextField(name: string): TextFieldLike
  getCheckBox(name: string): CheckBoxLike
  getDropdown(name: string): DropdownLike
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

function kindOf(f: FieldLike): PdfFieldInfo['kind'] {
  if (typeof f.check === 'function' && typeof f.isChecked === 'function') return 'checkbox'
  if (typeof f.select === 'function' && typeof f.getOptions === 'function') return 'dropdown'
  if (typeof f.setText === 'function' && typeof f.getText === 'function') return 'text'
  return 'other'
}

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
    const kind = kindOf(f)
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
  /** Default true: fields become page content after filling. Tests and the two-party signer stage pass false. */
  flatten?: boolean
  /** With `flatten: false`: mark every field this plan filled read-only so a later stage cannot change it. */
  readOnlyFilled?: boolean
  /** Studio calibration: outline every drawn/bound rect in red. */
  debugBoxes?: boolean
}

/**
 * Apply a fill plan to the template bytes. Field ops that fail are never
 * fatal: unknown names, refused values (maxLength, a dropdown without the
 * option) fall back to drawing at the box's rect when the op carries one, and
 * every such case is listed in `skipped` so callers can surface it.
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
  const fieldsByName = new Map(form.getFields().map((f) => [f.getName(), f] as const))
  const filledFields: FieldLike[] = []
  const draws: Array<Extract<FillOp, { kind: 'drawText' | 'drawImage' }>> = []

  const fallbackDraw = (op: Extract<FillOp, { kind: 'setText' | 'check' }>, why: string) => {
    skipped.push(`${op.bind} (${why})`)
    if (op.page && op.rect) {
      draws.push(op.kind === 'check' ? { kind: 'drawText', page: op.page, rect: op.rect, text: 'X', fontSize: 10, align: 'center', font: 'body' } : { kind: 'drawText', page: op.page, rect: op.rect, text: op.text, fontSize: op.fontSize ?? 10, align: op.align ?? 'left', font: 'body' })
    }
  }

  // ── 1. field ops ─────────────────────────────────────────────────────────────
  for (const op of plan) {
    if (op.kind === 'drawText' || op.kind === 'drawImage') {
      draws.push(op)
      continue
    }
    const field = fieldsByName.get(op.bind)
    if (!field) {
      fallbackDraw(op, 'no such field')
      continue
    }
    const kind = kindOf(field)
    try {
      if (op.kind === 'check') {
        if (kind !== 'checkbox') throw new Error('not a checkbox')
        form.getCheckBox(op.bind).check()
      } else if (kind === 'dropdown') {
        const dd = form.getDropdown(op.bind)
        const options = dd.getOptions()
        const match = options.find((o) => o === op.text) ?? options.find((o) => o.toLowerCase() === op.text.toLowerCase())
        if (!match) throw new Error('option not in dropdown')
        if (op.fontSize && typeof dd.setFontSize === 'function') dd.setFontSize(op.fontSize)
        dd.select(match)
      } else if (kind === 'text') {
        const tf = form.getTextField(op.bind)
        if (op.fontSize && typeof tf.setFontSize === 'function') tf.setFontSize(op.fontSize)
        tf.setText(op.text)
      } else throw new Error(`unsupported field kind ${kind}`)
      filledFields.push(field)
    } catch (e) {
      fallbackDraw(op, e instanceof Error ? e.message : String(e))
    }
  }

  // ── 2. flatten (or lock what was filled) ─────────────────────────────────────
  if (opts.flatten !== false) {
    try {
      if (typeof form.updateFieldAppearances === 'function') form.updateFieldAppearances(body)
    } catch {
      /* some PDFs lack a default appearance; flatten still works */
    }
    form.flatten()
  } else if (opts.readOnlyFilled) {
    for (const f of filledFields) {
      try {
        f.enableReadOnly?.()
      } catch {
        /* read-only is best effort */
      }
    }
  }

  // ── 3. draw ops ──────────────────────────────────────────────────────────────
  for (const op of draws) {
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
    drawTextInRect(page, font, op.text, op.rect, op.fontSize, op.align, black)
    if (opts.debugBoxes) outline(page, op.rect, red)
  }

  const bytes = await doc.save({ updateFieldAppearances: opts.flatten === false })
  return { bytes, skipped }
}

const FORM_MIN_DRAW_SIZE = 5

function drawTextInRect(page: PageLike, font: FontLike, text: string, rect: FormRect, fontSize: number, align: FormAlign, color: unknown) {
  const start = Math.min(fontSize, Math.max(FORM_MIN_DRAW_SIZE, rect.h * 0.8))
  const size = fitFontSize(text, Math.max(1, rect.w - 2), start, (t, s) => font.widthOfTextAtSize(t, s))
  const textWidth = font.widthOfTextAtSize(text, size)
  const x = align === 'center' ? rect.x + (rect.w - textWidth) / 2 : align === 'right' ? rect.x + rect.w - textWidth - 1 : rect.x + 1
  // Baseline: sit the text a little above the bottom of the box, centred for short boxes.
  const y = rect.y + Math.max(1, (rect.h - size * 0.72) / 2)
  page.drawText(text, { x, y, size, font, color })
}

function outline(page: PageLike, r: FormRect, color: unknown) {
  page.drawRectangle({ x: r.x, y: r.y, width: r.w, height: r.h, borderColor: color, borderWidth: 0.6, opacity: 0 })
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
