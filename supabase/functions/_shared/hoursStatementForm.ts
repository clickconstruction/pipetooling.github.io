/**
 * The signed hours statement as a Contract Form (punch list #212, PR 3): the pure half of the signing. A statement is
 * drawn as its own PDF (`hoursStatementPdf.ts`) with a form schema recorded as it is drawn — the signature box, the
 * date, the printed name, and the stated rows the worker types — and then sent, signed and filed exactly as every
 * Contract Form is (`send-contract-for-signature`, `/contract/accept`, `accept-contract`, `open-contract-form-pdf`).
 * This file holds what both sides of that need to agree on: the document's name, where its template lives, the keys
 * of the stated boxes, the seed values the office writes on the unsent row, and the stated days read back out of the
 * signer's answers. Type-only imports, so the app (`src/lib/people/hoursStatementForm.ts` re-exports it) and the
 * functions read one copy.
 */
import type { FormValues } from './formSchema.ts'
import type { HoursStatementStatedDay } from './hoursStatement.ts'

/** The `doc_type` on the statement's form template and its person copy (migration 20261102230000 widens both checks). */
export const HOURS_STATEMENT_DOC_TYPE = 'hours_statement'

/** Blank rows the worker may fill in, after any day the office already stated. */
export const HOURS_STATEMENT_BLANK_STATED_ROWS = 3

/** The caps the stated boxes carry, so a typed answer fits its cell. */
export const STATED_DAY_MAX = 12
export const STATED_HOURS_MAX = 6
export const STATED_NOTE_MAX = 80

/** `Hours statement HS-1042-0007`: the person copy's `document_name` and the template's `name`. */
export function hoursStatementDocumentName(recordId: string): string {
  return `Hours statement ${(recordId ?? '').trim() || 'draft'}`
}

/** Where the statement's own PDF lives in the private `contract-form-templates` bucket, one per statement. */
export function hoursStatementTemplatePath(statementId: string): string {
  return `hours-statements/${statementId}/statement.pdf`
}

/** The keys of the three boxes on stated row `i` (1-based). */
export function statedBoxKeys(i: number): { day: string; hours: string; note: string } {
  const n = Math.max(1, Math.floor(i))
  return { day: `stated_${n}_day`, hours: `stated_${n}_hours`, note: `stated_${n}_note` }
}

/** How many stated rows the paper draws: every day already stated, then the blank rows. */
export function statedRowCount(statedDays: ReadonlyArray<unknown>): number {
  return (statedDays?.length ?? 0) + HOURS_STATEMENT_BLANK_STATED_ROWS
}

/** The office's stated days as the boxes' seed values, so the signer sees them filled and may change any. */
export function statedSeedValues(statedDays: ReadonlyArray<HoursStatementStatedDay>): FormValues {
  const out: FormValues = {}
  statedDays.forEach((d, idx) => {
    const k = statedBoxKeys(idx + 1)
    if (d.day) out[k.day] = d.day
    if (typeof d.hours === 'number' && Number.isFinite(d.hours)) out[k.hours] = String(d.hours)
    if ((d.note ?? '').trim()) out[k.note] = d.note.trim()
  })
  return out
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function validYmd(y: number, m: number, d: number): boolean {
  if (!(y >= 2000 && y <= 2100) || !(m >= 1 && m <= 12) || !(d >= 1 && d <= 31)) return false
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

/**
 * A day as a worker types it → `YYYY-MM-DD`, or null when it is not a day: `2025-09-15`, `9/15/2025`, `9/15/25`,
 * `9-15-2025`, and `9/15` with the year taken from `yearHint` (the period's year).
 */
export function parseStatedDay(raw: string, yearHint?: number): string | null {
  const s = (raw ?? '').trim()
  if (!s) return null
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s)
  if (m) {
    const y = Number(m[1])
    const mo = Number(m[2])
    const d = Number(m[3])
    return validYmd(y, mo, d) ? `${y}-${pad2(mo)}-${pad2(d)}` : null
  }
  m = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2}|\d{4}))?$/.exec(s)
  if (!m) return null
  const mo = Number(m[1])
  const d = Number(m[2])
  let y: number
  if (m[3] == null) {
    if (yearHint == null) return null
    y = yearHint
  } else y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
  return validYmd(y, mo, d) ? `${y}-${pad2(mo)}-${pad2(d)}` : null
}

