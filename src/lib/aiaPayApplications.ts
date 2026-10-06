import { AIA_FIELD_DEFS, type AiaFieldKey, type AiaFieldValues, formatAiaDate } from './aiaG702G703Template'
import { buildAiaPreview } from './aiaG702G703Preview'
import {
  type PayApplicationLine,
  carriedWorkByLineId,
  carryForwardLines,
  cents,
  legacyFieldsFromLine,
  linesOfApplication,
} from './aiaPayApplicationLines'

/**
 * Pay applications the job remembers (the AIA window's saved rows, `job_pay_applications`).
 * A saved application keeps the form as it was typed and the sheet's totals over it, so the next
 * one can start from it: its work becomes *from previous application*, its line 6 becomes *less
 * previous certificates*. Nothing locks: a saved application can be opened, changed and saved again.
 */

export type SavedPayApplication = {
  id: string
  jobId: string
  applicationNumber: number
  /** `YYYY-MM-DD`, or null when the form's text was not a date. */
  periodTo: string | null
  applicationDate: string | null
  fields: AiaFieldValues
  /** The G703's lines. Never empty: an application saved before lines reads as its one line. */
  lines: PayApplicationLine[]
  /** Print each line as a labor row and a material row. */
  splitLaborMaterial: boolean
  contractSumToDate: number
  totalCompletedAndStored: number
  retainagePct: number
  retainageHeld: number
  totalEarnedLessRetainage: number
  currentPaymentDue: number
  /** A link to the file that was sent (a Google Drive or Docs link), or ''. */
  link: string
  /** Why it keeps previous amounts that no longer match the application before it, or ''. */
  carryReason: string
  /** The office's own name for it ("Sent to the GC"), or ''. Never printed on the form. */
  name: string
  /** When it was first saved and by whom, and when it was last saved and by whom (v2.4710): the database's stamps, the names as the users table has them or ''. */
  createdAt: string | null
  createdByName: string
  updatedAt: string | null
  updatedByName: string
}

/** One kept file beside an application. Today that is a pasted link. */
export type PayApplicationFile = { kind: 'link'; url: string }

/** The row as the table holds it. */
export type PayApplicationRow = {
  id: string
  job_id: string
  application_number: number
  period_to: string | null
  application_date: string | null
  fields: unknown
  contract_sum_to_date: number | string
  total_completed_and_stored: number | string
  retainage_pct: number | string
  retainage_held: number | string
  total_earned_less_retainage: number | string
  current_payment_due: number | string
  files?: unknown
  carry_reason?: string | null
  lines?: unknown
  split_labor_material?: boolean | null
  name?: string | null
  updated_at: string | null
  /** The stamps and the names behind them (v2.4710), read with the row; older reads leave them out. */
  created_at?: string | null
  created_by?: string | null
  updated_by?: string | null
  created_by_user?: { name: string | null } | null
  updated_by_user?: { name: string | null } | null
}

/** What the window holds for one application: the header boxes, the lines, and how the lines print. */
export type PayApplicationForm = { values: AiaFieldValues; lines: PayApplicationLine[]; splitLaborMaterial: boolean }

/** What a save writes: everything but the id and the server's stamps. */
export type PayApplicationWrite = Omit<PayApplicationRow, 'id' | 'updated_at'>

const KEYS = new Set<string>(AIA_FIELD_DEFS.map((d) => d.key))

/** Only the form's own keys, only strings and finite numbers: what came back from the database is not trusted to be the form. */
function fieldsFromJson(raw: unknown): AiaFieldValues {
  const out: AiaFieldValues = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!KEYS.has(k)) continue
    if (typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v))) out[k as AiaFieldKey] = v
  }
  return out
}

/** The longest name the table keeps. */
export const PAY_APPLICATION_NAME_MAX = 80

/** A typed name as it is kept: one line, single spaces, trimmed, cut at the table's length. */
export function cleanPayApplicationName(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, PAY_APPLICATION_NAME_MAX).trim()
}

/** A pasted link as it is kept: trimmed, and only when it is a web address. Anything else → ''. */
export function cleanPayApplicationLink(raw: string | null | undefined): string {
  const s = (raw ?? '').trim()
  if (!/^https?:\/\/\S+$/i.test(s)) return ''
  try {
    return new URL(s).toString()
  } catch {
    return ''
  }
}

/** The first link kept beside the row. */
function linkFromFiles(raw: unknown): string {
  if (!Array.isArray(raw)) return ''
  for (const f of raw) {
    if (f && typeof f === 'object' && (f as { kind?: unknown }).kind === 'link') {
      const url = cleanPayApplicationLink(String((f as { url?: unknown }).url ?? ''))
      if (url) return url
    }
  }
  return ''
}

