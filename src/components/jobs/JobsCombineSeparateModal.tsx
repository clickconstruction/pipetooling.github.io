import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  fetchJobMaterialsCostSnapshot,
  mercuryCardTotalFromLines,
  tallyPartsTotalFromLines,
} from '../../lib/fetchJobMaterialsCostSnapshot'
import { revenueDollarsFromFixtures } from '../../lib/revenueFromJobFixtures'
import { withSupabaseRetry, formatPostgrestOrUnknownError } from '../../utils/errorHandling'
import { loadTeamLaborData, type TeamLaborRow } from '../../utils/teamLabor'
import { useToastContext } from '../../contexts/ToastContext'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import type { Database } from '../../types/database'

const JOBS_COMBINE_SEPARATE_MODAL_Z_INDEX = 1050

type JobSearchRow = { id: string; hcp_number: string; job_name: string; job_address: string; click_number?: string }

type FixtureRow = Database['public']['Tables']['jobs_ledger_fixtures']['Row']

type ClockSessionListRow = Pick<
  Database['public']['Tables']['clock_sessions']['Row'],
  'id' | 'work_date' | 'clocked_in_at' | 'clocked_out_at' | 'user_id'
>

function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fixtureLineRevenue(f: Pick<FixtureRow, 'name' | 'count' | 'line_unit_price'>): number {
  return revenueDollarsFromFixtures([
    { name: f.name, count: f.count, line_unit_price: f.line_unit_price },
  ])
}

async function fetchMaterialsBilledTotal(jobId: string): Promise<number> {
  const rows = await withSupabaseRetry(
    async () => supabase.from('jobs_ledger_materials').select('amount').eq('job_id', jobId),
    'combine separate materials sum',
  )
  let s = 0
  for (const r of rows ?? []) {
    s += Number(r.amount) || 0
  }
  return s
}

export type JobsCombineSeparateModalProps = {
  open: boolean
  onClose: () => void
  onAfterSuccess: () => void
}

