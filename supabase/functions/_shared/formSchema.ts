/**
 * Contract forms — the schema kernel (v2.2788, Contract Forms PR 1).
 *
 * A "form" is a Contract Book entry whose content is an uploaded PDF plus the
 * entry boxes a dev placed on it in the Form Studio. The signer fills the real
 * page; the boxes say where each answer lands and what it is. This file is the
 * one description of that shape, shared by:
 *   - the Form Studio (client) — places boxes, drafts them from a PDF's own fields
 *   - the signer page (client) — overlays inputs, validates before submit
 *   - accept-contract (Deno) — validates again, builds the fill plan, splits
 *     sensitive answers out of what gets stored
 *   - scripts/forms/* (node, vite-node) — the agent workflow: inspect → draft → preview
 *
 * Dependency-free on purpose so every runtime imports it as-is
 * (`src/lib/forms/formSchema.ts` re-exports it into the app's tsc program).
 *
 * Coordinates are PDF points with the origin at the page's bottom-left, the
 * pdf-lib convention. `pdfRectToScreen` / `screenRectToPdf` convert for the
 * studio and the overlay.
 */

export type FormBoxType = 'text' | 'digits' | 'checkbox' | 'signature' | 'date' | 'constant'
export type FormAlign = 'left' | 'center' | 'right'
export type FormPrefill = 'person_name' | 'person_email' | 'person_phone'

/** PDF points, origin bottom-left. */
export type FormRect = { x: number; y: number; w: number; h: number }

export type FormBox = {
  /** Stable key; the values map is keyed by it. `[a-z0-9_]+`. */
  key: string
  type: FormBoxType
  /** 1-based page number. */
  page: number
  rect: FormRect
  /** Tab / lens order, ascending. */
  order: number
  /** What the signer is asked, in their words. */
  label: string
  labelEs?: string
  help?: string
  helpEs?: string
  required?: boolean
  /** Masked after entry, kept out of stored values / logs / mail; lives only in the flattened PDF. */
  sensitive?: boolean
  /** The lens skips it unless the signer opens "Rarely needed". */
  advanced?: boolean
  /** AcroForm field name to fill by name (text / checkbox / constant / date). Absent = draw at rect. */
  bind?: string
  /** digits: one AcroForm field per mask segment, in order. */
  bindSegments?: string[]
  maxLength?: number
  fontSize?: number
  align?: FormAlign
  prefill?: FormPrefill
  /** digits: e.g. `###-##-####` (SSN) or `##-#######` (EIN). `#` = one digit. */
  mask?: string
  /** checkbox: group key (see FormGroup). */
  group?: string
  /** Mutually exclusive set key (see FormOneOf), e.g. ssn | ein. */
  oneOf?: string
  /** constant: the text printed every time. */
  text?: string
  /** date: `today` (company calendar) or `typed`. */
  dateMode?: 'today' | 'typed'
  /** Studio sample value (shown in previews, never stored on a person). */
  sample?: string
}

export type FormGroup = { key: string; label: string; exactlyOne: boolean; required: boolean }
export type FormOneOf = { key: string; label: string; required: boolean }

export type FormPage = { width: number; height: number }

export type FormSchema = {
  version: 1
  pages: FormPage[]
  boxes: FormBox[]
  groups: FormGroup[]
  oneOfs: FormOneOf[]
}

/** What the signer typed / ticked, keyed by box key. Checkboxes are booleans. */
export type FormValues = Record<string, string | boolean>

export type FormValidationError = { key: string; message: string }

export type FormPerson = { name: string | null; email: string | null; phone: string | null }

export const FORM_SCHEMA_VERSION = 1 as const
export const FORM_BOX_KEY_RE = /^[a-z0-9_]+$/
export const FORM_DEFAULT_FONT_SIZE = 10
export const FORM_MIN_FONT_SIZE = 5

export function emptyFormSchema(pages: FormPage[]): FormSchema {
  return { version: FORM_SCHEMA_VERSION, pages, boxes: [], groups: [], oneOfs: [] }
}

// ── schema hygiene ─────────────────────────────────────────────────────────────

