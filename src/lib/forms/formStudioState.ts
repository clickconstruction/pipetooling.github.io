/**
 * Form Studio — pure editing operations on a FormSchema (Contract Forms PR 2).
 *
 * The studio component owns React state; every change to the schema goes
 * through one of these functions so the behaviour is testable without a DOM:
 * adding a box with a sensible default rect, moving / resizing inside the
 * page, importing a PDF's own fields without duplicating boxes already bound,
 * promoting sibling text fields into one masked digits box (SSN, EIN), and
 * parsing an imported JSON schema.
 */

import {
  FORM_BOX_KEY_RE,
  draftSchemaFromPdfFields,
  round2,
  validateFormSchema,
  type FormBox,
  type FormBoxType,
  type FormPage,
  type FormRect,
  type FormSchema,
  type FormValidationError,
  type PdfFieldInfo,
} from './formSchema'

export const DEFAULT_BOX_SIZE: Record<FormBoxType, { w: number; h: number }> = {
  text: { w: 160, h: 14 },
  digits: { w: 110, h: 14 },
  checkbox: { w: 10, h: 10 },
  signature: { w: 220, h: 20 },
  date: { w: 80, h: 14 },
  constant: { w: 160, h: 14 },
}

export const DEFAULT_BOX_LABEL: Record<FormBoxType, string> = {
  text: 'New text box',
  digits: 'New number',
  checkbox: 'New checkbox',
  signature: 'Signature',
  date: 'Date',
  constant: '',
}

export const DIGIT_MASK_PRESETS: Array<{ label: string; mask: string }> = [
  { label: 'SSN 3-2-4', mask: '###-##-####' },
  { label: 'EIN 2-7', mask: '##-#######' },
  { label: 'ZIP 5', mask: '#####' },
  { label: 'Phone 3-3-4', mask: '###-###-####' },
  { label: 'Year 4', mask: '####' },
]

/** A key no box uses yet: `${base}`, `${base}_2`, … */
export function uniqueBoxKey(schema: FormSchema, base: string): string {
  const clean = base.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'box'
  const used = new Set(schema.boxes.map((b) => b.key))
  if (!used.has(clean)) return clean
  let n = 2
  while (used.has(`${clean}_${n}`)) n++
  return `${clean}_${n}`
}

export function nextOrder(schema: FormSchema): number {
  return schema.boxes.reduce((m, b) => Math.max(m, b.order), 0) + 10
}

export function clampRectToPage(rect: FormRect, page: FormPage): FormRect {
  const w = Math.min(Math.max(2, rect.w), page.width)
  const h = Math.min(Math.max(2, rect.h), page.height)
  const x = Math.min(Math.max(0, rect.x), page.width - w)
  const y = Math.min(Math.max(0, rect.y), page.height - h)
  return { x: round2(x), y: round2(y), w: round2(w), h: round2(h) }
}

/** A new box of `type` centred on the page (or at `at`, its top-left in PDF points). */
export function addBox(schema: FormSchema, type: FormBoxType, pageNo: number, at?: { x: number; y: number }): { schema: FormSchema; box: FormBox } {
  const page = schema.pages[pageNo - 1] ?? schema.pages[0] ?? { width: 612, height: 792 }
  const size = DEFAULT_BOX_SIZE[type]
  const rect = clampRectToPage(
    at ? { x: at.x, y: at.y - size.h, w: size.w, h: size.h } : { x: (page.width - size.w) / 2, y: (page.height - size.h) / 2, w: size.w, h: size.h },
    page,
  )
  const box: FormBox = {
    key: uniqueBoxKey(schema, type === 'signature' || type === 'date' ? type : `${type}_${schema.boxes.filter((b) => b.type === type).length + 1}`),
    type,
    page: pageNo,
    rect,
    order: nextOrder(schema),
    label: DEFAULT_BOX_LABEL[type],
    ...(type === 'digits' ? { mask: '###-##-####' } : {}),
    ...(type === 'date' ? { dateMode: 'today' as const } : {}),
    ...(type === 'constant' ? { text: 'Constant text' } : {}),
  }
  return { schema: { ...schema, boxes: [...schema.boxes, box] }, box }
}

export function updateBox(schema: FormSchema, key: string, patch: Partial<FormBox>): FormSchema {
  return { ...schema, boxes: schema.boxes.map((b) => (b.key === key ? { ...b, ...patch } : b)) }
}

/** Rename a key everywhere it appears (values are re-keyed by the caller). Refuses collisions and bad keys. */
export function renameBoxKey(schema: FormSchema, from: string, to: string): { schema: FormSchema; error?: string } {
  if (!FORM_BOX_KEY_RE.test(to)) return { schema, error: 'Keys are lowercase letters, digits, and underscores' }
  if (from === to) return { schema }
  if (schema.boxes.some((b) => b.key === to)) return { schema, error: `"${to}" is already used` }
  return { schema: { ...schema, boxes: schema.boxes.map((b) => (b.key === from ? { ...b, key: to } : b)) } }
}

