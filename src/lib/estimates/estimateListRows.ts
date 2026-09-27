import type { Tables } from '../../types/database'
import { getCustomerDisplay, type CustomerRow } from '../customerContactDisplay'
import { formatEstimateUpdatedRelativeCompact } from '../formatEstimateListUpdated'
import { estimateDeclinedLabel, parseEstimateDeclineMetadata } from '../../../supabase/functions/_shared/estimateDecline'
import { MAX_ESTIMATE_OPTIONS } from './estimateOptions'

/**
 * What an estimate list row prints (pure): the customer line under the title, the two-line
 * Customer column on the Stages tab, the money, the status word, the options tell, the
 * Declined chip, the linked job's number, and the search that the list filters on. Lifted
 * out of `src/pages/Estimates.tsx` (Stage A of the Estimates map, v2.3868) so the list table
 * and cards can leave the page (the map's step 2) with their words already tested.
 */

/** A list row as the Pipeline and the Estimates list load it: the estimate with its customer and, when linked, the job's number. */
export type EstimateListRow = Tables<'estimates'> & {
  customers: Pick<CustomerRow, 'name' | 'address' | 'contact_info'> | null
  jobs_ledger?: { hcp_number: string } | null
}

/** The slice of `estimate_customer_events` the Pipeline loads for every sent / declined row (v2.2873). */
export type EstimateListCustomerEvent = Pick<Tables<'estimate_customer_events'>, 'estimate_id' | 'event_type' | 'occurred_at' | 'client_ip' | 'metadata'>

const isKeyedEntry = (x: unknown): boolean => Boolean(x && typeof x === 'object' && typeof (x as { key?: unknown }).key === 'string' && (x as { key: string }).key.trim())

/**
 * Cheap options count for list rows (v2.2462): keyed entries only, capped at the product max.
 * Full normalization is for the detail page; 200 rows × render shouldn't pay for it.
 */
export function estimateListOptionsCount(raw: unknown): number {
  if (!Array.isArray(raw)) return 0
  let n = 0
  for (const x of raw) {
    if (isKeyedEntry(x)) n++
    if (n === MAX_ESTIMATE_OPTIONS) break
  }
  return n
}

/** Cheap add-on count for list rows (v2.3556) — the same keyed-entries rule as the count above. */
export function estimateListAddOnCount(raw: unknown): number {
  if (!Array.isArray(raw)) return 0
  let n = 0
  let seen = 0
  for (const x of raw) {
    if (!isKeyedEntry(x)) continue
    seen++
    if ((x as { kind?: unknown }).kind === 'add_on') n++
    if (seen === MAX_ESTIMATE_OPTIONS) break
  }
  return n
}

/** "· 3 options" beside the list money — the row-level tell that a choice is out with the customer; "· 4 options · 2 add-ons" when some ride along (v2.3556). Nothing once accepted. */
export function estimateListOptionsSuffix(r: { options_snapshot?: unknown; status: string }): string {
  if (r.status === 'customer_accepted') return ''
  const n = estimateListOptionsCount(r.options_snapshot)
  if (n < 2) return ''
  const a = estimateListAddOnCount(r.options_snapshot)
  return a > 0 ? ` · ${n} options · ${a} add-on${a === 1 ? '' : 's'}` : ` · ${n} options`
}

/** Row chip for a Declined row: who said no, from the row's `declined` event (v2.2873). */
export function estimateDeclinedRowLabel(events: EstimateListCustomerEvent[] | undefined, nowMs: number = Date.now()): string {
  const ev = (events ?? []).find((e) => e.event_type === 'declined')
  if (!ev) return 'Declined'
  const meta = parseEstimateDeclineMetadata(ev.metadata)
  const when = ev.occurred_at ? ` · ${formatEstimateUpdatedRelativeCompact(ev.occurred_at, nowMs)}` : ''
  return `${estimateDeclinedLabel(meta)}${when}`
}

/** The linked job's number, when the row carries one. */
export function estimateLinkedJobHcp(r: { jobs_ledger?: { hcp_number: string } | null }): string | null {
  const t = (r.jobs_ledger?.hcp_number ?? '').trim()
  return t || null
}

/** Cents as the viewer's currency string. */
export function formatEstimateMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100)
}

export function estimateStatusLabel(s: Tables<'estimates'>['status']): string {
  switch (s) {
    case 'draft':
      return 'Draft'
    case 'sent':
      return 'Sent'
    case 'customer_accepted':
      return 'Accepted'
    case 'declined':
      return 'Declined'
    case 'superseded':
      return 'Superseded'
    default:
      return String(s)
  }
}

/** The grey line under the title: the customer as the CRM shows them, else the email, else the address, else a dash. */
export function estimateListCustomerSubline(r: EstimateListRow): string {
  const cust = r.customers
  if (cust && (cust.name?.trim() || cust.address?.trim())) {
    return getCustomerDisplay({ name: cust.name ?? '', address: cust.address ?? '' })
  }
  const email = r.customer_email?.trim()
  if (email) return email
  const addr = r.for_address?.trim()
  if (addr) return addr
  return '—'
}

/** For the Stages tab's Customer column: the name on the first line, the address on the second (when both exist). */
export function estimateListCustomerColumnLines(r: EstimateListRow): { primary: string; secondary: string | null } {
  const cust = r.customers
  if (cust) {
    const name = (cust.name ?? '').trim()
    const address = (cust.address ?? '').trim()
    if (name && address) return { primary: name, secondary: address }
    if (name) return { primary: name, secondary: null }
    if (address) return { primary: address, secondary: null }
  }
  const email = r.customer_email?.trim()
  if (email) return { primary: email, secondary: null }
  const addr = r.for_address?.trim()
  if (addr) return { primary: addr, secondary: null }
  return { primary: '—', secondary: null }
}

/** The list's search: the number, the title, the customer line, the status (its word or its key) and the money; a blank query matches everything. */
export function estimateListRowMatchesSearch(r: EstimateListRow, query: string): boolean {
  const t = query.trim().toLowerCase()
  if (!t) return true
  if (String(r.estimate_number).toLowerCase().includes(t)) return true
  if ((r.title ?? '').toLowerCase().includes(t)) return true
  if (estimateListCustomerSubline(r).toLowerCase().includes(t)) return true
  if (estimateStatusLabel(r.status).toLowerCase().includes(t)) return true
  if (String(r.status).toLowerCase().includes(t)) return true
  if (formatEstimateMoney(r.total_cents).toLowerCase().includes(t)) return true
  return false
}
