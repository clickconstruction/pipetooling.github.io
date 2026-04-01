import type { Json } from '../types/database'

/**
 * Writeup template blocks are stored as JSON in writeup_templates.schema.
 * Answers keyed by block id in writeups.answers (JSON object).
 *
 * - prompt: no answer stored
 * - text / textarea: string value
 * - checklist: string[] of checked option labels (must be subset of options)
 */

export type WriteupTemplateBlockPrompt = {
  type: 'prompt'
  id: string
  content: string
}

export type WriteupTemplateBlockText = {
  type: 'text'
  id: string
  label: string
  required?: boolean
}

export type WriteupTemplateBlockTextarea = {
  type: 'textarea'
  id: string
  label: string
  required?: boolean
}

export type WriteupTemplateBlockChecklist = {
  type: 'checklist'
  id: string
  label?: string
  options: string[]
  /** If true, at least one option must be checked */
  required?: boolean
}

export type WriteupTemplateBlock =
  | WriteupTemplateBlockPrompt
  | WriteupTemplateBlockText
  | WriteupTemplateBlockTextarea
  | WriteupTemplateBlockChecklist

export type WriteupAnswers = Record<string, unknown>

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

function parseBlock(raw: unknown): WriteupTemplateBlock | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = typeof o.id === 'string' ? o.id.trim() : ''
  if (!id) return null
  const type = o.type
  if (type === 'prompt') {
    if (!isNonEmptyString(o.content)) return null
    return { type: 'prompt', id, content: o.content.trim() }
  }
  if (type === 'text') {
    if (!isNonEmptyString(o.label)) return null
    return { type: 'text', id, label: o.label.trim(), required: Boolean(o.required) }
  }
  if (type === 'textarea') {
    if (!isNonEmptyString(o.label)) return null
    return { type: 'textarea', id, label: o.label.trim(), required: Boolean(o.required) }
  }
  if (type === 'checklist') {
    if (!Array.isArray(o.options)) return null
    const options = o.options
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .map((x) => x.trim())
    if (options.length === 0) return null
    const label = typeof o.label === 'string' && o.label.trim() ? o.label.trim() : undefined
    return { type: 'checklist', id, label, options, required: Boolean(o.required) }
  }
  return null
}

export function parseWriteupTemplateSchema(raw: unknown): { ok: true; schema: WriteupTemplateBlock[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) {
    return { ok: false, error: 'Template schema must be a JSON array.' }
  }
  const blocks: WriteupTemplateBlock[] = []
  const seenIds = new Set<string>()
  for (let i = 0; i < raw.length; i++) {
    const b = parseBlock(raw[i])
    if (!b) {
      return { ok: false, error: `Invalid block at index ${i}.` }
    }
    if (seenIds.has(b.id)) {
      return { ok: false, error: `Duplicate block id "${b.id}".` }
    }
    seenIds.add(b.id)
    blocks.push(b)
  }
  return { ok: true, schema: blocks }
}

export function emptyAnswersForSchema(schema: WriteupTemplateBlock[]): WriteupAnswers {
  const out: WriteupAnswers = {}
  for (const b of schema) {
    if (b.type === 'text' || b.type === 'textarea') out[b.id] = ''
    if (b.type === 'checklist') out[b.id] = []
  }
  return out
}

export function validateWriteupAnswers(
  schema: WriteupTemplateBlock[],
  answers: unknown,
  options: { enforceRequired?: boolean } = {}
): { ok: true; answers: WriteupAnswers } | { ok: false; errors: string[] } {
  const enforceRequired = options.enforceRequired !== false
  const obj = answers && typeof answers === 'object' && !Array.isArray(answers) ? (answers as Record<string, unknown>) : {}
  const errors: string[] = []
  const normalized: WriteupAnswers = { ...obj }

  for (const b of schema) {
    if (b.type === 'prompt') continue
    if (b.type === 'text' || b.type === 'textarea') {
      const v = obj[b.id]
      const str = typeof v === 'string' ? v.trim() : ''
      normalized[b.id] = str
      if (enforceRequired && b.required && !str) {
        errors.push(`${b.label} is required.`)
      }
      continue
    }
    if (b.type === 'checklist') {
      const v = obj[b.id]
      let checked: string[] = []
      if (Array.isArray(v)) {
        checked = v.filter((x): x is string => typeof x === 'string').map((x) => x.trim())
      }
      const optionSet = new Set(b.options)
      const filtered = checked.filter((x) => optionSet.has(x))
      normalized[b.id] = filtered
      if (enforceRequired && b.required && filtered.length === 0) {
        errors.push(b.label ? `${b.label}: select at least one option.` : 'Select at least one checklist option.')
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, answers: normalized }
}

/** Serialize schema to JSON for DB (validates structure). */
export function schemaToJson(schema: WriteupTemplateBlock[]): Json {
  return schema.map((b) => {
    if (b.type === 'prompt') return { type: b.type, id: b.id, content: b.content }
    if (b.type === 'text' || b.type === 'textarea') return { type: b.type, id: b.id, label: b.label, required: b.required ?? false }
    return { type: b.type, id: b.id, label: b.label, options: b.options, required: b.required ?? false }
  }) as Json
}
