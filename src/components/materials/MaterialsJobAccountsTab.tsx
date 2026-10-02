import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry, formatErrorMessage } from '../../utils/errorHandling'
import { fetchAllRows, fetchAllRowsChunkedIn } from '../../lib/supabasePaging'
import { formatCurrency } from '../../lib/format'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import { daysPastDue, type AgingBucketKey } from '../../lib/supplyHouseAging'
import {
  buildJobAccountsView,
  type JobAccountsRow,
  type JobAccountsStatus,
  type JobAccountsView,
} from '../../lib/materials/jobAccountsFlow'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { buildHeldLienLines, type HeldLienAffidavitRow, type HeldLienLine, type HeldLienNoticeRow } from '../../lib/materials/heldLienLine'
import { heldNoticeRisk, type HeldNoticeRisk } from '../../lib/materials/heldHouseNotice'
import { buildLienSupplierCard, buildLienSupplierJobs, type LienSupplierCardRow, type LienSupplierInvoiceInput, type LienSupplierJob, type LienSupplierWord } from '../../lib/jobs/lienJobSuppliers'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { LienSupplierWordForm } from '../jobs/LienJobSuppliers'
import { useIsMobile } from '../../hooks/useIsMobile'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

/** Same bar segment palette as the Supply Houses phone aging bars (v2.2191). */
const OWED_SEGMENT_COLORS: Record<AgingBucketKey, string> = {
  current: '#86efac',
  past1_30: '#fde68a',
  past30_60: '#fdba74',
  past60_90: '#fca5a5',
  past90plus: '#ef4444',
  noDueDate: 'var(--text-faint)',
}

const OWED_SEGMENT_ORDER: AgingBucketKey[] = ['current', 'past1_30', 'past30_60', 'past60_90', 'past90plus', 'noDueDate']

/**
 * Job-account (owner-secured) styling — teal, distinct from the aging ramp.
 * No teal theme tokens exist; saturated status colors stay literal (CLAUDE.md).
 */
const JOB_ACCOUNT_TEAL = { text: '#0f766e', tint: '#ccfbf1', mid: '#14b8a6' }
const JOB_ACCOUNT_STRIPE = `repeating-linear-gradient(45deg, ${JOB_ACCOUNT_TEAL.mid} 0 4px, ${JOB_ACCOUNT_TEAL.tint} 4px 8px)`

