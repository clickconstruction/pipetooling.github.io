// A payment on a job from the dev seat (v2.6940 / 0.65.0 — punch list #293's step-by-step; the owner, 2026-11-11:
// "lets add verbs to do it"). The fix it was made for: a job that reads paid from a payment row typed in by hand with
// no deposit behind it, beside the job that holds the real one.
//
// plan_job_payment → apply_job_payment, three actions, each through the door the screen uses, as the dev:
//   remove — remove_jobs_ledger_payment_and_reconcile, the RPC behind the Job window's Remove and Accounts Receivable's
//            Unlink and remove (it writes the payment trace, recomputes the paid figure, flips a bill back to Billed and
//            moves a Paid job that no longer covers its total back to Billed). A reason is required and lands on the
//            job's activity as a note in the dev's name.
//   record — one row into jobs_ledger_payments under RLS, as the Job window's payments table writes it.
//   link   — apply_mercury_bank_payment_allocations with a payment_id allocation, Accounts Receivable's link of a
//            recorded payment to its deposit; a change of type, reference or note is the Job window's own row write.
// No wrapper RPC and no migration: the dry run is this server's read of the job, its payment rows, its bills and the bank
// row, hashed with the payload. Pure: no env reads, no network; the test runs a recording fake
// (src/lib/devMcp/devMcpJobPayment.test.ts).

export const JOB_PAYMENT_VERBS = ['plan_job_payment', 'apply_job_payment'] as const
export type JobPaymentVerb = (typeof JOB_PAYMENT_VERBS)[number]
export function isJobPaymentVerb(name: string): name is JobPaymentVerb {
  return (JOB_PAYMENT_VERBS as readonly string[]).includes(name)
}

/** The RPC behind the Job window's Remove and Accounts Receivable's Unlink and remove. */
export const PAYMENT_REMOVE_RPC = 'remove_jobs_ledger_payment_and_reconcile'
/** The RPC behind Accounts Receivable's apply; a `payment_id` allocation links a recorded payment to its deposit. */
export const PAYMENT_LINK_RPC = 'apply_mercury_bank_payment_allocations'
/** The kinds the Job window's payment line offers (src/lib/jobs/inKindPayment.ts PAYMENT_KIND_CHOICES), but In kind. */
export const PAYMENT_TYPES = ['Cash', 'Check', 'Wire', 'ACH', 'Card (external)', 'Other'] as const

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
const REASON_MAX = 500
const TEXT_MAX = 200

