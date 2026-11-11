// One job combined into another from the dev seat (v2.6940 / 0.65.0 — punch list #293's step-by-step; the owner,
// 2026-11-11: "lets add verbs to do it"). The fix it was made for: an old shell job beside the job that holds the
// real work, combined once its unbacked payment row is off (plan_job_payment first, then this).
//
// plan_job_combine → apply_job_combine is Pipeline → the tools menu → Combine / Separate…'s Combine tab: one POST of
// migrate_job_ledger_costs_and_delete(p_from, p_to, p_allow_billed) as the dev. The RPC moves the source's costs,
// labor, schedule, reports, stage lines, Materials on site, notes and paper onto the target, adds the source's job
// total to the target's, keeps the source's numbers as prior numbers and deletes the source. It never moves a bill or
// a payment: the Combine tab refuses a source that holds either, and with allow_billed (the Delete flow's Reassign to
// another job…) they are deleted with the source.
//
// No wrapper RPC and no migration: the dry run is this server's read of both jobs, their payment rows and bills, the
// counts of what would move and the RPC's own holds worked out ahead, hashed with the payload. There is no undo, so
// apply asks for the plan's hash and confirm_no_undo: true. Pure: no env reads, no network; the test runs a recording
// fake (src/lib/devMcp/devMcpJobCombine.test.ts).

import { jobStatusWords, paymentDollars, paymentLine, payJobLabel, type PayInvoiceRow, type PayRow, PAY_INVOICE_COLS, PAY_ROW_COLS } from './devMcpJobPayment.ts'

export const JOB_COMBINE_VERBS = ['plan_job_combine', 'apply_job_combine'] as const
export type JobCombineVerb = (typeof JOB_COMBINE_VERBS)[number]
export function isJobCombineVerb(name: string): name is JobCombineVerb {
  return (JOB_COMBINE_VERBS as readonly string[]).includes(name)
}

/** The RPC behind Pipeline's Combine and Edit Job's Reassign to another job…. */
export const COMBINE_RPC = 'migrate_job_ledger_costs_and_delete'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const cents = (v: unknown): number => Math.round((Number(v) || 0) * 100)
const has = (v: string | null | undefined): boolean => (v ?? '').trim().length > 0

export type JobCombinePayload = { action: 'combine'; from_job_id: string; to_job_id: string; allow_billed: boolean; different_customers_ok: boolean }
export type JobCombineInput = { ok: true; p: JobCombinePayload; target: string; planHash: string | null } | { ok: false; error: string }

export const COMBINE_NO_UNDO =
  'There is no undo. Everything moved stays on the target, and the source job is deleted. A dev can bring the deleted source row back for 90 days (Settings → Data & migration → Recently deleted), but nothing that moved goes back with it.'

const SHAPE =
  'needs combine — { from_job_id (the job that goes away — find_job), to_job_id (the job that stays), allow_billed? (false, the Combine tab: a source with a bill or a payment is refused; true, the Delete flow\'s Reassign to another job…: the source\'s bills and payments are deleted with it, never moved), different_customers_ok? (true to combine two jobs that are on different customers) }.'

/** plan_job_combine / apply_job_combine's input, shaped. Apply also needs the plan's hash and confirm_no_undo: true. */
export function jobCombineInput(verb: JobCombineVerb, input: Json): JobCombineInput {
  const src = obj(input.combine)
  const shape = `${verb} ${SHAPE}`
  if (!src) return { ok: false, error: shape }
  const id = (k: string) => (typeof src[k] === 'string' ? (src[k] as string).trim().toLowerCase() : '')
  const from = id('from_job_id')
  const to = id('to_job_id')
  if (!UUID_RE.test(from) || !UUID_RE.test(to)) return { ok: false, error: shape }
  if (from === to) return { ok: false, error: `${verb}: from_job_id and to_job_id are the same job. Nothing to combine.` }
  for (const k of ['allow_billed', 'different_customers_ok']) if (src[k] !== undefined && typeof src[k] !== 'boolean') return { ok: false, error: `${verb}: ${k} is true or false.` }
  let planHash: string | null = null
  if (verb.startsWith('apply_')) {
    const h = typeof input.plan_hash === 'string' ? input.plan_hash.trim().toLowerCase() : ''
    if (!/^[0-9a-f]{64}$/.test(h)) return { ok: false, error: `${verb} needs plan_hash — the 64-hex value plan_job_combine replied with.` }
    if (input.confirm_no_undo !== true) return { ok: false, error: `${verb} needs confirm_no_undo: true beside the plan_hash. ${COMBINE_NO_UNDO}` }
    planHash = h
  }
  return { ok: true, p: { action: 'combine', from_job_id: from, to_job_id: to, allow_billed: src.allow_billed === true, different_customers_ok: src.different_customers_ok === true }, target: to, planHash }
}

