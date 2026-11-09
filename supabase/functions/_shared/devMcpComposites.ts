// dev-mcp's named verbs (v2.3646, to-dos/mcp-servers.md PR 4b-2): the four resolvers and the three
// composites. Each is the screen's own reads — the same RPCs and selects — handed to the screen's
// own kernels, so a number here is the number there. Nothing in this file reads the network: it
// takes a `Reader` (dev-mcp passes one that GETs as the dev; the tests pass a fake), and a part
// that fails is reported in place (`{ error }`) rather than sinking the whole answer.
//
// Where a screen's number is NOT reachable from a shared kernel the reply says so in words
// (`get_bid.totals`) instead of computing a second opinion.

import type { RowFilter, RowOrder } from './devMcpDoor.ts'
import { cardChargeCostUsd, EMPTY_CARD_CHARGE_EXCLUSIONS, type CardChargeExclusions } from './cardChargeAllocationFilter.ts'
import { customerDaysToPay, customerEstimateOutcomes, customerMoneyStats, profileJobRowMoney, type ProfileJob } from './customerProfileStats.ts'
import { jobCardChargesCountedFromLines, jobCardLineStatus, mercuryCardTotalFromLines, mercuryLinesFromRows, supplyInvoiceTotalFromRows, supplyLinesFromRows, tallyLinesFromRows, tallyPartsTotalFromLines, jobAccountSplitFromLines, type JobMercuryAllocLine } from './jobMaterialsCostLines.ts'
import { buildJobProfitSummary } from './jobProfitSummary.ts'
import { DRIVE_SETTING_KEYS, jobSubLaborInputsFromRows, type SubLaborItemRow, type SubLaborSheetRow } from './jobSubLaborInputs.ts'
import { formatBidLedgerNumberLabel, formatJobLedgerNumberLabel } from './ledgerDisplayPrefixes.ts'
import { overheadPartsAccountingBucketFromDefaultKey } from './gcKernels/lib/overheadPartsAccountingBuckets.ts'
import { STALE_COUNT_DAYS, containerLines, countDiffs, countIsDue, groupByPlace, lastCountedAt, linesOf, placeName, type Container, type Movement, type MovementReason, type Place } from './gcKernels/lib/materials/onSite.ts'
import { retiredContainers, unretireVerdict } from './gcKernels/lib/materials/unretire.ts'