export function savedPayApplicationFromRow(row: PayApplicationRow): SavedPayApplication {
  return {
    id: row.id,
    jobId: row.job_id,
    applicationNumber: Number(row.application_number),
    periodTo: row.period_to,
    applicationDate: row.application_date,
    fields: fieldsFromJson(row.fields),
    lines: linesOfApplication(row.lines, row.fields),
    splitLaborMaterial: row.split_labor_material === true,
    contractSumToDate: Number(row.contract_sum_to_date) || 0,
    totalCompletedAndStored: Number(row.total_completed_and_stored) || 0,
    retainagePct: Number(row.retainage_pct) || 0,
    retainageHeld: Number(row.retainage_held) || 0,
    totalEarnedLessRetainage: Number(row.total_earned_less_retainage) || 0,
    currentPaymentDue: Number(row.current_payment_due) || 0,
    link: linkFromFiles(row.files),
    carryReason: (row.carry_reason ?? '').trim(),
    name: cleanPayApplicationName(row.name),
    createdAt: row.created_at ?? null,
    createdByName: (row.created_by_user?.name ?? '').trim(),
    updatedAt: row.updated_at,
    updatedByName: (row.updated_by_user?.name ?? '').trim(),
  }
}

/** The application number as typed: a whole number from 1 to 9999, or null. */
export function parseApplicationNumber(raw: string | number | null | undefined): number | null {
  const s = String(raw ?? '').trim()
  if (!/^\d{1,4}$/.test(s)) return null
  const n = Number(s)
  return n >= 1 ? n : null
}

