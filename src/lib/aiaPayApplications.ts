import { AIA_FIELD_DEFS, type AiaFieldKey, type AiaFieldValues, formatAiaDate } from './aiaG702G703Template'
import { buildAiaPreview } from './aiaG702G703Preview'

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
  contractSumToDate: number
  totalCompletedAndStored: number
  retainagePct: number
  retainageHeld: number
  totalEarnedLessRetainage: number
  currentPaymentDue: number
  /** A link to the file that was sent (a Google Drive or Docs link), or ''. */
  link: string
  updatedAt: string | null
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
  updated_at: string | null
}

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
    contractSumToDate: Number(row.contract_sum_to_date) || 0,
    totalCompletedAndStored: Number(row.total_completed_and_stored) || 0,
    retainagePct: Number(row.retainage_pct) || 0,
    retainageHeld: Number(row.retainage_held) || 0,
    totalEarnedLessRetainage: Number(row.total_earned_less_retainage) || 0,
    currentPaymentDue: Number(row.current_payment_due) || 0,
    link: linkFromFiles(row.files),
    updatedAt: row.updated_at,
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

/** The row a save writes for this form and its link, or why it cannot be saved. */
export function payApplicationWriteFromForm(jobId: string, values: AiaFieldValues, link = ''): PayApplicationWriteResult {
  const number = parseApplicationNumber(values.g702_n5_project)
  if (number == null) return { ok: false, reason: 'Type the application number as a whole number, like 1, to save it on the job.' }
  const url = cleanPayApplicationLink(link)
  if (link.trim() && !url) return { ok: false, reason: 'The link to the file is not a web address. Paste the whole link, starting with https.' }
  const files: PayApplicationFile[] = url ? [{ kind: 'link', url }] : []
  const { math } = buildAiaPreview(values)
  return {
    ok: true,
    row: {
      job_id: jobId,
      application_number: number,
      period_to: parseAiaDate(values.g702_n6_period_to),
      application_date: parseAiaDate(values.g703_k3_application_date),
      fields: values,
      contract_sum_to_date: math.contractSumToDate,
      total_completed_and_stored: math.totalCompletedAndStored,
      retainage_pct: Number(values.g702_c28_retainage_percent) || 0,
      retainage_held: math.totalRetainage,
      total_earned_less_retainage: math.totalEarnedLessRetainage,
      current_payment_due: math.currentPaymentDue,
      files,
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

/** What carries from one application to the next unchanged: who, what, the contract, the rates, the line's name and value. */
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
  'g703_c13_description',
  'g703_d13_scheduled_value',
  'g703_g13_materials_stored',
]

/**
 * A new application's starting form, from the one before it and the job as it stands today.
 *
 * - The number is one past the last. The application date is today's (from `jobPrefill`); the period is typed.
 * - Work from previous application = the last one's previous work + its work that period. Stored
 *   material carries as it was: it is still on site until someone says otherwise.
 * - Less previous certificates = the last one's total earned less retainage (its line 6).
 * - Last period's change orders join the previous months; this month starts empty.
 * - Work this period is offered as the job's value created today less everything already claimed,
 *   and left empty when that is not above zero.
 */
export function carryForwardPayApplication(last: SavedPayApplication, jobPrefill: AiaFieldValues): AiaFieldValues {
  const f = last.fields
  const out: AiaFieldValues = { ...jobPrefill }
  for (const key of CARRIED_AS_IS) {
    const v = f[key]
    if (v !== undefined && v !== '') out[key] = v
    else delete out[key]
  }
  out.g702_n5_project = String(last.applicationNumber + 1)
  out.g702_n6_period_to = ''
  out.g703_k2_project = ''
  out.g703_k4_period_to = ''

  const workBefore = num(f.g703_e13_from_previous) + num(f.g703_f13_this_period)
  if (workBefore !== 0) out.g703_e13_from_previous = workBefore
  else delete out.g703_e13_from_previous
  if (last.totalEarnedLessRetainage !== 0) out.g702_h40_less_previous_certificates = last.totalEarnedLessRetainage
  else delete out.g702_h40_less_previous_certificates

  const additions = num(f.g702_f49_previous_month_change_order_additions) + num(f.g702_f50_this_month_change_order_additions)
  const deductions = num(f.g702_h49_previous_month_change_order_deductions) + num(f.g702_h50_this_month_change_order_deductions)
  if (additions !== 0) out.g702_f49_previous_month_change_order_additions = additions
  else delete out.g702_f49_previous_month_change_order_additions
  if (deductions !== 0) out.g702_h49_previous_month_change_order_deductions = deductions
  else delete out.g702_h49_previous_month_change_order_deductions
  delete out.g702_f50_this_month_change_order_additions
  delete out.g702_h50_this_month_change_order_deductions

  // `jobPrefill` offers the job's value created to date as this period's work; take off what earlier applications claimed.
  const valueCreated = num(jobPrefill.g703_f13_this_period)
  const offered = Math.round((valueCreated - workBefore - num(out.g703_g13_materials_stored)) * 100) / 100
  if (valueCreated > 0 && offered > 0) out.g703_f13_this_period = offered
  else delete out.g703_f13_this_period

  return out
}

/** One line for the window's list: `2 · 09/30/2026 · $17,280.00 due`. */
export function payApplicationLabel(app: SavedPayApplication): string {
  const due = `$${app.currentPaymentDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} due`
  return [String(app.applicationNumber), formatAiaDate(app.periodTo), due].filter(Boolean).join(' · ')
}
