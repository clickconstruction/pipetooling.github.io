/**
 * The lines of a pay application (v2.4498): the rows of the G703 continuation sheet.
 *
 * An application used to have one line, typed into five form fields. It now carries a list:
 * each line is a piece of the contract with its scheduled value, the work claimed before, the
 * work this period and the material stored on site. The sheet's math runs per line and the
 * G702 reads the totals. A line keeps its id from one application to the next, so the next one
 * can carry its work forward and a later one can be checked against it.
 */

export type PayApplicationLineStage = 'rough_in' | 'top_out' | 'trim_set'

export type PayApplicationLine = {
  /** Stable across applications: the next one finds this line by it. */
  id: string
  label: string
  scheduledValue: number
  /** Labor's part of the scheduled value, when the schedule splits labor and material; null when it does not. */
  labor: number | null
  stage: PayApplicationLineStage | null
  /** Work completed on earlier applications (column D). */
  fromPrevious: number
  /** Work completed this period (column E). */
  thisPeriod: number
  /** Material presently stored, not in D or E (column F). */
  stored: number
}

/** The sheet numbers its item rows 001 to 034 (rows 13–46); the totals row sums through row 47. */
export const AIA_G703_FIRST_ROW = 13
export const AIA_G703_MAX_ROWS = 34

const STAGES: ReadonlySet<string> = new Set(['rough_in', 'top_out', 'trim_set'])

export const cents = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

const toNumber = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