/** Structural problems a studio save or an import must refuse. */
export function validateFormSchema(schema: FormSchema): FormValidationError[] {
  const errors: FormValidationError[] = []
  if (schema.version !== FORM_SCHEMA_VERSION) errors.push({ key: '', message: `Unsupported schema version ${String(schema.version)}` })
  if (!Array.isArray(schema.pages) || schema.pages.length === 0) errors.push({ key: '', message: 'Schema has no pages' })
  const seen = new Set<string>()
  const groupKeys = new Set(schema.groups.map((g) => g.key))
  const oneOfKeys = new Set(schema.oneOfs.map((o) => o.key))
  for (const b of schema.boxes) {
    if (!FORM_BOX_KEY_RE.test(b.key)) errors.push({ key: b.key, message: 'Key must be lowercase letters, digits, and underscores' })
    if (seen.has(b.key)) errors.push({ key: b.key, message: 'Duplicate key' })
    seen.add(b.key)
    if (!(b.page >= 1 && b.page <= schema.pages.length)) errors.push({ key: b.key, message: `Page ${b.page} is outside the document` })
    if (!(b.rect.w > 0 && b.rect.h > 0)) errors.push({ key: b.key, message: 'Box has no size' })
    if (!b.label.trim() && b.type !== 'constant') errors.push({ key: b.key, message: 'Label is empty' })
    if (b.type === 'digits' && !b.mask) errors.push({ key: b.key, message: 'Digits box needs a mask' })
    if (b.type === 'digits' && b.bindSegments && b.mask && b.bindSegments.length !== maskSegments(b.mask).length) {
      errors.push({ key: b.key, message: 'bindSegments must match the mask segments' })
    }
    if (b.type === 'checkbox' && b.group && !groupKeys.has(b.group)) errors.push({ key: b.key, message: `Unknown group ${b.group}` })
    if (b.oneOf && !oneOfKeys.has(b.oneOf)) errors.push({ key: b.key, message: `Unknown one-of set ${b.oneOf}` })
    if (b.type === 'constant' && !(b.text ?? '').trim()) errors.push({ key: b.key, message: 'Constant has no text' })
  }
  return errors
}

// ── digits + masks ─────────────────────────────────────────────────────────────

