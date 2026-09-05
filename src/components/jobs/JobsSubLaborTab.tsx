import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/jobs/jobFormatting'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { buildJobWorkOrderCoverage, type JobWorkOrderCoverage, type WorkOrderRowLike } from '../../lib/subWorkOrders/workOrderCoverage'
import { buildSheetRail, sheetNextAction, type SheetNextAction, type SheetRail as SheetRailShape } from '../../lib/subWorkOrders/sheetRail'
import { isRosterSubSheet, type NeedsWorkOrderRosterPerson } from '../../lib/subWorkOrders/sheetsNeedingWorkOrder'
import { SHEET_RAIL_GAP } from '../../lib/subWorkOrders/sheetRailTone'
import { normalizePersonNameKey } from '../../lib/personNameKey'
import { useRosterSubKinds } from '../../hooks/useRosterSubKinds'
import { emitWorkOrderChanged, WORK_ORDER_CHANGED_EVENT } from '../../hooks/useJobWorkOrderCoverage'
import { SheetRail } from './SheetRail'
import { WorkOrderAssemblerModal, type WorkOrderAssemblerInitial } from './WorkOrderAssemblerModal'
import type { JobWithDetails } from '../../types/jobWithDetails'
import {
  SUB_SHEET_STAGES,
  SUB_SHEET_STAGE_HINT,
  SUB_SHEET_STAGE_LABEL,
  SUB_SHEET_STAGE_TONE,
  nextSubSheetStage,
  normalizeSubSheetStage,
  normalizeSubSheetStageSource,
  subSheetStageStamp,
  type SubSheetStage,
  type SubSheetStageTone,
} from '../../lib/subSheetStage'
import { AmountSmallCents } from '../AmountSmallCents'
import { lineLaborCost } from '../../lib/peopleLaborJobItemLineCost'
import { normalizeUrl } from '../../lib/projectsForecastStageLineItems'
import {
  subLaborJobBalance,
  subLaborJobMatchesSearch,
  type SubLaborOutstandingByPerson,
  type SubLaborSheetAssignee,
} from '../../lib/subLaborOutstanding'
import type {
  LaborJob,
  SubLaborBackchargeTarget,
  SubLaborPaymentTarget,
} from '../../types/laborJob'

export type JobsSubLaborTabProps = {
  error: string | null
  subLaborSearch: string
  onSubLaborSearchChange: (value: string) => void
  laborJobs: LaborJob[]
  laborJobsLoading: boolean
  laborJobNamesByHcp: Record<string, string>
  /** Pipeline jobs — job-anchored work orders cover every sheet on their job; the assembler needs the list. */
  jobs: JobWithDetails[]
  authUserId: string | undefined
  /** Junction assignees per sheet — with the roster, tells a crew pay sheet from a sub sheet. */
  laborJobAssigneesByJobId: ReadonlyMap<string, readonly SubLaborSheetAssignee[]>
  subLaborDueTotal: number
  subLaborOutstandingByPerson: SubLaborOutstandingByPerson
  onNewLaborJob: () => void
  onEditLaborJob: (job: LaborJob) => void
  onPrintJobSubSheet: (job: LaborJob) => void
  onUpdateLaborJobDate: (id: string, date: string | null) => void
  /** Move a sheet's stage (v2.2767) — either direction; the trigger posts the Activity line. */
  onSetLaborJobStage: (id: string, stage: SubSheetStage) => void | Promise<unknown>
  /** Seed + open the parent-owned Make Payment modal. */
  onOpenMakePayment: (target: SubLaborPaymentTarget, defaultAmount: string) => void
  /** Seed + open the parent-owned Backcharge modal. */
  onOpenBackcharge: (target: SubLaborBackchargeTarget) => void
}

