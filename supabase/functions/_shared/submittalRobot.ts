/**
 * The submittal robot's contracts (Submittals stage 6b): what each task kind takes, what the
 * robot writes back, and how the office reads it. Pure — twin-mcp validates results with it,
 * the Submittals tab summarises and confirms with it (imported as a twin kernel from src).
 *
 *   read_schedule    the fixture schedule off the plans → rows for bid_specified_products
 *                    (source = robot, unconfirmed until a person confirms)
 *   file_cut_sheets  a house's whole PDF split by tag → page guesses on the sheet strip
 *   read_redlines    a reviewer's marked-up PDF → proposed decisions the office confirms
 *
 * A guess at or above SURE reads sure; below it, "want a look". Nothing here sends or decides.
 */

export const SUBMITTAL_TASK_KINDS = ['read_schedule', 'file_cut_sheets', 'read_redlines'] as const
export type SubmittalTaskKind = (typeof SUBMITTAL_TASK_KINDS)[number]
export const SUBMITTAL_TASK_STATUSES = ['queued', 'working', 'ready', 'blocked', 'cancelled', 'done'] as const
export type SubmittalTaskStatus = (typeof SUBMITTAL_TASK_STATUSES)[number]

/** Confidence at or above this reads "sure"; below, "want a look". */
export const SURE = 0.7

export function asTaskKind(v: unknown): SubmittalTaskKind | null {
  return (SUBMITTAL_TASK_KINDS as readonly string[]).includes(String(v)) ? (v as SubmittalTaskKind) : null
}
export function asTaskStatus(v: unknown): SubmittalTaskStatus {
  return (SUBMITTAL_TASK_STATUSES as readonly string[]).includes(String(v)) ? (v as SubmittalTaskStatus) : 'queued'
}

export const TASK_KIND_LABELS: Record<SubmittalTaskKind, string> = {
  read_schedule: 'read the schedule',
  file_cut_sheets: 'split the file by tag',
  read_redlines: 'read the redlines',
}

function clamp01(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return 0.5
  return Math.max(0, Math.min(1, n))
}
function str(v: unknown, max = 400): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}
function tagOf(v: unknown): string {
  return str(v, 40).toUpperCase().replace(/\s+/g, '')
}

// ---------- read_schedule ----------

export type ScheduleRow = { tag: string; fixture: string | null; manufacturer: string | null; model: string | null; description: string | null; confidence: number }

/** The robot's rows, cleaned: a tag is required; duplicates keep the surer one. Bad input → error string. */
export function parseScheduleRows(raw: unknown): { ok: true; rows: ScheduleRow[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: 'rows must be an array of { tag, fixture, manufacturer, model, description, confidence }' }
  const byTag = new Map<string, ScheduleRow>()
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    const tag = tagOf(o.tag)
    if (!tag) continue
    const row: ScheduleRow = { tag, fixture: str(o.fixture, 120) || null, manufacturer: str(o.manufacturer, 120) || null, model: str(o.model, 120) || null, description: str(o.description, 400) || null, confidence: clamp01(o.confidence ?? 0.5) }
    const prev = byTag.get(tag)
    if (!prev || prev.confidence < row.confidence) byTag.set(tag, row)
  }
  if (byTag.size === 0) return { ok: false, error: 'no rows carried a tag — nothing to write' }
  return { ok: true, rows: [...byTag.values()].sort((a, b) => a.tag.localeCompare(b.tag, undefined, { numeric: true })) }
}

/** The inserts for bid_specified_products: source robot, unconfirmed. */
export function scheduleRowInserts(bidId: string, rows: ReadonlyArray<ScheduleRow>, createdBy: string | null): Array<Record<string, unknown>> {
  return rows.map((r) => ({ bid_id: bidId, tag: r.tag, fixture: r.fixture, manufacturer: r.manufacturer, model: r.model, description: r.description, source: 'robot', confirmed_at: null, confirmed_by: null, created_by: createdBy }))
}

/** "18 tags · 15 sure · 3 want a look" */
export function summarizeScheduleRows(rows: ReadonlyArray<ScheduleRow>): string {
  const sure = rows.filter((r) => r.confidence >= SURE).length
  const look = rows.length - sure
  return `${rows.length} tag${rows.length === 1 ? '' : 's'} · ${sure} sure${look ? ` · ${look} want a look` : ''}`
}

// ---------- file_cut_sheets ----------

export type SheetGuess = { page: number; tag: string; confidence: number }
export type SheetGuesses = { guesses: SheetGuess[]; skipped: number[] }