export function removeBox(schema: FormSchema, key: string): FormSchema {
  const boxes = schema.boxes.filter((b) => b.key !== key)
  return pruneEmptySets({ ...schema, boxes })
}

export function duplicateBox(schema: FormSchema, key: string): { schema: FormSchema; box: FormBox | null } {
  const src = schema.boxes.find((b) => b.key === key)
  if (!src) return { schema, box: null }
  const page = schema.pages[src.page - 1] ?? { width: 612, height: 792 }
  const box: FormBox = { ...src, key: uniqueBoxKey(schema, src.key), rect: clampRectToPage({ ...src.rect, y: src.rect.y - src.rect.h - 4 }, page), order: nextOrder(schema) }
  delete box.bind
  delete box.bindSegments
  return { schema: { ...schema, boxes: [...schema.boxes, box] }, box }
}

/** Drop groups / one-of sets no box refers to any more. */
export function pruneEmptySets(schema: FormSchema): FormSchema {
  const groups = schema.groups.filter((g) => schema.boxes.some((b) => b.group === g.key))
  const oneOfs = schema.oneOfs.filter((o) => schema.boxes.some((b) => b.oneOf === o.key))
  return { ...schema, groups, oneOfs }
}

export function ensureGroup(schema: FormSchema, key: string, label?: string): FormSchema {
  if (schema.groups.some((g) => g.key === key)) return schema
  return { ...schema, groups: [...schema.groups, { key, label: label ?? key, exactlyOne: true, required: false }] }
}

export function ensureOneOf(schema: FormSchema, key: string, label?: string): FormSchema {
  if (schema.oneOfs.some((o) => o.key === key)) return schema
  return { ...schema, oneOfs: [...schema.oneOfs, { key, label: label ?? key, required: false }] }
}

export function moveRect(schema: FormSchema, key: string, dx: number, dy: number): FormSchema {
  const b = schema.boxes.find((x) => x.key === key)
  if (!b) return schema
  const page = schema.pages[b.page - 1] ?? { width: 612, height: 792 }
  return updateBox(schema, key, { rect: clampRectToPage({ ...b.rect, x: b.rect.x + dx, y: b.rect.y + dy }, page) })
}

export function setRect(schema: FormSchema, key: string, rect: FormRect): FormSchema {
  const b = schema.boxes.find((x) => x.key === key)
  if (!b) return schema
  const page = schema.pages[b.page - 1] ?? { width: 612, height: 792 }
  return updateBox(schema, key, { rect: clampRectToPage(rect, page) })
}

/** Reassign `order` in steps of 10 following the current sort (ties by key). */
export function renumberOrders(schema: FormSchema): FormSchema {
  const sorted = [...schema.boxes].sort((a, b) => a.order - b.order || a.key.localeCompare(b.key))
  const orderByKey = new Map(sorted.map((b, i) => [b.key, (i + 1) * 10]))
  return { ...schema, boxes: schema.boxes.map((b) => ({ ...b, order: orderByKey.get(b.key) ?? b.order })) }
}

/** Swap a box with its neighbour in tab order. */
export function moveOrder(schema: FormSchema, key: string, dir: -1 | 1): FormSchema {
  const s = renumberOrders(schema)
  const sorted = [...s.boxes].sort((a, b) => a.order - b.order)
  const i = sorted.findIndex((b) => b.key === key)
  const j = i + dir
  if (i < 0 || j < 0 || j >= sorted.length) return s
  const a = sorted[i]!
  const b = sorted[j]!
  return { ...s, boxes: s.boxes.map((x) => (x.key === a.key ? { ...x, order: b.order } : x.key === b.key ? { ...x, order: a.order } : x)) }
}

/**
 * Import a PDF's own fields as boxes. Fields already bound by an existing box
 * (by `bind` or `bindSegments`) are skipped, so re-importing after a new
 * revision only adds what is new.
 */
export function mergeDraftedFields(schema: FormSchema, fields: PdfFieldInfo[], pages: FormPage[]): { schema: FormSchema; added: number; skipped: number } {
  const bound = new Set<string>()
  for (const b of schema.boxes) {
    if (b.bind) bound.add(b.bind)
    for (const s of b.bindSegments ?? []) bound.add(s)
  }
  const fresh = fields.filter((f) => !bound.has(f.name))
  const drafted = draftSchemaFromPdfFields(fresh, pages.length > 0 ? pages : schema.pages)
  let next: FormSchema = { ...schema, pages: schema.pages.length > 0 ? schema.pages : pages, boxes: [...schema.boxes] }
  let order = nextOrder(next)
  const groupKeys = new Set(next.groups.map((g) => g.key))
  for (const g of drafted.groups) {
    if (!groupKeys.has(g.key)) {
      next.groups = [...next.groups, g]
      groupKeys.add(g.key)
    }
  }
  for (const b of drafted.boxes) {
    const key = uniqueBoxKey(next, b.key)
    next.boxes.push({ ...b, key, order })
    order += 10
  }
  next = pruneEmptySets(next)
  return { schema: next, added: drafted.boxes.length, skipped: fields.length - fresh.length }
}