export type RowsQuery = { select?: string; filters?: RowFilter[]; order?: RowOrder[]; limit?: number }
export type Row = Record<string, unknown>
export type Reader = {
  /** `filters` narrow a set-returning RPC's answer on the server (v2.6468), as `rows`' filters narrow a table. */
  rpc: (name: string, args?: Record<string, unknown>, limit?: number, filters?: RowFilter[]) => Promise<unknown>
  rows: (table: string, query: RowsQuery) => Promise<Row[]>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FIND_LIMIT = 20
const THREAD_LIMIT = 15
/** The door answers at most this many rows a read (`ROWS_MAX_LIMIT` in devMcpDoor.ts). */
const ROWS_PAGE = 200
/** Where `readAllRows` stops and says so: twenty-five pages. */
export const ALL_ROWS_MAX = 5000
/** Ids per `in` read: each is about forty characters of the URL, which the door holds to 6,000. */
const IDS_PER_READ = 100

export type Part<T> = T | { error: string }
async function part<T>(run: () => Promise<T>): Promise<Part<T>> {
  try {
    return await run()
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
const failed = (p: unknown): p is { error: string } => !!p && typeof p === 'object' && !Array.isArray(p) && 'error' in (p as object) && Object.keys(p as object).length === 1
const asRows = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : [])
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
/** PostgREST `ilike` wildcard is `*`; a literal `*` or `,` or `(`/`)` in the text would change the pattern. */
const likeTerm = (text: string): string => `*${text.trim().replace(/[*,()]/g, ' ').replace(/\s+/g, '*')}*`

/**
 * Every row of a read the door cuts at 200 (v2.6463): a page at a time in `key` order, each page after the last
 * page's key, so no row repeats and none is skipped. `key` must be unique among the rows the filters keep, and in
 * the select. Stops at `max` rows and says so (`capped`) only when a row follows them — one look past a full last
 * page (v2.6488), so a read of exactly `max` rows is whole — so a total never undercounts in silence and a whole
 * read is never called short.
 */
export async function readAllRows(
  reader: Reader,
  table: string,
  query: { select: string; filters: RowFilter[] },
  key = 'id',
  max = ALL_ROWS_MAX,
): Promise<{ rows: Row[]; capped: boolean }> {
  const rows: Row[] = []
  let after: string | null = null
  for (;;) {
    const filters: RowFilter[] = after == null ? query.filters : [...query.filters, { column: key, op: 'gt', value: after }]
    const page = await reader.rows(table, { select: query.select, filters, order: [{ column: key }], limit: ROWS_PAGE })
    rows.push(...page)
    if (page.length < ROWS_PAGE) return { rows, capped: false }
    const last = page[page.length - 1]![key]
    if (last == null || last === '') throw new Error(`${table} cannot page: its select has no ${key}`)
    after = String(last)
    if (rows.length >= max) {
      const next = await reader.rows(table, { select: query.select, filters: [...query.filters, { column: key, op: 'gt', value: after }], order: [{ column: key }], limit: 1 })
      return { rows, capped: next.length > 0 }
    }
  }
}

type PrefixMap = Record<string, { job: string | null; bid: string | null }>
async function prefixMap(reader: Reader): Promise<PrefixMap> {
  const rows = await reader.rows('service_types', { select: 'id,ledger_job_prefix,ledger_bid_prefix', limit: 200 })
  return Object.fromEntries(rows.map((r) => [str(r.id), { job: (r.ledger_job_prefix as string | null) ?? null, bid: (r.ledger_bid_prefix as string | null) ?? null }]))
}
/** The app's `effectiveJobLedgerNumber`: the HCP number, else the Click number. */
export const jobNumberOf = (hcp: unknown, click: unknown): string => str(hcp).trim() || str(click).trim()
const jobLabel = (row: Row, prefixes: PrefixMap): string => formatJobLedgerNumberLabel(prefixes[str(row.service_type_id)]?.job, jobNumberOf(row.hcp_number, row.click_number))
const bidLabel = (row: Row, prefixes: PrefixMap): string => formatBidLedgerNumberLabel(prefixes[str(row.service_type_id)]?.bid, str(row.bid_number))

// ---------------------------------------------------------------------------
// Resolvers
// ---------------------------------------------------------------------------

export async function findJob(reader: Reader, text: string) {
  const [hits, prefixes] = await Promise.all([reader.rpc('search_jobs_ledger', { search_text: text.trim(), include_billing_only: true }, FIND_LIMIT), part(() => prefixMap(reader))])
  const map = failed(prefixes) ? {} : prefixes
  return { matches: asRows(hits).map((r) => ({ id: r.id, label: jobLabel(r, map), job_name: r.job_name, job_address: r.job_address, service_type: r.service_type_name })) }
}

export async function findBid(reader: Reader, text: string) {
  const [hits, prefixes] = await Promise.all([reader.rpc('search_bids_for_clock', { p_search_text: text.trim() }, FIND_LIMIT), part(() => prefixMap(reader))])
  const map = failed(prefixes) ? {} : prefixes
  return { matches: asRows(hits).map((r) => ({ id: r.id, label: bidLabel(r, map), project_name: r.project_name, address: r.address, customer: r.customer_name })) }
}

export async function findCustomer(reader: Reader, text: string) {
  const rows = await reader.rows('customers', { select: 'id,name,customer_type,address,contact_info,billing_email', filters: [{ column: 'name', op: 'ilike', value: likeTerm(text) }, { column: 'archived_at', op: 'is', value: null }], order: [{ column: 'name' }], limit: FIND_LIMIT })
  return { matches: rows }
}

/** People as the rosters list them: active, human, not a sample account. */
export async function findPerson(reader: Reader, text: string) {
  const rows = await reader.rows('users', {
    select: 'id,name,email,role',
    filters: [
      { column: 'name', op: 'ilike', value: likeTerm(text) },
      { column: 'archived_at', op: 'is', value: null },
      { column: 'is_digital_twin', op: 'eq', value: false },
      { column: 'is_sample', op: 'eq', value: false },
    ],
    order: [{ column: 'name' }],
    limit: FIND_LIMIT,
  })
  return { matches: rows }
}

export type Resolved = { id: string } | { refused: string }
/** An id as given, else the one match of a find; exported for devMcpSubmittals.ts (v2.6804). */
export async function resolve(ref: string, find: () => Promise<{ matches: Row[] }>, what: string): Promise<Resolved> {
  if (UUID_RE.test(ref.trim())) return { id: ref.trim().toLowerCase() }
  const { matches } = await find()
  if (matches.length === 1) return { id: str(matches[0]!.id) }
  const exact = matches.filter((m) => str(m.label).toLowerCase() === ref.trim().toLowerCase() || str(m.name).toLowerCase() === ref.trim().toLowerCase())
  if (exact.length === 1) return { id: str(exact[0]!.id) }
  if (matches.length === 0) return { refused: `No ${what} matches "${ref}".` }
  return { refused: `"${ref}" matches ${matches.length} ${what}s — pass the id of one: ${matches.slice(0, 8).map((m) => `${str(m.label ?? m.name)} (${str(m.id)})`).join('; ')}` }
}

// ---------------------------------------------------------------------------
// get_job — the Job window
// ---------------------------------------------------------------------------

const JOB_SELECT =
  'id,hcp_number,click_number,job_name,job_address,status,pct_complete,revenue,payments_made,service_type_id,customer_id,gc_customer_id,created_at,' +
  'customer:customers!jobs_ledger_customer_id_fkey(id,name),' +
  'materials:jobs_ledger_materials(description,amount),' +
  'invoices:jobs_ledger_invoices(id,status,amount,billed_at,estimated_bill_date,sequence_order),' +
  'payments:jobs_ledger_payments(invoice_id,amount,paid_on),' +
  'team:jobs_ledger_team_members(users(name,role))'

/** Every row of a read keyed by a list of ids, in `in` reads of `IDS_PER_READ`, each read paged. */
type ReadIn = (what: string, table: string, select: string, column: string, ids: readonly string[], key?: string) => Promise<Row[]>

/**
 * The one card rule's lookups for a job's card lines, as the Job window loads them (`loadCardChargeExclusions`,
 * v2.2692): each transaction's Banking → Accounting bucket (its drag-sort label's default key), and the transactions
 * also linked to a supply-house invoice. A lookup that fails takes nothing out, as the window's does, and says so in
 * `unread`.
 */
async function readCardChargeExclusions(readIn: ReadIn, txIds: readonly string[]): Promise<{ exclusions: CardChargeExclusions; unread: string[] }> {
  if (txIds.length === 0) return { exclusions: EMPTY_CARD_CHARGE_EXCLUSIONS, unread: [] }
  const [buckets, links] = await Promise.all([
    part(async () => {
      const assigned = await readIn('card line labels', 'mercury_transaction_drag_sort_assignments', 'mercury_transaction_id,label_id', 'mercury_transaction_id', txIds, 'mercury_transaction_id')
      const labels = await readIn('Accounting labels', 'mercury_drag_sort_labels', 'id,default_key', 'id', [...new Set(assigned.map((a) => str(a.label_id)))])
      const defaultKey = new Map(labels.map((l) => [str(l.id), (l.default_key as string | null) ?? null]))
      return new Map(assigned.map((a) => [str(a.mercury_transaction_id), overheadPartsAccountingBucketFromDefaultKey(defaultKey.get(str(a.label_id)))]))
    }),
    part(async () => new Set((await readIn('invoice links', 'mercury_transaction_supply_house_invoice_links', 'id,mercury_transaction_id', 'mercury_transaction_id', txIds)).map((r) => str(r.mercury_transaction_id)))),
  ])
  return {
    exclusions: { bucketByTxId: failed(buckets) ? new Map() : buckets, invoiceLinkedTxIds: failed(links) ? new Set() : links },
    unread: [
      ...(failed(buckets) ? [`The Accounting labels could not be read (${buckets.error}), so an Internal Transfer counts, as the window counts it then.`] : []),
      ...(failed(links) ? [`The supply-house invoice links could not be read (${links.error}), so a charge also on an invoice counts, as the window counts it then.`] : []),
    ],
  }
}

/** What the card rule did to the job's lines, beside what it counts — the window marks each line it leaves out. */
function cardRuleSummary(lines: JobMercuryAllocLine[], exclusions: CardChargeExclusions, unread: string[]) {
  const left = { internal_transfer: { lines: 0, cost: 0 }, invoice_linked: { lines: 0, cost: 0 } }
  for (const line of lines) {
    const status = jobCardLineStatus(line, exclusions)
    if (status === 'counts') continue
    left[status].lines += 1
    left[status].cost += cardChargeCostUsd(line.allocationAmount)
  }
  return {
    rule: 'jobCardChargesCountedFromLines — an Internal Transfer is not a job cost, and a charge also on a supply-house invoice is counted there',
    attached: mercuryCardTotalFromLines(lines),
    ...left,
    counted: jobCardChargesCountedFromLines(lines, exclusions),
    ...(unread.length ? { note: unread.join(' ') } : {}),
  }
}

export async function getJob(reader: Reader, ref: string, todayYmd: string) {
  const resolved = await resolve(ref, () => findJob(reader, ref) as Promise<{ matches: Row[] }>, 'job')
  if ('refused' in resolved) return resolved
  const id = resolved.id
  const eq = (column: string): RowFilter[] => [{ column, op: 'eq', value: id }]

  const [jobRows, prefixes] = await Promise.all([part(() => reader.rows('jobs_ledger', { select: JOB_SELECT, filters: eq('id'), limit: 1 })), part(() => prefixMap(reader))])
  if (failed(jobRows)) return { refused: `Could not read the job: ${jobRows.error}` }
  const job = jobRows[0]
  if (!job) return { refused: `No job ${id} — it does not exist, or RLS hides it from you.` }

  // The reads a big job outgrows come back whole (v2.6463): the door answers 200 rows a read, and a busy job carries
  // hundreds of card lines. A read that reaches `ALL_ROWS_MAX` says so beside the money instead of undercounting in silence.
  const stopped: string[] = []
  const every = async (what: string, table: string, query: { select: string; filters: RowFilter[] }, key = 'id'): Promise<Row[]> => {
    const read = await readAllRows(reader, table, query, key)
    if (read.capped) stopped.push(`${what}: stopped at ${read.rows.length}`)
    return read.rows
  }
  // A read by a list of ids goes in `in` reads of a hundred: the door holds a URL to 6,000 characters.
  const everyIn: ReadIn = async (what, table, select, column, ids, key = 'id') => {
    const rows: Row[] = []
    for (let i = 0; i < ids.length; i += IDS_PER_READ) rows.push(...(await every(what, table, { select, filters: [{ column, op: 'in', value: ids.slice(i, i + IDS_PER_READ) }] }, key)))
    return rows
  }

  const [strip, stages, stageProgress, hours, notes, statusEvents, reports, invoiceAmounts, supplyAlloc, cardAlloc, tally, sheets, settings] = await Promise.all([
    part(() => reader.rpc('list_job_account_strip', { p_job_ids: [id] })),
    part(() => reader.rpc('get_stages_enrichment', { p_job_ids: [id] })),
    part(() => reader.rpc('list_job_stage_progress', { p_job_id: id })),
    // The job's rows only, filtered on the server (v2.6468), as the Development page reads the site's (`fetchSiteLabor`):
    // the company's rows read whole would stop at PostgREST's 1,000 and could leave the job's out.
    part(async () => asRows(await reader.rpc('get_man_hours_by_job', {}, undefined, eq('job_id'))).filter((r) => r.job_id === id)),
    part(() => reader.rows('jobs_ledger_thread_notes', { select: 'created_at,body,author_user_id', filters: eq('job_id'), order: [{ column: 'created_at', ascending: false }], limit: THREAD_LIMIT })),
    part(() => reader.rows('job_status_events', { select: 'changed_at,from_status,to_status,changed_by_user_id', filters: eq('job_id'), order: [{ column: 'changed_at', ascending: false }], limit: THREAD_LIMIT })),
    part(() => reader.rpc('list_reports_for_job_ledger', { p_job_id: id }, THREAD_LIMIT)),
    part(() => reader.rpc('get_invoice_amounts_for_jobs', { p_job_ids: [id] })),
    // One allocation per invoice on a job, so the invoice id pages it (the table has no id of its own).
    part(() => every('supply invoice lines', 'supply_house_invoice_job_allocations', { select: 'invoice_id,pct,supply_house_invoices(invoice_number,invoice_date,amount,is_paid,on_job_account,supply_houses(name))', filters: eq('job_id') }, 'invoice_id')),
    // No `raw` on the embed: the totals never read it, and on a busy job the bank records ran to megabytes (the page dropped it too, v2.6378).
    part(() => every('card lines', 'mercury_transaction_job_allocations', { select: 'id,amount,note,mercury_transaction_id,mercury_transactions(posted_at,counterparty_name,amount)', filters: eq('job_id') })),
    part(() => reader.rpc('list_tally_parts_with_po')),
    part(() => every('sub-labor sheets', 'people_labor_jobs', { select: 'id,job_number,labor_rate,distance_miles', filters: [{ column: 'job_ledger_id', op: 'eq', value: id }] })),
    part(() => reader.rows('app_settings', { select: 'key,value_num', filters: [{ column: 'key', op: 'in', value: [...DRIVE_SETTING_KEYS] }], limit: 10 })),
  ])

  // Money — the Job window's profit band (DetailJobModal) and the hub's per-job bill row, from their own kernels.
  const money = await part(async () => {
    for (const p of [invoiceAmounts, supplyAlloc, cardAlloc, tally, sheets]) if (failed(p)) throw new Error(`a cost source could not be read: ${p.error}`)
    const sheetRows = sheets as unknown as SubLaborSheetRow[]
    const cardLines = mercuryLinesFromRows(cardAlloc as unknown as Parameters<typeof mercuryLinesFromRows>[0])
    const txIds = [...new Set(cardLines.map((l) => l.mercuryTransactionId).filter((t): t is string => !!t))]
    const [items, card] = await Promise.all([
      everyIn('sheet items', 'people_labor_job_items', 'id,job_id,count,hrs_per_unit,is_fixed,labor_rate,direct_labor_amount', 'job_id', sheetRows.map((s) => s.id)),
      readCardChargeExclusions(everyIn, txIds),
    ])
    const labor = jobSubLaborInputsFromRows(sheetRows, items as unknown as SubLaborItemRow[], failed(settings) ? [] : (settings as unknown as { key: string; value_num: number | null }[]))
    const supplyLines = supplyLinesFromRows(supplyAlloc as Row[])
    const tallyLines = tallyLinesFromRows(asRows(tally) as unknown as Parameters<typeof tallyLinesFromRows>[0], id)
    const parts = {
      supply_invoices: supplyInvoiceTotalFromRows(asRows(invoiceAmounts) as { job_id: string; invoice_amount: number | string }[], id),
      // By the one card rule, as the window's profit band counts them (v2.6468) — not every line attached (`card_rule.attached`).
      card_charges: jobCardChargesCountedFromLines(cardLines, card.exclusions),
      tally_parts: tallyPartsTotalFromLines(tallyLines),
      other_charges: asRows(job.materials).reduce((s, m) => s + (Number(m.amount) || 0), 0),
    }
    const profit = buildJobProfitSummary({
      revenue: job.revenue != null ? Number(job.revenue) : null,
      supplyInvoiceTotal: parts.supply_invoices,
      cardChargesTotal: parts.card_charges,
      tallyPartsTotal: parts.tally_parts,
      otherChargesTotal: parts.other_charges,
      laborJobs: labor.laborJobs,
      mileageCost: labor.mileageCost,
      timePerMile: labor.timePerMile,
    })
    const billing = profileJobRowMoney({ id, status: (job.status as string | null) ?? null, revenue: job.revenue == null ? null : Number(job.revenue), payments_made: job.payments_made == null ? null : Number(job.payments_made), invoices: asRows(job.invoices) as unknown as ProfileJob['invoices'], payments: asRows(job.payments) as unknown as ProfileJob['payments'] }, todayYmd)
    return {
      source: 'buildJobProfitSummary + profileJobRowMoney — the Job window and Customer hub kernels',
      profit,
      parts,
      card_rule: cardRuleSummary(cardLines, card.exclusions, card.unread),
      job_account_exposure: jobAccountSplitFromLines(supplyLines),
      billing,
      counts: { supply_invoice_lines: supplyLines.length, card_lines: cardLines.length, tally_lines: tallyLines.length, sub_labor_sheets: sheetRows.length },
      ...(stopped.length ? { stopped_reads: stopped, note: `A read stopped at ${ALL_ROWS_MAX} rows, so these totals undercount.` } : {}),
    }
  })

  const { materials: _m, invoices, payments, team, ...header } = job
  return {
    job: { label: jobLabel(job, failed(prefixes) ? {} : prefixes), ...header, team: asRows(team).map((t) => (t.users as Row | null)?.name).filter(Boolean) },
    money,
    invoices,
    payments,
    account_strip: strip,
    stages: { enrichment: stages, progress: stageProgress },
    hours,
    activity: { notes, status_events: statusEvents, reports },
  }
}

// ---------------------------------------------------------------------------
// get_customer — the Customer hub
// ---------------------------------------------------------------------------

const CUSTOMER_JOBS_SELECT =
  'id,hcp_number,click_number,job_name,status,revenue,payments_made,created_at,service_type_id,invoices:jobs_ledger_invoices(id,status,amount,billed_at,estimated_bill_date,sequence_order),payments:jobs_ledger_payments(invoice_id,amount,paid_on)'

export async function getCustomer(reader: Reader, ref: string, todayYmd: string) {
  const resolved = await resolve(ref, () => findCustomer(reader, ref) as Promise<{ matches: Row[] }>, 'customer')
  if ('refused' in resolved) return resolved
  const id = resolved.id
  const by = (column: string): RowFilter[] => [{ column, op: 'eq', value: id }]

  const customerRows = await part(() => reader.rows('customers', { filters: by('id'), limit: 1 }))
  if (failed(customerRows)) return { refused: `Could not read the customer: ${customerRows.error}` }
  if (!customerRows[0]) return { refused: `No customer ${id} — it does not exist, or RLS hides it from you.` }

  const [contacts, jobs, bids, estimates, addresses, prefixes] = await Promise.all([
    part(() => reader.rows('customer_contact_persons', { select: 'id,name,phone,email', filters: by('customer_id'), limit: 50 })),
    part(() => reader.rows('jobs_ledger', { select: CUSTOMER_JOBS_SELECT, filters: by('customer_id'), order: [{ column: 'created_at', ascending: false }], limit: 200 })),
    part(() => reader.rows('bids', { select: 'id,bid_number,service_type_id,project_name,outcome,address,bid_value,agreed_value,bid_date_sent,bid_due_date', filters: by('customer_id'), order: [{ column: 'bid_due_date', ascending: false }], limit: 100 })),
    part(() => reader.rows('estimates', { select: 'id,estimate_number,title,status,total_cents,sent_at,updated_at', filters: by('customer_id'), order: [{ column: 'updated_at', ascending: false }], limit: 100 })),
    part(() => reader.rows('customer_addresses', { filters: by('customer_id'), limit: 50 })),
    part(() => prefixMap(reader)),
  ])
  const map = failed(prefixes) ? {} : prefixes

  const money = await part(async () => {
    if (failed(jobs)) throw new Error(`the customer's jobs could not be read: ${jobs.error}`)
    const profileJobs = jobs as unknown as ProfileJob[]
    return {
      source: 'customerMoneyStats + customerDaysToPay + customerEstimateOutcomes — the Customer hub kernels',
      stats: customerMoneyStats(profileJobs, todayYmd),
      days_to_pay: customerDaysToPay(profileJobs, todayYmd),
      estimate_outcomes: failed(estimates) ? null : customerEstimateOutcomes(estimates as unknown as { status: string }[]),
      jobs_truncated: profileJobs.length === 200 ? 'only the newest 200 jobs were read — the stats cover those' : undefined,
    }
  })

  return {
    customer: customerRows[0],
    money,
    contacts,
    addresses,
    jobs: failed(jobs) ? jobs : jobs.map(({ invoices: _i, payments: _p, ...j }) => ({ label: jobLabel(j, map), ...j })),
    bids: failed(bids) ? bids : bids.map((b) => ({ label: bidLabel(b, map), ...b })),
    estimates,
  }
}

// ---------------------------------------------------------------------------
// get_bid — the Bid window's stored facts
// ---------------------------------------------------------------------------

export async function getBid(reader: Reader, ref: string) {
  const resolved = await resolve(ref, () => findBid(reader, ref) as Promise<{ matches: Row[] }>, 'bid')
  if ('refused' in resolved) return resolved
  const id = resolved.id
  const by = (column: string): RowFilter[] => [{ column, op: 'eq', value: id }]

  const bidRows = await part(() => reader.rows('bids', { filters: by('id'), limit: 1 }))
  if (failed(bidRows)) return { refused: `Could not read the bid: ${bidRows.error}` }
  const bid = bidRows[0]
  if (!bid) return { refused: `No bid ${id} — it does not exist, or RLS hides it from you.` }

  const [header, countRows, assignments, versions, sends, ledger, strip, prefixes] = await Promise.all([
    part(() => reader.rpc('get_bids_by_ids', { p_bid_ids: [id] })),
    part(() => reader.rows('bids_count_rows', { filters: by('bid_id'), order: [{ column: 'sequence_order' }], limit: 200 })),
    part(() => reader.rows('bid_pricing_assignments', { filters: by('bid_id'), limit: 200 })),
    part(() => reader.rows('bid_versions', { filters: by('bid_id'), order: [{ column: 'sort_order' }], limit: 50 })),
    part(() => reader.rows('bid_version_sends', { filters: by('bid_id'), order: [{ column: 'created_at', ascending: false }], limit: 50 })),
    part(() => reader.rows('bids_submission_entries', { filters: by('bid_id'), order: [{ column: 'occurred_at', ascending: false }], limit: THREAD_LIMIT })),
    part(() => reader.rpc('list_bid_job_account_strip', { p_bid_ids: [id] })),
    part(() => prefixMap(reader)),
  ])

  return {
    bid: { label: bidLabel(bid, failed(prefixes) ? {} : prefixes), ...bid },
    header,
    totals: 'rows as stored — the priced total on Bids → Pricing is computed in the useBidPricingEngine hook, not a shared kernel, so this server does not restate it. bid_value / agreed_value on the bid row are what the office entered.',
    count_rows: countRows,
    pricing_assignments: assignments,
    versions,
    sends,
    submission_ledger: ledger,
    account_strip: strip,
  }
}

// ---------------------------------------------------------------------------
// read_on_site — Materials on site (punch list #209, v2.6367): a job's cages and boxes as the phone's
// On site tab and the office's Materials tab read them, through the screens' own kernel
// (`lib/materials/onSite.ts`, bundled from the kernel copy): on hand is the sum of a line's rows, a
// count resets it, a shortfall at the last count reads missing. The ledger is read whole, 200 rows a
// page, up to the store's own cap, so an agent's number is the screen's number.
// ---------------------------------------------------------------------------

/** The most ledger rows one read takes — the store's MOVEMENTS_LIMIT; a job past it says so. */
export const ON_SITE_MOVEMENTS_MAX = 5000
const ON_SITE_RECENT = 15
const ON_SITE_MISSING_DAYS = 30
const CONTAINER_SELECT = 'id,job_id,label,kind,where_note,place_id,lat,lng,retired_at,created_at'
const MOVEMENT_SELECT = 'id,job_id,part_id,part_name,manufacturer,quantity,reason,from_container_id,to_container_id,note,source,item_id,by_user_id,by_name,at'

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0) || 0)
const strOrNull = (v: unknown): string | null => (v == null ? null : String(v))
/** The eight-character code a label's QR carries: the id's first eight hex characters in capitals (`labels.ts` boxCode). */
export const onSiteBoxCode = (id: string): string => id.replace(/-/g, '').slice(0, 8).toUpperCase()