export default function JobsSubLaborTab({
  error,
  subLaborSearch,
  onSubLaborSearchChange,
  laborJobs,
  laborJobsLoading,
  laborJobNamesByHcp,
  jobs,
  authUserId,
  laborJobAssigneesByJobId,
  subLaborDueTotal,
  subLaborOutstandingByPerson,
  onNewLaborJob,
  onEditLaborJob,
  onPrintJobSubSheet,
  onUpdateLaborJobDate,
  onSetLaborJobStage,
  onOpenMakePayment,
  onOpenBackcharge,
}: JobsSubLaborTabProps) {
  const [expandedSubLaborJobIds, setExpandedSubLaborJobIds] = useState<Set<string>>(new Set())
  const [stageMenuJobId, setStageMenuJobId] = useState<string | null>(null)
  /** Every live work order (one-row spine, PR 4): sheet-anchored ones cover their sheet, job-anchored ones every sheet on the job. */
  const [commitments, setCommitments] = useState<WorkOrderRowLike[]>([])
  const loadCommitments = useCallback(async () => {
    const { data, error } = await supabase
      .from('step_commitments')
      .select('id, status, amount, display_name, job_id, labor_job_id, step_id, record_id, offered_at, offer_expires_at, signed_at, accepted_at, declined_at, decline_reason, created_at, person_id')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(1000)
    if (error) return
    setCommitments((data ?? []) as WorkOrderRowLike[])
  }, [])
  useEffect(() => {
    void loadCommitments()
    const onChanged = () => void loadCommitments()
    window.addEventListener(WORK_ORDER_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(WORK_ORDER_CHANGED_EVENT, onChanged)
  }, [loadCommitments])
  const { roster } = useRosterSubKinds()
  const [assembler, setAssembler] = useState<WorkOrderAssemblerInitial | null>(null)
  useEffect(() => {
    if (!stageMenuJobId) return
    const close = () => setStageMenuJobId(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [stageMenuJobId])
  const [showAllOutstanding, setShowAllOutstanding] = useState(false)
  const [showOnlyDue, setShowOnlyDue] = useState(true)
  const [noAgreementOnly, setNoAgreementOnly] = useState(false)
  const [subsOnly, setSubsOnly] = useState(false)
  const [sortBy, setSortBy] = useState<'due' | 'date' | 'contractor'>('due')
  const today = todayYmdInAppTz()

  const spine = useMemo(() => {
    const personById = new Map(roster.map((p) => [p.id, p]))
    const personByNameKey = new Map<string, NeedsWorkOrderRosterPerson>()
    for (const p of roster) {
      const k = normalizePersonNameKey(p.name)
      if (k && !personByNameKey.has(k)) personByNameKey.set(k, p)
    }
    const jobsByNumber = new Map(jobs.map((j) => [j.hcp_number.trim().toLowerCase(), j]))
    const bySheet = new Map<string, WorkOrderRowLike[]>()
    const byJob = new Map<string, WorkOrderRowLike[]>()
    for (const r of commitments) {
      if (r.labor_job_id) bySheet.set(r.labor_job_id, [...(bySheet.get(r.labor_job_id) ?? []), r])
      else if (r.job_id) byJob.set(r.job_id, [...(byJob.get(r.job_id) ?? []), r])
    }
    const assigneeIds = new Map<string, string[]>()
    for (const [id, list] of laborJobAssigneesByJobId) assigneeIds.set(id, list.map((a) => a.personId))
    return { personById, personByNameKey, jobsByNumber, bySheet, byJob, assigneeIds }
  }, [roster, jobs, commitments, laborJobAssigneesByJobId])

  /** The rail, the office's next move, and whether the sheet is crew pay — one call per row. */
  const spineFor = useCallback(
    (job: LaborJob, bal: { totalCost: number; paid: number; backcharges: number; balance: number }): { coverage: JobWorkOrderCoverage; rail: SheetRailShape; next: SheetNextAction; crew: boolean; jobId: string | null; personId: string | null } => {
      const pipelineJob = spine.jobsByNumber.get((job.job_number ?? '').trim().toLowerCase()) ?? null
      const covering = [...(spine.bySheet.get(job.id) ?? []), ...(pipelineJob ? (spine.byJob.get(pipelineJob.id) ?? []) : [])]
      const coverage = buildJobWorkOrderCoverage(covering, today)
      const crew = roster.length > 0 && !isRosterSubSheet(job, spine.assigneeIds, spine.personById, spine.personByNameKey)
      const unpriced = bal.totalCost === 0 && bal.paid === 0 && bal.backcharges === 0
      const open = Math.max(0, bal.balance)
      const rail = buildSheetRail({ coverage, sheetStage: normalizeSubSheetStage(job.stage), payableAfter: job.payable_after ?? null, agreed: bal.totalCost, open, unpriced, crewPay: crew })
      const next = sheetNextAction(rail, coverage, { subName: job.assigned_to_name, agreed: bal.totalCost, open, unpriced, todayYmd: today })
      const ids = spine.assigneeIds.get(job.id) ?? []
      const personId = ids.length === 1 ? ids[0]! : null
      return { coverage, rail, next, crew, jobId: pipelineJob?.id ?? null, personId }
    },
    [spine, roster.length, today],
  )

  const outstandingRows = subLaborOutstandingByPerson.rows
  const OUTSTANDING_PREVIEW = 8
  const visibleOutstandingRows =
    showAllOutstanding || outstandingRows.length <= OUTSTANDING_PREVIEW
      ? outstandingRows
      : outstandingRows.slice(0, OUTSTANDING_PREVIEW)

  // Ledger rows: search filter + optional "only due" filter, each paired with its
  // computed balance so the row render reuses it rather than recomputing.
  const visibleLedgerJobs = laborJobs
    .filter((job) => subLaborJobMatchesSearch(job, subLaborSearch, laborJobNamesByHcp))
    .map((job) => {
      const bal = subLaborJobBalance(job)
      return { job, ...bal, ...spineFor(job, bal) }
    })
    .filter((row) => !showOnlyDue || row.balance > 0)
    .filter((row) => !noAgreementOnly || (!row.crew && row.rail.gap))
    .filter((row) => !subsOnly || !row.crew)
    .sort((a, b) => {
      if (sortBy === 'due') {
        return b.balance - a.balance || (a.job.assigned_to_name ?? '').localeCompare(b.job.assigned_to_name ?? '')
      }
      if (sortBy === 'contractor') {
        return (a.job.assigned_to_name ?? '').localeCompare(b.job.assigned_to_name ?? '')
      }
      // Date: newest first, by job_date (falling back to created_at).
      const aDate = a.job.job_date ?? a.job.created_at ?? ''
      const bDate = b.job.job_date ?? b.job.created_at ?? ''
      return bDate.localeCompare(aDate)
    })

  return (
    <div>
      {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          onClick={onNewLaborJob}
          style={{ padding: '0.35rem 0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}
        >
          New Sub Labor
        </button>
        </div>
        <div style={{ fontSize: '1rem', fontWeight: 600 }}>
          Sub Labor Due: <AmountSmallCents value={subLaborDueTotal} />
        </div>
      </div>
      {!laborJobsLoading && laborJobs.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
            Outstanding by contractor
          </div>
          {outstandingRows.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>All contractors are paid up.</p>
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'auto', WebkitOverflowScrolling: 'touch', width: 'fit-content', maxWidth: '100%' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: '0.875rem', fontVariantNumeric: 'tabular-nums' }}>
                <thead style={{ background: 'var(--bg-subtle)' }}>
                  <tr>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Total cost</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Paid</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Outstanding</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Contractor</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleOutstandingRows.map((row) => (
                    <tr key={row.key} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }} title={`$${formatCurrency(row.totalCost)}`}>
                        <AmountSmallCents value={row.totalCost} />
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }} title={`$${formatCurrency(row.paid)}`}>
                        <AmountSmallCents value={row.paid} />
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-red-700)' }} title={`$${formatCurrency(row.outstanding)}`}>
                        <AmountSmallCents value={row.outstanding} />
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        {row.name.trim() || <span style={{ color: 'var(--text-muted)' }}>(No name)</span>}
                        <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: 'var(--text-faint)' }}>
                          {row.jobCount} job{row.jobCount === 1 ? '' : 's'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--bg-subtle)', fontWeight: 700 }}>
                    <td style={{ padding: '0.5rem 0.75rem' }} />
                    <td style={{ padding: '0.5rem 0.75rem' }} />
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: 'var(--text-red-700)' }} title={`$${formatCurrency(subLaborOutstandingByPerson.totalOutstanding)}`}>
                      <AmountSmallCents value={subLaborOutstandingByPerson.totalOutstanding} />
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      Total
                      {outstandingRows.length > OUTSTANDING_PREVIEW ? (
                        <button
                          type="button"
                          onClick={() => setShowAllOutstanding((s) => !s)}
                          style={{ marginLeft: '0.5rem', padding: 0, background: 'none', border: 'none', color: 'var(--text-link)', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}
                        >
                          {showAllOutstanding ? 'Show less' : `Show all (${outstandingRows.length})`}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
      <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
        <input
          type="search"
          placeholder="Search contractor, HCP, address…"
          value={subLaborSearch}
          onChange={(e) => onSubLaborSearchChange(e.target.value)}
          style={{ flex: '1 1 240px', minWidth: 0, padding: '0.5rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Sort:</span>
          <div style={{ display: 'flex', border: '1px solid var(--border-strong)', borderRadius: 4, overflow: 'hidden' }}>
            {(['due', 'date', 'contractor'] as const).map((key) => {
              const active = sortBy === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSortBy(key)}
                  aria-pressed={active}
                  style={{
                    padding: '0.4rem 0.75rem',
                    border: 'none',
                    background: active ? '#3b82f6' : 'var(--surface)',
                    color: active ? 'white' : 'var(--text-700)',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {key === 'due' ? 'Due' : key === 'date' ? 'Date' : 'Contractor'}
                </button>
              )
            })}
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input
            type="checkbox"
            checked={showOnlyDue}
            onChange={(e) => setShowOnlyDue(e.target.checked)}
          />
          Only show due
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', cursor: 'pointer', whiteSpace: 'nowrap' }} title="Sub sheets with work under way and nothing signed">
          <input type="checkbox" checked={noAgreementOnly} onChange={(e) => setNoAgreementOnly(e.target.checked)} />
          No agreement
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', cursor: 'pointer', whiteSpace: 'nowrap' }} title="Hide crew pay sheets (a teammate on the sheet)">
          <input type="checkbox" checked={subsOnly} onChange={(e) => setSubsOnly(e.target.checked)} />
          Subs only
        </label>
      </div>
      {laborJobsLoading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading sub sheet ledger…</p>
      ) : laborJobs.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No jobs yet. Click New Sub Labor to add one.</p>
      ) : visibleLedgerJobs.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>{noAgreementOnly ? 'Every sub sheet with money open has an agreement behind it.' : showOnlyDue ? 'No payments due.' : 'No matching jobs.'}</p>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'auto', WebkitOverflowScrolling: 'touch', minWidth: 0 }}>
          <table style={{ width: '100%', minWidth: 1100, borderCollapse: 'collapse', fontSize: '0.875rem', fontVariantNumeric: 'tabular-nums' }}>
            <thead style={{ background: 'var(--bg-subtle)' }}>
              <tr>
                <th style={{ padding: '0.75rem', width: 32, borderBottom: '1px solid var(--border)' }} />
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Contractor</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Job</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Agreed</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Paid</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Due</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Where it stands</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Next</th>
                <th style={{ padding: '0.75rem', width: 80, borderBottom: '1px solid var(--border)' }} />
                <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Date</th>
                <th style={{ padding: '0.75rem', width: 80, borderBottom: '1px solid var(--border)' }} />
              </tr>
            </thead>
            <tbody>
              {visibleLedgerJobs
                .flatMap(({ job, totalCost, paid, backcharges, balance, rail, next, crew, coverage, jobId, personId }) => {
                const jobRate = job.labor_rate ?? 0
                const dateInputValue = job.job_date ?? (job.created_at ? job.created_at.slice(0, 10) : '')
                const expanded = expandedSubLaborJobIds.has(job.id)
                const toggle = () => {
                  setExpandedSubLaborJobIds((prev) => {
                    const next = new Set(prev)
                    if (next.has(job.id)) next.delete(job.id)
                    else next.add(job.id)
                    return next
                  })
                }
                return [
                  <tr
                    key={job.id}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: expanded ? 'var(--bg-subtle)' : undefined }}
                    onClick={toggle}
                  >
                    <td style={{ padding: '0.75rem', width: 32 }}>{expanded ? '▼' : '▶'}</td>
                    <td style={{ padding: '0.75rem' }}>
                      {job.assigned_to_name}
                      {crew ? (
                        <span title="A teammate is on this sheet — crew pay never needs a work order" style={{ display: 'inline-block', marginLeft: 6, padding: '1px 7px', borderRadius: 999, fontSize: '0.66rem', fontWeight: 700, background: 'var(--bg-violet-100)', color: 'var(--text-violet-700)', whiteSpace: 'nowrap' }}>
                          Crew pay
                        </span>
                      ) : null}
                    </td>
                    <td style={{ padding: '0.75rem', maxWidth: 220 }}>
                      <div style={{ lineHeight: 1.4 }}>
                        <div style={{ fontWeight: 500 }}>
                          {job.job_number ?? '—'}
                          {laborJobNamesByHcp[(job.job_number ?? '').trim().toLowerCase()] ? (
                            <> | {laborJobNamesByHcp[(job.job_number ?? '').trim().toLowerCase()]}</>
                          ) : null}
                          {job.project_id ? (
                            <a
                              href={`/workflows/${job.project_id}${job.step_id ? `#step-${job.step_id}` : ''}`}
                              onClick={(e) => e.stopPropagation()}
                              title={job.project_name ? `Project: ${job.project_name}` : 'Open project workflow'}
                              style={{
                                marginLeft: 6,
                                fontSize: '0.6875rem',
                                fontWeight: 600,
                                color: 'var(--text-link)',
                                background: 'var(--bg-blue-tint)',
                                borderRadius: 999,
                                padding: '0.05rem 0.5rem',
                                textDecoration: 'none',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {job.project_name ?? 'Project'}
                            </a>
                          ) : null}
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {job.address ? (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: 'var(--text-link)', textDecoration: 'none' }}
                              title={job.address}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {job.address}
                            </a>
                          ) : (
                            '—'
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>{totalCost > 0 ? <AmountSmallCents value={totalCost} /> : <span style={{ color: 'var(--text-faint)' }}>unpriced</span>}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>{paid > 0 ? <AmountSmallCents value={paid} /> : '—'}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.8125rem' }}>
                      {totalCost > 0 ? (
                        balance > 0 ? (
                          <span style={{ color: rail.gap ? SHEET_RAIL_GAP : 'var(--text-red-700)', fontWeight: rail.gap ? 700 : 500 }}><AmountSmallCents value={balance} /> due</span>
                        ) : balance < 0 ? (
                          <span style={{ color: 'var(--text-green-600)' }}>Over <AmountSmallCents value={-balance} /></span>
                        ) : (
                          <span style={{ color: 'var(--text-green-600)' }}>Paid</span>
                        )
                      ) : '—'}
                    </td>
                    <td style={{ padding: '0.75rem', verticalAlign: 'middle', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                      <SubSheetStageCell
                        job={job}
                        rail={rail}
                        paid={totalCost > 0 && balance <= 0}
                        menuOpen={stageMenuJobId === job.id}
                        onToggleMenu={() => setStageMenuJobId((cur) => (cur === job.id ? null : job.id))}
                        onPick={(stage) => {
                          setStageMenuJobId(null)
                          void onSetLaborJobStage(job.id, stage)
                        }}
                      />
                    </td>
                    <td style={{ padding: '0.75rem', verticalAlign: 'middle' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: next.button === 'reoffer' ? 'var(--text-amber-800)' : 'inherit' }}>{next.label}</div>
                      {next.hint ? <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{next.hint}</div> : null}
                      {next.button && next.button !== 'nudge' && next.buttonLabel ? (
                        <button
                          type="button"
                          onClick={() =>
                            next.button === 'draft'
                              ? setAssembler({ jobId, laborJobId: job.id, personId, amount: totalCost > 0 ? totalCost : null })
                              : setAssembler({ commitmentId: coverage.kind === 'none' ? null : coverage.id })
                          }
                          style={{ marginTop: 4, padding: '0.2rem 0.55rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}
                        >
                          {next.buttonLabel}
                        </button>
                      ) : null}
                    </td>
                    <td style={{ padding: '0.75rem', verticalAlign: 'middle' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'stretch' }}>
                        <button type="button" onClick={() => onEditLaborJob(job)} style={{ padding: '0.25rem 0.5rem', background: 'var(--bg-200)', color: 'var(--text-700)', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}>
                          Edit
                        </button>
                        <button type="button" onClick={() => onPrintJobSubSheet(job)} style={{ padding: '0.25rem 0.5rem', background: '#0ea5e9', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}>
                          Print
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem' }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="date"
                        value={dateInputValue}
                        onChange={(e) => onUpdateLaborJobDate(job.id, e.target.value || null)}
                        style={{ padding: '0.25rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
                      />
                    </td>
                    <td style={{ padding: '0.75rem', verticalAlign: 'middle' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'stretch' }}>
                        <button
                          type="button"
                          onClick={() => onOpenMakePayment({ id: job.id, contractor: job.assigned_to_name, hcp: job.job_number ?? '—', totalCost, paid, outstanding: Math.max(0, balance) }, balance > 0 ? String(balance) : '')}
                          style={{ padding: '0.25rem 0.5rem', background: '#059669', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}
                        >
                          Payment
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenBackcharge({ id: job.id, contractor: job.assigned_to_name, hcp: job.job_number ?? '—', totalCost, paid })}
                          style={{ padding: '0.25rem 0.5rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8125rem' }}
                        >
                          Backcharge
                        </button>
                      </div>
                    </td>
                  </tr>,
                  ...(expanded
                    ? [
                        <tr key={`${job.id}-expand`}>
                          <td colSpan={11} style={{ padding: 0, borderBottom: '1px solid var(--border)', background: 'var(--surface)', verticalAlign: 'top' }}>
                            <div onClick={(e) => e.stopPropagation()} style={{ padding: '1rem' }}>
                              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', fontWeight: 500 }}>
                                Total cost: <AmountSmallCents value={totalCost} /> · Paid: <AmountSmallCents value={paid} /> · Backcharges: <AmountSmallCents value={backcharges} />
                              </p>
                              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Invoice link</h4>
                              {job.invoice_link?.trim() ? (
                                <p style={{ margin: '0 0 1rem', fontSize: '0.875rem' }}>
                                  <a
                                    href={normalizeUrl(job.invoice_link)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: 'var(--text-link)', textDecoration: 'none' }}
                                  >
                                    {job.invoice_link}
                                  </a>
                                </p>
                              ) : (
                                <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-faint)' }}>No invoice linked.</p>
                              )}
                              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Specific Work (Line Items)</h4>
                              <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: '1rem' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                  <thead style={{ background: 'var(--bg-subtle)' }}>
                                    <tr>
                                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Fixture</th>
                                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>Count</th>
                                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>hrs/unit</th>
                                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>Labor Hours</th>
                                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Rate</th>
                                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Cost</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(job.items ?? []).map((i, idx) => {
                                      const hrs = Number(i.hrs_per_unit) || 0
                                      const laborHrs = (i.is_fixed ?? false) ? hrs : (Number(i.count) || 0) * hrs
                                      const rate = i.labor_rate != null ? Number(i.labor_rate) : jobRate
                                      const cost = lineLaborCost(i, jobRate)
                                      const isDirect =
                                        i.direct_labor_amount != null && Number.isFinite(Number(i.direct_labor_amount))
                                      return (
                                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                          <td style={{ padding: '0.5rem 0.75rem' }}>{i.fixture ?? '—'}</td>
                                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{isDirect ? '—' : Number(i.count)}</td>
                                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{isDirect ? '—' : hrs.toFixed(2)}</td>
                                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>{isDirect ? '—' : laborHrs.toFixed(2)}</td>
                                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{isDirect ? '—' : <AmountSmallCents value={rate} />}</td>
                                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}><AmountSmallCents value={cost} /></td>
                                        </tr>
                                      )
                                    })}
                                    {(job.items ?? []).length === 0 && (
                                      <tr><td colSpan={6} style={{ padding: '0.75rem', color: 'var(--text-faint)', fontSize: '0.875rem' }}>No line items yet</td></tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Payments</h4>
                              <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                  <thead style={{ background: 'var(--bg-subtle)' }}>
                                    <tr>
                                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Date</th>
                                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Type</th>
                                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)' }}>Amount</th>
                                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>Memo</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(job.payments ?? []).map((p) => (
                                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '0.5rem 0.75rem' }}>{p.payment_date ? new Date(p.payment_date + 'T00:00:00').toLocaleDateString() : p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</td>
                                        <td style={{ padding: '0.5rem 0.75rem', color: Number(p.amount) < 0 ? '#dc2626' : undefined }}>{Number(p.amount) < 0 ? 'Backcharge' : 'Payment'}</td>
                                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: Number(p.amount) < 0 ? '#dc2626' : undefined }}><AmountSmallCents value={Number(p.amount)} /></td>
                                        <td style={{ padding: '0.5rem 0.75rem' }}>{p.memo?.trim() ? p.memo : '—'}</td>
                                      </tr>
                                    ))}
                                    {(job.payments ?? []).length === 0 && (
                                      <tr><td colSpan={4} style={{ padding: '0.75rem', color: 'var(--text-faint)', fontSize: '0.875rem' }}>No payments yet</td></tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>,
                      ]
                    : []),
                ]
              })}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ marginTop: '0.6rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        The rail is the one the sub sees on their portal — Work · Walk-through · Customer pays · Paid — with the office's Drafted · Sent · Signed in front of it. A dashed red run means work is happening with nothing signed. Click the current dot to move the stage.
      </p>
      <WorkOrderAssemblerModal open={assembler != null} onClose={() => setAssembler(null)} jobs={jobs} initial={assembler} authUserId={authUserId} onChanged={() => { void loadCommitments(); emitWorkOrderChanged() }} />
    </div>
  )
}

const STAGE_CHIP_TONES: Record<SubSheetStageTone | 'green', { bg: string; fg: string; border: string }> = {
  amber: { bg: 'var(--bg-amber-100)', fg: 'var(--text-amber-800)', border: 'var(--border-amber)' },
  violet: { bg: 'var(--bg-violet-100)', fg: 'var(--text-violet-700)', border: 'var(--border-violet)' },
  blue: { bg: 'var(--bg-blue-tint)', fg: 'var(--text-blue-700)', border: '#93c5fd' },
  green: { bg: 'var(--bg-green-tint)', fg: 'var(--text-green-700)', border: '#6ee7b7' },
}

/**
 * The stage chip on a ledger row (v2.2767): click the chip for the four
 * stages (jump or step back), the → advances one. A paid sheet (open ≤ $0)
 * reads "Paid" and cannot be moved — the stage is moot once the money moved.
 */
function SubSheetStageCell({
  job,
  rail,
  paid,
  menuOpen,
  onToggleMenu,
  onPick,
}: {
  job: LaborJob
  rail: SheetRailShape
  paid: boolean
  menuOpen: boolean
  onToggleMenu: () => void
  onPick: (stage: SubSheetStage) => void
}) {
  const stage = normalizeSubSheetStage(job.stage)
  const next = nextSubSheetStage(stage)
  const stamp = subSheetStageStamp({
    source: normalizeSubSheetStageSource(job.stage_source),
    changedAt: job.stage_changed_at ?? null,
    changedByName: job.stage_changed_by_name ?? null,
    contractorName: job.assigned_to_name,
  })
  const tone = STAGE_CHIP_TONES[paid ? 'green' : SUB_SHEET_STAGE_TONE[stage]]
  const title = [paid ? 'Paid — the balance is $0' : SUB_SHEET_STAGE_LABEL[stage], stamp ? `last moved by ${stamp}` : null, job.stage_note ? `“${job.stage_note}”` : null]
    .filter(Boolean)
    .join(' · ')
  if (paid) {
    return <SheetRail rail={rail} title={title} />
  }
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
        <SheetRail rail={rail} title={`${title} · click the current dot to move the stage`} onCurrentClick={onToggleMenu} />
        {job.stage_source === 'portal' ? <span style={{ fontSize: '0.68rem', fontWeight: 600, color: tone.fg }} title="The sub moved it from their portal">· sub</span> : null}
        {next ? (
          <button
            type="button"
            title={`Move to ${SUB_SHEET_STAGE_LABEL[next]}`}
            aria-label={`Move to ${SUB_SHEET_STAGE_LABEL[next]}`}
            onClick={() => onPick(next)}
            style={{ background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: 999, padding: '1px 7px', fontSize: '0.72rem', fontWeight: 700, color: tone.fg, cursor: 'pointer' }}
          >
            →
          </button>
        ) : null}
      </span>
      {stamp ? (
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 3, whiteSpace: 'nowrap' }} title={job.stage_note ?? undefined}>
          {stamp}
          {job.stage_note ? ' ✎' : ''}
        </div>
      ) : null}
      {menuOpen && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          style={{ position: 'absolute', top: '100%', left: 0, zIndex: 20, marginTop: 4, width: 260, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, boxShadow: '0 8px 24px -10px rgba(0,0,0,0.3)', padding: '0.3rem', fontSize: '0.8125rem' }}
        >
          {SUB_SHEET_STAGES.map((s) => (
            <button
              key={s}
              type="button"
              role="menuitemradio"
              aria-checked={s === stage}
              onClick={() => onPick(s)}
              style={{ display: 'flex', justifyContent: 'space-between', gap: 8, width: '100%', textAlign: 'left', padding: '0.4rem 0.6rem', borderRadius: 5, border: 'none', background: s === stage ? 'var(--bg-subtle)' : 'transparent', color: 'var(--text-900)', fontWeight: s === stage ? 700 : 500, cursor: 'pointer', font: 'inherit' }}
            >
              <span>{SUB_SHEET_STAGE_LABEL[s]}</span>
              <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.72rem' }}>{SUB_SHEET_STAGE_HINT[s]}</span>
            </button>
          ))}
          <div style={{ borderTop: '1px solid var(--border)', margin: '0.3rem 0.2rem 0', padding: '0.35rem 0.4rem 0.1rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Paid sets itself at $0 open · every move posts to the job&#8217;s Activity feed
          </div>
        </div>
      )}
    </div>
  )
}
