import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { denverCalendarDayKey } from '../../utils/dateUtils'
import { payWeekContaining } from '../../lib/payWeekAnchor'
import { fetchOverheadOfficeJobLedgerIdFromAppSettings } from '../../lib/overheadOfficeJobSettings'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { buildYourRecordItems, yourRecordItemCopy, type YourRecordItem, type YourRecordJob, type YourRecordSession } from '../../lib/dashboardYourRecord'
import type { UserRole } from '../../hooks/useAuth'
import FieldPctUpdateModal from './FieldPctUpdateModal'
import AdditionalReportModal from '../AdditionalReportModal'
import { DashboardMyTimeDayEditorModal } from '../DashboardMyTimeDayEditorModal'

/**
 * Your record (v2.3368): up to three things only this person can put right —
 * a clock left running from a past day, an open job they worked with no %
 * complete, a job they worked with no field report from them. Their own
 * units, no money; renders nothing when the record is clean. Owns its three
 * doors (the field % modal, the leave-report modal, the My Time day editor)
 * so it can sit on the Job Mode card and the full Dashboard alike.
 */

const hoursOf = (inIso: string, outIso: string | null): number => {
  if (!outIso) return 0
  const h = (Date.parse(outIso) - Date.parse(inIso)) / 3_600_000
  return Number.isFinite(h) && h > 0 ? h : 0
}

type SessionRow = { id: string; job_ledger_id: string | null; work_date: string; clocked_in_at: string; clocked_out_at: string | null }
type JobRow = { id: string; hcp_number: string | null; click_number: string | null; job_name: string | null; job_address: string | null; pct_complete: number | null; status: string | null }

async function loadYourRecord(userId: string): Promise<YourRecordItem[]> {
  const todayYmd = denverCalendarDayKey(Date.now())
  const weekStart = payWeekContaining(todayYmd).start
  const [weekRows, openRows, officeJobId] = await Promise.all([
    withSupabaseRetry(
      async () =>
        supabase
          .from('clock_sessions')
          .select('id, job_ledger_id, work_date, clocked_in_at, clocked_out_at')
          .eq('user_id', userId)
          .gte('work_date', weekStart)
          .lte('work_date', todayYmd)
          .is('rejected_at', null)
          .is('revoked_at', null)
          .limit(500),
      'your record week sessions',
    ) as Promise<SessionRow[] | null>,
    withSupabaseRetry(
      async () => supabase.from('clock_sessions').select('id, job_ledger_id, work_date, clocked_in_at, clocked_out_at').eq('user_id', userId).is('clocked_out_at', null).is('revoked_at', null).limit(20),
      'your record open sessions',
    ) as Promise<SessionRow[] | null>,
    fetchOverheadOfficeJobLedgerIdFromAppSettings().catch(() => null),
  ])
  const byId = new Map<string, SessionRow>()
  for (const r of [...(weekRows ?? []), ...(openRows ?? [])]) byId.set(r.id, r)
  const sessions: YourRecordSession[] = [...byId.values()].map((r) => ({ id: r.id, jobId: r.job_ledger_id, workDate: r.work_date, clockedOutAt: r.clocked_out_at, hours: hoursOf(r.clocked_in_at, r.clocked_out_at) }))
  const jobIds = [...new Set(sessions.map((s) => s.jobId).filter((v): v is string => !!v))]
  const jobsById = new Map<string, YourRecordJob>()
  const reportedJobIds = new Set<string>()
  if (jobIds.length > 0) {
    const [jobRows, reportRows] = await Promise.all([
      withSupabaseRetry(async () => supabase.from('jobs_ledger').select('id, hcp_number, click_number, job_name, job_address, pct_complete, status').in('id', jobIds), 'your record jobs') as Promise<JobRow[] | null>,
      withSupabaseRetry(
        async () => supabase.from('reports').select('job_ledger_id').eq('created_by_user_id', userId).in('job_ledger_id', jobIds).gte('created_at', `${weekStart}T00:00:00-06:00`),
        'your record reports',
      ) as Promise<Array<{ job_ledger_id: string | null }> | null>,
    ])
    for (const j of jobRows ?? []) {
      jobsById.set(j.id, {
        id: j.id,
        hcpNumber: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '',
        jobName: (j.job_name ?? '').trim(),
        jobAddress: (j.job_address ?? '').trim(),
        pctComplete: j.pct_complete == null ? null : Number(j.pct_complete),
        status: j.status,
      })
    }
    for (const r of reportRows ?? []) if (r.job_ledger_id) reportedJobIds.add(r.job_ledger_id)
  }
  return buildYourRecordItems({ todayYmd, weekStart, sessions, jobsById, reportedJobIds, officeJobId })
}

const rowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.6rem', alignItems: 'center', padding: '0.55rem 0.7rem', borderLeft: '4px solid #f59e0b', background: 'var(--surface)', borderRadius: 6 }
const btnStyle: CSSProperties = { font: 'inherit', fontSize: '0.8rem', fontWeight: 700, padding: '0.35rem 0.75rem', borderRadius: 6, border: 'none', background: '#b45309', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }

export default function DashboardYourRecordCard({ userId, role, displayName, isSalary }: { userId: string; role: UserRole | null; displayName: string; isSalary: boolean }) {
  const [items, setItems] = useState<YourRecordItem[] | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [pctJob, setPctJob] = useState<YourRecordJob | null>(null)
  const [reportJob, setReportJob] = useState<YourRecordJob | null>(null)
  const [fixDay, setFixDay] = useState<string | null>(null)
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const next = await loadYourRecord(userId)
        if (!cancelled) setItems(next)
      } catch {
        if (!cancelled) setItems([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, refreshKey])

  useEffect(() => {
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  if (!items || items.length === 0) return null

  const open = (item: YourRecordItem) => {
    if (item.key === 'no-pct') setPctJob(item.job)
    else if (item.key === 'no-report') setReportJob(item.job)
    else setFixDay(item.ymd)
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem', marginTop: '0.75rem' }} data-testid="dashboard-your-record">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 700 }}>Your record</h2>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>this week · {items.length === 1 ? 'one thing' : `${items.length} things`} only you can fix</span>
      </div>
      <div style={{ display: 'grid', gap: '0.45rem' }}>
        {items.map((item) => {
          const c = yourRecordItemCopy(item)
          const k = item.key === 'clock-open' ? `open:${item.sessionId}` : `${item.key}:${item.jobId}`
          return (
            <div key={k} style={rowStyle}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{c.title}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.detail}</div>
              </div>
              <button type="button" onClick={() => open(item)} style={btnStyle}>
                {c.action}
              </button>
            </div>
          )
        })}
      </div>
      {pctJob ? (
        <FieldPctUpdateModal
          job={{ id: pctJob.id, hcpNumber: pctJob.hcpNumber, jobName: pctJob.jobName, label: `${pctJob.hcpNumber} · ${pctJob.jobName}`.replace(/^ · /, '') }}
          onClose={() => setPctJob(null)}
          onSaved={() => {
            setPctJob(null)
            refresh()
          }}
        />
      ) : null}
      {reportJob ? (
        <AdditionalReportModal
          open
          onClose={() => setReportJob(null)}
          onSaved={() => {
            setReportJob(null)
            refresh()
          }}
          onReportSaved={refresh}
          authUserId={userId}
          userRole={role}
          jobId={reportJob.id}
          hcpNumber={reportJob.hcpNumber}
          jobName={reportJob.jobName}
          jobAddress={reportJob.jobAddress}
        />
      ) : null}
      {fixDay ? (
        <DashboardMyTimeDayEditorModal
          dateStr={fixDay}
          sessions={[]}
          subjectUserId={userId}
          subjectDisplayName={displayName}
          showSalariedLabelUnderVisualStrip={isSalary}
          prefetchSalarySessionsWhenEmpty
          jobLabels={{}}
          bidLabels={{}}
          onClose={() => setFixDay(null)}
          onSaved={() => {
            setFixDay(null)
            refresh()
          }}
        />
      ) : null}
    </div>
  )
}