const containerOf = (r: Row): Container => ({ id: str(r.id), jobId: str(r.job_id), label: str(r.label), kind: str(r.kind) as Container['kind'], where: str(r.where_note), locationId: strOrNull(r.place_id), lat: typeof r.lat === 'number' ? r.lat : null, lng: typeof r.lng === 'number' ? r.lng : null, retiredAt: strOrNull(r.retired_at), createdAt: str(r.created_at) })
const placeOf = (r: Row): Place => ({ id: str(r.id), jobId: str(r.job_id), name: str(r.name), createdAt: str(r.created_at) })
const movementOf = (r: Row): Movement => ({ id: str(r.id), jobId: str(r.job_id), partId: strOrNull(r.part_id), partName: str(r.part_name), manufacturer: strOrNull(r.manufacturer), quantity: num(r.quantity), reason: str(r.reason) as MovementReason, fromContainerId: strOrNull(r.from_container_id), toContainerId: strOrNull(r.to_container_id), note: str(r.note), byUserId: strOrNull(r.by_user_id), byName: str(r.by_name), at: str(r.at), source: strOrNull(r.source), itemId: strOrNull(r.item_id) })

/**
 * The whole ledger of a job, a page at a time by `id` (v2.6488; by `at` before, which lost every row after a stamp that
 * 200 rows shared — a 200-line delivery lands at one `now()` — since each page from that stamp answered the same
 * rows); the kernel's `byTime` puts them in order. Stops at the cap and says so.
 */