/**
 * Merge several bound text boxes (the W-9's three SSN cells) into one masked
 * `digits` box whose `bindSegments` follow left-to-right order. The rect is the
 * union of the parts. Refuses when the segment count does not match the mask.
 */
export function promoteToDigits(schema: FormSchema, keys: string[], mask: string, newKey: string, label: string): { schema: FormSchema; error?: string } {
  const parts = schema.boxes.filter((b) => keys.includes(b.key) && b.type === 'text' && b.bind)
  if (parts.length !== keys.length || parts.length === 0) return { schema, error: 'Pick bound text boxes only' }
  const segments = mask.split(/[^#]+/).filter((s) => s.length > 0).length
  if (segments !== parts.length) return { schema, error: `The mask has ${segments} segment(s) but ${parts.length} box(es) were picked` }
  const page = parts[0]!.page
  if (parts.some((p) => p.page !== page)) return { schema, error: 'Boxes must be on the same page' }
  const ordered = [...parts].sort((a, b) => a.rect.x - b.rect.x)
  const x = Math.min(...ordered.map((p) => p.rect.x))
  const y = Math.min(...ordered.map((p) => p.rect.y))
  const right = Math.max(...ordered.map((p) => p.rect.x + p.rect.w))
  const top = Math.max(...ordered.map((p) => p.rect.y + p.rect.h))
  if (!FORM_BOX_KEY_RE.test(newKey) || schema.boxes.some((b) => b.key === newKey && !keys.includes(b.key))) return { schema, error: 'Bad or duplicate key' }
  const box: FormBox = {
    key: newKey,
    type: 'digits',
    page,
    rect: { x: round2(x), y: round2(y), w: round2(right - x), h: round2(top - y) },
    order: Math.min(...ordered.map((p) => p.order)),
    label,
    mask,
    bindSegments: ordered.map((p) => p.bind!),
    fontSize: ordered[0]!.fontSize,
  }
  return { schema: pruneEmptySets({ ...schema, boxes: [...schema.boxes.filter((b) => !keys.includes(b.key)), box] }) }
}

export type ParsedSchema = { ok: true; schema: FormSchema } | { ok: false; errors: FormValidationError[] }

/** Parse pasted / uploaded JSON into a schema, or say exactly what is wrong. */
export function parseSchemaJson(text: string): ParsedSchema {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (e) {
    return { ok: false, errors: [{ key: '', message: `Not valid JSON: ${e instanceof Error ? e.message : String(e)}` }] }
  }
  if (!raw || typeof raw !== 'object') return { ok: false, errors: [{ key: '', message: 'Expected an object' }] }
  const o = raw as Partial<FormSchema>
  const schema: FormSchema = {
    version: 1,
    pages: Array.isArray(o.pages) ? o.pages : [],
    boxes: Array.isArray(o.boxes) ? o.boxes : [],
    groups: Array.isArray(o.groups) ? o.groups : [],
    oneOfs: Array.isArray(o.oneOfs) ? o.oneOfs : [],
  }
  if (o.version !== undefined && o.version !== 1) return { ok: false, errors: [{ key: '', message: `Unsupported schema version ${String(o.version)}` }] }
  const errors = validateFormSchema(schema)
  return errors.length > 0 ? { ok: false, errors } : { ok: true, schema }
}

export function schemaSummary(schema: FormSchema): { boxes: number; asked: number; sensitive: number; bound: number; drawn: number; office: number } {
  const boxes = schema.boxes.length
  const office = schema.boxes.filter((b) => b.party === 'office').length
  const asked = schema.boxes.filter((b) => b.type !== 'constant' && !(b.type === 'date' && (b.dateMode ?? 'today') === 'today')).length
  const sensitive = schema.boxes.filter((b) => b.sensitive).length
  const bound = schema.boxes.filter((b) => b.bind || (b.bindSegments && b.bindSegments.length > 0)).length
  return { boxes, asked, sensitive, bound, drawn: boxes - bound, office }
}

/** The Book entry a publish creates or updates for a form template. */
export function bookEntryForForm(input: { formTemplateId: string; packetTemplateId: string; documentName: string; audience: string; sequenceOrder: number; versionDate: string | null }) {
  return {
    template_id: input.packetTemplateId,
    document_name: input.documentName.trim(),
    sequence_order: input.sequenceOrder,
    book_body_html: null,
    book_body_format: 'plain',
    tags: ['form'],
    canonical_document_url: null,
    audience: input.audience,
    book_version_date: input.versionDate,
    form_template_id: input.formTemplateId,
  }
}