/** Hours as a worker types them → a number to the hundredth, or null: `8`, `8.5`, `8,5`, `8 h`, `8hrs`. */
export function parseStatedHours(raw: string): number | null {
  const s = (raw ?? '').trim().toLowerCase().replace(/,/g, '.').replace(/\s*(h|hr|hrs|hours?)\.?$/, '')
  if (!s) return null
  if (!/^\d+(\.\d+)?$/.test(s)) return null
  const n = Math.round(Number(s) * 100) / 100
  return n > 0 && n <= 24 ? n : null
}

/**
 * The stated days out of the signer's answers: every row with a day, in day order. A row with a day and no hours
 * keeps `hours: null` (the worker named the day and nothing else); a row with hours or a note and no day is dropped
 * with its words, since a statement cannot carry a day it cannot place. `statedBy` is who stated them and when, as the
 * paper prints it (`Marcus Reyes, 2026-11-02`).
 */
export function statedDaysFromFormValues(values: FormValues, statedBy: string, opts: { yearHint?: number } = {}): HoursStatementStatedDay[] {
  const out: HoursStatementStatedDay[] = []
  for (let i = 1; i <= 200; i += 1) {
    const k = statedBoxKeys(i)
    if (!(k.day in values) && !(k.hours in values) && !(k.note in values)) {
      // Rows are numbered without gaps; the first missing row ends the walk.
      if (i > HOURS_STATEMENT_BLANK_STATED_ROWS) break
      continue
    }
    const dayRaw = typeof values[k.day] === 'string' ? (values[k.day] as string) : ''
    const day = parseStatedDay(dayRaw, opts.yearHint)
    if (!day) continue
    const hours = typeof values[k.hours] === 'string' ? parseStatedHours(values[k.hours] as string) : null
    const note = typeof values[k.note] === 'string' ? (values[k.note] as string).trim().slice(0, STATED_NOTE_MAX) : ''
    out.push({ day, hours, note, statedBy })
  }
  return out.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
}

/** `Marcus Reyes, 2026-11-02`: the stated-by words for a day the worker typed on the signing page or the paper. */
export function statedByWords(name: string, ymd: string): string {
  const n = (name ?? '').trim() || 'The worker'
  return `${n}, ${ymd}`
}

export type HoursStatementSendHow = 'email' | 'text' | 'link' | 'in_person' | 'paper'

/** The person copy's `note`: what the row is and how it went out, in the office's words. */
export function hoursStatementDocumentNote(args: { recordId: string; jobNumber: string; how: HoursStatementSendHow; byName: string }): string {
  const by = (args.byName ?? '').trim() || 'the office'
  const how =
    args.how === 'in_person'
      ? `handed to the worker in person by ${by}`
      : args.how === 'paper'
        ? `signed on paper, filed by ${by}`
        : args.how === 'text'
          ? `link texted by ${by}`
          : args.how === 'link'
            ? `link copied by ${by}`
            : `emailed by ${by}`
  return `Hours statement ${args.recordId} · job ${args.jobNumber} · ${how}`
}

/** A stated day as the paper path posts it, checked: `{ day, hours, note }` with a real day and hours in range. */
export function parseStatedDayRows(raw: unknown, statedBy: string, opts: { yearHint?: number } = {}): HoursStatementStatedDay[] | { error: string } {
  if (raw == null) return []
  if (!Array.isArray(raw)) return { error: 'stated_days must be a list of { day, hours, note }.' }
  const out: HoursStatementStatedDay[] = []
  for (const [i, r] of raw.entries()) {
    if (!r || typeof r !== 'object') return { error: `Stated row ${i + 1} is not a row.` }
    const row = r as Record<string, unknown>
    const day = typeof row.day === 'string' ? parseStatedDay(row.day, opts.yearHint) : null
    if (!day) return { error: `Stated row ${i + 1} needs a day (YYYY-MM-DD).` }
    let hours: number | null = null
    if (row.hours != null && row.hours !== '') {
      hours = typeof row.hours === 'number' ? (row.hours > 0 && row.hours <= 24 ? Math.round(row.hours * 100) / 100 : null) : typeof row.hours === 'string' ? parseStatedHours(row.hours) : null
      if (hours == null) return { error: `Stated row ${i + 1}: hours must be a number up to 24.` }
    }
    const note = typeof row.note === 'string' ? row.note.trim().slice(0, STATED_NOTE_MAX) : ''
    out.push({ day, hours, note, statedBy })
  }
  return out.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
}