/** Small teal "on job acct" chip — the house bills the property owner if unpaid. */
function JobAccountChip({ amount }: { amount?: number }) {
  return (
    <span
      title="On the house's job account — if this goes unpaid, the house bills the property owner, not you."
      style={{
        padding: '1px 8px',
        background: JOB_ACCOUNT_TEAL.tint,
        color: JOB_ACCOUNT_TEAL.text,
        fontSize: '0.6875rem',
        fontWeight: 600,
        borderRadius: 999,
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {amount !== undefined ? `$${formatCurrency(amount)} on job acct` : 'Job acct'}
    </span>
  )
}

/** Heat chip styles matching AGING_CELL_STYLES on the Supply Houses tab. */
const DUE_CHIP_STYLES: Record<AgingBucketKey, { background: string; color: string }> = {
  current: { background: 'var(--bg-emerald-tint)', color: 'var(--text-emerald-800)' },
  past1_30: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' },
  past30_60: { background: 'var(--bg-orange-100)', color: 'var(--text-orange-800)' },
  past60_90: { background: 'var(--bg-red-100)', color: 'var(--text-red-800)' },
  past90plus: { background: 'var(--bg-red-200)', color: 'var(--text-red-900)' },
  noDueDate: { background: 'var(--bg-muted)', color: 'var(--text-600)' },
}

const STATUS_CHIP: Record<JobAccountsStatus, { label: string; background: string; color: string }> = {
  owe_suppliers: { label: 'Owe suppliers', background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' },
  floating: { label: 'Floating', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)' },
  awaiting_customer: { label: 'Awaiting customer', background: 'var(--bg-muted)', color: 'var(--text-600)' },
  settled: { label: 'Settled', background: 'var(--bg-green-100)', color: 'var(--text-green-800)' },
}

type UserRole = 'dev' | 'master_technician' | 'assistant' | 'estimator' | 'primary' | 'superintendent'

type FilterKey = 'all' | 'owe_suppliers' | 'awaiting' | 'settled' | 'job_account' | 'no_account' | 'needs_flag' | 'no_packet' | 'notice_risk'
const FILTER_KEYS: readonly FilterKey[] = ['all', 'owe_suppliers', 'awaiting', 'settled', 'job_account', 'no_account', 'needs_flag', 'no_packet', 'notice_risk']

/** `?filter=` deep link (the Dashboard's job-account cards land here); unknown values read as All. */
function filterFromParam(value: string | null): FilterKey {
  return value && (FILTER_KEYS as readonly string[]).includes(value) ? (value as FilterKey) : 'all'
}

export type MaterialsJobAccountsTabProps = {
  /** Render gate — stays mounted across tab switches so loaded data survives. */
  active: boolean
  myRole: UserRole | null
  /** Opens the Supply Houses tab; with a house id, opens that house's detail (Make Payment lives there). */
  onOpenSupplyHouse: (houseId: string | null) => void
  /** The signed-in person's name: kept beside what a house told us (v2.4440). */
  authName?: string
}

/** What the houses' own notices are worked out from (v2.4440): kept so a saved word re-reads only the words. */
type HouseFactsRaw = {
  invoices: LienSupplierInvoiceInput[]
  allocations: Array<{ invoice_id: string; job_id: string; pct: number | null }>
  houses: Array<{ id: string; name: string }>
}
type WordRow = { job_id: string; supply_house_id: string; their_balance: number | null; notice_on: string | null; said_by: string | null; note: string | null; noted_by_name: string | null; noted_at: string | null }

function wordsByJobFrom(rows: WordRow[]): Map<string, Array<LienSupplierWord & { houseId: string }>> {
  const out = new Map<string, Array<LienSupplierWord & { houseId: string }>>()
  for (const w of rows) {
    const list = out.get(w.job_id) ?? []
    list.push({
      houseId: w.supply_house_id,
      balance: w.their_balance == null ? null : Number(w.their_balance),
      noticeYmd: w.notice_on ? w.notice_on.slice(0, 10) : null,
      saidBy: (w.said_by ?? '').trim(),
      note: (w.note ?? '').trim(),
      notedByName: (w.noted_by_name ?? '').trim(),
      notedYmd: w.noted_at ? calendarYmdInAppTzFromIso(w.noted_at) : '',
    })
    out.set(w.job_id, list)
  }
  return out
}

/** A house's own notice in the statement's words: the day it gave, else our estimate. */
function houseNoticeWords(r: LienSupplierCardRow): { text: string; sub: string; tone: 'amber' | 'plain' | 'muted' } | null {
  if (r.notice.kind === 'said') {
    const past = r.notice.daysLeft < 0
    return { text: `its notice ${past ? 'went' : 'goes'} out ${formatYmdMonthDay(r.notice.ymd)}`, sub: r.saidWords, tone: past ? 'muted' : r.notice.soon ? 'amber' : 'plain' }
  }
  if (r.notice.kind === 'open') return { text: `its own notice by ${formatYmdMonthDay(r.notice.ymd)}`, sub: `our estimate · ${r.notice.daysLeft} ${r.notice.daysLeft === 1 ? 'day' : 'days'}`, tone: r.notice.soon ? 'amber' : 'plain' }
  if (r.notice.kind === 'closed') return { text: `notice window closed ${formatYmdMonthDay(r.notice.ymd)}`, sub: 'our estimate', tone: 'muted' }
  return null
}
const NOTICE_INK = { amber: 'var(--text-amber-800)', plain: 'var(--text-700)', muted: 'var(--text-muted)' } as const

function matchesFilter(row: JobAccountsRow, filter: FilterKey, risk: ReadonlyMap<string, HeldNoticeRisk>): boolean {
  if (filter === 'all') return true
  if (filter === 'notice_risk') return risk.has(row.jobId)
  if (filter === 'owe_suppliers') return row.status === 'owe_suppliers'
  if (filter === 'awaiting') return row.status === 'floating' || row.status === 'awaiting_customer'
  if (filter === 'job_account') return row.owedOnJobAccount > 0.005
  if (filter === 'no_account') return row.missingAccountHouses.length > 0
  if (filter === 'needs_flag') return row.hasJobAccountShare && row.suppliersOwed - row.owedOnJobAccount > 0.005
  if (filter === 'no_packet') return !row.hasJobAccountShare && row.owedOnJobAccount > 0.005
  return row.status === 'settled'
}

function formatYmdShort(ymd: string): string {
  const d = new Date(ymd + 'T12:00:00')
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString()
}

function dueChipText(group: { oldestUnpaidDueYmd: string | null }, todayYmd: string): string {
  if (!group.oldestUnpaidDueYmd) return 'no due date'
  const days = daysPastDue(group.oldestUnpaidDueYmd, todayYmd)
  const date = formatYmdShort(group.oldestUnpaidDueYmd)
  return days > 0 ? `${date} — ${days}d past due` : `${date} — current`
}

/**
 * Materials → Held for suppliers (tab key `job-accounts`; named Job Accounts until v2.3641 — see docs/MATERIALS_TABS_ARCHITECTURE.md): per-job
 * money flow — customer payments in vs supply-house invoice allocations out.
 * Self-contained: loads on first activation, all math in
 * lib/materials/jobAccountsFlow.ts.
 */
export function MaterialsJobAccountsTab({ active, myRole, onOpenSupplyHouse, authName = '' }: MaterialsJobAccountsTabProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const jobFormModal = useJobFormModal()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<JobAccountsView | null>(null)
  const [todayYmd, setTodayYmd] = useState('')
  // The way back to the Lien desk (v2.4412): jobs on our own lien clock, by the desk's own RPCs.
  const [lienLines, setLienLines] = useState<ReadonlyMap<string, HeldLienLine>>(new Map())
  // The houses' own notices (v2.4440): what each house is owed by month, what it told us, and each job's property kind.
  const isMobile = useIsMobile()
  const houseRawRef = useRef<HouseFactsRaw | null>(null)
  const [suppliers, setSuppliers] = useState<ReadonlyMap<string, LienSupplierJob>>(new Map())
  const [kindByJob, setKindByJob] = useState<ReadonlyMap<string, string>>(new Map())
  const [wordHouse, setWordHouse] = useState<string | null>(null)
  const riskByJob = useMemo(() => {
    const out = new Map<string, HeldNoticeRisk>()
    if (!view || !todayYmd) return out
    for (const r of view.rows) {
      const risk = heldNoticeRisk(r, suppliers.get(r.jobId), kindByJob.get(r.jobId) ?? '', todayYmd)
      if (risk) out.set(r.jobId, risk)
    }
    return out
  }, [view, suppliers, kindByJob, todayYmd])

  /** What the houses told us, read fresh; a missing table (before the push) or a refused read is no words. */
  async function readWords(): Promise<WordRow[]> {
    try {
      return await fetchAllRows<WordRow>(
        async (from, to) => ({
          data: await withSupabaseRetry(
            () => supabase.from('job_supply_house_words').select('job_id, supply_house_id, their_balance, notice_on, said_by, note, noted_by_name, noted_at').order('job_id').order('supply_house_id').range(from, to),
            'load what the houses told us',
          ),
          error: null,
        }),
        'load what the houses told us',
      )
    } catch {
      return []
    }
  }
  /** After a word is saved or cleared: the words again, and the houses' notices rebuilt from what is already loaded. */
  async function reloadWords() {
    const raw = houseRawRef.current
    if (!raw) return
    const words = await readWords()
    setSuppliers(buildLienSupplierJobs({ ...raw, wordsByJob: wordsByJobFrom(words) }))
  }
  const [filter, setFilter] = useState<FilterKey>(() => filterFromParam(searchParams.get('filter')))
  useEffect(() => {
    const param = searchParams.get('filter')
    if (param) setFilter(filterFromParam(param))
  }, [searchParams])
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)
  // `?job=<id>` (v2.4404): the Lien desk's door. Once the rows are in, that job's statement opens and scrolls into view.
  const jobParam = searchParams.get('job')
  const jobParamDoneRef = useRef<string | null>(null)
  useEffect(() => {
    if (!active || !view || !jobParam || jobParamDoneRef.current === jobParam) return
    jobParamDoneRef.current = jobParam
    if (!view.rows.some((r) => r.jobId === jobParam)) return
    setFilter('all')
    setExpandedJobId(jobParam)
    // After the rows have laid out: a frame is too early on a cold load.
    window.setTimeout(() => document.querySelector(`[data-held-job="${CSS.escape(jobParam)}"]`)?.scrollIntoView({ block: 'start' }), 250)
  }, [active, view, jobParam])
  const loadStartedRef = useRef(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const invoicesPromise = (async () => {
        try {
          return await fetchAllRows(
            async (from, to) => ({
              data: await withSupabaseRetry(
                () =>
                  supabase
                    .from('supply_house_invoices')
                    .select('id, supply_house_id, amount, is_paid, due_date, invoice_date, on_job_account')
                    .order('id')
                    .range(from, to),
                'load supply house invoices',
              ),
              error: null,
            }),
            'load supply house invoices',
          )
        } catch {
          // Pre-migration prod (merge-to-db-push window): on_job_account doesn't
          // exist yet — load without it so the tab keeps working.
          const rows = await fetchAllRows(
            async (from, to) => ({
              data: await withSupabaseRetry(
                () =>
                  supabase
                    .from('supply_house_invoices')
                    .select('id, supply_house_id, amount, is_paid, due_date, invoice_date')
                    .order('id')
                    .range(from, to),
                'load supply house invoices',
              ),
              error: null,
            }),
            'load supply house invoices',
          )
          return rows.map((inv) => ({ ...inv, on_job_account: false }))
        }
      })()
      const [invoices, allocations, bidAllocations, houses] = await Promise.all([
        invoicesPromise,
        fetchAllRows(
          async (from, to) => ({
            data: await withSupabaseRetry(
              () =>
                supabase
                  .from('supply_house_invoice_job_allocations')
                  .select('invoice_id, job_id, pct')
                  .order('invoice_id')
                  .order('job_id')
                  .range(from, to),
              'load invoice job allocations',
            ),
            error: null,
          }),
          'load invoice job allocations',
        ),
        fetchAllRows(
          async (from, to) => ({
            data: await withSupabaseRetry(
              () =>
                supabase
                  .from('supply_house_invoice_bid_allocations')
                  .select('invoice_id, bid_id')
                  .order('invoice_id')
                  .order('bid_id')
                  .range(from, to),
              'load invoice bid allocations',
            ),
            error: null,
          }),
          'load invoice bid allocations',
        ),
        withSupabaseRetry(
          () => supabase.from('supply_houses').select('id, name').order('name'),
          'load supply houses',
        ),
      ])
      // Share packets on record (v2.1605 ledger) — drives the "packet on file" chip and the two gap filters.
      const shareRows = await fetchAllRows(
        async (from, to) => ({
          data: await withSupabaseRetry(
            () => supabase.from('supply_house_job_accounts').select('job_id').order('job_id').range(from, to),
            'load job account shares',
          ),
          error: null,
        }),
        'load job account shares',
      ).catch(() => [] as { job_id: string }[])
      // The evidence rule (v2.3430): jobs that bought at a house expecting an account with none on record.
      const noAccountByJob = new Map<string, string[]>()
      try {
        const { data: gaps, error: gapsErr } = await supabase.rpc('list_job_account_evidence_gaps')
        if (!gapsErr) {
          for (const g of (gaps ?? []) as Array<{ job_id: string; house_name: string }>) {
            const list = noAccountByJob.get(g.job_id) ?? []
            if (!list.includes(g.house_name)) list.push(g.house_name)
            noAccountByJob.set(g.job_id, list)
          }
        }
      } catch {
        // pre-push: no filter rows
      }
      const jobIds = [...new Set([...allocations.map((a) => a.job_id), ...noAccountByJob.keys()])]
      const jobs = await fetchAllRowsChunkedIn(
        jobIds,
        async (chunk, from, to) => ({
          data: await withSupabaseRetry(
            () =>
              supabase
                .from('jobs_ledger')
                .select('id, hcp_number, click_number, job_name, revenue, payments_made, customer_address_id')
                .in('id', chunk)
                .order('id')
                .range(from, to),
            'load jobs for job accounts',
          ),
          error: null,
        }),
        'load jobs for job accounts',
      )
      const today = todayYmdInAppTz()
      setTodayYmd(today)
      // The houses' own notices (v2.4440). Not awaited, like the lien clock below: the statement draws first.
      const raw: HouseFactsRaw = {
        invoices: invoices.map((i) => ({ id: i.id, supply_house_id: i.supply_house_id, amount: i.amount, is_paid: i.is_paid, invoice_date: i.invoice_date ?? null, paidYmd: null, on_job_account: Boolean(i.on_job_account) })),
        allocations,
        houses: houses ?? [],
      }
      houseRawRef.current = raw
      setSuppliers(buildLienSupplierJobs(raw))
      void (async () => {
        try {
          const addressIds = [...new Set(jobs.map((j) => j.customer_address_id).filter((id): id is string => Boolean(id)))]
          const [words, addresses] = await Promise.all([
            readWords(),
            fetchAllRowsChunkedIn(
              addressIds,
              async (chunk, from, to) => ({
                data: await withSupabaseRetry(() => supabase.from('customer_addresses').select('id, property_kind').in('id', chunk).order('id').range(from, to), 'load property kinds'),
                error: null,
              }),
              'load property kinds',
            ).catch(() => [] as Array<{ id: string; property_kind: string | null }>),
          ])
          const kindByAddress = new Map(addresses.map((a) => [a.id, a.property_kind ?? '']))
          setKindByJob(new Map(jobs.map((j) => [j.id, j.customer_address_id ? (kindByAddress.get(j.customer_address_id) ?? '') : ''])))
          setSuppliers(buildLienSupplierJobs({ ...raw, wordsByJob: wordsByJobFrom(words) }))
        } catch {
          // The statement stands without the houses' notices.
        }
      })()
      // Not awaited: the statement does not wait on the lien clock, and a failed read draws no line.
      void (async () => {
        try {
          const [notices, affidavits] = await Promise.all([
            supabase.rpc('list_lien_notice_months', { p_within_days: 400 } as never),
            supabase.rpc('list_lien_affidavit_windows', { p_within_days: 400 } as never),
          ])
          setLienLines(buildHeldLienLines(((notices.data ?? []) as unknown) as HeldLienNoticeRow[], ((affidavits.data ?? []) as unknown) as HeldLienAffidavitRow[], today))
        } catch {
          setLienLines(new Map())
        }
      })()
      setView(
        buildJobAccountsView(
          jobs,
          invoices,
          allocations,
          houses ?? [],
          bidAllocations.map((b) => b.invoice_id),
          today,
          new Set(shareRows.map((s) => s.job_id)),
          noAccountByJob,
        ),
      )
    } catch (e) {
      setError(formatErrorMessage(e, 'Failed to load job accounts'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!active || loadStartedRef.current) return
    loadStartedRef.current = true
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  if (!active) return null
  if (!(myRole === 'dev' || myRole === 'master_technician' || isAssistantLike(myRole))) return null

  const rows = (view?.rows.filter((r) => matchesFilter(r, filter, riskByJob)) ?? []).sort((a, b) =>
    // The risk filter reads soonest first; every other view keeps the kernel's order.
    filter === 'notice_risk' ? (riskByJob.get(a.jobId)?.ymd ?? '').localeCompare(riskByJob.get(b.jobId)?.ymd ?? '') : 0,
  )
  const awaitingCount = (view?.floatingJobs ?? 0) + (view?.awaitingJobs ?? 0)

  /** The Lien desk card's rows for a job's houses: each house's own notice and what it told us. */
  function houseRowsFor(row: JobAccountsRow): Map<string, LienSupplierCardRow> {
    const job = suppliers.get(row.jobId)
    if (!job || !todayYmd) return new Map()
    const card = buildLienSupplierCard(job, { propertyKind: kindByJob.get(row.jobId) ?? '', todayYmd, openBalance: Math.max(0, row.billed - row.paidIn), payerName: '' })
    return new Map(card.rows.map((r) => [r.houseId, r]))
  }

  /** Job window (Job / Edit / Bill tabs) in place; falls back to the Jobs page if the provider is absent. */
  function openJobWindow(jobId: string) {
    if (jobFormModal) {
      jobFormModal.openEditJob(jobId, { onSaved: () => void load() })
    } else {
      navigate(`/jobs?tab=stages&edit=${encodeURIComponent(jobId)}`)
    }
  }

  return (
    <div>
      {error && (
        <div style={{ padding: '0.75rem', background: 'var(--bg-red-100)', color: 'var(--text-red-800)', borderRadius: 4, marginBottom: '1rem' }}>
          {error}{' '}
          <button type="button" onClick={() => void load()} style={{ marginLeft: '0.5rem' }}>
            Retry
          </button>
        </div>
      )}

      {loading || !view ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1rem', fontWeight: 600 }}>
              Held for suppliers: ${formatCurrency(view.holdingTotal)}
            </div>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Customer money in vs. supply house money out, per job. Jobs where the customer paid you but a house is
              still owed are listed first.
            </p>
          </div>

          {/* Stat tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div style={{ background: 'var(--bg-amber-tint)', border: '1px solid var(--bg-amber-200)', borderRadius: 8, padding: '0.875rem 1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-amber-800)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Holding for suppliers
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-amber-800)', fontVariantNumeric: 'tabular-nums' }}>
                ${formatCurrency(view.holdingTotal)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-amber-700)' }}>
                {view.holdingJobs} job{view.holdingJobs === 1 ? '' : 's'} paid you — houses still owed
              </div>
              {view.holdingOnJobAccount > 0.005 && (
                <div style={{ marginTop: '0.35rem', paddingTop: '0.35rem', borderTop: '1px dashed var(--bg-amber-200)', fontSize: '0.75rem', color: 'var(--text-amber-700)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span>
                    Your account:{' '}
                    <strong style={{ fontVariantNumeric: 'tabular-nums' }}>${formatCurrency(view.holdingTotal - view.holdingOnJobAccount)}</strong>
                  </span>
                  <span style={{ color: JOB_ACCOUNT_TEAL.text }}>
                    Job accounts:{' '}
                    <strong style={{ fontVariantNumeric: 'tabular-nums' }}>${formatCurrency(view.holdingOnJobAccount)}</strong>
                  </span>
                </div>
              )}
            </div>
            <div style={{ background: 'var(--bg-blue-tint)', border: '1px solid var(--bg-blue-200)', borderRadius: 8, padding: '0.875rem 1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-blue-700)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Floating out of pocket
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-blue-800)', fontVariantNumeric: 'tabular-nums' }}>
                ${formatCurrency(view.floatingTotal)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-blue-500)' }}>
                {view.floatingJobs} job{view.floatingJobs === 1 ? '' : 's'} — you paid houses, customer hasn&rsquo;t paid
              </div>
            </div>
            <div style={{ background: 'var(--bg-green-tint)', border: '1px solid var(--bg-green-200)', borderRadius: 8, padding: '0.875rem 1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-green-700)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Settled
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-green-800)', fontVariantNumeric: 'tabular-nums' }}>
                {view.settledJobs} job{view.settledJobs === 1 ? '' : 's'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-green-600)' }}>Paid both ways — nothing held</div>
            </div>
            <div style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.875rem 1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-600)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Unallocated invoices
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-700)', fontVariantNumeric: 'tabular-nums' }}>
                ${formatCurrency(view.unallocatedTotal)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {view.unallocatedCount} unpaid invoice{view.unallocatedCount === 1 ? '' : 's'} not tied to a job or bid
              </div>
            </div>
            {view.onJobAccountTotal > 0.005 && (
              <div style={{ background: JOB_ACCOUNT_TEAL.tint, border: `1px solid ${JOB_ACCOUNT_TEAL.mid}`, borderRadius: 8, padding: '0.875rem 1rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: JOB_ACCOUNT_TEAL.text, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  On job accounts
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: JOB_ACCOUNT_TEAL.text, fontVariantNumeric: 'tabular-nums' }}>
                  ${formatCurrency(view.onJobAccountTotal)}
                </div>
                <div style={{ fontSize: '0.75rem', color: JOB_ACCOUNT_TEAL.text }}>
                  {view.onJobAccountJobs} job{view.onJobAccountJobs === 1 ? '' : 's'} — house bills the owner if unpaid, not you
                </div>
              </div>
            )}
          </div>

          {/* Filter chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {(
              [
                { key: 'all' as FilterKey, label: 'All', count: view.rows.length },
                { key: 'owe_suppliers' as FilterKey, label: 'Owe suppliers', count: view.holdingJobs },
                { key: 'awaiting' as FilterKey, label: 'Awaiting customer', count: awaitingCount },
                { key: 'settled' as FilterKey, label: 'Settled', count: view.settledJobs },
                ...(view.onJobAccountJobs > 0
                  ? [{ key: 'job_account' as FilterKey, label: 'On job account', count: view.onJobAccountJobs }]
                  : []),
                ...(view.noAccountJobs > 0 || filter === 'no_account'
                  ? [{ key: 'no_account' as FilterKey, label: 'Bought, no account', count: view.noAccountJobs }]
                  : []),
                ...(view.needsFlagJobs > 0 || filter === 'needs_flag'
                  ? [{ key: 'needs_flag' as FilterKey, label: 'Packet on file, unflagged', count: view.needsFlagJobs }]
                  : []),
                ...(view.noPacketJobs > 0 || filter === 'no_packet'
                  ? [{ key: 'no_packet' as FilterKey, label: 'Flagged, no packet', count: view.noPacketJobs }]
                  : []),
                ...(riskByJob.size > 0 || filter === 'notice_risk'
                  ? [{ key: 'notice_risk' as FilterKey, label: 'Paid, house can still notice', count: riskByJob.size }]
                  : []),
              ]
            ).map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setFilter(chip.key)}
                style={{
                  padding: '0.3rem 0.85rem',
                  borderRadius: 999,
                  border: filter === chip.key ? '1px solid transparent' : '1px solid var(--border-strong)',
                  backgroundColor: filter === chip.key ? '#3b82f6' : 'var(--surface)',
                  color: filter === chip.key ? 'white' : 'var(--text-700)',
                  fontWeight: filter === chip.key ? 600 : 400,
                  fontSize: '0.875rem',
                }}
              >
                {chip.label} <span style={{ opacity: 0.75 }}>{chip.count}</span>
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{filter === 'notice_risk' ? 'Sorted by the house’s date, soonest first' : 'Sorted by $ held, largest first'}</span>
            <button type="button" onClick={() => void load()} disabled={loading}>
              Refresh
            </button>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-600)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span style={{ width: 14, height: 8, borderRadius: 4, background: '#3b82f6', display: 'inline-block' }} />
              Customer paid you
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span style={{ width: 14, height: 8, borderRadius: 4, background: 'var(--bg-200)', display: 'inline-block' }} />
              Billed, unpaid
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span style={{ width: 14, height: 8, borderRadius: 4, background: 'var(--text-slate-400)', display: 'inline-block' }} />
              Paid to houses
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span style={{ width: 14, height: 8, borderRadius: 4, overflow: 'hidden', display: 'inline-flex' }}>
                <span style={{ flex: 1, background: OWED_SEGMENT_COLORS.past1_30 }} />
                <span style={{ flex: 1, background: OWED_SEGMENT_COLORS.past30_60 }} />
                <span style={{ flex: 1, background: OWED_SEGMENT_COLORS.past60_90 }} />
                <span style={{ flex: 1, background: OWED_SEGMENT_COLORS.past90plus }} />
              </span>
              Owed to houses, by days past due
            </span>
            {view.onJobAccountTotal > 0.005 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <span style={{ width: 14, height: 8, borderRadius: 4, background: JOB_ACCOUNT_STRIPE, display: 'inline-block' }} />
                On job account — house bills the owner
              </span>
            )}
          </div>

          {/* Job list */}
          <div style={{ overflowX: 'auto' }}>
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)', minWidth: 860 }}>
              {rows.length === 0 ? (
                <p style={{ margin: 0, padding: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  {view.rows.length === 0
                    ? 'No supply house invoices are allocated to jobs yet. Allocations are entered per invoice on the Supply Houses tab.'
                    : 'No jobs match this filter.'}
                </p>
              ) : (
                rows.map((row, i) => {
                  const outTotal = row.suppliersPaid + row.suppliersOwed
                  const scale = Math.max(row.billed, row.paidIn, outTotal, 0.01)
                  const chip = STATUS_CHIP[row.status]
                  const expanded = expandedJobId === row.jobId
                  const dimmed = row.status === 'settled'
                  return (
                    <div key={row.jobId} data-held-job={row.jobId} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)', scrollMarginTop: 96 }}>
                      <div
                        role="button"
                        tabIndex={0}
                        aria-expanded={expanded}
                        onClick={() => setExpandedJobId(expanded ? null : row.jobId)}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                            e.preventDefault()
                            setExpandedJobId(expanded ? null : row.jobId)
                          }
                        }}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(200px, 260px) 1fr 150px 28px',
                          gap: '1rem',
                          alignItems: 'center',
                          width: '100%',
                          textAlign: 'left',
                          padding: '0.875rem 1rem',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div
                            role="link"
                            tabIndex={0}
                            title="Open the job window (details, edit, bill)"
                            onClick={(e) => {
                              e.stopPropagation()
                              openJobWindow(row.jobId)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                e.stopPropagation()
                                openJobWindow(row.jobId)
                              }
                            }}
                            style={{
                              fontSize: '0.875rem',
                              fontWeight: 600,
                              color: dimmed ? 'var(--text-700)' : 'var(--text-base)',
                              overflowWrap: 'anywhere',
                              cursor: 'pointer',
                              width: 'fit-content',
                              textDecoration: 'underline',
                              textDecorationColor: 'var(--border-strong)',
                              textUnderlineOffset: 3,
                            }}
                          >
                            J{row.jobNumber || '—'} · {row.jobName || '—'}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 2 }}>
                            <span style={{ padding: '1px 8px', background: chip.background, color: chip.color, fontSize: '0.6875rem', fontWeight: 600, borderRadius: 999, whiteSpace: 'nowrap' }}>
                              {chip.label}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                              {row.houses.length} house{row.houses.length === 1 ? '' : 's'} · {row.invoiceCount} invoice{row.invoiceCount === 1 ? '' : 's'}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ width: 24, fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>In</span>
                            <span style={{ flex: 1, minWidth: 120, maxWidth: 420, height: 10 }}>
                              <span style={{ display: 'block', width: `${Math.min(100, (row.billed / scale) * 100)}%`, height: 10, borderRadius: 5, overflow: 'hidden', background: 'var(--bg-200)' }}>
                                <span
                                  style={{
                                    display: 'block',
                                    height: '100%',
                                    width: `${row.billed > 0.005 ? Math.min(100, (row.paidIn / row.billed) * 100) : 0}%`,
                                    background: '#3b82f6',
                                    opacity: dimmed ? 0.45 : 1,
                                  }}
                                />
                              </span>
                            </span>
                            <span style={{ fontSize: '0.75rem', color: dimmed ? 'var(--text-faint)' : 'var(--text-600)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                              ${formatCurrency(row.paidIn)} / ${formatCurrency(row.billed)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ width: 24, fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>Out</span>
                            <span style={{ flex: 1, minWidth: 120, maxWidth: 420, height: 10 }}>
                              {outTotal > 0.005 && (
                                <span style={{ display: 'flex', width: `${Math.min(100, (outTotal / scale) * 100)}%`, minWidth: 8, height: 10, borderRadius: 5, overflow: 'hidden' }}>
                                  {row.suppliersPaid > 0.005 && (
                                    <span style={{ display: 'block', height: '100%', width: `${(row.suppliersPaid / outTotal) * 100}%`, background: 'var(--text-slate-400)', opacity: dimmed ? 0.5 : 1 }} />
                                  )}
                                  {row.owedOnJobAccount > 0.005 && (
                                    <span
                                      title="On job account — house bills the owner if unpaid"
                                      style={{ display: 'block', height: '100%', width: `${(row.owedOnJobAccount / outTotal) * 100}%`, background: JOB_ACCOUNT_STRIPE }}
                                    />
                                  )}
                                  {OWED_SEGMENT_ORDER.map((bucket) =>
                                    row.owedBuckets[bucket] > 0.005 ? (
                                      <span
                                        key={bucket}
                                        style={{ display: 'block', height: '100%', width: `${(row.owedBuckets[bucket] / outTotal) * 100}%`, background: OWED_SEGMENT_COLORS[bucket] }}
                                      />
                                    ) : null,
                                  )}
                                </span>
                              )}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: dimmed ? 'var(--text-faint)' : 'var(--text-600)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                              ${formatCurrency(row.suppliersPaid)} paid
                              {row.suppliersOwed > 0.005 ? (
                                <>
                                  {' · '}
                                  <span style={{ color: 'var(--text-amber-800)', fontWeight: 600 }}>${formatCurrency(row.suppliersOwed)} owed</span>
                                </>
                              ) : (
                                ' · $0.00 owed'
                              )}
                              {row.suppliersCredits < -0.005 ? (
                                <>
                                  {' · '}
                                  <span style={{ color: 'var(--text-green-700)', fontWeight: 600 }}>
                                    ${formatCurrency(Math.abs(row.suppliersCredits))} credit
                                  </span>
                                </>
                              ) : null}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          {row.status === 'owe_suppliers' && (
                            <>
                              <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-amber-800)', fontVariantNumeric: 'tabular-nums' }}>
                                ${formatCurrency(row.held)}
                              </span>
                              <span style={{ fontSize: '0.6875rem', color: 'var(--text-amber-700)' }}>
                                {row.customerPaidFraction !== null && row.customerPaidFraction >= 1
                                  ? 'customer paid in full'
                                  : `customer ${Math.round((row.customerPaidFraction ?? 0) * 100)}% paid`}
                              </span>
                            </>
                          )}
                          {row.status === 'floating' && (
                            <>
                              <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-blue-800)', fontVariantNumeric: 'tabular-nums' }}>
                                ${formatCurrency(row.suppliersPaid)}
                              </span>
                              <span style={{ fontSize: '0.6875rem', color: 'var(--text-blue-500)' }}>awaiting customer</span>
                            </>
                          )}
                          {row.status === 'awaiting_customer' && (
                            <>
                              <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-600)', fontVariantNumeric: 'tabular-nums' }}>
                                ${formatCurrency(row.suppliersOwed)}
                              </span>
                              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>nothing received yet</span>
                            </>
                          )}
                          {row.status === 'settled' && (
                            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-label="Settled">
                              <circle cx="8" cy="8" r="7" stroke="var(--text-green-700)" strokeWidth="1.4" />
                              <path d="M5 8.2l2 2 4-4.4" stroke="var(--text-green-700)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                          {riskByJob.get(row.jobId) ? (
                            <span data-held-notice-risk title={`${riskByJob.get(row.jobId)!.words}. The customer has paid; a notice from the house would go to them.`} style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-red-700)', whiteSpace: 'nowrap' }}>
                              {riskByJob.get(row.jobId)!.house} notice by {formatYmdMonthDay(riskByJob.get(row.jobId)!.ymd)}
                            </span>
                          ) : null}
                          {row.owedOnJobAccount > 0.005 && (
                            <span
                              title="On the house's job account — if this goes unpaid, the house bills the property owner, not you."
                              style={{ fontSize: '0.6875rem', fontWeight: 600, color: JOB_ACCOUNT_TEAL.text, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}
                            >
                              {row.owedOnJobAccount > row.suppliersOwed - 0.005
                                ? 'all on job acct'
                                : `$${formatCurrency(row.owedOnJobAccount)} on job acct`}
                            </span>
                          )}
                        </div>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ justifySelf: 'center', transform: expanded ? 'rotate(180deg)' : 'none' }} aria-hidden>
                          <path d="M4 6l4 4 4-4" stroke="var(--text-muted)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>

                      {expanded && (
                        <div style={{ padding: '0 1rem 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              padding: '0.625rem 0.875rem',
                              background: row.customerPaidFraction !== null && row.customerPaidFraction >= 1 ? 'var(--bg-green-tint)' : 'var(--bg-subtle)',
                              border: `1px solid ${row.customerPaidFraction !== null && row.customerPaidFraction >= 1 ? 'var(--bg-green-200)' : 'var(--border)'}`,
                              borderRadius: 6,
                              flexWrap: 'wrap',
                            }}
                          >
                            <span style={{ fontSize: '0.8125rem', color: row.customerPaidFraction !== null && row.customerPaidFraction >= 1 ? 'var(--text-green-800)' : 'var(--text-700)' }}>
                              {row.customerPaidFraction !== null && row.customerPaidFraction >= 1 ? (
                                <>
                                  <strong>Customer paid in full</strong> — ${formatCurrency(row.paidIn)} received
                                </>
                              ) : (
                                <>
                                  Customer billed ${formatCurrency(row.billed)} · received ${formatCurrency(row.paidIn)}
                                </>
                              )}
                            </span>
                            {row.missingAccountHouses.length > 0 ? (
                              <span
                                title="This job bought from these houses (an invoice or a PO code in the last 180 days) and no job account is on record there — mark it opened or not needed on the house's roster under Supply houses."
                                style={{ padding: '1px 8px', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', fontSize: '0.6875rem', fontWeight: 600, borderRadius: 999, whiteSpace: 'nowrap' }}
                              >
                                No job account at {row.missingAccountHouses.join(', ')}
                              </span>
                            ) : null}
                            {row.hasJobAccountShare ? (
                              <span
                                title="A job-account setup packet was shared with a supply house for this job (see the job window's storefront icon)."
                                style={{ padding: '1px 8px', background: JOB_ACCOUNT_TEAL.tint, color: JOB_ACCOUNT_TEAL.text, fontSize: '0.6875rem', fontWeight: 600, borderRadius: 999, whiteSpace: 'nowrap' }}
                              >
                                Job account packet on file
                              </span>
                            ) : null}
                            <div style={{ flex: 1 }} />
                            <button
                              type="button"
                              onClick={() => openJobWindow(row.jobId)}
                              style={{ background: 'none', border: 'none', color: 'var(--text-link)', padding: 0, fontSize: '0.8125rem' }}
                            >
                              Open job
                            </button>
                          </div>

                          {(() => {
                            const lien = lienLines.get(row.jobId)
                            if (!lien) return null
                            const red = lien.urgent
                            return (
                              <div data-held-lien-line={lien.kind} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.25rem 0.75rem', padding: '0.45rem 0.75rem', marginBottom: '0.6rem', borderRadius: 8, border: `1px solid ${red ? 'var(--border-red)' : 'var(--border-amber)'}`, background: red ? 'var(--bg-red-tint)' : 'var(--bg-amber-tint)', fontSize: '0.8125rem' }}>
                                <strong style={{ color: red ? 'var(--text-red-700)' : 'var(--text-amber-800)', flex: '1 1 16rem', minWidth: 0 }}>{lien.words}</strong>
                                <Link to={lien.href} style={{ color: 'var(--text-link)', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                  Open the desk ›
                                </Link>
                              </div>
                            )
                          })()}

                          {riskByJob.get(row.jobId) ? (
                            <div data-held-risk-line style={{ padding: '0.45rem 0.75rem', marginBottom: '0.6rem', borderRadius: 8, border: '1px solid var(--border-red)', background: 'var(--bg-red-tint)', fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>
                              <strong>{riskByJob.get(row.jobId)!.words}.</strong> The customer has paid us, so a notice from the house would land on them. Pay the house, or call it and write down what it says.
                            </div>
                          ) : null}

                          <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 190px 110px 110px 130px', gap: '0.75rem', padding: '0.5rem 0.875rem', borderBottom: '1px solid var(--border)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                              <div>Supply house</div>
                              <div style={{ textAlign: 'right' }}>Invoices</div>
                              <div>Oldest due</div>
                              <div style={{ textAlign: 'right' }}>Paid</div>
                              <div style={{ textAlign: 'right' }}>Owed</div>
                              <div />
                            </div>
                            {row.houses.map((group, gi) => {
                              // The house's own notice and what it told us (v2.4440): the Lien desk card's row for this house.
                              const hr = houseRowsFor(row).get(group.supplyHouseId)
                              const nw = hr && group.owed > 0.005 ? houseNoticeWords(hr) : null
                              const wordKey = `${row.jobId}:${group.supplyHouseId}`
                              return (
                              <div key={group.supplyHouseId} style={{ borderBottom: gi === row.houses.length - 1 ? 'none' : '1px solid var(--border)' }}>
                              <div
                                style={{ display: 'grid', gridTemplateColumns: '1fr 90px 190px 110px 110px 130px', gap: '0.75rem', padding: '0.625rem 0.875rem', fontSize: '0.8125rem', alignItems: 'center' }}
                              >
                                <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 500, overflowWrap: 'anywhere', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                  {group.name}
                                  {group.owedOnJobAccount > 0.005 && <JobAccountChip amount={group.owedOnJobAccount} />}
                                </div>
                                {nw ? (
                                  <div data-held-house-notice={hr!.notice.kind} style={{ fontSize: '0.75rem', marginTop: 2 }}>
                                    <span style={{ color: NOTICE_INK[nw.tone], fontWeight: nw.tone === 'amber' ? 600 : undefined }}>{nw.text}</span>
                                    {nw.sub ? <span style={{ color: 'var(--text-muted)' }}> · {nw.sub}</span> : null}
                                  </div>
                                ) : null}
                                {hr?.word?.note ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>“{hr.word.note}”</div> : null}
                                {hr && group.owed > 0.005 ? (
                                  <button
                                    type="button"
                                    data-held-word-door={group.name}
                                    aria-expanded={wordHouse === wordKey}
                                    onClick={() => setWordHouse(wordHouse === wordKey ? null : wordKey)}
                                    style={{ border: 'none', background: 'none', padding: 0, marginTop: 2, color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.75rem' }}
                                  >
                                    {hr.word ? 'Change what they told us…' : 'They told us…'}
                                  </button>
                                ) : null}
                                </div>
                                <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{group.invoiceCount}</div>
                                <div>
                                  {group.oldestUnpaidBucket ? (
                                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums', ...DUE_CHIP_STYLES[group.oldestUnpaidBucket] }}>
                                      {dueChipText(group, todayYmd)}
                                    </span>
                                  ) : (
                                    <span style={{ color: 'var(--text-faint)' }}>—</span>
                                  )}
                                </div>
                                <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-600)' }}>${formatCurrency(group.paid)}</div>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: group.owed > 0.005 ? 'var(--text-amber-800)' : 'var(--text-600)' }}>${formatCurrency(group.owed)}</div>
                                  {hr?.theirBalanceWords ? <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{hr.theirBalanceWords}</div> : null}
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <button
                                    type="button"
                                    title="Open this house on the Supply Houses tab — invoices and Make Payment live there"
                                    onClick={() => onOpenSupplyHouse(group.supplyHouseId)}
                                  >
                                    Open house
                                  </button>
                                </div>
                              </div>
                              {hr && wordHouse === wordKey ? (
                                <LienSupplierWordForm
                                  row={hr}
                                  jobId={row.jobId}
                                  authName={authName}
                                  isMobile={isMobile}
                                  onCancel={() => setWordHouse(null)}
                                  onDone={() => {
                                    setWordHouse(null)
                                    void reloadWords()
                                  }}
                                />
                              ) : null}
                              </div>
                              )
                            })}
                          </div>
                          {row.hasJobAccountShare && row.suppliersOwed - row.owedOnJobAccount > 0.005 && (
                            <div style={{ fontSize: '0.75rem', color: JOB_ACCOUNT_TEAL.text }}>
                              Packet on file — the unflagged invoices here may belong on the job account. Flag them with the Edit pencil on the
                              Supply Houses tab.
                            </div>
                          )}
                          {!row.hasJobAccountShare && row.owedOnJobAccount > 0.005 && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-amber-800)' }}>
                              Flagged on a job account, but no setup packet is on record for this job — fine if the house opened it by phone;
                              otherwise send the packet from the job window&rsquo;s storefront icon.
                            </div>
                          )}
                          {row.suppliersOwed > 0.005 && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Owed on this job: <span style={{ fontWeight: 600, color: 'var(--text-amber-800)', fontVariantNumeric: 'tabular-nums' }}>${formatCurrency(row.suppliersOwed)}</span>{' '}
                              across {row.houses.filter((g) => g.owed > 0.005).length} house{row.houses.filter((g) => g.owed > 0.005).length === 1 ? '' : 's'}
                              {row.owedOnJobAccount > 0.005 && (
                                <>
                                  {' — '}
                                  <span style={{ fontWeight: 600, color: JOB_ACCOUNT_TEAL.text, fontVariantNumeric: 'tabular-nums' }}>${formatCurrency(row.owedOnJobAccount)}</span>{' '}
                                  of it on the job account (the house&rsquo;s recourse is the owner)
                                </>
                              )}
                              . Invoice detail and payments live on the Supply Houses tab.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}

              {view.unallocatedCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-600)' }}>
                    <strong>
                      {view.unallocatedCount} unpaid invoice{view.unallocatedCount === 1 ? ' isn' : 's aren'}&rsquo;t tied to any job
                    </strong>{' '}
                    — ${formatCurrency(view.unallocatedTotal)} missing from the numbers above.
                  </span>
                  <div style={{ flex: 1 }} />
                  <button type="button" onClick={() => onOpenSupplyHouse(null)}>
                    Review on Supply Houses
                  </button>
                </div>
              )}
            </div>
          </div>

          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-faint)', textAlign: 'center' }}>
            Held = unpaid supplier balance on jobs the customer has paid, capped at what came in. Jobs with no allocated
            supply house invoices don&rsquo;t appear here.
          </p>
        </div>
      )}
    </div>
  )
}
