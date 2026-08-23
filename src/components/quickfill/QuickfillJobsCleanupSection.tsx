import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useReportQuickfillSectionMetric } from '../../contexts/QuickfillSectionMetricsContext'
import { fetchAllRows } from '../../lib/supabasePaging'
import { formatCurrency } from '../../lib/jobs/jobFormatting'
import { buildUnlinkedSubLaborRows, sumUnlinkedSubLabor, type UnlinkedSubLaborRow, type UnlinkedSubLaborSheetInput } from '../../lib/jobs/subLaborUnlinked'
import type { SubLaborPickerJobSlice } from '../../lib/jobs/subLaborJobPicker'
import { usePipelineMoneyOpportunities } from '../../hooks/usePipelineMoneyOpportunities'
import { PipelineMoneyOpportunities } from '../jobs/PipelineMoneyOpportunities'
import { stagesMoneyMoveHref, stagesMoneyMoveKeyForPipelineMove, type StagesMoneyMoveKey } from '../../lib/jobs/stagesMoneyMoveLink'
import type { PipelineMoveKey } from '../../lib/jobs/pipelineOverview'

/**
 * Quickfill → "Jobs Cleanup" (v2.2145, owner-approved mockup): one station
 * for job hygiene — (1) sub labor sheets attached to no job, each a tap into
 * that sheet's Edit form (`?editLabor=<sheet id>`, where the Job field's
 * search is one tap away); (2) the Pipeline's Today's Money Opportunities,
 * the SAME cards (shared `PipelineMoneyOpportunities`), each action landing
 * on Jobs → Pipeline with the matching thing open (`?stagesMove=`).
 * Fix-ups are deliberately absent — Quickfill's Missing job info station has them.
 */

type SheetRow = {
  id: string
  assigned_to_name: string | null
  address: string | null
  job_number: string | null
  job_date: string | null
  labor_rate: number | null
}
type ItemRow = { job_id: string; count: number | null; hrs_per_unit: number | null; is_fixed: boolean | null; labor_rate: number | null; direct_labor_amount: number | null }
type PaymentRow = { job_id: string; amount: number | null }
type JobLean = SubLaborPickerJobSlice

