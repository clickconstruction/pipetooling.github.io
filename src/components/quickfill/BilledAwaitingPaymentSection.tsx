import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useReportQuickfillSectionMetric } from '../../contexts/QuickfillSectionMetricsContext'
import { formatCurrency } from '../../lib/format'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import { fetchStagesHeaderStats } from '../../lib/jobs/fetchStagesHeaderStats'
import { fetchAllRowsChunkedIn } from '../../lib/supabasePaging'
import type { StageRow } from '../../lib/jobsStagesBoard'
import { buildBilledByCustomerBreakdown, billedBreakdownTotal, type BilledBreakdownCustomerGroup } from '../../lib/jobs/billedByCustomerBreakdown'
import { reportBillTruthShadow } from '../../lib/billing/billTruthShadow'

/**
 * Quickfill → Billed Awaiting Payment (v2.2190): "Who owes what" — the same
 * per-customer breakdown the Pipeline's WAITING ON CUSTOMERS card opens
 * (customers ranked by what they owe, bill count, oldest bill's age; expand a
 * customer for its bills, each with a door into the Pipeline). Was a 60-row
 * flat table with no question. Rows come from the Pipeline's own lean billed
 * spine (one row per bill, Collections excluded) decorated with names.
 */

type JobNameRow = { id: string; job_name: string | null; customer_name: string | null; customer_id: string | null }