/** `###-##-####` → [3, 2, 4]. */
export function maskSegments(mask: string): number[] {
  return mask
    .split(/[^#]+/)
    .filter((s) => s.length > 0)
    .map((s) => s.length)
}

export function maskDigitCount(mask: string): number {
  return maskSegments(mask).reduce((a, b) => a + b, 0)
}

export function onlyDigits(raw: string): string {
  return raw.replace(/\D+/g, '')
}

/** "123456789" + `###-##-####` → "123-45-6789" (partial input keeps partial output). */
export function formatDigitsWithMask(digits: string, mask: string): string {
  const d = onlyDigits(digits)
  let i = 0
  let out = ''
  for (const ch of mask) {
    if (i >= d.length) break
    if (ch === '#') out += d[i++]
    else out += ch
  }
  return out
}

/** "123456789" + `###-##-####` → ["123", "45", "6789"]. */
export function splitDigitsByMask(digits: string, mask: string): string[] {
  const d = onlyDigits(digits)
  const parts: string[] = []
  let i = 0
  for (const len of maskSegments(mask)) {
    parts.push(d.slice(i, i + len))
    i += len
  }
  return parts
}

/** Last four characters of a stored answer — the hint staff see for a sensitive box. */
export function lastFour(value: string | boolean | undefined): string {
  if (typeof value !== 'string') return ''
  const s = value.replace(/\s+/g, '')
  return s.length <= 4 ? s : s.slice(-4)
}

// ── values ─────────────────────────────────────────────────────────────────────

export function isFilled(v: string | boolean | undefined): boolean {
  if (typeof v === 'boolean') return v
  return typeof v === 'string' && v.trim().length > 0
}

/** Fill empty prefillable boxes from the roster; never overwrites what the signer typed. */
export function applyPrefill(schema: FormSchema, values: FormValues, person: FormPerson): FormValues {
  const out: FormValues = { ...values }
  for (const b of schema.boxes) {
    if (!b.prefill || isFilled(out[b.key])) continue
    const v = b.prefill === 'person_name' ? person.name : b.prefill === 'person_email' ? person.email : person.phone
    if (v && v.trim()) out[b.key] = v.trim()
  }
  return out
}

/** Studio sample values, for previews only. */
export function sampleValues(schema: FormSchema): FormValues {
  const out: FormValues = {}
  for (const b of schema.boxes) {
    if (b.type === 'checkbox') {
      if (b.sample === 'true' || b.sample === 'x' || b.sample === 'X') out[b.key] = true
    } else if (b.sample != null && b.sample !== '') out[b.key] = b.sample
  }
  return out
}

/** The boxes a signer interacts with (constants and auto dates are not asked). */
export function askedBoxes(schema: FormSchema): FormBox[] {
  return [...schema.boxes]
    .filter((b) => b.type !== 'constant' && !(b.type === 'date' && (b.dateMode ?? 'today') === 'today'))
    .sort((a, b) => a.order - b.order || a.key.localeCompare(b.key))
}

/**
 * Validate a submission. Signature boxes are validated by the signing payload,
 * not here. Unknown keys are refused so nothing rides along into storage.
 */
export function validateFormValues(schema: FormSchema, values: FormValues): FormValidationError[] {
  const errors: FormValidationError[] = []
  const byKey = new Map(schema.boxes.map((b) => [b.key, b]))
  for (const k of Object.keys(values)) if (!byKey.has(k)) errors.push({ key: k, message: 'Unknown field' })

  for (const b of schema.boxes) {
    const v = values[b.key]
    switch (b.type) {
      case 'text': {
        if (b.required && !isFilled(v)) errors.push({ key: b.key, message: `${b.label} is required` })
        if (typeof v === 'string' && b.maxLength && v.length > b.maxLength) errors.push({ key: b.key, message: `${b.label} is longer than ${b.maxLength} characters` })
        if (v != null && typeof v !== 'string') errors.push({ key: b.key, message: `${b.label} must be text` })
        break
      }
      case 'digits': {
        const digits = typeof v === 'string' ? onlyDigits(v) : ''
        const want = b.mask ? maskDigitCount(b.mask) : 0
        if (!b.oneOf && b.required && digits.length === 0) errors.push({ key: b.key, message: `${b.label} is required` })
        if (digits.length > 0 && want > 0 && digits.length !== want) errors.push({ key: b.key, message: `${b.label} needs ${want} digits` })
        if (typeof v === 'string' && v.trim() && digits.length === 0) errors.push({ key: b.key, message: `${b.label} must be digits` })
        break
      }
      case 'checkbox': {
        if (v != null && typeof v !== 'boolean') errors.push({ key: b.key, message: `${b.label} must be checked or not` })
        if (!b.group && b.required && v !== true) errors.push({ key: b.key, message: `${b.label} must be checked` })
        break
      }
      case 'date': {
        if ((b.dateMode ?? 'today') === 'typed' && b.required && !isFilled(v)) errors.push({ key: b.key, message: `${b.label} is required` })
        break
      }
      default:
        break
    }
  }

  for (const g of schema.groups) {
    const members = schema.boxes.filter((b) => b.type === 'checkbox' && b.group === g.key)
    const checked = members.filter((b) => values[b.key] === true).length
    if (g.exactlyOne && checked > 1) errors.push({ key: g.key, message: `Pick only one: ${g.label}` })
    if (g.required && checked === 0) errors.push({ key: g.key, message: `Pick one: ${g.label}` })
  }

  for (const o of schema.oneOfs) {
    const members = schema.boxes.filter((b) => b.oneOf === o.key)
    const filled = members.filter((b) => isFilled(values[b.key])).length
    if (filled > 1) errors.push({ key: o.key, message: `Fill only one: ${o.label}` })
    if (o.required && filled === 0) errors.push({ key: o.key, message: `${o.label} is required` })
  }
  return errors
}

/**
 * What gets stored on the person row after signing: sensitive boxes are
 * removed from `values` and reduced to their last four in `hints`. The full
 * answer exists afterward only inside the flattened PDF.
 */
export function splitFormValuesForStorage(schema: FormSchema, values: FormValues): { values: FormValues; hints: Record<string, string> } {
  const out: FormValues = {}
  const hints: Record<string, string> = {}
  const byKey = new Map(schema.boxes.map((b) => [b.key, b]))
  for (const [k, v] of Object.entries(values)) {
    const b = byKey.get(k)
    if (!b) continue
    if (b.sensitive) {
      const h = lastFour(v)
      if (h) hints[k] = h
    } else out[k] = v
  }
  return { values: out, hints }
}

// ── fill plan ──────────────────────────────────────────────────────────────────

export type FillOp =
  | { kind: 'setText'; bind: string; text: string; fontSize?: number }
  | { kind: 'check'; bind: string }
  | { kind: 'drawText'; page: number; rect: FormRect; text: string; fontSize: number; align: FormAlign; font: 'body' | 'cursive' }
  | { kind: 'drawImage'; page: number; rect: FormRect; png: Uint8Array }

export type DrawTextOp = Extract<FillOp, { kind: 'drawText' }>

export type FillSignature = { mode: 'type'; text: string } | { mode: 'draw'; png: Uint8Array } | null

export type FillContext = {
  /** "Sep 4, 2026" in the company calendar. */
  todayLabel: string
  signature: FillSignature
}

/**
 * Turn answers into concrete PDF operations. Bound boxes fill the PDF's own
 * field (native appearance); unbound boxes draw at their rect. Signatures
 * always draw. Empty answers produce nothing.
 */
export function buildFillPlan(schema: FormSchema, values: FormValues, ctx: FillContext): FillOp[] {
  const ops: FillOp[] = []
  const draw = (b: FormBox, text: string, font: 'body' | 'cursive' = 'body'): DrawTextOp => ({
    kind: 'drawText',
    page: b.page,
    rect: b.rect,
    text,
    fontSize: b.fontSize ?? FORM_DEFAULT_FONT_SIZE,
    align: b.align ?? 'left',
    font,
  })
  for (const b of [...schema.boxes].sort((a, c) => a.order - c.order)) {
    const v = values[b.key]
    switch (b.type) {
      case 'text': {
        if (typeof v !== 'string' || !v.trim()) break
        const text = b.maxLength ? v.trim().slice(0, b.maxLength) : v.trim()
        ops.push(b.bind ? { kind: 'setText', bind: b.bind, text, fontSize: b.fontSize } : draw(b, text))
        break
      }
      case 'digits': {
        if (typeof v !== 'string') break
        const digits = onlyDigits(v)
        if (!digits) break
        if (b.bindSegments && b.mask) {
          const parts = splitDigitsByMask(digits, b.mask)
          b.bindSegments.forEach((bind, i) => {
            const part = parts[i] ?? ''
            if (part) ops.push({ kind: 'setText', bind, text: part, fontSize: b.fontSize })
          })
        } else if (b.bind) {
          ops.push({ kind: 'setText', bind: b.bind, text: b.mask ? formatDigitsWithMask(digits, b.mask) : digits, fontSize: b.fontSize })
        } else {
          ops.push(draw(b, b.mask ? formatDigitsWithMask(digits, b.mask) : digits))
        }
        break
      }
      case 'checkbox': {
        if (v !== true) break
        ops.push(b.bind ? { kind: 'check', bind: b.bind } : { ...draw(b, 'X'), align: 'center' })
        break
      }
      case 'constant': {
        const text = (b.text ?? '').trim()
        if (!text) break
        ops.push(b.bind ? { kind: 'setText', bind: b.bind, text, fontSize: b.fontSize } : draw(b, text))
        break
      }
      case 'date': {
        const text = (b.dateMode ?? 'today') === 'today' ? ctx.todayLabel : typeof v === 'string' ? v.trim() : ''
        if (!text) break
        ops.push(b.bind ? { kind: 'setText', bind: b.bind, text, fontSize: b.fontSize } : draw(b, text))
        break
      }
      case 'signature': {
        const sig = ctx.signature
        if (!sig) break
        if (sig.mode === 'type') {
          if (sig.text.trim()) ops.push({ ...draw(b, sig.text.trim(), 'cursive'), fontSize: b.fontSize ?? Math.max(FORM_MIN_FONT_SIZE, Math.round(b.rect.h * 0.75)) })
        } else ops.push({ kind: 'drawImage', page: b.page, rect: b.rect, png: sig.png })
        break
      }
    }
  }
  return ops
}

// ── drafting from a PDF's own fields ───────────────────────────────────────────

export type PdfFieldInfo = {
  /** Fully qualified AcroForm name, e.g. `topmostSubform[0].Page1[0].f1_01[0]`. */
  name: string
  kind: 'text' | 'checkbox' | 'other'
  page: number
  rect: FormRect
  maxLength?: number
}

/** `topmostSubform[0].Page1[0].f1_01[0]` → `f1_01`; `...c1_1[3]` → `c1_1_3`. */
export function keyFromFieldName(name: string): string {
  const last = name.split('.').pop() ?? name
  const m = /^(.*?)\[(\d+)\]$/.exec(last)
  const base = (m ? m[1] : last)!.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'field'
  return m && Number(m[2]) > 0 ? `${base}_${m[2]}` : base
}

/** `...c1_1[3]` → `c1_1` (the parent a checkbox shares with its siblings). */
export function groupKeyFromFieldName(name: string): string {
  const last = name.split('.').pop() ?? name
  const m = /^(.*?)\[(\d+)\]$/.exec(last)
  return ((m ? m[1] : last)!.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'group')
}

/**
 * A first-pass schema from the PDF's built-in fields: every text field becomes
 * a bound text box, sibling checkboxes become one exactly-one group. Labels are
 * placeholders for the dev (or an agent) to rewrite. Reading order: page, then
 * top to bottom, then left to right.
 */
export function draftSchemaFromPdfFields(fields: PdfFieldInfo[], pages: FormPage[]): FormSchema {
  const schema = emptyFormSchema(pages)
  const usable = fields.filter((f) => f.kind !== 'other')
  const ordered = [...usable].sort((a, b) => a.page - b.page || b.rect.y + b.rect.h - (a.rect.y + a.rect.h) || a.rect.x - b.rect.x)
  const usedKeys = new Set<string>()
  const groups = new Map<string, number>()
  ordered.forEach((f, i) => {
    let key = keyFromFieldName(f.name)
    if (f.kind === 'checkbox') {
      const idx = /\[(\d+)\]$/.exec(f.name.split('.').pop() ?? '')?.[1]
      if (idx != null && !key.endsWith(`_${idx}`)) key = `${key}_${idx}`
    }
    let unique = key
    let n = 2
    while (usedKeys.has(unique)) unique = `${key}_${n++}`
    usedKeys.add(unique)
    if (f.kind === 'text') {
      schema.boxes.push({
        key: unique,
        type: 'text',
        page: f.page,
        rect: f.rect,
        order: (i + 1) * 10,
        label: `Field ${unique}`,
        bind: f.name,
        ...(f.maxLength ? { maxLength: f.maxLength } : {}),
      })
    } else {
      const g = groupKeyFromFieldName(f.name)
      groups.set(g, (groups.get(g) ?? 0) + 1)
      schema.boxes.push({ key: unique, type: 'checkbox', page: f.page, rect: f.rect, order: (i + 1) * 10, label: `Box ${unique}`, bind: f.name, group: g })
    }
  })
  for (const [g, count] of groups) {
    if (count >= 2) schema.groups.push({ key: g, label: `Choose one (${g})`, exactlyOne: true, required: false })
    else for (const b of schema.boxes) if (b.group === g) delete b.group
  }
  return schema
}

// ── geometry for the studio and the overlay ────────────────────────────────────

export type ScreenRect = { left: number; top: number; width: number; height: number }

/** PDF rect (origin bottom-left) → CSS px rect (origin top-left) at `scale` px per point. */
export function pdfRectToScreen(rect: FormRect, page: FormPage, scale: number): ScreenRect {
  return { left: rect.x * scale, top: (page.height - rect.y - rect.h) * scale, width: rect.w * scale, height: rect.h * scale }
}

export function screenRectToPdf(r: ScreenRect, page: FormPage, scale: number): FormRect {
  const w = r.width / scale
  const h = r.height / scale
  return { x: round2(r.left / scale), y: round2(page.height - r.top / scale - h), w: round2(w), h: round2(h) }
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Shrink a font size until `measure(text, size)` fits `width`, never below the minimum. */
export function fitFontSize(text: string, width: number, startSize: number, measure: (text: string, size: number) => number): number {
  let size = startSize
  while (size > FORM_MIN_FONT_SIZE && measure(text, size) > width) size -= 0.5
  return size
}
