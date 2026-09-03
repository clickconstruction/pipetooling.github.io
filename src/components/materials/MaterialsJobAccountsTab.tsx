import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

type FilterKey = 'all' | 'owe_suppliers' | 'awaiting' | 'settled' | 'job_account'

export type MaterialsJobAccountsTabProps = {
  /** Render gate — stays mounted across tab switches so loaded data survives. */
  active: boolean
  myRole: UserRole | null
  /** Opens the Supply Houses tab; with a house id, opens that house's detail (Make Payment lives there). */
  onOpenSupplyHouse: (houseId: string | null) => void
}

function matchesFilter(row: JobAccountsRow, filter: FilterKey): boolean {
  if (filter === 'all') return true
  if (filter === 'owe_suppliers') return row.status === 'owe_suppliers'
  if (filter === 'awaiting') return row.status === 'floating' || row.status === 'awaiting_customer'
  if (filter === 'job_account') return row.owedOnJobAccount > 0.005
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
 * Materials → Job Accounts (see docs/MATERIALS_TABS_ARCHITECTURE.md): per-job
 * money flow — customer payments in vs supply-house invoice allocations out.
 * Self-contained: loads on first activation, all math in
 * lib/materials/jobAccountsFlow.ts.
 */
export function MaterialsJobAccountsTab({ active, myRole, onOpenSupplyHouse }: MaterialsJobAccountsTabProps) {
  const navigate = useNavigate()
  const jobFormModal = useJobFormModal()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<JobAccountsView | null>(null)
  const [todayYmd, setTodayYmd] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)
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
                    .select('id, supply_house_id, amount, is_paid, due_date, on_job_account')
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
                    .select('id, supply_house_id, amount, is_paid, due_date')
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
      const jobIds = [...new Set(allocations.map((a) => a.job_id))]
      const jobs = await fetchAllRowsChunkedIn(
        jobIds,
        async (chunk, from, to) => ({
          data: await withSupabaseRetry(
            () =>
              supabase
                .from('jobs_ledger')
                .select('id, hcp_number, click_number, job_name, revenue, payments_made')
                .in('id', chunk)
                .order('id')
                .range(from, to),
            'load jobs for job accounts',
          ),
          error: null,
        }),
        'load jobs for job accounts',
      )
      const today = new Date().toLocaleDateString('en-CA')
      setTodayYmd(today)
      setView(
        buildJobAccountsView(
          jobs,
          invoices,
          allocations,
          houses ?? [],
          bidAllocations.map((b) => b.invoice_id),
          today,
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

  const rows = view?.rows.filter((r) => matchesFilter(r, filter)) ?? []
  const awaitingCount = (view?.floatingJobs ?? 0) + (view?.awaitingJobs ?? 0)

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
              Job Accounts — holding for suppliers: ${formatCurrency(view.holdingTotal)}
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
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Sorted by $ held, largest first</span>
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
                    <div key={row.jobId} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
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
                            <div style={{ flex: 1 }} />
                            <button
                              type="button"
                              onClick={() => openJobWindow(row.jobId)}
                              style={{ background: 'none', border: 'none', color: 'var(--text-link)', padding: 0, fontSize: '0.8125rem' }}
                            >
                              Open job
                            </button>
                          </div>

                          <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 190px 110px 110px 130px', gap: '0.75rem', padding: '0.5rem 0.875rem', borderBottom: '1px solid var(--border)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                              <div>Supply house</div>
                              <div style={{ textAlign: 'right' }}>Invoices</div>
                              <div>Oldest due</div>
                              <div style={{ textAlign: 'right' }}>Paid</div>
                              <div style={{ textAlign: 'right' }}>Owed</div>
                              <div />
                            </div>
                            {row.houses.map((group, gi) => (
                              <div
                                key={group.supplyHouseId}
                                style={{ display: 'grid', gridTemplateColumns: '1fr 90px 190px 110px 110px 130px', gap: '0.75rem', padding: '0.625rem 0.875rem', borderBottom: gi === row.houses.length - 1 ? 'none' : '1px solid var(--border)', fontSize: '0.8125rem', alignItems: 'center' }}
                              >
                                <div style={{ fontWeight: 500, overflowWrap: 'anywhere', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                  {group.name}
                                  {group.owedOnJobAccount > 0.005 && <JobAccountChip amount={group.owedOnJobAccount} />}
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
                                <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: group.owed > 0.005 ? 'var(--text-amber-800)' : 'var(--text-600)' }}>
                                  ${formatCurrency(group.owed)}
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
                            ))}
                          </div>
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
