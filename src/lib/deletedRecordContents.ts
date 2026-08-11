/**
 * Recently deleted (dev) — pure helpers for reading a deleted bundle's contents
 * and filtering the bundle list (v2.1129). The archive stores to_jsonb(OLD) of
 * every deleted row, so summaries are derived, not stored: pick the most
 * human field(s) a row has and compose a one-line description.
 *
 * v2.1566 adds the malice-triage layer: type-aware row summaries for the
 * high-traffic tables (clock sessions, reports, schedule blocks, invoices…),
 * consequence badges per bundle (money removed, age at deletion, approval
 * state, owner ≠ deleter), and burst grouping so a reviewer walks the alert's
 * deletions burst by burst.
 */
import { formatDispatchNoteTimeChicago } from '../utils/dispatchNoteDisplay'

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

/** Optional context for type-aware summaries: user ids → display names. */
export type DeletedRowSummaryCtx = { userNameById?: ReadonlyMap<string, string> }

function isoMs(v: unknown): number | null {
  const s = nonEmptyString(v)
  if (!s) return null
  const t = Date.parse(s)
  return Number.isFinite(t) ? t : null
}

function personName(rowData: Record<string, unknown>, ctx?: DeletedRowSummaryCtx): string | null {
  const id = nonEmptyString(rowData.user_id) ?? nonEmptyString(rowData.created_by)
  if (!id) return null
  return ctx?.userNameById?.get(id) ?? null
}

/** Clock-session lifecycle in one word — approval state is a triage signal. */
export function clockSessionStatus(rowData: Record<string, unknown>): string {
  if (nonEmptyString(rowData.revoked_at)) return 'revoked'
  if (nonEmptyString(rowData.rejected_at)) return 'rejected'
  if (nonEmptyString(rowData.approved_at)) return 'approved'
  return 'pending approval'
}

/** "HH:MM[:SS]" → "HH:MM"; anything else unchanged. */
function trimClockTime(v: unknown): string | null {
  const s = nonEmptyString(v)
  if (!s) return null
  return /^\d{1,2}:\d{2}/.test(s) ? s.slice(0, 5) : s
}

/**
 * Type-aware row summaries for the tables reviewers actually triage. Falls
 * back to the generic field-probe (summarizeDeletedRow) for everything else.
 * All time-of-day rendering is company time.
 */
