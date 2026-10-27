/**
 * The drafted field report (punch list #186, item 1, PR 2, v2.5916): what `report-draft` asks the model for and how it
 * reads the answer. Pure, no Deno globals, so a test can hold it. The model gets the words the tech said, the job's
 * lines with their last percent and the report's fields, and answers one JSON object held to `DRAFT_SCHEMA`:
 * three short lines for Notes (what was done, the parts, the next step), a percent per line the tech named with the
 * words it came from, and the language heard. A line the tech did not name is never in the answer, so the form leaves
 * it as it was. Nothing here writes: the draft goes back to the form, and Save report is the tech's.
 */

export interface DraftLineIn {
  id: string
  name: string
  /** The line's percent on record before this report; null when nobody has said one. */
  pct: number | null
}

export interface DraftRequest {
  transcript: string
  /** The language the words were heard in, as the phone named it ("es-MX"); '' when unknown. */
  lang: string
  jobName: string
  lines: DraftLineIn[]
  /** The report's text fields, by label: the model fills Notes and leaves the rest. */
  fields: string[]
}

export interface DraftLineOut {
  id: string
  pct: number
  /** The words the percent came from, as said. */
  from: string
}

export interface ReportDraft {
  notes: { done: string; parts: string; next: string }
  lines: DraftLineOut[]
  /** The language the words were in, BCP 47 ("en", "es"). */
  language: string
}

/** The longest transcript the function takes: two minutes of talk is well under this. */
export const TRANSCRIPT_MAX = 4000
export const LINES_MAX = 40

/** The request as the function reads it, or why it cannot. */
export function readDraftRequest(body: unknown): { ok: true; request: DraftRequest } | { ok: false; why: string } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const transcript = typeof b.transcript === 'string' ? b.transcript.trim() : ''
  if (!transcript) return { ok: false, why: 'Nothing was said.' }
  if (transcript.length > TRANSCRIPT_MAX) return { ok: false, why: 'That note is too long to draft from. Say it in two parts.' }
  const lines: DraftLineIn[] = []
  if (Array.isArray(b.lines)) {
    for (const raw of b.lines.slice(0, LINES_MAX)) {
      const l = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
      const id = typeof l.id === 'string' ? l.id.trim() : ''
      const name = typeof l.name === 'string' ? l.name.trim() : ''
      if (!id || !name) continue
      const pct = typeof l.pct === 'number' && Number.isFinite(l.pct) ? Math.max(0, Math.min(100, Math.round(l.pct))) : null
      lines.push({ id, name: name.slice(0, 120), pct })
    }
  }
  const fields = Array.isArray(b.fields) ? b.fields.filter((f): f is string => typeof f === 'string' && f.trim() !== '').map((f) => f.trim().slice(0, 120)).slice(0, 20) : []
  return {
    ok: true,
    request: {
      transcript,
      lang: typeof b.lang === 'string' ? b.lang.trim().slice(0, 20) : '',
      jobName: typeof b.jobName === 'string' ? b.jobName.trim().slice(0, 160) : '',
      lines,
      fields,
    },
  }
}

/** The one shape the model may answer with. */
export const DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    notes: {
      type: 'object',
      properties: {
        done: { type: 'string', description: 'What was done, one or two short sentences in English. Empty when nothing was said about it.' },
        parts: { type: 'string', description: 'The parts and materials used, as a short list in one line. Empty when none were named.' },
        next: { type: 'string', description: 'The next step and when, one short sentence. Empty when none was said.' },
      },
      required: ['done', 'parts', 'next'],
      additionalProperties: false,
    },
    lines: {
      type: 'array',
      description: 'Only the job lines the speaker named, each with the percent they meant and the words it came from.',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The line id, exactly as given.' },
          // Structured output refuses `minimum` and `maximum` on an integer (v2.5996, the first live draft's 400), so the
          // range rides in the description and `readDraft` clamps every number to 0..100 on its way back.
          pct: { type: 'integer', description: 'The percent the line is at, a whole number from 0 to 100.' },
          from: { type: 'string', description: 'The words of the transcript the percent came from, as said.' },
        },
        required: ['id', 'pct', 'from'],
        additionalProperties: false,
      },
    },
    language: { type: 'string', description: 'The language of the transcript as a BCP 47 code: en, es.' },
  },
  required: ['notes', 'lines', 'language'],
  additionalProperties: false,
} as const