let idSeq = 0
/** A new line's id: unique within the browser session and across saves. */
export function newLineId(): string {
  idSeq += 1
  return `l${Date.now().toString(36)}${idSeq.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function emptyLine(id: string = newLineId()): PayApplicationLine {
  return { id, label: '', scheduledValue: 0, labor: null, stage: null, fromPrevious: 0, thisPeriod: 0, stored: 0 }
}

/** Lines read back from the database: only what is a line, with every number finite and every id unique. */
export function parsePayApplicationLines(raw: unknown): PayApplicationLine[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: PayApplicationLine[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const o = item as Record<string, unknown>
    const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : ''
    if (!id || seen.has(id)) continue
    seen.add(id)
    const scheduledValue = cents(toNumber(o.scheduledValue))
    const labor = o.labor == null || o.labor === '' ? null : Math.min(Math.max(0, cents(toNumber(o.labor))), Math.max(0, scheduledValue))
    out.push({
      id,
      label: typeof o.label === 'string' ? o.label : '',
      scheduledValue,
      labor,
      stage: typeof o.stage === 'string' && STAGES.has(o.stage) ? (o.stage as PayApplicationLineStage) : null,
      fromPrevious: cents(toNumber(o.fromPrevious)),
      thisPeriod: cents(toNumber(o.thisPeriod)),
      stored: cents(toNumber(o.stored)),
    })
  }
  return out
}

/** The five form fields an application's one line used to live in (v2.4490–v2.4497). */
export const LEGACY_LINE_FIELD_KEYS = {
  label: 'g703_c13_description',
  scheduledValue: 'g703_d13_scheduled_value',
  fromPrevious: 'g703_e13_from_previous',
  thisPeriod: 'g703_f13_this_period',
  stored: 'g703_g13_materials_stored',
} as const

export const LEGACY_LINE_ID = 'line-1'

/** An application saved before lines: its one line, from the form fields it was typed into. */
export function legacyLineFromFields(fields: unknown): PayApplicationLine {
  const f = fields && typeof fields === 'object' && !Array.isArray(fields) ? (fields as Record<string, unknown>) : {}
  return {
    id: LEGACY_LINE_ID,
    label: typeof f[LEGACY_LINE_FIELD_KEYS.label] === 'string' ? (f[LEGACY_LINE_FIELD_KEYS.label] as string) : '',
    scheduledValue: cents(toNumber(f[LEGACY_LINE_FIELD_KEYS.scheduledValue])),
    labor: null,
    stage: null,
    fromPrevious: cents(toNumber(f[LEGACY_LINE_FIELD_KEYS.fromPrevious])),
    thisPeriod: cents(toNumber(f[LEGACY_LINE_FIELD_KEYS.thisPeriod])),
    stored: cents(toNumber(f[LEGACY_LINE_FIELD_KEYS.stored])),
  }
}

/** The legacy fields for a one-line application, so a client from before lines still reads it. */
export function legacyFieldsFromLine(line: PayApplicationLine): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  if (line.label.trim()) out[LEGACY_LINE_FIELD_KEYS.label] = line.label
  if (line.scheduledValue !== 0) out[LEGACY_LINE_FIELD_KEYS.scheduledValue] = line.scheduledValue
  if (line.fromPrevious !== 0) out[LEGACY_LINE_FIELD_KEYS.fromPrevious] = line.fromPrevious
  if (line.thisPeriod !== 0) out[LEGACY_LINE_FIELD_KEYS.thisPeriod] = line.thisPeriod
  if (line.stored !== 0) out[LEGACY_LINE_FIELD_KEYS.stored] = line.stored
  return out
}

/** An application's lines: the saved list, or the one line its form fields held. Never empty. */
export function linesOfApplication(rawLines: unknown, fields: unknown): PayApplicationLine[] {
  const lines = parsePayApplicationLines(rawLines)
  return lines.length > 0 ? lines : [legacyLineFromFields(fields)]
}

export type PayApplicationLineMath = {
  id: string
  label: string
  scheduledValue: number
  fromPrevious: number
  thisPeriod: number
  stored: number
  /** D + E + F. */
  totalToDate: number
  /** Total over the scheduled value; null when the scheduled value is 0 (the sheet shows #DIV/0!). */
  pctComplete: number | null
  balanceToFinish: number
  retainage: number
}

/** One sheet row's math: H = E + F + G, I = H / D, J = D − H, K = H × the retainage percent. */
export function lineMath(line: Pick<PayApplicationLine, 'id' | 'label' | 'scheduledValue' | 'fromPrevious' | 'thisPeriod' | 'stored'>, retainageFraction: number): PayApplicationLineMath {
  const totalToDate = line.fromPrevious + line.thisPeriod + line.stored
  return {
    id: line.id,
    label: line.label,
    scheduledValue: line.scheduledValue,
    fromPrevious: cents(line.fromPrevious),
    thisPeriod: cents(line.thisPeriod),
    stored: cents(line.stored),
    totalToDate: cents(totalToDate),
    pctComplete: line.scheduledValue === 0 ? null : totalToDate / line.scheduledValue,
    balanceToFinish: cents(line.scheduledValue - totalToDate),
    retainage: cents(totalToDate * retainageFraction),
  }
}

/** A line's percent done to date (work only, stored material apart), 0–100 with two decimals; null with no scheduled value. */
export function linePercentDone(line: Pick<PayApplicationLine, 'scheduledValue' | 'fromPrevious' | 'thisPeriod'>): number | null {
  if (line.scheduledValue === 0) return null
  return Math.round(((line.fromPrevious + line.thisPeriod) / line.scheduledValue) * 10000) / 100
}

/** The work this period that puts a line at this percent done to date. */
export function thisPeriodForPercent(line: Pick<PayApplicationLine, 'scheduledValue' | 'fromPrevious'>, pct: number): number {
  return cents((line.scheduledValue * pct) / 100 - line.fromPrevious)
}

/**
 * The lines a new application starts with, from the one before it: each line's work to date
 * becomes its previous work, this period starts empty, and stored material stays on site.
 */
export function carryForwardLines(lastLines: ReadonlyArray<PayApplicationLine>): PayApplicationLine[] {
  return lastLines.map((l) => ({ ...l, fromPrevious: cents(l.fromPrevious + l.thisPeriod), thisPeriod: 0 }))
}

/** What each line of an application gives the next as previous work, by line id. */
export function carriedWorkByLineId(lines: ReadonlyArray<PayApplicationLine>): Map<string, number> {
  return new Map(lines.map((l) => [l.id, cents(l.fromPrevious + l.thisPeriod)]))
}

/** The rows the sheet prints: a line as one row, or as a labor row and a material row when the schedule splits them. */
export type PayApplicationPrintRow = Pick<PayApplicationLine, 'id' | 'label' | 'scheduledValue' | 'fromPrevious' | 'thisPeriod' | 'stored'> & { lineId: string; part: 'whole' | 'labor' | 'material' }

export function printRowsOf(lines: ReadonlyArray<PayApplicationLine>, split: boolean): PayApplicationPrintRow[] {
  const rows: PayApplicationPrintRow[] = []
  for (const l of lines) {
    if (!split || l.labor == null || l.scheduledValue === 0) {
      rows.push({ id: l.id, lineId: l.id, part: 'whole', label: l.label, scheduledValue: l.scheduledValue, fromPrevious: l.fromPrevious, thisPeriod: l.thisPeriod, stored: l.stored })
      continue
    }
    // Work divides in the schedule's own ratio; the material row takes what is left, so the two add to the line to the cent.
    const share = l.labor / l.scheduledValue
    const part = (n: number) => cents(n * share)
    const label = l.label.trim() || 'Line'
    rows.push({ id: `${l.id}:labor`, lineId: l.id, part: 'labor', label: `${label}, labor`, scheduledValue: l.labor, fromPrevious: part(l.fromPrevious), thisPeriod: part(l.thisPeriod), stored: 0 })
    rows.push({
      id: `${l.id}:material`,
      lineId: l.id,
      part: 'material',
      label: `${label}, material`,
      scheduledValue: cents(l.scheduledValue - l.labor),
      fromPrevious: cents(l.fromPrevious - part(l.fromPrevious)),
      thisPeriod: cents(l.thisPeriod - part(l.thisPeriod)),
      // Stored material is material.
      stored: l.stored,
    })
  }
  return rows
}