function ageChip(days: number | null, handSet: boolean) {
  if (days == null) return <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>no bill line</span>
  const tone =
    days >= 90
      ? { background: 'var(--bg-red-100)', color: 'var(--text-red-700)' }
      : days >= 30
        ? { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' }
        : { background: 'var(--bg-subtle)', color: 'var(--text-muted)' }
  return (
    <span
      title={handSet ? `${days} days — from the hand-set est. bill date` : `${days} days since billed`}
      style={{ fontSize: '0.75rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums', padding: '0.05rem 0.4rem', borderRadius: 9999, whiteSpace: 'nowrap', ...tone }}
    >
      {days}d{handSet ? <span aria-hidden style={{ marginLeft: 3, opacity: 0.7 }}>·</span> : null}
    </span>
  )
}

export function BilledAwaitingPaymentSection() {
  const { user: authUser, role } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [groups, setGroups] = useState<BilledBreakdownCustomerGroup[]>([])
  const [billCount, setBillCount] = useState(0)
  const [excluded, setExcluded] = useState<{ count: number; total: number }>({ count: 0, total: 0 })
  const [openKeys, setOpenKeys] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    if (!authUser?.id) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetchStagesHeaderStats(null)
        if (cancelled) return
        if (!res.ok) {
          setError(res.error)
          setLoading(false)
          return
        }
        const lean = res.leanBilledRows
        const jobIds = Array.from(new Set(lean.map((r) => r.job.id)))
        const names = jobIds.length
          ? await fetchAllRowsChunkedIn<JobNameRow, string>(
              jobIds,
              (chunk, from, to) =>
                supabase.from('jobs_ledger').select('id, job_name, customer_name, customer_id').in('id', chunk).order('id', { ascending: true }).range(from, to),
              'load billed job names',
            )
          : []
        if (cancelled) return
        const byId = new Map(names.map((n) => [n.id, n]))
        // Lean rows lack names; the breakdown groups by customer_id / customer_name and labels by job_name.
        const decorated: StageRow[] = lean.map((r) => {
          const n = byId.get(r.job.id)
          const job = { ...r.job, job_name: n?.job_name ?? r.job.job_name ?? null, customer_name: n?.customer_name ?? null, customer_id: n?.customer_id ?? r.job.customer_id ?? null }
          return { ...r, job } as StageRow
        })
        const built = buildBilledByCustomerBreakdown(decorated)
        const count = built.reduce((s, g) => s + g.count, 0)
        // Shadow (one release): this pile used to drop settled ($0) bills the strip counted.
        reportBillTruthShadow({
          surface: 'quickfill-ar-count',
          legacy: built.reduce((s, g) => s + g.bills.filter((b) => !b.settled).length, 0),
          kernel: count,
          userId: authUser?.id ?? null,
          role: role ?? null,
        })
        if (!cancelled) {
          setGroups(built)
          setBillCount(count)
          setExcluded({ count: res.billTruth.excludedOwed.count, total: res.billTruth.excludedOwed.total })
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [authUser?.id, role])

  const canAccess = role === 'dev' || role === 'master_technician' || isAssistantLike(role)
  const total = useMemo(() => billedBreakdownTotal(groups), [groups])
  useReportQuickfillSectionMetric(
    'billed-awaiting',
    !canAccess || !authUser?.id ? null : loading ? null : error ? null : billCount,
    !!(canAccess && authUser?.id && loading),
  )
  if (!canAccess) return null
  if (loading) return null
  if (groups.length === 0) return null

  const cell: React.CSSProperties = { padding: '0.5rem 0.6rem' }
  return (
    <section style={{ marginBottom: '1.5rem' }}>
      <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
        {billCount} bill{billCount === 1 ? '' : 's'} · ${formatCurrency(total)} open · {groups.length} customer{groups.length === 1 ? '' : 's'} — click a customer for their bills, oldest first
        {excluded.count > 0
          ? ` · ${excluded.count} bill${excluded.count === 1 ? '' : 's'} on paid or missing jobs excluded ($${formatCurrency(excluded.total)})`
          : ''}
      </div>
      {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
              <th style={{ ...cell, textAlign: 'left' }}>Customer</th>
              <th style={{ ...cell, textAlign: 'center' }}>Bills</th>
              <th style={{ ...cell, textAlign: 'center' }}>Oldest</th>
              <th style={{ ...cell, textAlign: 'right' }}>Owed</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const open = openKeys.has(g.key)
              return (
                <GroupRows
                  key={g.key}
                  g={g}
                  open={open}
                  cell={cell}
                  onToggle={() =>
                    setOpenKeys((prev) => {
                      const next = new Set(prev)
                      if (next.has(g.key)) next.delete(g.key)
                      else next.add(g.key)
                      return next
                    })
                  }
                />
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
        <Link
          to="/jobs?tab=stages&stagesSection=billed"
          style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', textDecoration: 'none', borderRadius: 4, fontSize: '0.875rem' }}
        >
          View in Jobs Pipeline
        </Link>
      </div>
    </section>
  )
}

function GroupRows({
  g,
  open,
  cell,
  onToggle,
}: {
  g: BilledBreakdownCustomerGroup
  open: boolean
  cell: React.CSSProperties
  onToggle: () => void
}) {
  return (
    <>
      <tr onClick={onToggle} aria-expanded={open} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
        <td style={cell}>
          <span aria-hidden style={{ display: 'inline-block', width: '1rem', color: 'var(--text-muted)' }}>{open ? '▾' : '▸'}</span>
          {g.customerName}
        </td>
        <td style={{ ...cell, textAlign: 'center', color: 'var(--text-muted)' }}>{g.count}</td>
        <td style={{ ...cell, textAlign: 'center' }}>{ageChip(g.worstAgeDays, g.worstAgeHandSet)}</td>
        <td style={{ ...cell, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>${formatCurrency(g.total)}</td>
      </tr>
      {open
        ? g.bills.map((b) => (
            <tr key={`${g.key}-${b.invoiceId ?? b.jobId}`} style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
              <td style={{ ...cell, paddingLeft: '2rem' }}>
                <span style={{ fontSize: '0.8125rem' }}>
                  {b.jobNumber} · {b.jobName}
                </span>{' '}
                <Link
                  to={b.invoiceId ? `/jobs?tab=stages&stagesInvoice=${encodeURIComponent(b.invoiceId)}` : `/jobs?tab=stages&stagesJob=${encodeURIComponent(b.jobId)}`}
                  style={{ fontSize: '0.75rem', color: 'var(--text-link)', marginLeft: 6, whiteSpace: 'nowrap' }}
                >
                  View in Pipeline →
                </Link>
              </td>
              <td style={cell} />
              <td style={{ ...cell, textAlign: 'center' }}>{ageChip(b.ageDays, b.ageHandSet)}</td>
              <td style={{ ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>${formatCurrency(b.amount)}</td>
            </tr>
          ))
        : null}
    </>
  )
}