export function summarizeDeletedRowForTable(
  tableName: string,
  rowData: Record<string, unknown>,
  ctx?: DeletedRowSummaryCtx,
): string {
  if (tableName === 'clock_sessions') {
    const parts: string[] = []
    const who = personName(rowData, ctx)
    const inMs = isoMs(rowData.clocked_in_at)
    const outMs = isoMs(rowData.clocked_out_at)
    if (inMs != null && outMs != null) {
      const hours = Math.round(((outMs - inMs) / 3_600_000) * 10) / 10
      parts.push(
        `${formatDispatchNoteTimeChicago(String(rowData.clocked_in_at))}–${formatDispatchNoteTimeChicago(String(rowData.clocked_out_at))}`,
        `${hours}h`,
      )
    } else if (inMs != null) {
      parts.push(`in at ${formatDispatchNoteTimeChicago(String(rowData.clocked_in_at))} (no clock-out)`)
    } else {
      const wd = nonEmptyString(rowData.work_date)
      if (wd) parts.push(wd.slice(0, 10))
    }
    parts.push(clockSessionStatus(rowData))
    const note = nonEmptyString(rowData.notes)
    if (note) parts.push(`“${note.length > 40 ? `${note.slice(0, 40)}…` : note}”`)
    return `${who ? `${who} — ` : ''}${parts.join(' · ')}`
  }
  if (tableName === 'reports') {
    const template = nonEmptyString(rowData.template_name)
    const author = nonEmptyString(rowData.created_by_name)
    const when = nonEmptyString(rowData.created_at)
    const parts = [template ? `“${template}”` : 'report']
    if (author) parts.push(author)
    if (when) parts.push(when.slice(0, 10))
    return parts.join(' · ')
  }
  if (tableName === 'job_schedule_blocks') {
    const date = nonEmptyString(rowData.work_date) ?? nonEmptyString(rowData.block_date)
    const start = trimClockTime(rowData.time_start)
    const end = trimClockTime(rowData.time_end)
    const who = personName(rowData, ctx)
    const parts: string[] = []
    if (date) parts.push(date.slice(0, 10))
    if (start && end) parts.push(`${start}–${end}`)
    if (who) parts.push(who)
    return parts.length > 0 ? parts.join(' · ') : summarizeDeletedRow(rowData)
  }
  if (tableName === 'invoices') {
    const seq = finiteNumber(rowData.sequence_order)
    const parts: string[] = []
    parts.push(seq != null ? `invoice #${seq}` : (nonEmptyString(rowData.invoice_number) ?? 'invoice'))
    const amount = finiteNumber(rowData.amount) ?? finiteNumber(rowData.total)
    if (amount != null) parts.push(formatMoney(amount))
    const status =
      nonEmptyString(rowData.stripe_invoice_status) ?? nonEmptyString(rowData.status)
    if (status) parts.push(status)
    return parts.join(' · ')
  }
  if (tableName === 'bid_count_row_custom_prices') {
    const price = finiteNumber(rowData.custom_price) ?? finiteNumber(rowData.price)
    return price != null ? `custom price ${formatMoney(price)}` : 'custom price'
  }
  return summarizeDeletedRow(rowData)
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
 * Type-aware (v2.1566) and drops lines that would render as a bare "row" —
 * they add nothing the count chips don't already say. Tolerates any
 * malformed/absent RPC payload (old function shape) by returning [].
 */
export function summarizePreviewItems(previewItems: unknown, limit = 3, ctx?: DeletedRowSummaryCtx): string[] {
  if (!Array.isArray(previewItems)) return []
  return previewItems
    .filter(isPreviewItem)
    .map((item) => ({ item, line: summarizeDeletedRowForTable(item.table_name, item.fields, ctx) }))
    .filter(({ line }) => line !== 'row' && !line.startsWith('id '))
    .slice(0, Math.max(0, limit))
    .map(({ item, line }) => `${humanizeArchiveTable(item.table_name)}: ${line}`)
}

// ---------------------------------------------------------------------------
// Consequence badges (v2.1566) — the malice-triage strip on each bundle card.
// ---------------------------------------------------------------------------

/** Tables whose money fields represent job value rather than money records. */
const JOB_VALUE_TABLES = new Set(['jobs_ledger_fixtures', 'jobs_ledger_line_items'])

export type BundleBadgeTone = 'red' | 'amber' | 'blue' | 'neutral'
export type BundleBadge = { label: string; tone: BundleBadgeTone }

type BadgeRow = { table_name: string; record_id: string | null; row_data: Record<string, unknown> }

function firstMoneyField(rowData: Record<string, unknown>): number | null {
  for (const f of MONEY_FIELDS) {
    const v = finiteNumber(rowData[f])
    if (v != null) return v
  }
  return null
}

/** "$4,520" / "$92.4k"-free: badges show exact dollars, rounded to whole. */
function formatBadgeMoney(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

/**
 * The card's consequence badges. Sources, in preference order: the bundle's
 * fully fetched rows (alert-window bundles auto-load them), then the digest
 * RPC's triage fields (money_total / head_created_at / owner_*), then nothing
 * — a badge only renders when its fact is actually known.
 */
export function deriveBundleBadges(opts: {
  groupKey: string
  deletedAt: string
  deletedById?: string | null
  deletedByName?: string | null
  tables?: string[]
  rows?: BadgeRow[] | null
  moneyTotal?: number | null
  headCreatedAt?: string | null
  ownerUserId?: string | null
  ownerName?: string | null
  userNameById?: ReadonlyMap<string, string>
  now?: Date
}): BundleBadge[] {
  const badges: BundleBadge[] = []
  const rows = opts.rows ?? null

  // Money records (invoices / payments / pay reports / supply invoices / POs).
  const moneyFromRows = rows
    ? rows
        .filter((r) => MONEY_ARCHIVE_TABLES.has(r.table_name))
        .reduce((sum, r) => sum + (firstMoneyField(r.row_data) ?? 0), 0)
    : null
  const moneyTotal = moneyFromRows ?? (typeof opts.moneyTotal === 'number' ? opts.moneyTotal : null)
  if (moneyTotal != null && moneyTotal > 0) {
    const moneyTables = (rows ? rows.map((r) => r.table_name) : (opts.tables ?? [])).filter((t) =>
      MONEY_ARCHIVE_TABLES.has(t),
    )
    const labels = [...new Set(moneyTables.map(humanizeArchiveTable))]
    badges.push({
      label: `${formatBadgeMoney(moneyTotal)} in ${labels.length > 0 ? labels.join(' + ') : 'money records'}`,
      tone: 'red',
    })
  }

  // Job value removed (fixtures / line items) — needs full rows.
  if (rows) {
    const jobValue = rows
      .filter((r) => JOB_VALUE_TABLES.has(r.table_name))
      .reduce((sum, r) => sum + (firstMoneyField(r.row_data) ?? 0), 0)
    if (jobValue > 0) badges.push({ label: `${formatBadgeMoney(jobValue)} removed from job`, tone: 'red' })
  }

  // Age at deletion: fat-finger fixes die young; erased history is old.
  const headRow = rows?.find((r) => r.record_id === opts.groupKey) ?? null
  const createdMsCandidates = [
    isoMs(opts.headCreatedAt),
    isoMs(headRow?.row_data.created_at),
    ...(rows ? rows.map((r) => isoMs(r.row_data.created_at)) : []),
  ].filter((v): v is number => v != null)
  const createdMs = createdMsCandidates.length > 0 ? Math.min(...createdMsCandidates) : null
  const deletedMs = isoMs(opts.deletedAt)
  if (createdMs != null && deletedMs != null && deletedMs >= createdMs) {
    const ageMs = deletedMs - createdMs
    const minutes = Math.round(ageMs / 60_000)
    const hours = Math.round(ageMs / 3_600_000)
    const days = Math.round(ageMs / 86_400_000)
    if (minutes < 60) badges.push({ label: `created ${Math.max(minutes, 1)}m before deletion`, tone: 'red' })
    else if (hours < 24) badges.push({ label: `created ${hours}h before deletion`, tone: 'amber' })
    else if (days < 60) badges.push({ label: `existed ${days}d`, tone: 'neutral' })
    else badges.push({ label: `existed ${Math.round(days / 30)} months`, tone: 'neutral' })
  }

  // Clock-session approval state — deleting APPROVED time is the louder event.
  if (rows) {
    const clockRows = rows.filter((r) => r.table_name === 'clock_sessions')
    if (clockRows.length > 0) {
      const approved = clockRows.filter((r) => clockSessionStatus(r.row_data) === 'approved').length
      if (approved > 0) {
        badges.push({
          label: approved === 1 ? 'approved session deleted' : `${approved} approved sessions deleted`,
          tone: 'red',
        })
      } else {
        badges.push({ label: 'pending approval', tone: 'amber' })
      }
    }
    const paidInvoices = rows.filter(
      (r) =>
        r.table_name === 'invoices' &&
        [r.row_data.stripe_invoice_status, r.row_data.status].some(
          (v) => typeof v === 'string' && v.toLowerCase() === 'paid',
        ),
    ).length
    if (paidInvoices > 0) {
      badges.push({
        label: paidInvoices === 1 ? 'paid invoice deleted' : `${paidInvoices} paid invoices deleted`,
        tone: 'red',
      })
    }
  }

  // Owner ≠ deleter: deleting someone ELSE's record is a triage flag.
  const ownerId =
    opts.ownerUserId ??
    nonEmptyString(headRow?.row_data.user_id) ??
    nonEmptyString(headRow?.row_data.created_by) ??
    null
  if (ownerId && opts.deletedById && ownerId !== opts.deletedById) {
    const ownerName = opts.ownerName ?? opts.userNameById?.get(ownerId) ?? null
    badges.push({
      label: ownerName ? `belonged to ${ownerName}` : 'not the deleter’s own record',
      tone: 'blue',
    })
  }

  return badges
}

// ---------------------------------------------------------------------------
// Burst grouping (v2.1566) — review the alert's deletions burst by burst.
// ---------------------------------------------------------------------------

export type BurstAlertLike = {
  actor_name: string | null
  window_start: string
  window_end: string
}

/**
 * Partition bundles into per-alert burst groups (first matching window wins,
 * alerts in given order — newest first from the RPC) plus the ungrouped rest.
 * Bundle order is preserved within every group.
 */
export function groupBundlesByBurst<T extends { deleted_at: string }>(
  bundles: T[],
  alerts: BurstAlertLike[],
): { bursts: { alert: BurstAlertLike; bundles: T[] }[]; rest: T[] } {
  const bursts = alerts.map((alert) => ({ alert, bundles: [] as T[] }))
  const rest: T[] = []
  for (const b of bundles) {
    const t = Date.parse(b.deleted_at)
    const hit = Number.isNaN(t)
      ? undefined
      : bursts.find(({ alert }) => {
          const start = Date.parse(alert.window_start)
          const end = Date.parse(alert.window_end)
          return !Number.isNaN(start) && !Number.isNaN(end) && t >= start && t <= end
        })
    if (hit) hit.bundles.push(b)
    else rest.push(b)
  }
  return { bursts: bursts.filter((g) => g.bundles.length > 0), rest }
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