export const DRAFT_SYSTEM = [
  'You draft a plumbing field report from what a technician said on the job, for the office to read.',
  'Write the report in plain English, short sentences, trade words as the technician used them.',
  'Say only what the technician said. Never add work, parts or dates they did not say.',
  'For the job lines: set a percent only for a line the technician clearly spoke about, by its name or an obvious short form.',
  '"Done", "finished", "complete" on a line means 100. "Half", "halfway" means 50. A number they said is the number.',
  'A line they did not speak about is not in your answer at all.',
  'Quote the exact words each percent came from in "from".',
  'If the technician spoke Spanish, still write the report in English and set language to es.',
].join(' ')

/** The message the model reads: the job, its lines with their numbers, the fields, then the words. */
export function draftUserMessage(r: DraftRequest): string {
  const lines = r.lines.length
    ? r.lines.map((l) => `- id ${l.id}: ${l.name}${l.pct != null ? ` (now at ${l.pct}%)` : ' (no percent yet)'}`).join('\n')
    : '- (this job has one line; no per-line percents)'
  return [
    `Job: ${r.jobName || '(unnamed)'}`,
    `The job's lines:`,
    lines,
    `The report's text fields: ${r.fields.length ? r.fields.join(', ') : 'Notes'}`,
    r.lang ? `The phone heard the words as ${r.lang}.` : '',
    `What the technician said:`,
    `"""${r.transcript}"""`,
  ]
    .filter(Boolean)
    .join('\n')
}

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** The model's answer as a draft, held to the job's lines; null when it is not the shape asked for. */
export function readDraft(json: unknown, lines: readonly DraftLineIn[]): ReportDraft | null {
  if (!json || typeof json !== 'object') return null
  const o = json as Record<string, unknown>
  const n = (o.notes && typeof o.notes === 'object' ? o.notes : null) as Record<string, unknown> | null
  if (!n) return null
  const known = new Set(lines.map((l) => l.id))
  const out: DraftLineOut[] = []
  if (Array.isArray(o.lines)) {
    for (const raw of o.lines) {
      const l = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
      const id = text(l.id, 200)
      if (!known.has(id) || out.some((x) => x.id === id)) continue
      const pct = typeof l.pct === 'number' && Number.isFinite(l.pct) ? Math.max(0, Math.min(100, Math.round(l.pct))) : null
      if (pct === null) continue
      out.push({ id, pct, from: text(l.from, 300) })
    }
  }
  const draft: ReportDraft = {
    notes: { done: text(n.done, 1000), parts: text(n.parts, 600), next: text(n.next, 400) },
    lines: out,
    language: text(o.language, 12).toLowerCase() || 'en',
  }
  if (!draft.notes.done && !draft.notes.parts && !draft.notes.next && !draft.lines.length) return null
  return draft
}

/** The text block of a Messages answer, parsed; null when there is none or it is not JSON. */
export function draftFromAnswer(content: ReadonlyArray<{ type: string; text?: string }>, lines: readonly DraftLineIn[]): ReportDraft | null {
  const block = content.find((b) => b.type === 'text' && typeof b.text === 'string')
  if (!block?.text) return null
  try {
    return readDraft(JSON.parse(block.text), lines)
  } catch {
    return null
  }
}

/** What a call cost, in cents, at Claude Opus 5.5's rates ($4 and $20 a million tokens), to the hundredth. */
export function costCents(usage: { input_tokens?: number; output_tokens?: number } | null | undefined): number {
  const i = usage?.input_tokens ?? 0
  const o = usage?.output_tokens ?? 0
  return Math.round(((i * 4 + o * 20) / 1_000_000) * 100 * 100) / 100
}