export async function readOnSiteMovements(reader: Reader, jobId: string): Promise<{ movements: Movement[]; capped: boolean }> {
  const { rows, capped } = await readAllRows(reader, 'job_material_movements', { select: MOVEMENT_SELECT, filters: [{ column: 'job_id', op: 'eq', value: jobId }] }, 'id', ON_SITE_MOVEMENTS_MAX)
  return { movements: rows.map(movementOf), capped }
}

export async function getOnSite(reader: Reader, ref: string, now: Date) {
  const resolved = await resolve(ref, () => findJob(reader, ref) as Promise<{ matches: Row[] }>, 'job')
  if ('refused' in resolved) return resolved
  const id = resolved.id
  const byJob: RowFilter[] = [{ column: 'job_id', op: 'eq', value: id }]
  const [jobRows, prefixes] = await Promise.all([part(() => reader.rows('jobs_ledger', { select: 'id,hcp_number,click_number,job_name,job_address,service_type_id', filters: [{ column: 'id', op: 'eq', value: id }], limit: 1 })), part(() => prefixMap(reader))])
  if (failed(jobRows)) return { refused: `Could not read the job: ${jobRows.error}` }
  const job = jobRows[0]
  if (!job) return { refused: `No job ${id} — it does not exist, or RLS hides it from you.` }
  // The boxes and the places page by id too (v2.6488; one read of 200 before): the kernel sorts them as the screens do.
  const [containerRows, placeRows, ledger] = await Promise.all([
    part(() => readAllRows(reader, 'job_containers', { select: CONTAINER_SELECT, filters: byJob })),
    part(() => readAllRows(reader, 'job_places', { select: 'id,job_id,name,created_at', filters: byJob })),
    part(() => readOnSiteMovements(reader, id)),
  ])
  if (failed(containerRows)) return { refused: `Could not read the job's containers: ${containerRows.error}` }
  if (failed(ledger)) return { refused: `Could not read the job's ledger: ${ledger.error}` }
  const containers = containerRows.rows.map(containerOf)
  const places = failed(placeRows) ? [] : placeRows.rows.map(placeOf)
  const { movements, capped } = ledger
  const lines = containerLines(movements)
  const live = containers.filter((c) => !c.retiredAt)
  const labelOf = (containerId: string | null): string | null => (containerId ? containers.find((c) => c.id === containerId)?.label ?? null : null)
  const partWords = (partName: string, manufacturer: string | null): string => (manufacturer ? `${partName} · ${manufacturer}` : partName)

  const boxes = groupByPlace(containers, places).flatMap((g) =>
    g.containers.map((c) => {
      const last = lastCountedAt(movements, c.id)
      return {
        container: c.label,
        kind: c.kind,
        id: c.id,
        code: onSiteBoxCode(c.id),
        place: c.kind === 'unsorted' ? null : g.place?.name ?? placeName(places, c.locationId),
        where: c.where || null,
        pinned: c.lat != null && c.lng != null,
        last_count: last ? { at: last.at, by: last.byName } : null,
        count_due: c.kind === 'unsorted' ? false : countIsDue(last, now),
        lines: linesOf(lines, c.id).map((l) => ({ part: partWords(l.partName, l.manufacturer), part_id: l.partId, on_hand: l.onHand, last_touched: l.lastTouchedAt ? { at: l.lastTouchedAt, by: l.lastTouchedBy } : null, last_count_diff: l.lastCountDiff, cannot_find_since_count: l.cannotFindSinceCount || undefined })),
      }
    }),
  )
  const sinceIso = new Date(now.getTime() - ON_SITE_MISSING_DAYS * 86_400_000).toISOString()
  const missing = countDiffs(movements)
    .filter((d) => d.diff < 0 && d.at >= sinceIso)
    .map((d) => ({ container: labelOf(d.containerId), part: partWords(d.partName, d.manufacturer), expected: d.expected, counted: d.counted, missing: -d.diff, at: d.at, by: d.byName }))
  const cannotFind = movements
    .filter((m) => m.reason === 'cannot_find' && m.at >= sinceIso)
    .map((m) => ({ container: labelOf(m.fromContainerId), part: partWords(m.partName, m.manufacturer), quantity: m.quantity, at: m.at, by: m.byName, note: m.note || undefined }))
  const recent = [...movements]
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, ON_SITE_RECENT)
    .map((m) => ({ at: m.at, reason: m.reason, part: partWords(m.partName, m.manufacturer), quantity: m.quantity, from: labelOf(m.fromContainerId), to: labelOf(m.toContainerId), by: m.byName, note: m.note || undefined, source: m.source || undefined }))
  // The office's Retired fold (v2.6406): each retired box with the screens' own verdict on bringing it back.
  const retired = retiredContainers(containers).map((c) => {
    const verdict = unretireVerdict(containers, c.id)
    return { container: c.label, kind: c.kind, id: c.id, retired_at: c.retiredAt, bring_back: verdict.ok ? 'plan_container { action: bring_back }' : verdict.words }
  })
  const dueLabels = boxes.filter((b) => b.count_due).map((b) => b.container)
  const unsorted = boxes.find((b) => b.kind === 'unsorted')
  return {
    job: { id, label: jobLabel(job, failed(prefixes) ? {} : prefixes), job_name: job.job_name, job_address: job.job_address },
    summary: {
      containers: live.filter((c) => c.kind !== 'unsorted').length,
      retired: containers.length - live.length,
      lines_on_site: lines.filter((l) => l.onHand > 0 && live.some((c) => c.id === l.containerId)).length,
      waiting_in_unsorted: unsorted ? unsorted.lines.filter((l) => l.on_hand > 0).length : 0,
      due_a_count: dueLabels,
      count_due_after_days: STALE_COUNT_DAYS,
      missing_last_30_days: missing.length + cannotFind.length,
      ledger_rows: movements.length,
      ledger_capped: capped ? `the first ${ON_SITE_MOVEMENTS_MAX} rows only — a job this size wants the summary RPC the card names` : undefined,
    },
    boxes,
    retired,
    missing: { counts_short: missing, cannot_find: cannotFind },
    recent,
    photos: 'read_rows on job_box_photos by job_id — the files live in the job\'s Drive folder, never here.',
    writes: 'plan_container → apply_container (a cage or box: add, move, retire an empty one, bring a retired one back) · plan_delivery → apply_delivery (lines into Unsorted or a box) · plan_movement → apply_movement (moved, used, returned, taken, cannot_find, damaged, one line) · plan_count → apply_count (a box walked). Name a box by its stencil as listed here.',
  }
}
