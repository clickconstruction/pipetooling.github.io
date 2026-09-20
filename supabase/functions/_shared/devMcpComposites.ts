// dev-mcp's named verbs (v2.3646, to-dos/mcp-servers.md PR 4b-2): the four resolvers and the three
// composites. Each is the screen's own reads — the same RPCs and selects — handed to the screen's
// own kernels, so a number here is the number there. Nothing in this file reads the network: it
// takes a `Reader` (dev-mcp passes one that GETs as the dev; the tests pass a fake), and a part
// that fails is reported in place (`{ error }`) rather than sinking the whole answer.
//
// Where a screen's number is NOT reachable from a shared kernel the reply says so in words
// (`get_bid.totals`) instead of computing a second opinion.

import type { RowFilter, RowOrder } from './devMcpDoor.ts'
import { customerDaysToPay, customerEstimateOutcomes, customerMoneyStats, profileJobRowMoney, type ProfileJob } from './customerProfileStats.ts'
import { mercuryCardTotalFromLines, mercuryLinesFromRows, supplyInvoiceTotalFromRows, supplyLinesFromRows, tallyLinesFromRows, tallyPartsTotalFromLines, jobAccountSplitFromLines } from './jobMaterialsCostLines.ts'
import { buildJobProfitSummary } from './jobProfitSummary.ts'
import { DRIVE_SETTING_KEYS, jobSubLaborInputsFromRows, type SubLaborItemRow, type SubLaborSheetRow } from './jobSubLaborInputs.ts'
import { formatBidLedgerNumberLabel, formatJobLedgerNumberLabel } from './ledgerDisplayPrefixes.ts'