// ── what moves ───────────────────────────────────────────────────────────────────────────────────────────────────

export type CombineMove = { group: string; what: string; table: string; column: string }

/**
 * The rows a plan counts on the source, by the groups the office names them in — each a table the RPC repoints
 * (20261109160000 holds its newest body). The RPC moves more than these (holds, watchers, caches, pointers with no
 * count worth reading); the plan says so.
 */
export const COMBINE_MOVES: readonly CombineMove[] = [
  { group: 'costs', what: 'parts tallied', table: 'jobs_tally_parts', column: 'job_id' },
  { group: 'costs', what: 'billed materials lines', table: 'jobs_ledger_materials', column: 'job_id' },
  { group: 'costs', what: 'card and bank charges split to the job', table: 'mercury_transaction_job_allocations', column: 'job_id' },
  { group: 'costs', what: 'supply house invoice shares', table: 'supply_house_invoice_job_allocations', column: 'job_id' },
  { group: 'labor', what: 'clock sessions', table: 'clock_sessions', column: 'job_ledger_id' },
  { group: 'labor', what: 'sub labor sheets', table: 'people_labor_jobs', column: 'job_ledger_id' },
  { group: 'labor', what: 'work orders', table: 'step_commitments', column: 'job_id' },
  { group: 'schedule', what: 'schedule blocks', table: 'job_schedule_blocks', column: 'job_id' },
  { group: 'reports and photos', what: 'field reports', table: 'reports', column: 'job_ledger_id' },
  { group: 'reports and photos', what: 'report photos', table: 'report_photos', column: 'job_id' },
  { group: 'reports and photos', what: 'inspections', table: 'inspections', column: 'job_ledger_id' },
  { group: 'reports and photos', what: 'photo notes', table: 'job_photo_notes', column: 'job_id' },
  { group: 'stage lines', what: 'line items (Specific Work)', table: 'jobs_ledger_fixtures', column: 'job_id' },
  { group: 'Materials on site', what: 'cages and boxes', table: 'job_containers', column: 'job_id' },
  { group: 'Materials on site', what: 'ledger presses', table: 'job_material_movements', column: 'job_id' },
  { group: 'Materials on site', what: 'box photos', table: 'job_box_photos', column: 'job_id' },
  { group: 'notes and history', what: 'activity notes', table: 'jobs_ledger_thread_notes', column: 'job_id' },
  { group: 'notes and history', what: 'history lines', table: 'job_activity_events', column: 'job_id' },
  { group: 'notes and history', what: 'status moves', table: 'job_status_events', column: 'job_id' },
  { group: 'messages', what: 'texts, calls, emails and team notes', table: 'messages', column: 'jobs_ledger_id' },
  { group: 'team', what: 'team members', table: 'jobs_ledger_team_members', column: 'job_id' },
  { group: 'money and legal paper', what: 'payment promises', table: 'job_payment_promises', column: 'job_id' },
  { group: 'money and legal paper', what: 'lien notices and affidavits', table: 'job_lien_filings', column: 'job_id' },
  { group: 'money and legal paper', what: 'lien releases', table: 'job_lien_releases', column: 'job_id' },
  { group: 'money and legal paper', what: 'demand letters', table: 'job_demand_letters', column: 'job_id' },
  { group: 'money and legal paper', what: 'Lien desk items', table: 'job_lien_desk_items', column: 'job_id' },
  { group: 'money and legal paper', what: 'agreements', table: 'job_contracts', column: 'job_id' },
  { group: 'money and legal paper', what: 'pay applications', table: 'job_pay_applications', column: 'job_id' },
  { group: 'money and legal paper', what: 'hours statements', table: 'hours_statements', column: 'job_ledger_id' },
  { group: 'money and legal paper', what: 'statements of charges', table: 'job_charge_statements', column: 'job_ledger_id' },
  { group: 'plans', what: 'plan sets', table: 'plan_sets', column: 'job_id' },
  { group: 'estimate', what: 'the estimate that made the job', table: 'estimates', column: 'job_ledger_id' },
]