export type Json = Record<string, unknown>
const obj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null)
const cents = (v: unknown): number => Math.round((Number(v) || 0) * 100)
/** $1,234.50 — the words a plan reads back. */
export const paymentDollars = (c: number): string => `${c < 0 ? '-' : ''}$${(Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export type PaymentRemove = { action: 'remove'; payment_id: string; reason: string; unlink_bank?: true }
export type PaymentRecord = { action: 'record'; job_id: string; amount: number; paid_on: string; payment_type?: string; reference_number?: string; note?: string; reason?: string; duplicate_ok?: true }
export type PaymentLink = { action: 'link'; payment_id: string; mercury_transaction_id?: string; payment_type?: string; reference_number?: string; note?: string; reason?: string }
export type JobPaymentPayload = PaymentRemove | PaymentRecord | PaymentLink

export type JobPaymentInput = { ok: true; p: JobPaymentPayload; target: string; planHash: string | null } | { ok: false; error: string }

const SHAPE =
  `needs payment — { action: 'remove', payment_id (a jobs_ledger_payments.id — get_job lists a job's payments), reason (why it comes off, kept on the job's activity, under ${REASON_MAX}), unlink_bank? (true to remove a row that has a bank deposit behind it, as Accounts Receivable's Unlink and remove does) } ` +
  `| { action: 'record', job_id (a jobs_ledger.id — find_job), amount (dollars, more than 0), paid_on (YYYY-MM-DD, never ahead of today), payment_type? (${PAYMENT_TYPES.join(' | ')}), reference_number?, note?, reason?, duplicate_ok? (true when the job really was paid the same amount twice on one day) } ` +
  `| { action: 'link', payment_id, mercury_transaction_id? (a mercury_transactions.id, the bank row that paid it), payment_type?, reference_number?, note?, reason? } — link needs a bank row or one of the three words.`

/** A type as the Job window writes it: the menu's own spelling whatever the case; null when it is not on the menu. */
export function paymentTypeAsWritten(raw: string): string | null {
  const t = raw.trim().toLowerCase()
  return PAYMENT_TYPES.find((k) => k.toLowerCase() === t || (k === 'Card (external)' && (t === 'card' || t === 'card external'))) ?? null
}

/** plan_job_payment / apply_job_payment's input, shaped. `todayYmd` is the app's day: a payment is never recorded ahead of it. */
export function jobPaymentInput(verb: JobPaymentVerb, input: Json, todayYmd: string): JobPaymentInput {
  const src = obj(input.payment)
  const shape = `${verb} ${SHAPE}`
  if (!src) return { ok: false, error: shape }
  const str = (k: string) => (typeof src[k] === 'string' ? (src[k] as string).trim() : '')
  const action = str('action').toLowerCase()
  if (action !== 'remove' && action !== 'record' && action !== 'link') return { ok: false, error: shape }
  const reason = str('reason')
  if (reason.length > REASON_MAX) return { ok: false, error: `${verb}: reason is under ${REASON_MAX} characters.` }
  const words: { payment_type?: string; reference_number?: string; note?: string } = {}
  if (action !== 'remove') {
    const type = str('payment_type')
    if (type) {
      if (/in.?kind/i.test(type)) return { ok: false, error: `${verb}: work paid in kind is recorded from Bill Customer's in kind question, which ties it to the arrangement. The seat has no verb for it.` }
      const written = paymentTypeAsWritten(type)
      if (!written) return { ok: false, error: `${verb}: payment_type is one of ${PAYMENT_TYPES.join(', ')} — the Job window's own list.` }
      words.payment_type = written
    }
    for (const k of ['reference_number', 'note'] as const) {
      const v = str(k)
      if (v.length > TEXT_MAX) return { ok: false, error: `${verb}: ${k} is under ${TEXT_MAX} characters.` }
      if (v) words[k] = v
    }
  }
  let p: JobPaymentPayload
  let target: string
  if (action === 'record') {
    const jobId = str('job_id').toLowerCase()
    if (!UUID_RE.test(jobId)) return { ok: false, error: shape }
    const raw = src.amount
    const n = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\$?[\d,]+(\.\d{1,2})?$/.test(raw.trim()) ? Number(raw.trim().replace(/[$,]/g, '')) : NaN
    if (!Number.isFinite(n) || n <= 0 || n > 99_999_999) return { ok: false, error: `${verb}: amount is dollars received, more than 0. A payment comes off with action remove, never as a negative row.` }
    const paidOn = str('paid_on')
    if (!YMD_RE.test(paidOn) || Number.isNaN(Date.parse(`${paidOn}T12:00:00Z`))) return { ok: false, error: `${verb}: paid_on is YYYY-MM-DD, the day the money was received.` }
    if (paidOn > todayYmd) return { ok: false, error: `${verb}: paid_on ${paidOn} is ahead of today (${todayYmd}). A payment is recorded once it has happened.` }
    p = { action: 'record', job_id: jobId, amount: Math.round(n * 100) / 100, paid_on: paidOn, ...words, ...(reason ? { reason } : {}), ...(src.duplicate_ok === true ? { duplicate_ok: true as const } : {}) }
    target = jobId
  } else {
    const paymentId = str('payment_id').toLowerCase()
    if (!UUID_RE.test(paymentId)) return { ok: false, error: shape }
    target = paymentId
    if (action === 'remove') {
      if (!reason) return { ok: false, error: `${verb}: a remove needs reason — why the payment comes off, in words the office will read on the job's activity.` }
      p = { action: 'remove', payment_id: paymentId, reason, ...(src.unlink_bank === true ? { unlink_bank: true as const } : {}) }
    } else {
      const bank = str('mercury_transaction_id').toLowerCase()
      if (bank && !UUID_RE.test(bank)) return { ok: false, error: `${verb}: mercury_transaction_id is a mercury_transactions.id (read_rows on mercury_transactions finds the deposit by amount and day).` }
      if (!bank && Object.keys(words).length === 0) return { ok: false, error: `${verb}: a link names the bank row (mercury_transaction_id) or changes payment_type, reference_number or note. Nothing to do.` }
      p = { action: 'link', payment_id: paymentId, ...(bank ? { mercury_transaction_id: bank } : {}), ...words, ...(reason ? { reason } : {}) }
    }
  }
  let planHash: string | null = null
  if (verb.startsWith('apply_')) {
    const h = typeof input.plan_hash === 'string' ? input.plan_hash.trim().toLowerCase() : ''
    if (!/^[0-9a-f]{64}$/.test(h)) return { ok: false, error: `${verb} needs plan_hash — the 64-hex value plan_job_payment replied with.` }
    planHash = h
  }
  return { ok: true, p, target, planHash }
}

// ── the world ────────────────────────────────────────────────────────────────────────────────────────────────────

export type JobPaymentReads = { rows(table: string, query: string): Promise<Json[]> }

export type PayJobRow = { id: string; job_name: string | null; click_number: string | null; hcp_number: string | null; status: string | null; revenue: number | string | null; payments_made: number | string | null; updated_at: string | null }
export type PayRow = {
  id: string
  job_id: string
  amount: number | string
  paid_on: string | null
  sent_on: string | null
  note: string | null
  payment_type: string | null
  reference_number: string | null
  invoice_id: string | null
  mercury_transaction_id: string | null
  stripe_credit_note_id: string | null
  sequence_order: number | null
  created_at: string | null
  created_by: string | null
}
export type PayInvoiceRow = { id: string; amount: number | string; status: string; stripe_invoice_id: string | null; stripe_invoice_status: string | null }
export type BankRow = { id: string; amount: number | string; posted_at: string | null; status: string | null; kind: string | null; counterparty_name: string | null }
export type BankUse = { id: string; job_id: string; amount: number | string }

export const PAY_JOB_COLS = 'id,job_name,click_number,hcp_number,status,revenue,payments_made,updated_at'
export const PAY_ROW_COLS = 'id,job_id,amount,paid_on,sent_on,note,payment_type,reference_number,invoice_id,mercury_transaction_id,stripe_credit_note_id,sequence_order,created_at,created_by'
export const PAY_INVOICE_COLS = 'id,amount,status,stripe_invoice_id,stripe_invoice_status'
export const BANK_ROW_COLS = 'id,amount,posted_at,status,kind,counterparty_name'

export type JobPaymentWorld = {
  job: PayJobRow | null
  /** The row a remove or a link names; null for a record, or when RLS shows none. */
  row: PayRow | null
  payments: PayRow[]
  invoices: PayInvoiceRow[]
  /** The bank row behind the named row, or the one a link names. */
  bank: BankRow | null
  bankAsked: string | null
  /** Every payment row already tied to that bank row, on any job. */
  bankUse: BankUse[]
}

export async function readJobPaymentWorld(reads: JobPaymentReads, p: JobPaymentPayload): Promise<JobPaymentWorld> {
  const row = p.action === 'record' ? null : (((await reads.rows('jobs_ledger_payments', `select=${PAY_ROW_COLS}&id=eq.${p.payment_id}`))[0] as PayRow | undefined) ?? null)
  const jobId = p.action === 'record' ? p.job_id : row?.job_id ?? null
  const bankAsked = (p.action === 'link' ? p.mercury_transaction_id : undefined) ?? row?.mercury_transaction_id ?? null
  if (!jobId) return { job: null, row, payments: [], invoices: [], bank: null, bankAsked, bankUse: [] }
  const [jobs, payments, invoices, banks, bankUse] = await Promise.all([
    reads.rows('jobs_ledger', `select=${PAY_JOB_COLS}&id=eq.${jobId}`),
    reads.rows('jobs_ledger_payments', `select=${PAY_ROW_COLS}&job_id=eq.${jobId}&order=sequence_order.asc,id.asc&limit=200`),
    reads.rows('jobs_ledger_invoices', `select=${PAY_INVOICE_COLS}&job_id=eq.${jobId}&order=sequence_order.asc&limit=200`),
    bankAsked ? reads.rows('mercury_transactions', `select=${BANK_ROW_COLS}&id=eq.${bankAsked}`) : Promise.resolve([]),
    bankAsked ? reads.rows('jobs_ledger_payments', `select=id,job_id,amount&mercury_transaction_id=eq.${bankAsked}&limit=200`) : Promise.resolve([]),
  ])
  return { job: (jobs[0] as PayJobRow | undefined) ?? null, row, payments: payments as PayRow[], invoices: invoices as PayInvoiceRow[], bank: (banks[0] as BankRow | undefined) ?? null, bankAsked, bankUse: bankUse as BankUse[] }
}

// ── the words ────────────────────────────────────────────────────────────────────────────────────────────────────

const STATUS_WORDS: Record<string, string> = { waiting: 'Waiting', working: 'Working', ready_to_bill: 'Ready to bill', billed: 'Billed', paid: 'Paid' }
export const jobStatusWords = (s: string | null | undefined): string => STATUS_WORDS[s ?? ''] ?? (s ?? 'no status')

export const payJobLabel = (job: Pick<PayJobRow, 'click_number' | 'hcp_number' | 'job_name'>): string => {
  const n = (job.click_number ?? '').trim() || (job.hcp_number ?? '').trim()
  if (n) return /^\d+$/.test(n) ? `JP${n}` : n
  return (job.job_name ?? '').trim() || 'this job'
}

const has = (v: string | null | undefined): boolean => (v ?? '').trim().length > 0

/** What stands behind a payment row, in words: the bank row, else the type and reference typed, else nothing. */
export function paymentBackingWords(row: Pick<PayRow, 'mercury_transaction_id' | 'payment_type' | 'reference_number' | 'invoice_id'>, bank: BankRow | null): string {
  if (has(row.mercury_transaction_id)) {
    if (!bank) return 'a bank row is tied to it, which this account could not read'
    const posted = (bank.posted_at ?? '').slice(0, 10)
    return `a bank deposit stands behind it: ${paymentDollars(Math.abs(cents(bank.amount)))}${posted ? ` posted ${posted}` : ''}${has(bank.counterparty_name) ? ` from ${bank.counterparty_name!.trim()}` : ''}${(bank.status ?? '') === 'failed' ? ', which the bank returned' : ''}`
  }
  const typed = [has(row.payment_type) ? row.payment_type!.trim() : '', has(row.reference_number) ? `reference ${row.reference_number!.trim()}` : ''].filter(Boolean)
  if (typed.length) return `no bank row is tied to it; it was typed as ${typed.join(', ')}`
  return 'nothing stands behind it: no bank row, no type and no reference'
}

/** One payment row as a plan lists it. */
export function paymentLine(row: PayRow): Json {
  return {
    id: row.id,
    amount: cents(row.amount) / 100,
    paid_on: row.paid_on ? String(row.paid_on).slice(0, 10) : null,
    payment_type: has(row.payment_type) ? row.payment_type : null,
    reference_number: has(row.reference_number) ? row.reference_number : null,
    note: has(row.note) ? row.note : null,
    bank_row: row.mercury_transaction_id ?? null,
    on_bill: row.invoice_id ?? null,
    typed_in_on: row.created_at ? String(row.created_at).slice(0, 10) : null,
  }
}

const rowWords = (row: PayRow): string =>
  `${paymentDollars(cents(row.amount))}${row.paid_on ? ` dated ${String(row.paid_on).slice(0, 10)}` : ' with no date'}${has(row.payment_type) ? `, ${row.payment_type!.trim()}` : ''}${has(row.reference_number) ? `, reference ${row.reference_number!.trim()}` : ''}`

/**
 * Why Stripe holds a row, in the remove RPC's own words; null when nothing stands in the way. A row Stripe wrote
 * itself (its note reads Stripe) is refused here too: its door is Stripe's.
 */
export function stripeHoldsRow(row: PayRow, invoices: readonly PayInvoiceRow[]): string | null {
  if (has(row.stripe_credit_note_id)) return 'This part payment sits on the Stripe bill as a credit note — the row\'s Undo part payment in the app reverses it. The seat has no verb for that.'
  const inv = row.invoice_id ? invoices.find((i) => i.id === row.invoice_id) : undefined
  if (inv && has(inv.stripe_invoice_id) && (inv.stripe_invoice_status ?? '').trim() === 'paid') return 'This bill is marked paid in Stripe — unwind the out-of-band payment on the bill in the app first. The seat has no verb for that.'
  if ((row.note ?? '').trim().toLowerCase() === 'stripe') return 'Stripe recorded this payment itself. It leaves through Stripe\'s own doors in the app (a refund, an unwind), never through the seat.'
  return null
}

export type DryRun = { ok: true; reply: Json } | { ok: false; refused: string }

function jobCard(job: PayJobRow, paidCents: number): Json {
  const total = cents(job.revenue)
  return { id: job.id, label: payJobLabel(job), status: job.status, status_words: jobStatusWords(job.status), job_total: total / 100, paid: paidCents / 100, balance: (total - paidCents) / 100, updated_at: job.updated_at }
}

/** The line apply leaves on the job's Job activity / notes; null when a record or a word change carries no reason. */
export function paymentNoteBody(p: JobPaymentPayload, world: JobPaymentWorld): string | null {
  if (p.action === 'remove' && world.row) return `Payment removed: ${rowWords(world.row)} (${paymentBackingWords(world.row, world.bank)}). Reason: ${p.reason}`
  if (p.action === 'record') return p.reason ? `Payment recorded: ${paymentDollars(cents(p.amount))} dated ${p.paid_on}${p.payment_type ? `, ${p.payment_type}` : ''}${p.reference_number ? `, reference ${p.reference_number}` : ''}. Reason: ${p.reason}` : null
  if (p.action === 'link' && world.row) {
    if (p.mercury_transaction_id && world.bank) {
      const posted = (world.bank.posted_at ?? '').slice(0, 10)
      return `Payment of ${rowWords(world.row)} tied to the bank deposit of ${paymentDollars(Math.abs(cents(world.bank.amount)))}${posted ? ` posted ${posted}` : ''}${has(world.bank.counterparty_name) ? ` from ${world.bank.counterparty_name!.trim()}` : ''}.${p.reason ? ` Reason: ${p.reason}` : ''}`
    }
    return p.reason ? `Payment of ${rowWords(world.row)} changed: ${linkWordChanges(p, world.row).join(', ')}. Reason: ${p.reason}` : null
  }
  return null
}

function linkWordChanges(p: PaymentLink, row: PayRow): string[] {
  const out: string[] = []
  for (const k of ['payment_type', 'reference_number', 'note'] as const) {
    if (p[k] !== undefined && (row[k] ?? '').trim() !== p[k]) out.push(`${k.replace('_', ' ')} ${has(row[k]) ? `${row[k]!.trim()} → ` : 'set to '}${p[k]}`)
  }
  return out
}

/** The row a record inserts, as the Job window's payments table writes one (paymentInsertRows), after the job's last. */
export function paymentInsertRow(p: PaymentRecord, world: JobPaymentWorld): Json {
  const next = world.payments.reduce((m, r) => Math.max(m, Number(r.sequence_order ?? -1)), -1) + 1
  return { job_id: p.job_id, amount: p.amount, sequence_order: next, paid_on: p.paid_on, sent_on: null, note: p.note ?? null, payment_type: p.payment_type ?? null, reference_number: p.reference_number ?? null, invoice_id: null, mercury_transaction_id: null }
}

/** The columns a link's word change writes on the row; empty when the link only ties the bank row. */
export function paymentWordsPatch(p: PaymentLink, row: PayRow): Json {
  const patch: Json = {}
  for (const k of ['payment_type', 'reference_number', 'note'] as const) if (p[k] !== undefined && (row[k] ?? '').trim() !== p[k]) patch[k] = p[k]
  return patch
}

/** Accounts Receivable's apply, with the one allocation that links a recorded payment (never a Stripe-hosted bill). */
export function paymentLinkRpcBody(p: PaymentLink, row: PayRow): Json {
  return { p_mercury_transaction_id: p.mercury_transaction_id, p_paid_on: row.paid_on ? String(row.paid_on).slice(0, 10) : null, p_payment_type: '', p_note: '', p_allocations: [{ payment_id: row.id }], p_allow_stripe_hosted: false }
}

const NOTHING_SENT = 'Nothing goes to the customer: no receipt, no email, no text.'

/**
 * What the plan says and what the hash commits to: the job as it stands with every payment row on it, the row named,
 * what stands behind it, the paid figure and the status as they would read after, and what the write sets off.
 */
export function jobPaymentDryRun(p: JobPaymentPayload, world: JobPaymentWorld): DryRun {
  if (p.action !== 'record' && !world.row) return { ok: false, refused: `No payment ${p.payment_id} is visible to you — get_job lists a job's payments with their ids.` }
  if (!world.job) return { ok: false, refused: p.action === 'record' ? `No job ${p.job_id} is visible to you — find_job resolves a number or a name.` : 'The job this payment is on is not visible to you.' }
  const job = world.job
  const label = payJobLabel(job)
  const paidNow = world.payments.reduce((s, r) => s + cents(r.amount), 0)
  const total = cents(job.revenue)
  const base = { action: p.action, job: jobCard(job, paidNow), payments: world.payments.map(paymentLine) }
  const noteBody = paymentNoteBody(p, world)
  const noteWords = noteBody ? { note_on_activity: noteBody, note_shows: `${label}'s Job activity / notes, as a note by you` } : { note_on_activity: null }

  if (p.action === 'remove') {
    const row = world.row!
    const held = stripeHoldsRow(row, world.invoices)
    if (held) return { ok: false, refused: held }
    const banked = has(row.mercury_transaction_id)
    if (banked && !p.unlink_bank) {
      return { ok: false, refused: `This payment of ${rowWords(row)} on ${label} is tied to a bank row: ${paymentBackingWords(row, world.bank)}. Edit Job refuses to remove it; Accounts Receivable's Unlink and remove is the press, which frees the deposit to be matched again. Pass unlink_bank: true to do that here.` }
    }
    const paidAfter = paidNow - cents(row.amount)
    const backToBilled = job.status === 'paid' && total > paidAfter + 1
    const inv = row.invoice_id ? world.invoices.find((i) => i.id === row.invoice_id) : undefined
    const onBillAfter = inv ? world.payments.filter((r) => r.invoice_id === inv.id && r.id !== row.id).reduce((s, r) => s + cents(r.amount), 0) : 0
    const billAfter = inv ? (onBillAfter >= cents(inv.amount) ? (inv.status === 'billed' ? 'paid' : inv.status) : inv.status === 'paid' ? 'billed' : inv.status) : null
    const bankFailed = banked && (world.bank?.status ?? '') === 'failed'
    return {
      ok: true,
      reply: {
        ...base,
        removes: { ...paymentLine(row), backing: paymentBackingWords(row, world.bank) },
        after: {
          paid: paidAfter / 100,
          balance: (total - paidAfter) / 100,
          status: backToBilled ? 'billed' : job.status,
          status_words: backToBilled ? `Billed — ${label} reads Paid today and would no longer cover its total, so the RPC moves it back` : `${jobStatusWords(job.status)}, as it is`,
          ...(inv ? { bill: { id: inv.id, status_now: inv.status, status_after: billAfter } } : {}),
        },
        door: `${PAYMENT_REMOVE_RPC} as you — the Job window's Remove${banked ? " and Accounts Receivable's Unlink and remove" : ''}`,
        sets_off: [
          'the job\'s paid figure is worked out again from the rows left',
          'the payment trace (jobs_ledger_payment_events) keeps a removed row with the amount, the day and your name',
          'the job\'s history gets a payment removed line',
          ...(banked ? [bankFailed ? 'the bank returned this deposit, so it is marked returned in Accounts Receivable and never lists in To match again' : 'the bank deposit is free in Accounts Receivable again, to be matched to the job it paid'] : []),
          ...(backToBilled ? ['the job moves from Paid back to Billed through update_job_status'] : []),
        ],
        sends: NOTHING_SENT,
        ...noteWords,
        no_undo: 'A removed row is not restored. To put a payment back, record it again (action record) and tie it to its bank row (action link).',
      },
    }
  }

  if (p.action === 'record') {
    const amount = cents(p.amount)
    const twin = world.payments.find((r) => cents(r.amount) === amount && String(r.paid_on ?? '').slice(0, 10) === p.paid_on)
    if (twin && !p.duplicate_ok) return { ok: false, refused: `${label} already holds a payment of ${rowWords(twin)} (${twin.id}). A second row for the same money counts it twice. To tie that row to its bank row use action link; pass duplicate_ok: true only when the job was paid the same amount twice that day.` }
    const paidAfter = paidNow + amount
    const row = paymentInsertRow(p, world)
    const warnings: string[] = []
    if (total > 0 && paidAfter > total + 1) warnings.push(`The paid figure would pass the job total by ${paymentDollars(paidAfter - total)}.`)
    if (!p.payment_type && !p.reference_number) warnings.push('This row would carry no type and no reference: nothing on it would say where the money came from. Name the type and the reference, then tie it to its bank row with action link.')
    return {
      ok: true,
      reply: {
        ...base,
        records: { ...row, backing: 'no bank row yet — tie it with action link once the deposit is in mercury_transactions' },
        after: {
          paid: paidAfter / 100,
          balance: (total - paidAfter) / 100,
          status: job.status,
          status_words: `${jobStatusWords(job.status)}, as it is — a payment typed on the Job window moves no status${total > 0 && paidAfter >= total && job.status === 'billed' ? '; the total is covered, so plan_job_update can move it to Paid' : ''}`,
        },
        door: 'one row into jobs_ledger_payments as you, under the Job window\'s own RLS',
        sets_off: [
          'the job\'s paid figure is worked out again from the rows',
          'the job\'s history gets a Payment line in your name',
          'the office\'s payment email is queued for its recipient list (the same email a payment typed on the Job window queues)',
          ...(p.payment_type === 'Check' ? ['a check with no deposit tied to it opens a case in Accounts Receivable after the unbanked-check days pass'] : []),
        ],
        sends: `${NOTHING_SENT} The office's own payment email goes to the people on its list.`,
        ...noteWords,
        ...(warnings.length ? { warnings } : {}),
      },
    }
  }

  // link
  const row = world.row!
  const held = stripeHoldsRow(row, world.invoices)
  if (held) return { ok: false, refused: held }
  const patch = paymentWordsPatch(p, row)
  const warnings: string[] = []
  let ties: Json | null = null
  if (p.mercury_transaction_id) {
    if (has(row.mercury_transaction_id)) {
      return { ok: false, refused: row.mercury_transaction_id === p.mercury_transaction_id ? `This payment is already tied to that bank row. Nothing to link.` : `This payment is already tied to another bank row (${row.mercury_transaction_id}): ${paymentBackingWords(row, world.bank)}. Remove it with unlink_bank: true and record it again to tie it elsewhere.` }
    }
    const inv = row.invoice_id ? world.invoices.find((i) => i.id === row.invoice_id) : undefined
    if (inv && has(inv.stripe_invoice_id)) return { ok: false, refused: 'This payment sits on a bill Stripe hosts. Accounts Receivable links it only behind its out-of-band confirmation in the app; the seat does not.' }
    if (cents(row.amount) <= 0) return { ok: false, refused: 'A recorded payment needs a positive amount before it can be tied to a deposit.' }
    const bank = world.bank
    if (!bank) return { ok: false, refused: `No bank row ${p.mercury_transaction_id} is visible to you — read_rows on mercury_transactions finds a deposit by its amount and day.` }
    if (cents(bank.amount) <= 0) return { ok: false, refused: `That bank row is ${paymentDollars(cents(bank.amount))}: money out, not a deposit.` }
    if ((bank.status ?? '') === 'failed') return { ok: false, refused: 'The bank returned that deposit. A returned deposit cannot pay a job.' }
    const used = world.bankUse.filter((u) => u.id !== row.id).reduce((s, u) => s + cents(u.amount), 0)
    const left = cents(bank.amount) - used
    if (cents(row.amount) > left + 1) {
      return { ok: false, refused: `That deposit is ${paymentDollars(cents(bank.amount))} and ${paymentDollars(used)} of it already pays ${world.bankUse.length === 1 ? 'another payment row' : `${world.bankUse.length} payment rows`} (${world.bankUse.map((u) => u.id).join(', ')}); ${paymentDollars(Math.max(left, 0))} is left, less than this payment's ${paymentDollars(cents(row.amount))}. One deposit pays once: if the other row is the duplicate, remove it first.` }
    }
    const posted = (bank.posted_at ?? '').slice(0, 10)
    const paidOn = String(row.paid_on ?? '').slice(0, 10)
    if (cents(row.amount) !== cents(bank.amount)) warnings.push(`The deposit is ${paymentDollars(cents(bank.amount))} and the payment ${paymentDollars(cents(row.amount))}: the deposit keeps ${paymentDollars(left - cents(row.amount))} to match elsewhere.`)
    if (posted && paidOn && Math.abs(Date.parse(`${posted}T12:00:00Z`) - Date.parse(`${paidOn}T12:00:00Z`)) > 10 * 86_400_000) warnings.push(`The deposit posted ${posted} and the payment is dated ${paidOn}, more than ten days apart. The link leaves the payment's date as it is.`)
    ties = { bank_row: { id: bank.id, amount: cents(bank.amount) / 100, posted_on: posted || null, kind: bank.kind, from: bank.counterparty_name, status: bank.status }, left_on_the_deposit_after: (left - cents(row.amount)) / 100 }
  }
  if (!ties && Object.keys(patch).length === 0) return { ok: false, refused: `That payment already reads that way. Nothing to change.` }
  return {
    ok: true,
    reply: {
      ...base,
      changes: { ...paymentLine(row), backing: paymentBackingWords(row, has(row.mercury_transaction_id) ? world.bank : null) },
      ...(ties ? { ties } : {}),
      ...(Object.keys(patch).length ? { words_after: patch } : {}),
      after: { paid: paidNow / 100, balance: (total - paidNow) / 100, status: job.status, status_words: `${jobStatusWords(job.status)}, as it is — a link moves no money and no status` },
      door: [Object.keys(patch).length ? 'the row\'s words written on jobs_ledger_payments as you, under the Job window\'s own RLS' : '', ties ? `${PAYMENT_LINK_RPC} as you with the one payment_id allocation — Accounts Receivable's link of a recorded payment` : ''].filter(Boolean).join('; then '),
      sets_off: ties
        ? [
            'the row is stamped with when it was linked and by you',
            ...(has(row.reference_number) || patch.reference_number ? [] : ['the row\'s reference becomes the bank\'s own id for the deposit, as it had none']),
            'the deposit leaves Accounts Receivable\'s To match by this amount',
            'the deposit is labelled Income in Banking when that switch is on and nothing labelled it',
            'an open unbanked-check case on this payment closes',
          ]
        : ['nothing beyond the row itself'],
      sends: NOTHING_SENT,
      ...noteWords,
      ...(warnings.length ? { warnings } : {}),
    },
  }
}

/** The apply's reply. `after` is the job read back. */
export function jobPaymentAppliedWords(p: JobPaymentPayload, label: string, result: { ok: true; detail: Json; after: { paid: number | null; status: string | null } | null; note: { id: string } | { error: string } | null } | { ok: false; error: string }): Json {
  if (!result.ok) return { action: p.action, job: label, ok: false, error: result.error }
  const after = result.after ? { paid: result.after.paid, status: result.after.status, status_words: jobStatusWords(result.after.status) } : null
  const note = result.note === null ? null : 'id' in result.note ? { written: true, id: result.note.id } : { written: false, why: result.note.error, next: 'the change itself landed; plan_activity_note leaves the reason by hand' }
  const next =
    p.action === 'remove'
      ? `${label} no longer carries that payment. get_job shows the rows left${after ? ` and the paid figure at ${paymentDollars(cents(after.paid))}` : ''}.`
      : p.action === 'record'
        ? `${label} carries the payment. Tie it to its bank row with plan_job_payment { action: 'link', payment_id, mercury_transaction_id }.`
        : `${label}'s payment reads as planned. get_job shows the row.`
  return { action: p.action, job: label, ok: true, ...result.detail, ...(after ? { after } : {}), ...(note ? { note_on_activity: note } : {}), next }
}