/** Pages 1..pageCount; one guess per page (the surer wins); skipped pages are the quote itself, covers, blanks. */
export function parseSheetGuesses(raw: unknown, pageCount: number): { ok: true; value: SheetGuesses } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'result must be { guesses: [{ page, tag, confidence }], skipped: [page] }' }
  const o = raw as Record<string, unknown>
  if (!Array.isArray(o.guesses)) return { ok: false, error: 'guesses must be an array of { page, tag, confidence }' }
  const byPage = new Map<number, SheetGuess>()
  for (const g of o.guesses) {
    if (!g || typeof g !== 'object') continue
    const x = g as Record<string, unknown>
    const page = Math.round(Number(x.page))
    const tag = tagOf(x.tag)
    if (!Number.isFinite(page) || page < 1 || (pageCount > 0 && page > pageCount) || !tag) continue
    const guess = { page, tag, confidence: clamp01(x.confidence ?? 0.5) }
    const prev = byPage.get(page)
    if (!prev || prev.confidence < guess.confidence) byPage.set(page, guess)
  }
  const skipped = Array.isArray(o.skipped) ? [...new Set(o.skipped.map((p) => Math.round(Number(p))).filter((p) => Number.isFinite(p) && p >= 1 && (pageCount === 0 || p <= pageCount) && !byPage.has(p)))].sort((a, b) => a - b) : []
  if (byPage.size === 0) return { ok: false, error: 'no guess named a page and a tag' }
  return { ok: true, value: { guesses: [...byPage.values()].sort((a, b) => a.page - b.page), skipped } }
}

/** "14 pages matched to tags · 2 unsure · 3 pages skipped" */
export function summarizeSheetGuesses(v: SheetGuesses): string {
  const sure = v.guesses.filter((g) => g.confidence >= SURE).length
  const unsure = v.guesses.length - sure
  const parts = [`${sure} page${sure === 1 ? '' : 's'} matched to tags`]
  if (unsure) parts.push(`${unsure} unsure`)
  if (v.skipped.length) parts.push(`${v.skipped.length} page${v.skipped.length === 1 ? '' : 's'} skipped`)
  return parts.join(' · ')
}

// ---------- read_redlines ----------

export type RedlineProposal = 'approved' | 'revise' | 'rejected' | 'question'
export type RedlineAnnotation = { page: number | null; tag: string | null; text: string; proposed: RedlineProposal; confidence: number }

export function parseRedlineAnnotations(raw: unknown): { ok: true; annotations: RedlineAnnotation[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: 'annotations must be an array of { page, tag, text, proposed, confidence }' }
  const out: RedlineAnnotation[] = []
  for (const a of raw) {
    if (!a || typeof a !== 'object') continue
    const x = a as Record<string, unknown>
    const text = str(x.text, 600)
    const proposed = ['approved', 'revise', 'rejected', 'question'].includes(String(x.proposed)) ? (x.proposed as RedlineProposal) : 'question'
    const tag = tagOf(x.tag) || null
    if (!text && !tag) continue
    const page = Number.isFinite(Number(x.page)) && Number(x.page) >= 1 ? Math.round(Number(x.page)) : null
    out.push({ page, tag, text, proposed: tag ? proposed : 'question', confidence: clamp01(x.confidence ?? 0.5) })
  }
  if (out.length === 0) return { ok: false, error: 'no annotation carried text or a tag' }
  return { ok: true, annotations: out }
}

/** "10 annotations · 6 read as decisions · 2 unsure · 2 are questions for the thread" */
export function summarizeRedlines(annotations: ReadonlyArray<RedlineAnnotation>): string {
  const decisions = annotations.filter((a) => a.proposed !== 'question' && a.tag)
  const sure = decisions.filter((a) => a.confidence >= SURE).length
  const unsure = decisions.length - sure
  const questions = annotations.length - decisions.length
  const parts = [`${annotations.length} annotation${annotations.length === 1 ? '' : 's'}`, `${sure} read as decision${sure === 1 ? '' : 's'}`]
  if (unsure) parts.push(`${unsure} unsure`)
  if (questions) parts.push(`${questions} ${questions === 1 ? 'is a question' : 'are questions'} for the thread`)
  return parts.join(' · ')
}

/** The office's task line: "robot · read the schedule · ready · 18 tags · 15 sure · 3 want a look". */
export function describeTask(t: { kind: string; status: string; result: unknown; summary?: string | null }, pageCount = 0): string {
  const kind = asTaskKind(t.kind)
  const status = asTaskStatus(t.status)
  const head = `robot · ${kind ? TASK_KIND_LABELS[kind] : t.kind} · ${status === 'ready' ? 'ready' : status === 'working' ? 'working' : status === 'queued' ? 'queued' : status === 'blocked' ? 'blocked' : status === 'done' ? 'confirmed' : 'cancelled'}`
  if (status === 'blocked') return `${head}${t.summary ? ` · ${t.summary}` : ''}`
  if (status !== 'ready' || !t.result || typeof t.result !== 'object') return head
  const r = t.result as Record<string, unknown>
  if (kind === 'read_schedule') {
    const p = parseScheduleRows(r.rows)
    return p.ok ? `${head} · ${summarizeScheduleRows(p.rows)}` : head
  }
  if (kind === 'file_cut_sheets') {
    const p = parseSheetGuesses(r, pageCount)
    return p.ok ? `${head} · ${summarizeSheetGuesses(p.value)}` : head
  }
  if (kind === 'read_redlines') {
    const p = parseRedlineAnnotations(r.annotations)
    return p.ok ? `${head} · ${summarizeRedlines(p.annotations)}` : head
  }
  return head
}
