/**
 * Explicit PostgREST embed column lists for `jobs_ledger` fetches.
 * `(*)` is avoided on child tables so new DB columns are not auto-pulled in list/detail
 * until we opt in, and the list query can omit full-table embeds (materials/fixtures) on first load.
 *
 * @see `fetchJobsLedgerWithDetailsForStages` and `fetchJobWithDetailsById`
 */

/** `jobs_ledger_invoices` — full row (small fixed set) */
export const JOBS_LEDGER_INVOICES_EMBED = [
  'amount',
  'billed_at',
  'created_at',
  'estimated_bill_date',
  'external_send_channel',
  'external_send_note',
  'hosted_invoice_url',
  'id',
  'is_primary_rtb_bundle',
  'job_id',
  'sent_to_customer_at',
  'sequence_order',
  'status',
  'stripe_invoice_footer',
  'stripe_invoice_id',
  'stripe_invoice_memo',
  'stripe_invoice_status',
].join(', ')

/** `jobs_ledger_payments` — full row */
export const JOBS_LEDGER_PAYMENTS_EMBED = [
  'amount',
  'created_at',
  'id',
  'invoice_id',
  'job_id',
  'mercury_transaction_id',
  'note',
  'paid_on',
  'payment_type',
  'reference_number',
  'sequence_order',
].join(', ')

/** `jobs_ledger_materials` — full row */
export const JOBS_LEDGER_MATERIALS_EMBED = ['amount', 'created_at', 'description', 'id', 'job_id', 'sequence_order'].join(
  ', ',
)

/** `jobs_ledger_fixtures` — full row */
export const JOBS_LEDGER_FIXTURES_EMBED = [
  'count',
  'created_at',
  'id',
  'job_id',
  'line_description',
  'line_unit_price',
  'name',
  'sequence_order',
].join(', ')

/** `jobs_ledger_team_members` + users embed */
export const JOBS_LEDGER_TEAM_MEMBERS_EMBED = ['created_at', 'id', 'job_id', 'user_id', 'users(name)'].join(', ')

/**
 * Stages list: one query without materials/fixtures; those are batch-loaded and merged
 * (see `fetchJobsLedgerWithDetailsForStages`).
 */
export function buildJobsListStagesPrimarySelect(): string {
  return `
    *,
    jobs_ledger_invoices(${JOBS_LEDGER_INVOICES_EMBED}),
    jobs_ledger_payments(${JOBS_LEDGER_PAYMENTS_EMBED}),
    jobs_ledger_team_members(${JOBS_LEDGER_TEAM_MEMBERS_EMBED}),
    reports(job_ledger_id),
    projects:project_id(id, name),
    bids:bid_id(id, project_name, bid_number)
  `
}

/**
 * Single-job detail: same as historical full embed, with explicit child columns.
 */
export function buildJobsLedgerFullDetailSelect(): string {
  return `
    *,
    jobs_ledger_materials(${JOBS_LEDGER_MATERIALS_EMBED}),
    jobs_ledger_fixtures(${JOBS_LEDGER_FIXTURES_EMBED}),
    jobs_ledger_payments(${JOBS_LEDGER_PAYMENTS_EMBED}),
    jobs_ledger_invoices(${JOBS_LEDGER_INVOICES_EMBED}),
    jobs_ledger_team_members(${JOBS_LEDGER_TEAM_MEMBERS_EMBED}),
    reports(job_ledger_id),
    projects:project_id(id, name),
    bids:bid_id(id, project_name, bid_number)
  `
}
