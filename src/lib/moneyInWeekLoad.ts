import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

/**
 * The Money in bar's reads (punch list #191). Every source reads on its own
 * and fails soft: a source that cannot be read lands in `failed`, and the
 * kernel draws the rest — Stripe being down must not blank the checks.
 *
 * Deposits are read the way the Accounts Receivable window reads them: posted
 * ones through its own list (the org's deposit filter, closed-out and returned
 * deposits left out, what is still unapplied), pending ones from the table
 * with the same filter applied here. What came back is that window's open
 * return cases. The pile (every open bill against its payer's pace) is built
 * with the Collect desk's own kernel, so its GC rules ride along unchanged.
 */
import { withSupabaseRetry } from '../utils/errorHandling'
import { calendarYmdInAppTzFromIso, ymdAddDays } from '../utils/dateUtils'
import { fetchAllRows, fetchAllRowsChunkedIn } from './supabasePaging'
import { parsePaySpeedsRpc, parsePromisedPayDatesRpc } from './jobs/billedExpectedPay'
import { parsePaidClaimsRpc, type PaidClaim } from './jobs/paidClaims'
import { arReturnCaseView, type ArReturnCaseRow } from './jobs/arReturnCase'
import { buildCollectPile } from './bridge/collect/collectPile'
import { collectBillsFromAr, arRowInvoiceId } from './bridge/collect/collectBills'
import { loadCollectDeskReads } from './bridge/collect/loadCollectDesk'
import { fetchBankPaymentsSortingConfigFromAppSettings } from './bankingSortingConfig'
import { moneyInDepositsFromRows, moneyInDepositsSince, moneyInUnlinkedFromRows, returnCaseLivePaymentIds, type MoneyInPendingDepositRow, type MoneyInPostedDepositRow, type MoneyInUnlinkedRow } from './moneyInDeposits'
import { moneyInDepositFilterOf, readOpenReturnCaseRows, readPendingDepositRows, readPostedDepositRows, readUnlinkedPaymentRows } from './moneyInDepositsLoad'
import type { FinancialItem } from './dashboardFinancials'
import { MATCH_LOOKBACK_DAYS, weekMondayContaining, type MoneyInDeposit, type MoneyInPayment, type MoneyInReturn, type MoneyInStripePayout, type MoneyInUnlinkedPayment, type MoneyInWeekInput } from './moneyInWeek'

export type MoneyInSource = 'payments' | 'drawer' | 'bank' | 'returns' | 'pile' | 'claims' | 'stripe'

export type MoneyInWeekLoad = { input: MoneyInWeekInput; failed: MoneyInSource[] }

type PaymentRow = { id: string; job_id: string | null; amount: number | string | null; paid_on: string | null; payment_type: string | null; note: string | null; reference_number: string | null; mercury_transaction_id: string | null }
type PayerJobRow = { id: string; bill_to_party: string | null; customer_id: string | null; gc_customer_id: string | null; customer: { name: string | null } | null; gc: { name: string | null } | null }
type UnlinkedRow = MoneyInUnlinkedRow
type PendingRow = MoneyInPendingDepositRow
type PostedRow = MoneyInPostedDepositRow
type LinkedDepositRow = { id: string; posted_at: string | null; kind: string | null }
type StripeOpenRow = { id: string }

const ymdOf = (iso: string | null): string | null => (iso ? calendarYmdInAppTzFromIso(iso) : null)
const num = (v: number | string | null | undefined): number => Number(v) || 0

/** The payer each job bills: the GC when the job's bills go to the GC, else the customer. */
function payerNamesByJob(jobs: ReadonlyArray<PayerJobRow>): Map<string, string> {
  const out = new Map<string, string>()
  for (const j of jobs) {
    const toGc = j.bill_to_party === 'gc' && j.gc_customer_id
    const name = ((toGc ? j.gc?.name : j.customer?.name) ?? '').trim()
    if (name) out.set(j.id, name)
  }
  return out
}