export default function JobsCombineSeparateModal({ open, onClose, onAfterSuccess }: JobsCombineSeparateModalProps) {
  const { showToast } = useToastContext()
  const jobFormModalCtx = useJobFormModal()

  const [activeTab, setActiveTab] = useState<'combine' | 'separate'>('combine')

  /** Combine */
  const [cSourceSearch, setCSourceSearch] = useState('')
  const [cSourceCandidates, setCSourceCandidates] = useState<JobSearchRow[]>([])
  const [cSourceSearchLoading, setCSourceSearchLoading] = useState(false)
  const [cSourceId, setCSourceId] = useState<string | null>(null)
  const [cSourceRow, setCSourceRow] = useState<JobSearchRow | null>(null)

  const [cTargetSearch, setCTargetSearch] = useState('')
  const [cTargetCandidates, setCTargetCandidates] = useState<JobSearchRow[]>([])
  const [cTargetSearchLoading, setCTargetSearchLoading] = useState(false)
  const [cTargetId, setCTargetId] = useState<string | null>(null)

  const [cSourcePreviewLoading, setCSourcePreviewLoading] = useState(false)
  const [cSourcePreview, setCSourcePreview] = useState<{
    partsStyle: number
    materialsBilled: number
    teamCost: number
    teamHours: number
  } | null>(null)

  const [cTargetPreviewLoading, setCTargetPreviewLoading] = useState(false)
  const [cTargetPreview, setCTargetPreview] = useState<{
    partsStyle: number
    materialsBilled: number
    teamCost: number
    teamHours: number
  } | null>(null)

  const [cMigrateBusy, setCMigrateBusy] = useState(false)

  /** Separate */
  const [sJobSearch, setSJobSearch] = useState('')
  const [sJobCandidates, setSJobCandidates] = useState<JobSearchRow[]>([])
  const [sJobSearchLoading, setSJobSearchLoading] = useState(false)
  const [sSourceId, setSSourceId] = useState<string | null>(null)
  const [sSourceRow, setSSourceRow] = useState<JobSearchRow | null>(null)

  const [sFixtures, setSFixtures] = useState<FixtureRow[]>([])
  const [sFixturesLoading, setSFixturesLoading] = useState(false)
  const [sFixturePick, setSFixturePick] = useState<Set<string>>(() => new Set())

  const [sSessions, setSSessions] = useState<ClockSessionListRow[]>([])
  const [sSessionNames, setSSessionNames] = useState<Record<string, string>>({})
  const [sSessionsLoading, setSSessionsLoading] = useState(false)
  const [sSessionsOpen, setSSessionsOpen] = useState(false)
  const [sSessionPick, setSSessionPick] = useState<Set<string>>(() => new Set())

  const [sNewHcp, setSNewHcp] = useState('')
  const [sNewName, setSNewName] = useState('')
  const [sNewAddress, setSNewAddress] = useState('')
  const [sSplitBusy, setSSplitBusy] = useState(false)
  const [sSplitFollowUpJobId, setSSplitFollowUpJobId] = useState<string | null>(null)

  const resetAll = useCallback(() => {
    setActiveTab('combine')
    setCSourceSearch('')
    setCSourceCandidates([])
    setCSourceSearchLoading(false)
    setCSourceId(null)
    setCSourceRow(null)
    setCTargetSearch('')
    setCTargetCandidates([])
    setCTargetSearchLoading(false)
    setCTargetId(null)
    setCSourcePreviewLoading(false)
    setCSourcePreview(null)
    setCTargetPreviewLoading(false)
    setCTargetPreview(null)
    setCMigrateBusy(false)

    setSJobSearch('')
    setSJobCandidates([])
    setSJobSearchLoading(false)
    setSSourceId(null)
    setSSourceRow(null)
    setSFixtures([])
    setSFixturesLoading(false)
    setSFixturePick(new Set())
    setSSessions([])
    setSSessionNames({})
    setSSessionsLoading(false)
    setSSessionsOpen(false)
    setSSessionPick(new Set())
    setSNewHcp('')
    setSNewName('')
    setSNewAddress('')
    setSSplitBusy(false)
    setSSplitFollowUpJobId(null)
  }, [])

  useEffect(() => {
    if (!open) resetAll()
  }, [open, resetAll])

  /** Debounced job search (combine source) */
  useEffect(() => {
    if (!open || activeTab !== 'combine') {
      setCSourceCandidates([])
      setCSourceSearchLoading(false)
      return
    }
    const q = cSourceSearch.trim()
    if (q.length < 2) {
      setCSourceCandidates([])
      setCSourceSearchLoading(false)
      return
    }
    setCSourceSearchLoading(true)
    let cancelled = false
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const raw = await withSupabaseRetry(
            async () => supabase.rpc('search_jobs_ledger', { search_text: q }),
            'combine separate c source search',
          )
          const rows = (raw ?? []) as JobSearchRow[]
          if (!cancelled) setCSourceCandidates(rows.slice(0, 30))
        } catch {
          if (!cancelled) setCSourceCandidates([])
        } finally {
          if (!cancelled) setCSourceSearchLoading(false)
        }
      })()
    }, 280)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [open, activeTab, cSourceSearch])

  /** Debounced job search (combine target) */
  useEffect(() => {
    if (!open || activeTab !== 'combine') {
      setCTargetCandidates([])
      setCTargetSearchLoading(false)
      return
    }
    const q = cTargetSearch.trim()
    if (q.length < 2) {
      setCTargetCandidates([])
      setCTargetSearchLoading(false)
      return
    }
    setCTargetSearchLoading(true)
    let cancelled = false
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const raw = await withSupabaseRetry(
            async () => supabase.rpc('search_jobs_ledger', { search_text: q }),
            'combine separate c target search',
          )
          const rows = (raw ?? []) as JobSearchRow[]
          if (!cancelled) {
            const filtered = cSourceId ? rows.filter((r) => r.id !== cSourceId) : rows
            setCTargetCandidates(filtered.slice(0, 30))
          }
        } catch {
          if (!cancelled) setCTargetCandidates([])
        } finally {
          if (!cancelled) setCTargetSearchLoading(false)
        }
      })()
    }, 280)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [open, activeTab, cTargetSearch, cSourceId])

  /** Debounced job search (separate source) */
  useEffect(() => {
    if (!open || activeTab !== 'separate') {
      setSJobCandidates([])
      setSJobSearchLoading(false)
      return
    }
    const q = sJobSearch.trim()
    if (q.length < 2) {
      setSJobCandidates([])
      setSJobSearchLoading(false)
      return
    }
    setSJobSearchLoading(true)
    let cancelled = false
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const raw = await withSupabaseRetry(
            async () => supabase.rpc('search_jobs_ledger', { search_text: q }),
            'combine separate s job search',
          )
          const rows = (raw ?? []) as JobSearchRow[]
          if (!cancelled) setSJobCandidates(rows.slice(0, 30))
        } catch {
          if (!cancelled) setSJobCandidates([])
        } finally {
          if (!cancelled) setSJobSearchLoading(false)
        }
      })()
    }, 280)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [open, activeTab, sJobSearch])

  async function loadCostPreview(jobId: string): Promise<{
    partsStyle: number
    materialsBilled: number
    teamCost: number
    teamHours: number
  }> {
    const [snap, materialsSum, teamRows] = await Promise.all([
      fetchJobMaterialsCostSnapshot(jobId),
      fetchMaterialsBilledTotal(jobId),
      loadTeamLaborData(supabase),
    ])
    const teamRow = teamRows.find((r: TeamLaborRow) => r.jobId === jobId) ?? null
    const partsStyle =
      snap.supplyInvoiceTotal + tallyPartsTotalFromLines(snap.tallyPartLines) + mercuryCardTotalFromLines(snap.mercuryAllocLines)
    return {
      partsStyle,
      materialsBilled: materialsSum,
      teamCost: teamRow?.jobCost ?? 0,
      teamHours: teamRow?.manHours ?? 0,
    }
  }

  /** Combine: source preview */
  useEffect(() => {
    if (!open || activeTab !== 'combine' || !cSourceId) {
      setCSourcePreview(null)
      setCSourcePreviewLoading(false)
      return
    }
    let cancelled = false
    setCSourcePreviewLoading(true)
    setCSourcePreview(null)
    void (async () => {
      try {
        const p = await loadCostPreview(cSourceId)
        if (!cancelled) setCSourcePreview(p)
      } catch {
        if (!cancelled) setCSourcePreview(null)
      } finally {
        if (!cancelled) setCSourcePreviewLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, activeTab, cSourceId])

  /** Combine: target preview */
  useEffect(() => {
    if (!open || activeTab !== 'combine' || !cTargetId) {
      setCTargetPreview(null)
      setCTargetPreviewLoading(false)
      return
    }
    let cancelled = false
    setCTargetPreviewLoading(true)
    setCTargetPreview(null)
    void (async () => {
      try {
        const p = await loadCostPreview(cTargetId)
        if (!cancelled) setCTargetPreview(p)
      } catch {
        if (!cancelled) setCTargetPreview(null)
      } finally {
        if (!cancelled) setCTargetPreviewLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, activeTab, cTargetId])

  /** Separate: fixtures + sessions */
  useEffect(() => {
    if (!open || activeTab !== 'separate' || !sSourceId) {
      setSFixtures([])
      setSFixturesLoading(false)
      setSSessions([])
      setSSessionNames({})
      setSSessionsLoading(false)
      setSFixturePick(new Set())
      setSSessionPick(new Set())
      return
    }
    let cancelled = false
    setSFixturesLoading(true)
    setSSessionsLoading(true)
    void (async () => {
      try {
        const fx = await withSupabaseRetry(
          () =>
            supabase
              .from('jobs_ledger_fixtures')
              .select('*')
              .eq('job_id', sSourceId)
              .order('sequence_order', { ascending: true }),
          'combine separate fixtures',
        )
        if (!cancelled) setSFixtures((fx ?? []) as FixtureRow[])

        const sess = await withSupabaseRetry(
          () =>
            supabase
              .from('clock_sessions')
              .select('id, work_date, clocked_in_at, clocked_out_at, user_id')
              .eq('job_ledger_id', sSourceId)
              .order('work_date', { ascending: false })
              .limit(250),
          'combine separate clock sessions',
        )
        const sessRows = (sess ?? []) as ClockSessionListRow[]
        if (!cancelled) setSSessions(sessRows)

        const uids = [...new Set(sessRows.map((s) => s.user_id))]
        const nameById: Record<string, string> = {}
        if (uids.length > 0) {
          const users = await withSupabaseRetry(
            () => supabase.from('users').select('id, name').in('id', uids),
            'combine separate session users',
          )
          for (const u of users ?? []) {
            if (u.id) nameById[u.id] = (u.name ?? '').trim() || u.id
          }
        }
        if (!cancelled) setSSessionNames(nameById)
      } catch {
        if (!cancelled) {
          setSFixtures([])
          setSSessions([])
          setSSessionNames({})
        }
      } finally {
        if (!cancelled) {
          setSFixturesLoading(false)
          setSSessionsLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, activeTab, sSourceId])

  const combineCanSubmit = useMemo(
    () => Boolean(cSourceId && cTargetId && cSourceId !== cTargetId && !cMigrateBusy && !sSplitFollowUpJobId),
    [cSourceId, cTargetId, cMigrateBusy, sSplitFollowUpJobId],
  )

  const sPickCount = sFixturePick.size
  const sMovingAllFixtures = sFixtures.length > 0 && sPickCount >= sFixtures.length
  const separateCanSubmit = useMemo(
    () =>
      Boolean(
        sSourceId &&
          sPickCount > 0 &&
          !sMovingAllFixtures &&
          sNewHcp.trim() &&
          sNewName.trim() &&
          sNewAddress.trim() &&
          !sSplitBusy &&
          !sSplitFollowUpJobId &&
          !sFixturesLoading,
      ),
    [
      sSourceId,
      sPickCount,
      sMovingAllFixtures,
      sNewHcp,
      sNewName,
      sNewAddress,
      sSplitBusy,
      sSplitFollowUpJobId,
      sFixturesLoading,
    ],
  )

  const projectedSplitRevenue = useMemo(() => {
    const picked = sFixtures.filter((f) => sFixturePick.has(f.id))
    return revenueDollarsFromFixtures(
      picked.map((f) => ({ name: f.name, count: f.count, line_unit_price: f.line_unit_price })),
    )
  }, [sFixtures, sFixturePick])

  async function runCombineMigrate(): Promise<void> {
    if (!cSourceId || !cTargetId || cSourceId === cTargetId) return
    setCMigrateBusy(true)
    try {
      const data = await withSupabaseRetry(
        () =>
          supabase.rpc('migrate_job_ledger_costs_and_delete', {
            p_from: cSourceId,
            p_to: cTargetId,
          }),
        'combine separate migrate',
      )
      const payload = data as { ok?: boolean; error?: string } | null
      if (!payload?.ok) {
        const msg =
          typeof payload?.error === 'string' && payload.error.trim()
            ? payload.error
            : 'Could not migrate and delete this job.'
        showToast(msg, 'error')
        return
      }
      showToast(
        'Costs and job total moved to the target job; the source job was removed. Open the target job to verify Specific Work and Job Total.',
        'success',
      )
      onAfterSuccess()
      onClose()
    } catch (err: unknown) {
      showToast(formatPostgrestOrUnknownError(err, 'Failed to migrate job'), 'error')
    } finally {
      setCMigrateBusy(false)
    }
  }

  async function runSeparateSplit(): Promise<void> {
    if (!separateCanSubmit || !sSourceId) return
    setSSplitBusy(true)
    try {
      const data = await withSupabaseRetry(
        () =>
          supabase.rpc('split_job_ledger_fixtures_to_new_job', {
            p_source_job_id: sSourceId,
            p_fixture_ids: [...sFixturePick],
            p_new_hcp: sNewHcp.trim(),
            p_new_job_name: sNewName.trim(),
            p_new_job_address: sNewAddress.trim(),
            p_clock_session_ids: sSessionPick.size > 0 ? [...sSessionPick] : [],
          }),
        'combine separate split',
      )
      const payload = data as { ok?: boolean; error?: string; new_job_id?: string } | null
      if (!payload?.ok) {
        const msg =
          typeof payload?.error === 'string' && payload.error.trim() ? payload.error : 'Could not split this job.'
        showToast(msg, 'error')
        return
      }
      const nid = typeof payload.new_job_id === 'string' ? payload.new_job_id : ''
      showToast(
        'Created a new job with the selected Specific Work lines. Parts, Mercury, supply allocations, crew grid, schedule blocks, and reports stayed on the original job.',
        'success',
      )
      onAfterSuccess()
      if (nid) setSSplitFollowUpJobId(nid)
      else onClose()
    } catch (err: unknown) {
      showToast(formatPostgrestOrUnknownError(err, 'Failed to split job'), 'error')
    } finally {
      setSSplitBusy(false)
    }
  }

  function dismissSplitSuccess(): void {
    setSSplitFollowUpJobId(null)
    onClose()
  }

  if (!open) return null

  const overlayBusy = cMigrateBusy || sSplitBusy

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: JOBS_COMBINE_SEPARATE_MODAL_Z_INDEX,
        padding: '1rem',
      }}
      onClick={() => {
        if (overlayBusy) return
        onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="jobs-combine-separate-title"
        style={{
          background: 'var(--surface)',
          padding: '1.5rem',
          borderRadius: 8,
          minWidth: 360,
          maxWidth: 560,
          maxHeight: '90vh',
          overflow: 'auto',
          width: '100%',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="jobs-combine-separate-title" style={{ margin: '0 0 1rem', fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-strong)' }}>
          Combine / Separate jobs
        </h2>

        {sSplitFollowUpJobId ? (
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#166534', lineHeight: 1.5 }}>
              New job created. Open it in Edit Job to verify details, or close when you are done.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => dismissSplitSuccess()}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--bg-muted)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = sSplitFollowUpJobId
                  if (id) {
                    jobFormModalCtx?.openEditJob(id, { onSaved: onAfterSuccess })
                    dismissSplitSuccess()
                  }
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                Edit new job
              </button>
            </div>
          </div>
        ) : (
          <>
            <div
              role="tablist"
              aria-label="Combine or separate jobs"
              style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)' }}
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'combine'}
                onClick={() => setActiveTab('combine')}
                disabled={overlayBusy}
                style={{
                  padding: '0.5rem 0.75rem',
                  marginBottom: -1,
                  border: 'none',
                  borderBottom: activeTab === 'combine' ? '2px solid #2563eb' : '2px solid transparent',
                  background: 'none',
                  cursor: overlayBusy ? 'not-allowed' : 'pointer',
                  fontWeight: activeTab === 'combine' ? 600 : 400,
                  color: activeTab === 'combine' ? 'var(--text-blue-700)' : 'var(--text-muted)',
                  fontSize: '0.875rem',
                }}
              >
                Combine
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'separate'}
                onClick={() => setActiveTab('separate')}
                disabled={overlayBusy}
                style={{
                  padding: '0.5rem 0.75rem',
                  marginBottom: -1,
                  border: 'none',
                  borderBottom: activeTab === 'separate' ? '2px solid #2563eb' : '2px solid transparent',
                  background: 'none',
                  cursor: overlayBusy ? 'not-allowed' : 'pointer',
                  fontWeight: activeTab === 'separate' ? 600 : 400,
                  color: activeTab === 'separate' ? 'var(--text-blue-700)' : 'var(--text-muted)',
                  fontSize: '0.875rem',
                }}
              >
                Separate
              </button>
            </div>

            {activeTab === 'combine' ? (
              <div>
                <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-700)', lineHeight: 1.5 }}>
                  Move labor, parts, materials, Specific Work, and related rows from the <strong>source</strong> job into
                  the <strong>target</strong> job, add the source <strong>Job total (revenue)</strong> to the target, then
                  remove the source job. Matches <strong>Edit Job → Migrate and Delete</strong>. This cannot be undone.
                </p>

                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: 6 }}>
                  Job to remove (source)
                </label>
                <input
                  type="search"
                  value={cSourceSearch}
                  onChange={(e) => {
                    setCSourceSearch(e.target.value)
                    setCSourceId(null)
                    setCSourceRow(null)
                  }}
                  placeholder="Search HCP, name, or address (2+ characters)"
                  disabled={cMigrateBusy}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.65rem',
                    borderRadius: 6,
                    border: '1px solid var(--border-strong)',
                    fontSize: '0.875rem',
                    marginBottom: 8,
                  }}
                />
                {cSourceSearchLoading ? (
                  <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Searching…</p>
                ) : null}
                <ul
                  style={{
                    listStyle: 'none',
                    margin: '0 0 1rem',
                    padding: 0,
                    maxHeight: 140,
                    overflow: 'auto',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                  }}
                >
                  {cSourceCandidates.map((j) => (
                    <li key={j.id}>
                      <button
                        type="button"
                        disabled={cMigrateBusy}
                        onClick={() => {
                          setCSourceId(j.id)
                          setCSourceRow(j)
                          if (cTargetId === j.id) setCTargetId(null)
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '0.5rem 0.65rem',
                          border: 'none',
                          borderBottom: '1px solid #f3f4f6',
                          background: cSourceId === j.id ? 'var(--bg-blue-tint)' : 'var(--surface)',
                          cursor: cMigrateBusy ? 'not-allowed' : 'pointer',
                          fontSize: '0.8125rem',
                        }}
                      >
                        <strong>{effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'}</strong> — {(j.job_name ?? '').trim() || '—'}
                        <div style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{(j.job_address ?? '').trim() || '—'}</div>
                      </button>
                    </li>
                  ))}
                </ul>

                {cSourceRow ? (
                  <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-700)' }}>
                    <strong>Source selected:</strong> {effectiveJobLedgerNumber(cSourceRow.hcp_number, cSourceRow.click_number) || '—'} —{' '}
                    {(cSourceRow.job_name ?? '').trim() || '—'}
                  </p>
                ) : null}

                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: 6 }}>
                  Job to keep (target)
                </label>
                <input
                  type="search"
                  value={cTargetSearch}
                  onChange={(e) => {
                    setCTargetSearch(e.target.value)
                    setCTargetId(null)
                  }}
                  placeholder="Search HCP, name, or address (2+ characters)"
                  disabled={cMigrateBusy}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.65rem',
                    borderRadius: 6,
                    border: '1px solid var(--border-strong)',
                    fontSize: '0.875rem',
                    marginBottom: 8,
                  }}
                />
                {cTargetSearchLoading ? (
                  <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Searching…</p>
                ) : null}
                <ul
                  style={{
                    listStyle: 'none',
                    margin: '0 0 1rem',
                    padding: 0,
                    maxHeight: 140,
                    overflow: 'auto',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                  }}
                >
                  {cTargetCandidates.map((j) => (
                    <li key={j.id}>
                      <button
                        type="button"
                        disabled={cMigrateBusy}
                        onClick={() => setCTargetId(j.id)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '0.5rem 0.65rem',
                          border: 'none',
                          borderBottom: '1px solid #f3f4f6',
                          background: cTargetId === j.id ? 'var(--bg-blue-tint)' : 'var(--surface)',
                          cursor: cMigrateBusy ? 'not-allowed' : 'pointer',
                          fontSize: '0.8125rem',
                        }}
                      >
                        <strong>{effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'}</strong> — {(j.job_name ?? '').trim() || '—'}
                        <div style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{(j.job_address ?? '').trim() || '—'}</div>
                      </button>
                    </li>
                  ))}
                </ul>

                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)', marginBottom: 8 }}>Summary</div>
                  <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '4px 8px 4px 0', color: 'var(--text-muted)', fontWeight: 600 }} />
                        <th style={{ textAlign: 'right', padding: '4px 4px', color: 'var(--text-muted)', fontWeight: 600 }}>Source</th>
                        <th style={{ textAlign: 'right', padding: '4px 0 4px 4px', color: 'var(--text-muted)', fontWeight: 600 }}>Target</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ padding: '4px 8px 4px 0', color: 'var(--text-700)' }}>Parts-style costs</td>
                        <td style={{ textAlign: 'right', padding: '4px 4px' }}>
                          {cSourcePreviewLoading
                            ? '…'
                            : cSourcePreview
                              ? `$${formatCurrency(cSourcePreview.partsStyle)}`
                              : '—'}
                        </td>
                        <td style={{ textAlign: 'right', padding: '4px 0 4px 4px' }}>
                          {cTargetPreviewLoading
                            ? '…'
                            : cTargetPreview
                              ? `$${formatCurrency(cTargetPreview.partsStyle)}`
                              : '—'}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '4px 8px 4px 0', color: 'var(--text-700)' }}>Billed materials</td>
                        <td style={{ textAlign: 'right', padding: '4px 4px' }}>
                          {cSourcePreviewLoading
                            ? '…'
                            : cSourcePreview
                              ? `$${formatCurrency(cSourcePreview.materialsBilled)}`
                              : '—'}
                        </td>
                        <td style={{ textAlign: 'right', padding: '4px 0 4px 4px' }}>
                          {cTargetPreviewLoading
                            ? '…'
                            : cTargetPreview
                              ? `$${formatCurrency(cTargetPreview.materialsBilled)}`
                              : '—'}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '4px 8px 4px 0', color: 'var(--text-700)' }}>Team labor (est.)</td>
                        <td style={{ textAlign: 'right', padding: '4px 4px' }}>
                          {cSourcePreviewLoading
                            ? '…'
                            : cSourcePreview
                              ? `$${formatCurrency(cSourcePreview.teamCost)}`
                              : '—'}
                        </td>
                        <td style={{ textAlign: 'right', padding: '4px 0 4px 4px' }}>
                          {cTargetPreviewLoading
                            ? '…'
                            : cTargetPreview
                              ? `$${formatCurrency(cTargetPreview.teamCost)}`
                              : '—'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (cMigrateBusy) return
                      onClose()
                    }}
                    disabled={cMigrateBusy}
                    style={{
                      padding: '0.5rem 1rem',
                      background: 'var(--bg-muted)',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 6,
                      cursor: cMigrateBusy ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!combineCanSubmit}
                    onClick={() => void runCombineMigrate()}
                    style={{
                      padding: '0.5rem 1rem',
                      background: !combineCanSubmit ? '#9ca3af' : '#b91c1c',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      cursor: !combineCanSubmit ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                    }}
                  >
                    {cMigrateBusy ? 'Working…' : 'Confirm migrate and delete source'}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-700)', lineHeight: 1.5 }}>
                  Pick a <strong>Working</strong> job, select one or more <strong>Specific Work</strong> lines to move into a
                  new job, then enter the new job&apos;s HCP, name, and address. At least one line must remain on the
                  original job.
                </p>
                <p
                  style={{
                    margin: '0 0 1rem',
                    fontSize: '0.8125rem',
                    color: 'var(--text-amber-800)',
                    lineHeight: 1.45,
                    background: 'var(--bg-amber-tint)',
                    padding: '0.65rem 0.75rem',
                    borderRadius: 6,
                    border: '1px solid #fde68a',
                  }}
                >
                  <strong>Limitations (v1):</strong> Parts tally, Mercury splits, supply-house %, crew job JSON, schedule
                  blocks, field reports, and thread notes are <strong>not</strong> moved automatically. They stay on the
                  original billing job unless you adjust them manually.
                </p>

                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: 6 }}>
                  Source job
                </label>
                <input
                  type="search"
                  value={sJobSearch}
                  onChange={(e) => {
                    setSJobSearch(e.target.value)
                    setSSourceId(null)
                    setSSourceRow(null)
                  }}
                  placeholder="Search HCP, name, or address (2+ characters)"
                  disabled={sSplitBusy}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.65rem',
                    borderRadius: 6,
                    border: '1px solid var(--border-strong)',
                    fontSize: '0.875rem',
                    marginBottom: 8,
                  }}
                />
                {sJobSearchLoading ? (
                  <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Searching…</p>
                ) : null}
                <ul
                  style={{
                    listStyle: 'none',
                    margin: '0 0 1rem',
                    padding: 0,
                    maxHeight: 120,
                    overflow: 'auto',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                  }}
                >
                  {sJobCandidates.map((j) => (
                    <li key={j.id}>
                      <button
                        type="button"
                        disabled={sSplitBusy}
                        onClick={() => {
                          setSSourceId(j.id)
                          setSSourceRow(j)
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '0.5rem 0.65rem',
                          border: 'none',
                          borderBottom: '1px solid #f3f4f6',
                          background: sSourceId === j.id ? 'var(--bg-blue-tint)' : 'var(--surface)',
                          cursor: sSplitBusy ? 'not-allowed' : 'pointer',
                          fontSize: '0.8125rem',
                        }}
                      >
                        <strong>{effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'}</strong> — {(j.job_name ?? '').trim() || '—'}
                        <div style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{(j.job_address ?? '').trim() || '—'}</div>
                      </button>
                    </li>
                  ))}
                </ul>

                {sSourceRow ? (
                  <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-700)' }}>
                    <strong>Selected:</strong> {effectiveJobLedgerNumber(sSourceRow.hcp_number, sSourceRow.click_number) || '—'} — {(sSourceRow.job_name ?? '').trim() || '—'}
                  </p>
                ) : null}

                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)', marginBottom: 8 }}>
                  Specific Work lines to move
                </div>
                {sFixturesLoading ? (
                  <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Loading lines…</p>
                ) : sFixtures.length === 0 && sSourceId ? (
                  <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No Specific Work lines on this job.</p>
                ) : (
                  <ul
                    style={{
                      listStyle: 'none',
                      margin: '0 0 1rem',
                      padding: 0,
                      maxHeight: 200,
                      overflow: 'auto',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                    }}
                  >
                    {sFixtures.map((f) => {
                      const checked = sFixturePick.has(f.id)
                      const line$ = fixtureLineRevenue(f)
                      return (
                        <li
                          key={f.id}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.5rem',
                            padding: '0.45rem 0.65rem',
                            borderBottom: '1px solid #f3f4f6',
                            fontSize: '0.8125rem',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={sSplitBusy}
                            onChange={() => {
                              setSFixturePick((prev) => {
                                const next = new Set(prev)
                                if (next.has(f.id)) next.delete(f.id)
                                else next.add(f.id)
                                return next
                              })
                            }}
                            style={{ marginTop: 3 }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 500 }}>{(f.name ?? '').trim() || '(unnamed line)'}</div>
                            <div style={{ color: 'var(--text-muted)' }}>
                              qty {f.count} · ${formatCurrency(Number(f.line_unit_price) || 0)} unit →{' '}
                              <strong>${formatCurrency(line$)}</strong> extended
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}

                {sMovingAllFixtures ? (
                  <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>
                    Leave at least one Specific Work line on the original job, or use Combine to merge into another job
                    instead.
                  </p>
                ) : null}

                {sPickCount > 0 ? (
                  <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-700)' }}>
                    <strong>New job revenue (from selected lines):</strong> ${formatCurrency(projectedSplitRevenue)}
                  </p>
                ) : null}

                <details
                  open={sSessionsOpen}
                  onToggle={(e) => setSSessionsOpen((e.target as HTMLDetailsElement).open)}
                  style={{ marginBottom: '1rem', fontSize: '0.875rem' }}
                >
                  <summary style={{ cursor: sSplitBusy ? 'not-allowed' : 'pointer', fontWeight: 600, color: 'var(--text-700)' }}>
                    Clock sessions on this job ({sSessionsLoading ? '…' : sSessions.length})
                  </summary>
                  {sSessionsLoading ? (
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Loading sessions…</p>
                  ) : sSessions.length === 0 ? (
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No sessions linked to this job.</p>
                  ) : (
                    <ul style={{ listStyle: 'none', margin: '0.5rem 0 0', padding: 0, maxHeight: 160, overflow: 'auto' }}>
                      {sSessions.map((s) => {
                        const checked = sSessionPick.has(s.id)
                        const uname = sSessionNames[s.user_id] ?? s.user_id.slice(0, 8)
                        return (
                          <li
                            key={s.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              padding: '0.35rem 0',
                              borderBottom: '1px solid #f3f4f6',
                              fontSize: '0.8125rem',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={sSplitBusy}
                              onChange={() => {
                                setSSessionPick((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(s.id)) next.delete(s.id)
                                  else next.add(s.id)
                                  return next
                                })
                              }}
                            />
                            <span>
                              {s.work_date} · {uname}
                              {s.clocked_out_at ? '' : ' · open'}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </details>

                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: 6 }}>
                  New HCP #
                </label>
                <input
                  value={sNewHcp}
                  onChange={(e) => setSNewHcp(e.target.value)}
                  disabled={sSplitBusy}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.65rem',
                    borderRadius: 6,
                    border: '1px solid var(--border-strong)',
                    fontSize: '0.875rem',
                    marginBottom: 10,
                    boxSizing: 'border-box',
                  }}
                />
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: 6 }}>
                  New job name
                </label>
                <input
                  value={sNewName}
                  onChange={(e) => setSNewName(e.target.value)}
                  disabled={sSplitBusy}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.65rem',
                    borderRadius: 6,
                    border: '1px solid var(--border-strong)',
                    fontSize: '0.875rem',
                    marginBottom: 10,
                    boxSizing: 'border-box',
                  }}
                />
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: 6 }}>
                  New job address
                </label>
                <input
                  value={sNewAddress}
                  onChange={(e) => setSNewAddress(e.target.value)}
                  disabled={sSplitBusy}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.65rem',
                    borderRadius: 6,
                    border: '1px solid var(--border-strong)',
                    fontSize: '0.875rem',
                    marginBottom: '1rem',
                    boxSizing: 'border-box',
                  }}
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (sSplitBusy) return
                      onClose()
                    }}
                    disabled={sSplitBusy}
                    style={{
                      padding: '0.5rem 1rem',
                      background: 'var(--bg-muted)',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 6,
                      cursor: sSplitBusy ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!separateCanSubmit}
                    onClick={() => void runSeparateSplit()}
                    style={{
                      padding: '0.5rem 1rem',
                      background: !separateCanSubmit ? '#9ca3af' : '#16a34a',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      cursor: !separateCanSubmit ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                    }}
                  >
                    {sSplitBusy ? 'Working…' : 'Create new job and move lines'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}