function formatLaborDate(ymd: string | null): string {
  if (!ymd) return 'no date'
  const d = new Date(`${ymd}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return ymd
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function QuickfillJobsCleanupSection() {
  const { user: authUser, role } = useAuth()
  const navigate = useNavigate()
  const [sheets, setSheets] = useState<UnlinkedSubLaborRow[] | null>(null)
  const [sheetsLoading, setSheetsLoading] = useState(true)
  const [sheetsError, setSheetsError] = useState<string | null>(null)

  const loadSheets = useCallback(async () => {
    if (!authUser?.id) return
    setSheetsLoading(true)
    setSheetsError(null)
    try {
      const [sheetRows, jobs] = await Promise.all([
        fetchAllRows<SheetRow>(
          (from, to) =>
            supabase
              .from('people_labor_jobs')
              .select('id, assigned_to_name, address, job_number, job_date, labor_rate')
              .order('created_at', { ascending: false })
              .order('id', { ascending: true })
              .range(from, to),
          'load sub labor sheets',
        ),
        fetchAllRows<JobLean>(
          (from, to) =>
            supabase
              .from('jobs_ledger')
              .select('id, hcp_number, click_number, job_name, customer_name, job_address')
              .order('created_at', { ascending: false })
              .order('id', { ascending: true })
              .range(from, to),
          'load jobs for sub labor linking',
        ),
      ])
      // Only sheets that will show need items + payments — resolve first, then fetch their money.
      const candidates = buildUnlinkedSubLaborRows(
        sheetRows.map((s) => ({ ...s, items: [], payments: [] })),
        jobs,
      )
      const ids = candidates.map((c) => c.id)
      const [items, payments] = ids.length
        ? await Promise.all([
            fetchAllRows<ItemRow>(
              (from, to) =>
                supabase
                  .from('people_labor_job_items')
                  .select('job_id, count, hrs_per_unit, is_fixed, labor_rate, direct_labor_amount')
                  .in('job_id', ids)
                  .order('job_id', { ascending: true })
                  .order('sequence_order', { ascending: true })
                  .range(from, to),
              'load sub labor items',
            ),
            fetchAllRows<PaymentRow>(
              (from, to) =>
                supabase
                  .from('people_labor_job_payments')
                  .select('job_id, amount')
                  .in('job_id', ids)
                  .order('job_id', { ascending: true })
                  .order('sequence_order', { ascending: true })
                  .range(from, to),
              'load sub labor payments',
            ),
          ])
        : [[], []]
      const itemsBy = new Map<string, ItemRow[]>()
      for (const i of items) itemsBy.set(i.job_id, [...(itemsBy.get(i.job_id) ?? []), i])
      const paysBy = new Map<string, PaymentRow[]>()
      for (const p of payments) paysBy.set(p.job_id, [...(paysBy.get(p.job_id) ?? []), p])
      const candidateIds = new Set(ids)
      const inputs: UnlinkedSubLaborSheetInput[] = sheetRows
        .filter((s) => candidateIds.has(s.id))
        .map((s) => ({
          ...s,
          items: (itemsBy.get(s.id) ?? []).map((i) => ({
            count: i.count ?? undefined,
            hrs_per_unit: i.hrs_per_unit ?? undefined,
            is_fixed: i.is_fixed ?? undefined,
            labor_rate: i.labor_rate,
            direct_labor_amount: i.direct_labor_amount,
          })),
          payments: paysBy.get(s.id) ?? [],
        }))
      setSheets(buildUnlinkedSubLaborRows(inputs, jobs))
    } catch (e) {
      setSheetsError(e instanceof Error ? e.message : 'Could not load sub labor sheets')
      setSheets([])
    } finally {
      setSheetsLoading(false)
    }
  }, [authUser?.id])

  useEffect(() => {
    void loadSheets()
  }, [loadSheets])

  const money = usePipelineMoneyOpportunities({ enabled: Boolean(authUser?.id), authUserId: authUser?.id, authRole: role })

  const sheetCount = sheets?.length ?? 0
  const sums = useMemo(() => sumUnlinkedSubLabor(sheets ?? []), [sheets])
  useReportQuickfillSectionMetric(
    'jobs-cleanup',
    sheetsLoading || money.loading ? null : sheetCount + money.cardCount,
    sheetsLoading || money.loading,
  )

  const go = (key: StagesMoneyMoveKey) => navigate(stagesMoneyMoveHref(key))
  const moveAction = useMemo(() => {
    const m = {} as Record<PipelineMoveKey, () => void>
    for (const k of ['bill-capable', 'chase-90', 'allocate-deposits', 'fix-dates'] as const) {
      m[k] = () => go(stagesMoneyMoveKeyForPipelineMove(k))
    }
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate])

  const nothingToDo = !sheetsLoading && !money.loading && sheetCount === 0 && money.cardCount === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {nothingToDo ? (
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Nothing to clean up — every sub labor sheet is attached to a job and the pipeline is clean ✅
        </p>
      ) : null}

      {/* Block 1 — sub labor with no job */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: '0.5rem',
            padding: '0.45rem 0.85rem',
            background: 'var(--bg-subtle)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            Sub labor with no job
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {sheetsLoading
              ? 'loading…'
              : sheetCount === 0
                ? 'every sheet is attached to a job ✅'
                : `${sheetCount} sheet${sheetCount === 1 ? '' : 's'} · $${formatCurrency(sums.total)}${sums.due > 0 ? ` · $${formatCurrency(sums.due)} due` : ''}`}
          </span>
        </div>
        {sheetsError ? (
          <p style={{ margin: 0, padding: '0.6rem 0.85rem', fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{sheetsError}</p>
        ) : null}
        {(sheets ?? []).map((r) => (
          <div
            key={r.id}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto auto',
              gap: '0.35rem 0.9rem',
              alignItems: 'center',
              padding: '0.5rem 0.85rem',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, overflowWrap: 'anywhere' }}>{r.contractor}</span>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.typedNumber ? (
                  <>
                    <span style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--text-amber-800)', marginRight: 6 }}>#{r.typedNumber}</span>
                    no job with this number ·{' '}
                  </>
                ) : null}
                {formatLaborDate(r.dateYmd)}
                {r.address ? ` · ${r.address}` : ''}
              </span>
            </span>
            <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600 }}>${formatCurrency(r.total)}</span>
              <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{r.due > 0 ? `$${formatCurrency(r.due)} due` : 'Paid'}</span>
            </span>
            <button
              type="button"
              onClick={() => navigate(`/jobs?tab=sub_sheet_ledger&editLabor=${encodeURIComponent(r.id)}`)}
              title="Open this sheet in Edit Sub Labor — the Job field's search is one tap away"
              style={{
                height: 28,
                padding: '0 0.75rem',
                border: 'none',
                borderRadius: 9999,
                background: '#2563eb',
                color: '#ffffff',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              Link job
            </button>
          </div>
        ))}
      </div>

      {/* Block 2 — the Pipeline's own cards, shared component, navigate on action */}
      {money.error ? (
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{money.error}</p>
      ) : money.loading && !money.stats ? (
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }} aria-busy>
          Loading today’s money opportunities…
        </p>
      ) : (
        <PipelineMoneyOpportunities
          moves={money.moves}
          moveAction={moveAction}
          fixups={[]}
          onFixup={() => {}}
          chase={money.chase}
          onStartChase={() => go('chase')}
          gcRound={money.gcRound}
          onCertifyRound={() => go('gcRoundCertify')}
          onStartRound={() => go('gcRoundStart')}
          headerNote="same cards as Jobs → Pipeline — each button opens it there"
        />
      )}
    </div>
  )
}

export default QuickfillJobsCleanupSection