export type RowsQuery = { select?: string; filters?: RowFilter[]; order?: RowOrder[]; limit?: number }
export type Row = Record<string, unknown>
export type Reader = {
  rpc: (name: string, args?: Record<string, unknown>, limit?: number) => Promise<unknown>
  rows: (table: string, query: RowsQuery) => Promise<Row[]>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FIND_LIMIT = 20
const THREAD_LIMIT = 15

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
  const [hits, prefixes] = await Promise.all([reader.rpc('search_jobs_ledger', { search_text: text.trim() }, FIND_LIMIT), part(() => prefixMap(reader))])
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

type Resolved = { id: string } | { refused: string }
async function resolve(ref: string, find: () => Promise<{ matches: Row[] }>, what: string): Promise<Resolved> {
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
  'invoices:jobs_ledger_invoices(id,status,amount,billed_at,estimated_bill_date),' +
  'payments:jobs_ledger_payments(invoice_id,amount,paid_on),' +
  'team:jobs_ledger_team_members(users(name,role))'

export async function getJob(reader: Reader, ref: string, todayYmd: string) {
  const resolved = await resolve(ref, () => findJob(reader, ref) as Promise<{ matches: Row[] }>, 'job')
  if ('refused' in resolved) return resolved
  const id = resolved.id
  const eq = (column: string): RowFilter[] => [{ column, op: 'eq', value: id }]

  const [jobRows, prefixes] = await Promise.all([part(() => reader.rows('jobs_ledger', { select: JOB_SELECT, filters: eq('id'), limit: 1 })), part(() => prefixMap(reader))])
  if (failed(jobRows)) return { refused: `Could not read the job: ${jobRows.error}` }
  const job = jobRows[0]
  if (!job) return { refused: `No job ${id} — it does not exist, or RLS hides it from you.` }

  const [strip, stages, stageProgress, hours, notes, statusEvents, reports, invoiceAmounts, supplyAlloc, cardAlloc, tally, sheets, settings] = await Promise.all([
    part(() => reader.rpc('list_job_account_strip', { p_job_ids: [id] })),
    part(() => reader.rpc('get_stages_enrichment', { p_job_ids: [id] })),
    part(() => reader.rpc('list_job_stage_progress', { p_job_id: id })),
    part(async () => asRows(await reader.rpc('get_man_hours_by_job')).filter((r) => r.job_id === id)),
    part(() => reader.rows('jobs_ledger_thread_notes', { select: 'created_at,body,author_user_id', filters: eq('job_id'), order: [{ column: 'created_at', ascending: false }], limit: THREAD_LIMIT })),
    part(() => reader.rows('job_status_events', { select: 'changed_at,from_status,to_status,changed_by_user_id', filters: eq('job_id'), order: [{ column: 'changed_at', ascending: false }], limit: THREAD_LIMIT })),
    part(() => reader.rpc('list_reports_for_job_ledger', { p_job_id: id }, THREAD_LIMIT)),
    part(() => reader.rpc('get_invoice_amounts_for_jobs', { p_job_ids: [id] })),
    part(() => reader.rows('supply_house_invoice_job_allocations', { select: 'pct,supply_house_invoices(invoice_number,invoice_date,amount,is_paid,on_job_account,supply_houses(name))', filters: eq('job_id'), limit: 200 })),
    part(() => reader.rows('mercury_transaction_job_allocations', { select: 'id,amount,note,mercury_transaction_id,mercury_transactions(posted_at,counterparty_name,amount,raw)', filters: eq('job_id'), order: [{ column: 'created_at' }], limit: 200 })),
    part(() => reader.rpc('list_tally_parts_with_po')),
    part(() => reader.rows('people_labor_jobs', { select: 'id,job_number,labor_rate,distance_miles', filters: [{ column: 'job_ledger_id', op: 'eq', value: id }], order: [{ column: 'created_at', ascending: false }], limit: 200 })),
    part(() => reader.rows('app_settings', { select: 'key,value_num', filters: [{ column: 'key', op: 'in', value: [...DRIVE_SETTING_KEYS] }], limit: 10 })),
  ])

  // Money — the Job window's profit band (DetailJobModal) and the hub's per-job bill row, from their own kernels.
  const money = await part(async () => {
    for (const p of [invoiceAmounts, supplyAlloc, cardAlloc, tally, sheets]) if (failed(p)) throw new Error(`a cost source could not be read: ${p.error}`)
    const sheetRows = sheets as unknown as SubLaborSheetRow[]
    const items = sheetRows.length === 0 ? [] : await reader.rows('people_labor_job_items', { select: 'job_id,count,hrs_per_unit,is_fixed,labor_rate,direct_labor_amount', filters: [{ column: 'job_id', op: 'in', value: sheetRows.map((s) => s.id) }], limit: 200 })
    const labor = jobSubLaborInputsFromRows(sheetRows, items as unknown as SubLaborItemRow[], failed(settings) ? [] : (settings as unknown as { key: string; value_num: number | null }[]))
    const supplyLines = supplyLinesFromRows(supplyAlloc as Row[])
    const cardLines = mercuryLinesFromRows(cardAlloc as unknown as Parameters<typeof mercuryLinesFromRows>[0])
    const tallyLines = tallyLinesFromRows(asRows(tally) as unknown as Parameters<typeof tallyLinesFromRows>[0], id)
    const parts = {
      supply_invoices: supplyInvoiceTotalFromRows(asRows(invoiceAmounts) as { job_id: string; invoice_amount: number | string }[], id),
      card_charges: mercuryCardTotalFromLines(cardLines),
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
      job_account_exposure: jobAccountSplitFromLines(supplyLines),
      billing,
      counts: { supply_invoice_lines: supplyLines.length, card_lines: cardLines.length, tally_lines: tallyLines.length, sub_labor_sheets: sheetRows.length },
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
  'id,hcp_number,click_number,job_name,status,revenue,payments_made,created_at,service_type_id,invoices:jobs_ledger_invoices(id,status,amount,billed_at,estimated_bill_date),payments:jobs_ledger_payments(invoice_id,amount,paid_on)'

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