// ── the world ────────────────────────────────────────────────────────────────────────────────────────────────────

export type JobCombineReads = {
  rows(table: string, query: string): Promise<Json[]>
  /** An exact count of the rows a filter matches, as the dev under RLS. */
  count(table: string, query: string): Promise<number>
}

export type CombineJobRow = {
  id: string
  job_name: string | null
  job_address: string | null
  click_number: string | null
  hcp_number: string | null
  status: string | null
  pct_complete: number | string | null
  revenue: number | string | null
  payments_made: number | string | null
  customer_id: string | null
  customer_name: string | null
  prior_numbers: string[] | null
  updated_at: string | null
}
export const COMBINE_JOB_COLS = 'id,job_name,job_address,click_number,hcp_number,status,pct_complete,revenue,payments_made,customer_id,customer_name,prior_numbers,updated_at'

export type CombineSide = {
  job: CombineJobRow | null
  payments: PayRow[]
  invoices: PayInvoiceRow[]
  /** Live work orders straight on the job (no step, no labor job, not cancelled). */
  workOrders: Array<{ person_id: string | null; display_name: string | null }>
  openAgreements: number
  payApplications: number
  supplyShares: Array<{ invoice_id: string; pct: number | string }>
}
export type CombineCount = CombineMove & { rows: number | null; held?: string }
export type JobCombineWorld = { source: CombineSide; target: CombineSide; collectFlows: number; counts: CombineCount[] }

async function readSide(reads: JobCombineReads, jobId: string): Promise<CombineSide> {
  const [jobs, payments, invoices, orders, agreements, apps, shares] = await Promise.all([
    reads.rows('jobs_ledger', `select=${COMBINE_JOB_COLS}&id=eq.${jobId}`),
    reads.rows('jobs_ledger_payments', `select=${PAY_ROW_COLS}&job_id=eq.${jobId}&order=sequence_order.asc,id.asc&limit=200`),
    reads.rows('jobs_ledger_invoices', `select=${PAY_INVOICE_COLS}&job_id=eq.${jobId}&order=sequence_order.asc&limit=200`),
    reads.rows('step_commitments', `select=person_id,display_name&job_id=eq.${jobId}&step_id=is.null&labor_job_id=is.null&status=neq.cancelled&limit=200`),
    reads.count('job_contracts', `job_id=eq.${jobId}&status=in.(draft,sent)`),
    reads.count('job_pay_applications', `job_id=eq.${jobId}&deleted_at=is.null`),
    reads.rows('supply_house_invoice_job_allocations', `select=invoice_id,pct&job_id=eq.${jobId}&limit=200`),
  ])
  return {
    job: (jobs[0] as CombineJobRow | undefined) ?? null,
    payments: payments as PayRow[],
    invoices: invoices as PayInvoiceRow[],
    workOrders: orders as CombineSide['workOrders'],
    openAgreements: agreements,
    payApplications: apps,
    supplyShares: shares as CombineSide['supplyShares'],
  }
}

/** Both jobs as the dev reads them, and a count of every table in COMBINE_MOVES on the source; a count that fails takes only itself out. */
export async function readJobCombineWorld(reads: JobCombineReads, p: JobCombinePayload): Promise<JobCombineWorld> {
  const [source, target] = await Promise.all([readSide(reads, p.from_job_id), readSide(reads, p.to_job_id)])
  if (!source.job || !target.job) return { source, target, collectFlows: 0, counts: [] }
  const collectFlows = await reads.count('job_collect_payment_flows', `job_id=eq.${p.from_job_id}`)
  const counts: CombineCount[] = []
  for (let i = 0; i < COMBINE_MOVES.length; i += 8) {
    const batch = COMBINE_MOVES.slice(i, i + 8)
    counts.push(
      ...(await Promise.all(
        batch.map(async (m): Promise<CombineCount> => {
          try {
            return { ...m, rows: await reads.count(m.table, `${m.column}=eq.${p.from_job_id}`) }
          } catch (e) {
            return { ...m, rows: null, held: e instanceof Error ? e.message : String(e) }
          }
        }),
      )),
    )
  }
  return { source, target, collectFlows, counts }
}

