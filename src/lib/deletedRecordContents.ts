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

/** Archive tables whose loss is the first thing a bulk-delete reviewer checks. */
const MONEY_ARCHIVE_TABLES = new Set([
  'invoices',
  'payments_made',
  'pay_stubs',
  'supply_house_invoices',
  'purchase_orders',
])

export type BundleDigestChip = {
  table: string
  label: string
  /** Row count when the digest RPC fields are present; null pre-migration (label-only chip). */
  count: number | null
  money: boolean
}

/**
 * Per-table chips for a bundle card, money tables first, then by count desc.
 * `tableCounts` comes from the digest migration; when absent (old RPC shape)
 * every table still gets a label-only chip, so the card never regresses.
 */
export function buildBundleDigestChips(
  tables: string[],
  tableCounts: Record<string, number> | null | undefined,
): BundleDigestChip[] {
  const chips = tables.map((table) => {
    const n = tableCounts?.[table]
    return {
      table,
      label: humanizeArchiveTable(table),
      count: typeof n === 'number' && Number.isFinite(n) ? n : null,
      money: MONEY_ARCHIVE_TABLES.has(table),
    }
  })
  return chips.sort(
    (a, b) => Number(b.money) - Number(a.money) || (b.count ?? 0) - (a.count ?? 0) || a.label.localeCompare(b.label),
  )
}

export type DeletedBundlePreviewItem = { table_name: string; fields: Record<string, unknown> }

function isPreviewItem(v: unknown): v is DeletedBundlePreviewItem {
  if (typeof v !== 'object' || v === null) return false
  const item = v as Record<string, unknown>
  return typeof item.table_name === 'string' && typeof item.fields === 'object' && item.fields !== null
}

/**
 * "invoices: #1042 · $4,520.00" lines for the always-visible card preview.
 * Tolerates any malformed/absent RPC payload (old function shape) by
 * returning [] — the card simply shows no preview lines then.
 */
export function summarizePreviewItems(previewItems: unknown, limit = 3): string[] {
  if (!Array.isArray(previewItems)) return []
  return previewItems
    .filter(isPreviewItem)
    .slice(0, Math.max(0, limit))
    .map((item) => `${humanizeArchiveTable(item.table_name)}: ${summarizeDeletedRow(item.fields)}`)
}

export type AlertWindow = { start: string; end: string }

/** True when the bundle's deleted_at falls inside any active alert burst window (inclusive). */
export function bundleInAlertWindows(deletedAt: string, windows: AlertWindow[]): boolean {
  const t = Date.parse(deletedAt)
  if (Number.isNaN(t)) return false
  return windows.some((w) => {
    const start = Date.parse(w.start)
    const end = Date.parse(w.end)
    return !Number.isNaN(start) && !Number.isNaN(end) && t >= start && t <= end
  })
}

/** Stable partition: alert-window bundles first, original order preserved within each half. */
export function sortBundlesAlertFirst<T extends { deleted_at: string }>(bundles: T[], windows: AlertWindow[]): T[] {
  if (windows.length === 0) return bundles
  const flagged: T[] = []
  const rest: T[] = []
  for (const b of bundles) (bundleInAlertWindows(b.deleted_at, windows) ? flagged : rest).push(b)
  return [...flagged, ...rest]
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