/** A date as the form prints it (`10/31/2026`, also `10/31/26` and `2026-10-31`) → `YYYY-MM-DD`; anything else → null. */
export function parseAiaDate(raw: string | number | null | undefined): string | null {
  const s = String(raw ?? '').trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  const us = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/.exec(s)
  const [y, m, d] = iso ? [Number(iso[1]), Number(iso[2]), Number(iso[3])] : us ? [Number(us[3]!.length === 2 ? `20${us[3]}` : us[3]), Number(us[1]), Number(us[2])] : [0, 0, 0]
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export type PayApplicationWriteResult = { ok: true; row: PayApplicationWrite } | { ok: false; reason: string }

/**
 * The row a save writes for this form and its link, or why it cannot be saved. `carryReason` and
 * `name` are each written only when passed: a save with nothing to say leaves the column alone.
 * A one-line application also writes its line into the form fields it used to live in, so a
 * client from before lines still reads it.
 */
export function payApplicationWriteFromForm(
  jobId: string,
  form: PayApplicationForm,
  link = '',
  carryReason?: string,
  name?: string,
): PayApplicationWriteResult {
  const { values, lines, splitLaborMaterial } = form
  const number = parseApplicationNumber(values.g702_n5_project)
  if (number == null) return { ok: false, reason: 'Type the application number as a whole number, like 1, to save it on the job.' }
  const url = cleanPayApplicationLink(link)
  if (link.trim() && !url) return { ok: false, reason: 'The link to the file is not a web address. Paste the whole link, starting with https.' }
  const files: PayApplicationFile[] = url ? [{ kind: 'link', url }] : []
  const { math } = buildAiaPreview(values, lines, { splitLaborMaterial })
  return {
    ok: true,
    row: {
      job_id: jobId,
      application_number: number,
      period_to: parseAiaDate(values.g702_n6_period_to),
      application_date: parseAiaDate(values.g703_k3_application_date),
      fields: lines.length === 1 ? { ...values, ...legacyFieldsFromLine(lines[0]!) } : values,
      lines,
      split_labor_material: splitLaborMaterial,
      contract_sum_to_date: math.contractSumToDate,
      total_completed_and_stored: math.totalCompletedAndStored,
      retainage_pct: Number(values.g702_c28_retainage_percent) || 0,
      retainage_held: math.totalRetainage,
      total_earned_less_retainage: math.totalEarnedLessRetainage,
      current_payment_due: math.currentPaymentDue,
      files,
      ...(carryReason === undefined ? {} : { carry_reason: carryReason.trim() }),
      ...(name === undefined ? {} : { name: cleanPayApplicationName(name) }),
    },
  }
}

/** Saved applications in number order. */
export function sortPayApplications(list: ReadonlyArray<SavedPayApplication>): SavedPayApplication[] {
  return [...list].sort((a, b) => a.applicationNumber - b.applicationNumber)
}

/** The number a new application starts with: one past the highest saved. */
export function nextApplicationNumber(list: ReadonlyArray<SavedPayApplication>): number {
  return list.reduce((max, a) => Math.max(max, a.applicationNumber), 0) + 1
}

/** The saved application just before this number, the one a new or reopened application follows. */
export function previousPayApplication(list: ReadonlyArray<SavedPayApplication>, applicationNumber: number): SavedPayApplication | null {
  const before = sortPayApplications(list).filter((a) => a.applicationNumber < applicationNumber)
  return before[before.length - 1] ?? null
}

const num = (v: string | number | undefined): number => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** The three header amounts a later application takes from the one before it (its lines carry their own work). */
export const CARRIED_AMOUNT_KEYS = [
  'g702_h40_less_previous_certificates',
  'g702_f49_previous_month_change_order_additions',
  'g702_h49_previous_month_change_order_deductions',
] as const satisfies readonly AiaFieldKey[]
export type CarriedAmountKey = (typeof CARRIED_AMOUNT_KEYS)[number]

/**
 * What an application gives the next one on the G702: its line 6 becomes previous certificates,
 * and its change orders join the previous months.
 */
export function carriedAmountsFrom(previous: SavedPayApplication): Record<CarriedAmountKey, number> {
  const f = previous.fields
  return {
    g702_h40_less_previous_certificates: cents(previous.totalEarnedLessRetainage),
    g702_f49_previous_month_change_order_additions: cents(
      num(f.g702_f49_previous_month_change_order_additions) + num(f.g702_f50_this_month_change_order_additions),
    ),
    g702_h49_previous_month_change_order_deductions: cents(
      num(f.g702_h49_previous_month_change_order_deductions) + num(f.g702_h50_this_month_change_order_deductions),
    ),
  }
}

/** What carries from one application to the next unchanged: who, what, the contract, the rates. */
const CARRIED_AS_IS: readonly AiaFieldKey[] = [
  'g702_n7_project_no',
  'g702_n9_contract_date',
  'g702_h6_project_name',
  'g702_h7_project_address',
  'g702_h8_project_city_state_zip',
  'g702_d6_owner_name',
  'g702_d7_owner_address',
  'g702_d8_owner_city_state_zip',
  'g702_d10_contractor_name',
  'g702_d11_contractor_address',
  'g702_d12_contractor_license',
  'g702_h18_original_contract_sum',
  'g702_c28_retainage_percent',
  'g702_c31_retainage_material_percent',
  'g703_k5_architect_project_no',
]

/**
 * A new application's starting form, from the one before it and the job as it stands today.
 *
 * - The number is one past the last. The application date is today's (from `jobPrefill`); the period is typed.
 * - Each line keeps its name and value; its work to date becomes its previous work, and its
 *   stored material stays on site until someone says otherwise.
 * - Less previous certificates = the last one's total earned less retainage (its line 6).
 * - Last period's change orders join the previous months; this month starts empty.
 * - On a one-line application, work this period is offered as the job's value created today
 *   less everything already claimed, and left empty when that is not above zero.
 */
export function carryForwardPayApplication(last: SavedPayApplication, jobPrefill: AiaFieldValues, valueCreated = 0): PayApplicationForm {
  const f = last.fields
  const values: AiaFieldValues = { ...jobPrefill }
  for (const key of CARRIED_AS_IS) {
    const v = f[key]
    if (v !== undefined && v !== '') values[key] = v
    else delete values[key]
  }
  values.g702_n5_project = String(last.applicationNumber + 1)
  values.g702_n6_period_to = ''
  values.g703_k2_project = ''
  values.g703_k4_period_to = ''

  const carried = carriedAmountsFrom(last)
  for (const key of CARRIED_AMOUNT_KEYS) {
    if (carried[key] !== 0) values[key] = carried[key]
    else delete values[key]
  }
  delete values.g702_f50_this_month_change_order_additions
  delete values.g702_h50_this_month_change_order_deductions

  const lines = carryForwardLines(last.lines)
  if (lines.length === 1) {
    const only = lines[0]!
    const offered = cents(valueCreated - only.fromPrevious - only.stored)
    if (valueCreated > 0 && offered > 0) only.thisPeriod = offered
  }
  return { values, lines, splitLaborMaterial: last.splitLaborMaterial }
}

export type CarryDifference = { key: string; label: string; here: number; fromPrevious: number }
export type CarryMismatch = { previousNumber: number; differences: CarryDifference[] }

const LABEL_BY_KEY = Object.fromEntries(AIA_FIELD_DEFS.map((d) => [d.key, d.label])) as Record<AiaFieldKey, string>

/**
 * Where an application's previous amounts differ from what the application before it gives today:
 * each line's previous work, then the G702's previous certificates and change orders.
 * Nothing locks a saved application, so an earlier one can change after a later one went out; the
 * later one is flagged, not blocked. null when it has no application before it, or they agree.
 */
export function carryMismatch(
  form: Pick<PayApplicationForm, 'values' | 'lines'>,
  applicationNumber: number | null,
  list: ReadonlyArray<SavedPayApplication>,
): CarryMismatch | null {
  if (applicationNumber == null) return null
  const previous = previousPayApplication(list, applicationNumber)
  if (!previous) return null
  const differences: CarryDifference[] = []

  const given = carriedWorkByLineId(previous.lines)
  const hereById = new Map(form.lines.map((l) => [l.id, l]))
  const name = (l: PayApplicationLine | undefined) => (l && l.label.trim() ? l.label.trim() : 'A line')
  // A line the earlier application has: its work to date should be this line's previous work.
  for (const p of previous.lines) {
    const mine = hereById.get(p.id)
    const here = cents(mine ? mine.fromPrevious : 0)
    const fromPrevious = given.get(p.id) ?? 0
    if (here !== fromPrevious) differences.push({ key: `line:${p.id}`, label: `${name(mine ?? p)}, work from previous application`, here, fromPrevious })
  }
  // A line only this application has claims no previous work from the earlier one.
  for (const l of form.lines) {
    if (given.has(l.id)) continue
    const here = cents(l.fromPrevious)
    if (here !== 0) differences.push({ key: `line:${l.id}`, label: `${name(l)}, work from previous application`, here, fromPrevious: 0 })
  }

  const carried = carriedAmountsFrom(previous)
  for (const key of CARRIED_AMOUNT_KEYS) {
    const here = cents(num(form.values[key]))
    if (here !== carried[key]) differences.push({ key, label: LABEL_BY_KEY[key], here, fromPrevious: carried[key] })
  }
  return differences.length > 0 ? { previousNumber: previous.applicationNumber, differences } : null
}

/** The form with the previous application's amounts as it gives them today: on each line, and on the G702. */
export function withCarriedAmounts<T extends Pick<PayApplicationForm, 'values' | 'lines'>>(form: T, previous: SavedPayApplication): T {
  const values: AiaFieldValues = { ...form.values }
  const carried = carriedAmountsFrom(previous)
  for (const key of CARRIED_AMOUNT_KEYS) {
    if (carried[key] !== 0) values[key] = carried[key]
    else delete values[key]
  }
  const given = carriedWorkByLineId(previous.lines)
  const lines = form.lines.map((l) => ({ ...l, fromPrevious: given.get(l.id) ?? 0 }))
  return { ...form, values, lines }
}

/** The owner, 2026-10-04: retainage "is usually 10% but can sometimes go to 5% after 50% complete", and at 5% "it covers everything to date". */
export const AIA_RETAINAGE_DROP_AFTER = 0.5
export const AIA_REDUCED_RETAINAGE_PERCENT = 5

export type RetainageDropOffer = {
  /** How far along the job is: total completed and stored over the scheduled value. */
  pctComplete: number
  /** Retainage held at the form's percent, and at the reduced one over everything to date. */
  heldNow: number
  heldAtReduced: number
  /** What the payment due gains when the percent drops: the retainage let go. */
  moreDue: number
}

/**
 * The offer to drop retainage: made once the job is past halfway while the form still holds more
 * than the reduced percent. It is an offer, not a rule: not every contract drops it.
 */
export function retainageDropOffer(form: PayApplicationForm): RetainageDropOffer | null {
  const { values, lines, splitLaborMaterial } = form
  const pct = num(values.g702_c28_retainage_percent)
  if (pct <= AIA_REDUCED_RETAINAGE_PERCENT) return null
  const now = buildAiaPreview(values, lines, { splitLaborMaterial }).math
  const pctComplete = now.line.pctComplete
  if (pctComplete == null || pctComplete <= AIA_RETAINAGE_DROP_AFTER) return null
  const reduced = buildAiaPreview({ ...values, g702_c28_retainage_percent: AIA_REDUCED_RETAINAGE_PERCENT }, lines, { splitLaborMaterial }).math
  return {
    pctComplete,
    heldNow: now.totalRetainage,
    heldAtReduced: reduced.totalRetainage,
    moreDue: Math.round((reduced.currentPaymentDue - now.currentPaymentDue) * 100) / 100,
  }
}

/** One line for the window's list: `2 · 09/30/2026 · $17,280.00 due`, with its name after the number when it has one. */
export function payApplicationLabel(app: SavedPayApplication): string {
  const due = `$${app.currentPaymentDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} due`
  return [String(app.applicationNumber), app.name, formatAiaDate(app.periodTo), due].filter(Boolean).join(' · ')
}