// ── the dry run ──────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The target's prior numbers after the combine, as the RPC writes them: its own, then the source's HCP #, its C# and
 * the prior numbers the source carried itself, each once, in that order.
 */
export function priorNumbersAfter(source: Pick<CombineJobRow, 'hcp_number' | 'click_number' | 'prior_numbers'>, target: Pick<CombineJobRow, 'prior_numbers'>): string[] {
  const all = [...(target.prior_numbers ?? []), ...(has(source.hcp_number) ? [`HCP ${source.hcp_number!.trim()}`] : []), ...(has(source.click_number) ? [`C# ${source.click_number!.trim()}`] : []), ...(source.prior_numbers ?? [])]
  return all.filter((n, i) => typeof n === 'string' && n !== '' && all.indexOf(n) === i)
}

const paidOf = (side: CombineSide): number => side.payments.reduce((s, r) => s + cents(r.amount), 0)
const dayOf = (r: PayRow): string => (r.paid_on ? String(r.paid_on).slice(0, 10) : 'no date')
const backedWords = (r: PayRow): string => (has(r.mercury_transaction_id) ? 'a bank row behind it' : has(r.payment_type) || has(r.reference_number) ? `typed as ${[r.payment_type, r.reference_number].filter((x) => has(x)).join(' ')}, no bank row` : 'no bank row, no type, no reference')

/** A source payment the target also holds: the same amount to the cent. One deposit, two rows. */
export function paymentsOnBoth(source: readonly PayRow[], target: readonly PayRow[]): Array<{ source: PayRow; target: PayRow }> {
  const left = [...target]
  const out: Array<{ source: PayRow; target: PayRow }> = []
  for (const s of source) {
    const i = left.findIndex((t) => cents(t.amount) === cents(s.amount))
    if (i >= 0) out.push({ source: s, target: left.splice(i, 1)[0]! })
  }
  return out
}

function sideCard(side: CombineSide): Json {
  const job = side.job!
  const total = cents(job.revenue)
  const paid = paidOf(side)
  return {
    id: job.id,
    label: payJobLabel(job),
    job_name: job.job_name,
    job_address: job.job_address,
    customer: job.customer_name,
    status: job.status,
    status_words: `${jobStatusWords(job.status)}${job.pct_complete != null ? ` at ${Number(job.pct_complete)}%` : ''}`,
    job_total: total / 100,
    paid: paid / 100,
    balance: (total - paid) / 100,
    payments: side.payments.map(paymentLine),
    bills: side.invoices.map((i) => ({ id: i.id, amount: cents(i.amount) / 100, status: i.status, on_stripe: has(i.stripe_invoice_id) })),
    prior_numbers: job.prior_numbers ?? [],
    updated_at: job.updated_at,
  }
}

export type CombineStop = { code: string; words: string; fix: string }
export type DryRun = { ok: true; reply: Json } | { ok: false; refused: string }

const PROGRESS_RANK: Record<string, number> = { waiting: 0, working: 1, ready_to_bill: 2, billed: 3, paid: 4 }

/**
 * What the plan says and what the hash commits to: both jobs as they read, what would move, the target after, the
 * numbers kept, every reason the combine would stop and every warning. A plan with stops still answers, so all the
 * reasons are read at once; apply refuses while one stands.
 */
