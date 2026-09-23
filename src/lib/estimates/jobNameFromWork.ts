/**
 * Naming a job for the customer *and the work* (v2.3766).
 *
 * The office names jobs for the work — "Montolongo- Pretest", "Pool Work",
 * "Gas Line" — so a second job at the same house can be told from the first.
 * An estimate has no scope field; its line items are the only place the work
 * is written. The rule: when there is exactly one line and its name is
 * specific (short, and not a generic service word), the job is
 * "<customer> — <line>". Otherwise the customer's name alone — a guess from a
 * list of lines ("1st Draw- Installation of customer provided i…") reads worse
 * than the plain name.
 *
 * SQL twins: `auto_create_job_from_signed_estimate` (estimate lines) and
 * `plan_job_names_from_work` (a job's own Specific Work lines), both in
 * supabase/migrations/20260923220000_job_name_from_estimate_line.sql. Keep the
 * three in step.
 */

/** Line names that say nothing about the work. Compared lower-cased and trimmed. */
export const GENERIC_WORK_NAMES: ReadonlySet<string> = new Set([
  'item',
  'service',
  'service visit',
  'custom service visit',
  'service call',
  'trip charge',
  'labor',
  'materials',
  'misc',
  'miscellaneous',
])

/** Longer than this and the line is a description, not a name. */
export const WORK_NAME_MAX_CHARS = 60

export const WORK_NAME_SEPARATOR = ' — '

/** Whitespace folded, trailing periods dropped, first letter capitalised ("pretest." → "Pretest"). */
export function tidyWorkName(name: string | null | undefined): string {
  const s = (name ?? '').replace(/\s+/g, ' ').trim().replace(/\.+$/, '').trim()
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}

/** A line name that can stand as the work in a job name. */
export function isSpecificWorkName(name: string | null | undefined): boolean {
  const s = tidyWorkName(name)
  if (!s || s.length > WORK_NAME_MAX_CHARS) return false
  return !GENERIC_WORK_NAMES.has(s.toLowerCase())
}

/**
 * The work an estimate's lines name, or null. Exactly one line, named by its
 * `line_item` (falling back to `description`, the same order the Specific Work
 * mapping uses), and specific.
 */
export function specificWorkFromLines(lines: unknown): string | null {
  if (!Array.isArray(lines) || lines.length !== 1) return null
  const x = lines[0]
  if (!x || typeof x !== 'object') return null
  const rec = x as Record<string, unknown>
  const raw =
    (typeof rec.line_item === 'string' && rec.line_item.trim()) ||
    (typeof rec.description === 'string' && rec.description.trim()) ||
    ''
  const name = tidyWorkName(raw)
  return isSpecificWorkName(name) ? name : null
}

/** "<customer> — <work>", or the customer alone when there is no work to name. */
export function jobNameForCustomerAndWork(customerName: string, work: string | null): string {
  const c = customerName.replace(/\s+/g, ' ').trim()
  if (!c) return ''
  return work ? `${c}${WORK_NAME_SEPARATOR}${work}` : c
}
