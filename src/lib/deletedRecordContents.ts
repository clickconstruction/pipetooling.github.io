/**
 * Recently deleted (dev) — pure helpers for reading a deleted bundle's contents
 * and filtering the bundle list (v2.1129). The archive stores to_jsonb(OLD) of
 * every deleted row, so summaries are derived, not stored: pick the most
 * human field(s) a row has and compose a one-line description.
 */

/** Human names for archive table_name values; anything unmapped falls back to underscores → spaces. */
const ARCHIVE_TABLE_LABELS: Record<string, string> = {
  jobs_ledger: 'job',
  jobs_ledger_fixtures: 'fixtures',
  jobs_ledger_line_items: 'line items',
  job_schedule_blocks: 'schedule blocks',
  job_team_members: 'team members',
  job_parts_tally_transactions: 'parts tally transactions',
  bids: 'bid',
  bid_line_items: 'bid line items',
  clock_sessions: 'clock sessions',
  customers: 'customer',
  customer_contacts: 'customer contacts',
  customer_contact_persons: 'customer contact persons',
  projects: 'project',
  estimates: 'estimate',
  invoices: 'invoices',
  payments_made: 'payments',
  pay_stubs: 'pay report',
  pay_stub_days: 'pay report days',
  pay_stub_deductions: 'pay report deductions',
  pay_stub_payments: 'pay report payments',
  supply_houses: 'supply house',
  supply_house_invoices: 'supply house invoices',
  purchase_orders: 'purchase orders',
  material_templates: 'material templates',
  people: 'person',
  people_labor_jobs: 'sub labor jobs',
  person_licenses: 'licences',
  writeups: 'writeups',
  reports: 'reports',
}

export function humanizeArchiveTable(tableName: string): string {
  return ARCHIVE_TABLE_LABELS[tableName] ?? tableName.replace(/_/g, ' ')
}

/** First non-empty of these names a row's title. Order matters: most specific first. */
const TITLE_FIELDS = [
  'job_name', 'project_name', 'person_name', 'name', 'title', 'label',
  'invoice_number', 'bid_number', 'estimate_number', 'po_number',
  'part_name', 'description', 'fixture_name', 'item_name',
] as const

const DATE_FIELDS = ['work_date', 'date', 'due_date', 'invoice_date', 'scheduled_date', 'block_date'] as const

const MONEY_FIELDS = ['amount', 'total', 'gross_pay', 'total_amount', 'price', 'cost'] as const

const QUANTITY_FIELDS = ['quantity', 'hours', 'hours_total'] as const

function nonEmptyString(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}

function finiteNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** "$1,234.56" — archive amounts are dollars. */
function formatMoney(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * One human line for an archived row: title-ish field, then a date, then an
 * amount/quantity — whichever the row actually has. Falls back to a short id
 * so no row ever renders blank.
 */
export function summarizeDeletedRow(rowData: Record<string, unknown>): string {
  const parts: string[] = []
  for (const f of TITLE_FIELDS) {
    const v = nonEmptyString(rowData[f])
    if (v) {
      parts.push(v)
      break
    }
  }
  for (const f of DATE_FIELDS) {
    const v = nonEmptyString(rowData[f])
    if (v) {
      parts.push(v.slice(0, 10))
      break
    }
  }
  for (const f of MONEY_FIELDS) {
    const v = finiteNumber(rowData[f])
    if (v != null) {
      parts.push(formatMoney(v))
      break
    }
  }
  if (parts.length < 2) {
    for (const f of QUANTITY_FIELDS) {
      const v = finiteNumber(rowData[f])
      if (v != null) {
        parts.push(`${v} ${f === 'quantity' ? 'qty' : 'hr'}`)
        break
      }
    }
  }
  if (parts.length > 0) return parts.join(' · ')
  const id = nonEmptyString(rowData.id)
  return id ? `id ${id.slice(0, 8)}` : 'row'
}

export type DeletedBundleFilters = {
  /** Exact kind match; '' = all. */
  kind: string
  /** Exact deleted_by_name match; '' = all. */
  deletedBy: string
  /** Case-insensitive substring of the label; '' = all. */
  search: string
}

export const EMPTY_BUNDLE_FILTERS: DeletedBundleFilters = { kind: '', deletedBy: '', search: '' }

type FilterableBundle = { kind: string; label: string; deleted_by_name: string | null }

export function filterDeletedBundles<T extends FilterableBundle>(bundles: T[], filters: DeletedBundleFilters): T[] {
  const search = filters.search.trim().toLowerCase()
  return bundles.filter(
    (b) =>
      (filters.kind === '' || b.kind === filters.kind) &&
      (filters.deletedBy === '' || (b.deleted_by_name ?? '') === filters.deletedBy) &&
      (search === '' || b.label.toLowerCase().includes(search)),
  )
}

/** Distinct non-empty values in first-seen order — filter dropdown options. */
export function distinctValues<T>(items: T[], pick: (item: T) => string | null): string[] {
  const seen = new Set<string>()
  for (const item of items) {
    const v = pick(item)
    if (v != null && v !== '') seen.add(v)
  }
  return [...seen]
}