export async function loadMoneyInWeek(
  db: SupabaseClient<Database>,
  args: { ar: ReadonlyArray<FinancialItem>; collections: ReadonlyArray<FinancialItem>; todayYmd: string },
): Promise<MoneyInWeekLoad> {
  const failed = new Set<MoneyInSource>()
  const todayYmd = args.todayYmd
  const weekMonday = weekMondayContaining(todayYmd) ?? todayYmd
  const lastMonday = ymdAddDays(weekMonday, -7)
  // A payment typed in weeks ago can still reach the bank this week.
  const paymentsSince = ymdAddDays(lastMonday, -21)
  // A deposit can only be a drawer check typed in up to three days after it.
  const depositsSince = moneyInDepositsSince(todayYmd)
  const unlinkedSince = ymdAddDays(weekMonday, -MATCH_LOOKBACK_DAYS)
  const soft = async <T>(source: MoneyInSource, fallback: T, read: () => Promise<T>): Promise<T> => {
    try {
      return await read()
    } catch {
      failed.add(source)
      return fallback
    }
  }

  // The deposit filter first: the posted read takes it as its own filter.
  const sorting = await fetchBankPaymentsSortingConfigFromAppSettings()
  const cfg = sorting.outcome === 'error' ? null : sorting.config
  const filter = moneyInDepositFilterOf(cfg)

  const jobIds = [...new Set([...args.ar, ...args.collections].map((i) => i.jobId).filter((id): id is string => id != null))]
  const invoiceIds = [...new Set([...args.ar, ...args.collections].map((i) => arRowInvoiceId(i.key)).filter((id): id is string => id != null))]

  const [payRows, unlinkedRows, pendingRows, postedRows, caseRows, claims, paySpeeds, promises, deskReads, stripeOpenIds, payout] = await Promise.all([
    soft<PaymentRow[]>('payments', [], async () =>
      fetchAllRows(
        async (from, to) => ({
          data: (await withSupabaseRetry(
            async () =>
              db.from('jobs_ledger_payments').select('id, job_id, amount, paid_on, payment_type, note, reference_number, mercury_transaction_id').gte('paid_on', paymentsSince).order('id').range(from, to),
            'money in payments',
          )) as PaymentRow[] | null,
          error: null,
        }),
        'money in payments',
      ),
    ),
    soft<UnlinkedRow[]>('drawer', [], async () => readUnlinkedPaymentRows(db, unlinkedSince)),
    soft<PendingRow[]>('bank', [], async () => readPendingDepositRows(db)),
    soft<PostedRow[]>('bank', [], async () => readPostedDepositRows(db, cfg, depositsSince)),
    soft<ArReturnCaseRow[]>('returns', [], async () => readOpenReturnCaseRows(db)),
    soft<PaidClaim[] | null>('claims', null, async () => {
      const { data, error } = await db.rpc('list_paid_claims')
      if (error) throw error
      return parsePaidClaimsRpc(data as unknown)
    }),
    soft('pile', null, async () => {
      const { data, error } = await db.rpc('get_billed_customer_pay_speeds' as never)
      if (error) throw error
      return parsePaySpeedsRpc(data as unknown)
    }),
    soft('pile', null, async () => {
      const { data, error } = await db.rpc('list_job_promised_pay_dates' as never)
      if (error) throw error
      return parsePromisedPayDatesRpc(data as unknown)
    }),
    soft('pile', null, async () => loadCollectDeskReads(db, { jobIds, invoiceIds, canReadTouches: false })),
    soft<ReadonlySet<string>>('stripe', new Set<string>(), async () => {
      if (!invoiceIds.length) return new Set<string>()
      const rows = await fetchAllRowsChunkedIn<StripeOpenRow, string>(
        invoiceIds,
        async (chunk, from, to) => ({
          data: (await withSupabaseRetry(
            async () => db.from('jobs_ledger_invoices').select('id').in('id', chunk).not('stripe_invoice_id', 'is', null).eq('stripe_invoice_status', 'open').order('id').range(from, to),
            'money in stripe bills',
          )) as StripeOpenRow[] | null,
          error: null,
        }),
        'money in stripe bills',
      )
      return new Set(rows.map((r) => r.id))
    }),
    soft<MoneyInStripePayout | null>('stripe', null, async () => {
      const { data, error } = await db.functions.invoke('get-stripe-payouts', { body: {} })
      if (error) throw new Error(error.message)
      const b = (data ?? {}) as { error?: unknown; nextPayout?: { usd?: unknown; arrivalYmd?: unknown } | null }
      if (typeof b.error === 'string' && b.error) throw new Error(b.error)
      const p = b.nextPayout
      if (!p || typeof p.usd !== 'number' || !(p.usd > 0)) return null
      return { usd: p.usd, arrivalYmd: typeof p.arrivalYmd === 'string' ? p.arrivalYmd : null }
    }),
  ])

  // The deposit each matched payment sits in, and every payer's name — two reads that need the first ones.
  const linkedIds = [...new Set(payRows.map((p) => p.mercury_transaction_id).filter((id): id is string => id != null))]
  const caseJobIds = caseRows.map((r) => r.last_job?.job_id ?? r.live_payments?.[0]?.job_id ?? r.recorded_payment?.job_id ?? r.stripe_case?.job_id ?? null)
  const nameJobIds = [...new Set([...payRows.map((p) => p.job_id), ...unlinkedRows.map((u) => u.job_id), ...caseJobIds].filter((id): id is string => id != null))]
  const [linkedRows, payerJobs] = await Promise.all([
    soft<LinkedDepositRow[]>('payments', [], async () =>
      linkedIds.length
        ? fetchAllRowsChunkedIn<LinkedDepositRow, string>(
            linkedIds,
            async (chunk, from, to) => ({
              data: (await withSupabaseRetry(async () => db.from('mercury_transactions').select('id, posted_at, kind').in('id', chunk).order('id').range(from, to), 'money in matched deposits')) as LinkedDepositRow[] | null,
              error: null,
            }),
            'money in matched deposits',
          )
        : Promise.resolve([] as LinkedDepositRow[]),
    ),
    soft<PayerJobRow[]>('payments', [], async () =>
      nameJobIds.length
        ? fetchAllRowsChunkedIn<PayerJobRow, string>(
            nameJobIds,
            async (chunk, from, to) => ({
              data: (await withSupabaseRetry(
                async () =>
                  db
                    .from('jobs_ledger')
                    .select('id, bill_to_party, customer_id, gc_customer_id, customer:customers!jobs_ledger_customer_id_fkey(name), gc:customers!jobs_ledger_gc_customer_id_fkey(name)')
                    .in('id', chunk)
                    .order('id')
                    .range(from, to),
                'money in payers',
              )) as unknown as PayerJobRow[] | null,
              error: null,
            }),
            'money in payers',
          )
        : Promise.resolve([] as PayerJobRow[]),
    ),
  ])
  const payerByJob = payerNamesByJob(payerJobs)
  const payerFor = (jobId: string | null, fallback: string | null): string => (jobId ? payerByJob.get(jobId) : undefined) ?? ((fallback ?? '').trim() || 'Unknown payer')

  const linkedDeposits = new Map<string, { postedYmd: string | null; kind: string | null }>()
  for (const r of linkedRows) linkedDeposits.set(r.id, { postedYmd: ymdOf(r.posted_at), kind: r.kind })

  const payments: MoneyInPayment[] = payRows.map((p) => ({
    paymentId: p.id,
    jobId: p.job_id,
    usd: num(p.amount),
    paidOnYmd: (p.paid_on ?? '').slice(0, 10) || null,
    paymentType: p.payment_type,
    note: p.note,
    referenceNumber: p.reference_number,
    payerName: payerFor(p.job_id, null),
    bankTransactionId: p.mercury_transaction_id,
  }))

  const unlinked: MoneyInUnlinkedPayment[] = moneyInUnlinkedFromRows(unlinkedRows, (u) => payerFor(u.job_id, u.job_name))

  const deposits: MoneyInDeposit[] = moneyInDepositsFromRows(pendingRows, postedRows, filter)

  let unbankedCount = 0
  const returns: MoneyInReturn[] = []
  caseRows.forEach((r, i) => {
    if (r.source === 'unbanked') {
      unbankedCount += 1
      return
    }
    try {
      const view = arReturnCaseView({ row: r, trail: [], todayYmd })
      const jobId = caseJobIds[i] ?? null
      returns.push({
        id: r.mercury_transaction_id,
        payerName: view.payer === 'The customer' ? payerFor(jobId, view.payer) : view.payer,
        usd: view.amount,
        cameBackYmd: view.cameBackYmd,
        chip: view.chip.text,
        livePaymentIds: returnCaseLivePaymentIds(r),
        jobId,
      })
    } catch {
      failed.add('returns')
    }
  })

  const bills = collectBillsFromAr({ ar: args.ar, collections: args.collections, sentByInvoice: deskReads?.sentByInvoice ?? null })
  const pile = buildCollectPile({
    bills,
    paySpeeds,
    promisesByJob: promises,
    payAppJobIds: deskReads?.payAppJobIds ?? new Set<string>(),
    gcPayerIds: deskReads?.gcPayerIds ?? new Set<string>(),
    todayYmd,
  }).bills

  return {
    input: { payments, unlinked, deposits, linkedDeposits, returns, unbankedCount, pile, claims, stripeOpenInvoiceIds: stripeOpenIds, payout, todayYmd },
    failed: [...failed],
  }
}
