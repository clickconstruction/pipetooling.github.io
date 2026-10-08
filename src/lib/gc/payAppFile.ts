/**
 * GC mode, the real build, Owner Billing's O2b: one pay application as the AIA G702 and G703's cells, for ours to the
 * customer and a trade's to us, moved word for word from the GC mode prototype (branch spike/gc-mode, `gcPayAppFile.ts`).
 * The Excel and PDF writers come with O4a, on main's own filler.
 */
import type { AiaFieldValues } from '../aiaG702G703Template'
import type { PayApplication } from './building'
import { shortDate } from './words'

/** Who and what the pay application is for: the parts of the form that are not numbers. */
export interface PayAppParties {
  project: string
  /** "3", or "4, final". */
  applicationNo: string
  /** The bill day it is for (YYYY-MM-DD). */
  periodTo: string
  /** The day it went. Null: a draft. */
  sentOn: string | null
  contractDate: string | null
  /** Who it goes to: our customer on ours, us on a trade's. */
  to: { name: string; address: string }
  /** The property's owner, when it is not the customer (`GcProject.propertyOwner`). */
  propertyOwner?: string | null
  /** Who sends it: us on ours, the trade's company on theirs. */
  from: { name: string; address: string; license?: string }
  architect: string | null
  /** The change orders in line 2, each with whether it was signed in this period. A credit is negative. */
  changeOrders: { amount: number; thisPeriod: boolean }[]
  /** Line 5's words when retainage is not one plain percent. */
  retainageWords?: string | null
}

/** The 703 rows the template has: 13 to 46. */
export const PAY_APP_FIRST_ROW = 13

export const PAY_APP_LAST_ROW = 46

export interface PayAppRow {
  row: number
  item: string
  description: string
  scheduled: number
  previous: number
  thisPeriod: number
  stored: number
  /** Written as a number when retainage is not one percent across the lines. Null: the template's formula. */
  retainage: number | null
}

export interface PayAppCells {
  fields: AiaFieldValues
  /** G702 H40: line 7. */
  previousCertificates: number
  rows: PayAppRow[]
  /** Lines past the template's last row, left off the sheet. */
  left: number
}

/** "200 Main Plaza, Suite 300, Boerne" → the street and the town, split at the last comma. */
export function splitAddress(address: string): { street: string; town: string } {
  const at = address.lastIndexOf(',')
  return at < 0 ? { street: address.trim(), town: '' } : { street: address.slice(0, at).trim(), town: address.slice(at + 1).trim() }
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** What goes in which cell of the template for one pay application. */
export function payAppCells(app: PayApplication, parties: PayAppParties): PayAppCells {
  const s = app.summary
  const to = splitAddress(parties.to.address)
  const sum = (thisPeriod: boolean, sign: 1 | -1) =>
    round2(parties.changeOrders.filter((c) => c.thisPeriod === thisPeriod && Math.sign(c.amount) === sign).reduce((t, c) => t + Math.abs(c.amount), 0))
  // One percent across the lines lets the template's own formula hold it; otherwise each line's is written.
  const oneRate = app.final || app.lines.every((l) => Math.abs(l.retainage - (l.toDate * s.retainagePct) / 100) < 0.01)
  const rate = app.final ? 0 : s.retainagePct
  const title = `${parties.project} · application ${parties.applicationNo}`
  const fields: AiaFieldValues = {
    g702_n5_project: title,
    g702_n6_period_to: shortDate(parties.periodTo),
    g702_n9_contract_date: parties.contractDate ? shortDate(parties.contractDate) : '',
    g702_d6_owner_name: parties.to.name,
    g702_d7_owner_address: to.street,
    g702_d8_owner_city_state_zip: to.town,
    g702_d10_contractor_name: parties.from.name,
    g702_d11_contractor_address: parties.from.address,
    g702_d12_contractor_license: parties.from.license ?? '',
    g702_h18_original_contract_sum: round2(s.originalSum),
    g702_f49_previous_month_change_order_additions: sum(false, 1),
    g702_h49_previous_month_change_order_deductions: sum(false, -1),
    g702_f50_this_month_change_order_additions: sum(true, 1),
    g702_h50_this_month_change_order_deductions: sum(true, -1),
    g702_c28_retainage_percent: rate,
    g702_c31_retainage_material_percent: rate,
    g703_k2_project: title,
    g703_k3_application_date: parties.sentOn ? shortDate(parties.sentOn) : '',
    g703_k4_period_to: shortDate(parties.periodTo),
    g703_k5_architect_project_no: parties.architect ?? '',
  }
  const room = PAY_APP_LAST_ROW - PAY_APP_FIRST_ROW + 1
  const rows = app.lines.slice(0, room).map((l, i) => ({
    row: PAY_APP_FIRST_ROW + i,
    item: String(l.item).padStart(3, '0'),
    description: l.label,
    scheduled: round2(l.scheduled),
    previous: round2(l.fromPrevious),
    thisPeriod: round2(l.thisPeriod),
    stored: round2(l.stored),
    retainage: oneRate ? null : round2(l.retainage),
  }))
  return { fields, previousCertificates: round2(s.previousCertificates), rows, left: Math.max(0, app.lines.length - room) }
}

/** "Fair-Oaks-Shops-Building-D-pay-application-3.xlsx" */
export function payAppFileName(parties: PayAppParties, ext: 'xlsx' | 'pdf'): string {
  const safe = `${parties.project} pay application ${parties.applicationNo}`.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${safe || 'pay-application'}.${ext}`
}