export function jobCombineDryRun(p: JobCombinePayload, world: JobCombineWorld): DryRun {
  if (!world.source.job) return { ok: false, refused: `No job ${p.from_job_id} is visible to you — find_job resolves a number or a name.` }
  if (!world.target.job) return { ok: false, refused: `No job ${p.to_job_id} is visible to you — find_job resolves a number or a name.` }
  const s = world.source.job
  const t = world.target.job
  const sLabel = payJobLabel(s)
  const tLabel = payJobLabel(t)
  const sPaid = paidOf(world.source)
  const tPaid = paidOf(world.target)
  const sTotal = cents(s.revenue)
  const tTotal = cents(t.revenue)
  const stops: CombineStop[] = []
  const warnings: string[] = []
  const twins = paymentsOnBoth(world.source.payments, world.target.payments)
  const twinWords = twins.map((w) => `${sLabel}'s ${paymentDollars(cents(w.source.amount))} payment dated ${dayOf(w.source)} (${backedWords(w.source)}, id ${w.source.id}) matches ${tLabel}'s ${paymentDollars(cents(w.target.amount))} payment dated ${dayOf(w.target)} (${backedWords(w.target)})`)

  // The RPC's billing guard, in its order, each named — it answers with the first only.
  if (!p.allow_billed) {
    if (s.status !== 'working' && s.status !== 'ready_to_bill') stops.push({ code: 'source_status', words: `${sLabel} is at ${jobStatusWords(s.status)}. The Combine tab takes a source at Working or Ready to bill only.`, fix: 'plan_job_update moves the status back one step at a time, once its bills and payments are off; or allow_billed: true, which deletes the source\'s bills and payments with it.' })
    if (cents(s.payments_made) !== 0 || world.source.payments.length > 0) stops.push({ code: 'source_payments', words: `${sLabel} carries ${world.source.payments.length} payment ${world.source.payments.length === 1 ? 'row' : 'rows'}, ${paymentDollars(sPaid)} in all. The Combine tab refuses a source with a recorded payment.`, fix: 'plan_job_payment { action: \'remove\' } takes off a row no deposit stands behind; a real payment is moved to the target in the app (the payment row\'s Move), which the seat has no verb for.' })
    if (world.source.invoices.length > 0) stops.push({ code: 'source_bills', words: `${sLabel} carries ${world.source.invoices.length} ${world.source.invoices.length === 1 ? 'bill' : 'bills'}. The Combine tab refuses a source with a bill.`, fix: 'Remove or void the bill in the app first; the seat has no verb for it.' })
    if (world.collectFlows > 0) stops.push({ code: 'source_collect_flow', words: `${sLabel} has an in-app collect payment flow.`, fix: 'Finish or cancel it in the app first.' })
  } else {
    const banked = world.source.payments.filter((r) => has(r.mercury_transaction_id))
    if (banked.length) stops.push({ code: 'source_banked_payment', words: `${sLabel} carries ${banked.length === 1 ? 'a payment' : `${banked.length} payments`} with a bank row behind ${banked.length === 1 ? 'it' : 'them'} (${banked.map((r) => `${paymentDollars(cents(r.amount))} dated ${dayOf(r)}`).join('; ')}). With allow_billed the source's payments are deleted with it, and a real deposit would lose the job it paid.`, fix: 'Move the payment to the target in the app (the payment row\'s Move), or remove it with plan_job_payment { action: \'remove\', unlink_bank: true } and record it on the target.' })
    const hosted = world.source.invoices.filter((i) => has(i.stripe_invoice_id))
    if (hosted.length) stops.push({ code: 'source_stripe_bill', words: `${sLabel} carries ${hosted.length === 1 ? 'a bill' : `${hosted.length} bills`} Stripe hosts. With allow_billed the row would be deleted here while the bill stands in Stripe with its pay link.`, fix: 'Void the bill through the app first.' })
  }
  if (twins.length && !p.allow_billed) stops.push({ code: 'payment_on_both', words: `${twinWords.join('; ')}. One deposit, two rows: both jobs read paid for the same money.`, fix: `Read which row has the bank row behind it, then remove the other with plan_job_payment { action: 'remove', payment_id, reason } and plan the combine again.` })

  // The three collisions and the overflow the RPC holds on.
  const tOrders = new Set(world.target.workOrders.map((o) => o.person_id).filter(Boolean))
  const both = [...new Set(world.source.workOrders.filter((o) => o.person_id && tOrders.has(o.person_id)).map((o) => (o.display_name ?? '').trim() || 'a sub'))].sort()
  if (both.length) stops.push({ code: 'work_order_collision', words: `Both jobs hold a live work order for ${both.join(', ')}.`, fix: 'Cancel one of them in the app, then plan again.' })
  if (world.source.openAgreements > 0 && world.target.openAgreements > 0) stops.push({ code: 'agreement_collision', words: 'Both jobs hold an open agreement.', fix: 'Void one of them in the app, then plan again.' })
  if (world.source.payApplications > 0 && world.target.payApplications > 0) stops.push({ code: 'pay_application_collision', words: 'Both jobs hold pay applications.', fix: 'Delete one job\'s applications in the app, then plan again.' })
  const over = world.source.supplyShares.filter((a) => world.target.supplyShares.some((b) => b.invoice_id === a.invoice_id && Number(a.pct) + Number(b.pct) > 100))
  if (over.length) stops.push({ code: 'supply_alloc_overflow', words: `Merging the supply house invoice shares would pass 100% on ${over.length === 1 ? 'one invoice' : `${over.length} invoices`} (${over.map((a) => a.invoice_id).join(', ')}).`, fix: 'Lower one job\'s share of that invoice in the app, then plan again.' })

  // The seat's own hold: the screen lets two customers combine without a word.
  if (s.customer_id && t.customer_id && s.customer_id !== t.customer_id && !p.different_customers_ok) {
    stops.push({ code: 'different_customers', words: `${sLabel} is on ${s.customer_name ?? 'one customer'} and ${tLabel} on ${t.customer_name ?? 'another'}. The combined job keeps the target's customer.`, fix: 'Pass different_customers_ok: true when that is meant.' })
  }

  if (twins.length && p.allow_billed) warnings.push(`${twinWords.join('; ')}. With allow_billed the source's rows are deleted with it, so ${tLabel}'s paid figure stays ${paymentDollars(tPaid)}.`)
  if (p.allow_billed && (world.source.payments.length || world.source.invoices.length)) warnings.push(`allow_billed: ${sLabel}'s ${world.source.payments.length} payment ${world.source.payments.length === 1 ? 'row' : 'rows'} (${paymentDollars(sPaid)}) and ${world.source.invoices.length} ${world.source.invoices.length === 1 ? 'bill' : 'bills'} are deleted with it. They do not move to ${tLabel}.`)
  if (sTotal > 0) {
    warnings.push(
      sTotal === tTotal
        ? `Both jobs carry the same job total, ${paymentDollars(sTotal)}. The combine adds them: ${tLabel} would read ${paymentDollars(tTotal + sTotal)} against ${paymentDollars(tPaid)} paid. If this is one job entered twice the total doubles; zero the source's line items and total first, or correct the target's after.`
        : `The combine adds ${sLabel}'s job total to ${tLabel}'s: ${paymentDollars(tTotal)} + ${paymentDollars(sTotal)} = ${paymentDollars(tTotal + sTotal)}. Its line items move too, and Edit Job works the total out from the lines.`,
    )
  }
  const sRank = PROGRESS_RANK[s.status ?? ''] ?? -1
  const tRank = PROGRESS_RANK[t.status ?? ''] ?? -1
  if (sRank > tRank || (sRank === tRank && Number(s.pct_complete ?? 0) > Number(t.pct_complete ?? 0))) {
    warnings.push(`${sLabel} is further along (${jobStatusWords(s.status)}${s.pct_complete != null ? ` at ${Number(s.pct_complete)}%` : ''}) than ${tLabel} (${jobStatusWords(t.status)}${t.pct_complete != null ? ` at ${Number(t.pct_complete)}%` : ''}). Combining never changes the target's status or % done; the note on its activity keeps the source's.`)
  }
  if (s.customer_id && t.customer_id && s.customer_id !== t.customer_id && p.different_customers_ok) warnings.push(`The two jobs are on different customers; the combined job stays on ${t.customer_name ?? 'the target\'s'}.`)

  const moving = world.counts.filter((c) => (c.rows ?? 0) > 0)
  const boxPhotos = world.counts.find((c) => c.table === 'job_box_photos')?.rows ?? 0
  const priorAfter = priorNumbersAfter(s, t)
  const kept = priorAfter.filter((n) => !(t.prior_numbers ?? []).includes(n))
  return {
    ok: true,
    reply: {
      action: 'combine',
      no_undo: COMBINE_NO_UNDO,
      door: p.allow_billed ? `${COMBINE_RPC} as you with p_allow_billed true — Edit Job's Delete flow, Reassign to another job…` : `${COMBINE_RPC} as you — Pipeline, the tools menu, Combine / Separate…, the Combine tab`,
      source: sideCard(world.source),
      target: sideCard(world.target),
      moves: moving.map((c) => ({ group: c.group, what: c.what, rows: c.rows })),
      moves_words: moving.length
        ? `${moving.reduce((n, c) => n + (c.rows ?? 0), 0)} rows counted across ${moving.length} kinds move to ${tLabel}. The RPC also moves what a count says little about: contact links, holds, watchers, the crew grid, supply house accounts, lien and legal pointers.`
        : `${sLabel} holds none of the rows the plan counts. The RPC still repoints its smaller links (contacts, watchers, holds).`,
      ...(world.counts.some((c) => c.rows === null) ? { could_not_count: world.counts.filter((c) => c.rows === null).map((c) => ({ what: c.what, why: c.held })) } : {}),
      never_moves: p.allow_billed ? 'Bills and payments are deleted with the source. They never move.' : 'Bills and payments never move in a combine; a source that holds either is refused.',
      after: {
        target: {
          label: tLabel,
          job_total: (tTotal + sTotal) / 100,
          paid: tPaid / 100,
          balance: (tTotal + sTotal - tPaid) / 100,
          status: t.status,
          status_words: `${jobStatusWords(t.status)}${t.pct_complete != null ? ` at ${Number(t.pct_complete)}%` : ''}, as it is`,
          prior_numbers: priorAfter,
        },
        source: `${sLabel} is deleted`,
        note_on_activity: `Combined "${s.job_name ?? ''}" (Job #${(s.hcp_number ?? '').trim() || (s.click_number ?? '').trim() || '—'}) into this job — a note in your name on ${tLabel}'s Job activity, with the source's last status`,
      },
      prior_numbers_kept: kept.length ? kept : 'none — the source carries no number the target lacks',
      photos: boxPhotos > 0 ? `${boxPhotos} box ${boxPhotos === 1 ? 'photo' : 'photos'} follow in Drive: after the rows move, photo-save is asked to move the files into ${tLabel}'s photo folder.` : 'No box photos to move in Drive.',
      sends: 'Nothing is sent to anyone.',
      stops,
      ...(warnings.length ? { warnings } : {}),
      can_apply: stops.length === 0,
      apply_with: stops.length === 0 ? 'apply_job_combine with the same combine, this plan_hash and confirm_no_undo: true' : `Nothing to apply yet: ${stops.length} ${stops.length === 1 ? 'reason stops' : 'reasons stop'} it. Put each right, then plan again.`,
    },
  }
}

/** The RPC's body, as the Combine tab sends it; the allow flag only when it is true. */
export function combineRpcBody(p: JobCombinePayload): Json {
  return { p_from: p.from_job_id, p_to: p.to_job_id, ...(p.allow_billed ? { p_allow_billed: true } : {}) }
}

/** How many box photos the plan counted on the source — whether apply asks photo-save to move their files. */
export function combineBoxPhotos(world: JobCombineWorld): number {
  return world.counts.find((c) => c.table === 'job_box_photos')?.rows ?? 0
}

/** The apply's reply. `rpc` is what the RPC answered; `after` is the target read back. */
export function jobCombineAppliedWords(labels: { source: string; target: string }, result: { ok: true; rpc: Json; after: Json | null; photos?: unknown } | { ok: false; error: string }): Json {
  if (!result.ok) return { action: 'combine', ok: false, source: labels.source, target: labels.target, error: result.error, standing: 'Both jobs stand as they were: the RPC moves everything or nothing.' }
  return {
    action: 'combine',
    ok: true,
    source: `${labels.source} is deleted`,
    target: labels.target,
    note_on_activity: typeof result.rpc.note_body === 'string' ? result.rpc.note_body : null,
    ...(result.rpc.estimate_unlinked === true ? { estimate: "The source's estimate stays on the Estimates page on its own — the target already has an estimate of its own." } : {}),
    ...(result.after ? { after: result.after } : {}),
    ...(result.photos !== undefined ? { photos: result.photos } : {}),
    next: `get_job on ${labels.target} shows the combined job. Check its job total and Specific Work: the source's total and lines were added. ${COMBINE_NO_UNDO}`,
  }
}
