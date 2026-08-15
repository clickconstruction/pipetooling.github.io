import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/format'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { loadTeamLaborData, type TeamLaborRow } from '../../utils/teamLabor'
import {
  buildCrewPnlSummary,
  crewPnlRangeForPreset,
  type CrewPnlJobInput,
  type CrewPnlPersonRow,
  type CrewPnlRange,
  type CrewPnlRangePreset,
  type CrewPnlRosterPerson,
  type CrewPnlTeamLaborInput,
} from '../../lib/crewPnlSummary'
import {
  buildOffsetPaymentTimeline,
  buildPayStatementHtml,
  buildPayStatementPayments,
  offsetSignedAmount,
  paidTotalInRange,
  personOffsetBalances,
  uncoveredApprovedWeeks,
  type ApprovedDayHours,
  type PayStubLike,
  type PersonOffsetLike,
  type PersonWorkDay,
  type StubPaymentLike,
} from '../../lib/people/personMoneyLedger'
import { openPayStubWindow } from '../../lib/peopleDocuments/buildPayStubHtml'

/**
 * The person money ledger (v2.1666, Offsets → Balances): one modal answering
 * "where does this person stand" — offsets (±) and pay-report payments as a
 * dated timeline, the jobs they worked with hours and billing credit (Crew
 * P&L attribution, clocked crew labor only), and the shareable pay statement
 * (hours + jobs, no company revenue). Office-pool surface.
 */

type JobRow = {
  id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  revenue: number | null
  last_work_date: string | null
  team_members: Array<{ user_id: string | null; users: { name: string | null } | { name: string | null }[] | null }> | null
}

export type PersonMoneyLedgerModalProps = {
  personName: string
  offsets: PersonOffsetLike[]
  payStubs: PayStubLike[]
  onClose: () => void
}

const RANGE_OPTIONS: Array<{ value: CrewPnlRangePreset; label: string }> = [
  { value: 'this_year', label: 'This year' },
  { value: 'this_quarter', label: 'This quarter' },
  { value: 'this_month', label: 'This month' },
  { value: 'all', label: 'All time' },
]

type LedgerFilter = 'all' | 'offsets' | 'payments' | 'jobs'

function formatYmdShort(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ymd
  const currentYear = new Date().getFullYear()
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(y !== currentYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  })
}

function signedMoney(n: number): string {
  const abs = `$${formatCurrency(Math.abs(n))}`
  return n < 0 ? `−${abs}` : `+${abs}`
}

export default function PersonMoneyLedgerModal({ personName, offsets, payStubs, onClose }: PersonMoneyLedgerModalProps) {
  const [teamLabor, setTeamLabor] = useState<TeamLaborRow[] | null>(null)
  const [jobs, setJobs] = useState<JobRow[] | null>(null)
  const [roster, setRoster] = useState<CrewPnlRosterPerson[]>([])
  const [stubPayments, setStubPayments] = useState<StubPaymentLike[]>([])
  const [approvedDayHours, setApprovedDayHours] = useState<ApprovedDayHours[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [preset, setPreset] = useState<CrewPnlRangePreset>('this_year')
  const [filter, setFilter] = useState<LedgerFilter>('all')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const stubIds = payStubs.map((s) => s.id)
        const [labor, peopleRes, paymentsRes, hoursRes] = await Promise.all([
          loadTeamLaborData(supabase),
          supabase.from('people').select('id, name, account_user_id'),
          stubIds.length > 0
            ? supabase.from('pay_stub_payments').select('id, pay_stub_id, amount, paid_at, memo').in('pay_stub_id', stubIds)
            : Promise.resolve({ data: [], error: null }),
          // Approved day hours (the Hours grid, payroll's source of truth) —
          // days here with no covering pay report = "no pay report yet".
          supabase.from('people_hours').select('work_date, hours').eq('person_name', personName.trim()),
        ])
        if (cancelled) return
        setTeamLabor(labor)
        setStubPayments((paymentsRes.data ?? []) as StubPaymentLike[])
        setApprovedDayHours(
          ((hoursRes.data ?? []) as Array<{ work_date: string; hours: number }>).map((h) => ({ workDate: h.work_date, hours: h.hours })),
        )
        setRoster(
          ((peopleRes.data ?? []) as Array<{ id: string; name: string | null; account_user_id: string | null }>).map((p) => ({
            id: p.id,
            name: p.name,
            accountUserId: p.account_user_id,
          })),
        )
        // Complete jobs list, PAGINATED past PostgREST's 1000-row cap (the
        // v2.977/978 Crew P&L incidents) — partial data is worse than none.
        const PAGE = 1000
        const acc: JobRow[] = []
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabase
            .from('jobs_ledger')
            .select('id, hcp_number, click_number, job_name, revenue, last_work_date, team_members:jobs_ledger_team_members(user_id, users(name))')
            .order('created_at', { ascending: true })
            .range(from, from + PAGE - 1)
          if (cancelled) return
          if (error) throw error
          const rows = (data ?? []) as unknown as JobRow[]
          acc.push(...rows)
          if (rows.length < PAGE) break
        }
        if (!cancelled) setJobs(acc)
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const range: CrewPnlRange = useMemo(
    () => crewPnlRangeForPreset(calendarYmdInAppTzFromIso(new Date().toISOString()), preset),
    [preset],
  )

  const personRow: CrewPnlPersonRow | null = useMemo(() => {
    if (!teamLabor || !jobs) return null
    const jobInputs: CrewPnlJobInput[] = jobs.map((j) => ({
      id: j.id,
      jobLabel: (j.job_name ?? '').trim() || (j.hcp_number ?? '').trim() || (j.click_number ?? '').trim() || j.id.slice(0, 8),
      revenue: j.revenue,
      teamMembers: (j.team_members ?? []).map((m) => {
        const u = Array.isArray(m.users) ? (m.users[0] ?? null) : m.users
        return { userId: m.user_id, userName: u?.name ?? null }
      }),
      fallbackDate: j.last_work_date,
    }))
    const laborInputs: CrewPnlTeamLaborInput[] = teamLabor.map((r) => ({
      jobId: r.jobId,
      breakdown: r.breakdown.map((b) => ({ personName: b.personName, personId: b.personId, byWorkDate: b.byWorkDate })),
    }))
    const summary = buildCrewPnlSummary({ jobs: jobInputs, teamLabor: laborInputs, subLabor: [], people: roster, range })
    const target = personName.trim().toLowerCase()
    return summary.rows.find((r) => r.displayName.trim().toLowerCase() === target) ?? null
  }, [teamLabor, jobs, roster, range, personName])

  /** The person's per-day job hours (statement lines) — clocked crew labor. */
  const workDays: PersonWorkDay[] = useMemo(() => {
    if (!teamLabor) return []
    const target = personName.trim().toLowerCase()
    const out: PersonWorkDay[] = []
    for (const row of teamLabor) {
      for (const b of row.breakdown) {
        if (b.personName.trim().toLowerCase() !== target) continue
        for (const d of b.byWorkDate) {
          out.push({ workDate: d.workDate, hours: d.hours, jobLabel: (row.jobName ?? '').trim() || row.hcpNumber || row.jobId.slice(0, 8) })
        }
      }
    }
    return out
  }, [teamLabor, personName])

  const uncoveredWeeks = useMemo(
    () => uncoveredApprovedWeeks({ dayHours: approvedDayHours, payStubs }),
    [approvedDayHours, payStubs],
  )

  const timeline = useMemo(
    () => buildOffsetPaymentTimeline({ offsets, payStubs, stubPayments, uncoveredWeeks }),
    [offsets, payStubs, stubPayments, uncoveredWeeks],
  )

  const inRange = (ymd: string) => (range.start == null || ymd >= range.start) && (range.end == null || ymd <= range.end)
  const visibleTimeline = useMemo(
    () =>
      timeline
        .filter((r) => inRange(r.dateYmd))
        .filter((r) => (filter === 'offsets' ? r.kind === 'offset' : filter === 'payments' ? r.kind !== 'offset' : true)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inRange derives from range
    [timeline, filter, range],
  )

  const paidInRange = useMemo(
    () => paidTotalInRange({ payStubs, stubPayments, rangeStart: range.start, rangeEnd: range.end }),
    [payStubs, stubPayments, range],
  )
  const offsetsNetInRange = useMemo(
    () => offsets.reduce((s, o) => (inRange(o.occurred_date) ? s + offsetSignedAmount(o.type, o.amount) : s), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- inRange derives from range
    [offsets, range],
  )
  const pendingBalance = useMemo(() => personOffsetBalances(offsets)[0]?.pendingNet ?? 0, [offsets])

  function openStatement() {
    const payments = buildPayStatementPayments({
      payStubs,
      offsets,
      workDays,
      stubPayments,
      rangeStart: range.start,
      rangeEnd: range.end,
    })
    const rangeLabel =
      range.start == null && range.end == null
        ? 'All time'
        : `${range.start ? formatYmdShort(range.start) : '…'} – ${range.end ? formatYmdShort(range.end) : 'today'}`
    const html = buildPayStatementHtml({
      personName,
      companyName: 'Click Plumbing',
      rangeLabel,
      payments,
      generatedYmd: calendarYmdInAppTzFromIso(new Date().toISOString()),
    })
    openPayStubWindow(html, false)
  }

  const chip = (tone: 'plain' | 'amber' | 'red' | 'green' | 'sky', text: string): React.ReactNode => (
    <span
      style={{
        padding: '0.15rem 0.6rem',
        borderRadius: 999,
        fontSize: '0.6875rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        background:
          tone === 'amber'
            ? 'var(--bg-amber-100)'
            : tone === 'red'
              ? 'var(--bg-red-100)'
              : tone === 'green'
                ? 'var(--bg-green-100)'
                : tone === 'sky'
                  ? 'var(--bg-sky-tint)'
                  : 'var(--bg-subtle)',
        color:
          tone === 'amber'
            ? 'var(--text-amber-800)'
            : tone === 'red'
              ? 'var(--text-red-700)'
              : tone === 'green'
                ? 'var(--text-green-800)'
                : tone === 'sky'
                  ? 'var(--text-link)'
                  : 'var(--text-muted)',
      }}
    >
      {text}
    </span>
  )

  const statCard = (label: string, value: string, tone?: 'red' | 'green'): React.ReactNode => (
    <div style={{ flex: '1 1 130px', minWidth: 120, background: 'var(--bg-subtle)', borderRadius: 8, padding: '0.55rem 0.75rem' }}>
      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: '1.0625rem', fontWeight: 600, color: tone === 'red' ? 'var(--text-red-700)' : tone === 'green' ? 'var(--text-green-800)' : undefined }}>
        {value}
      </div>
    </div>
  )

  const pillStyle = (active: boolean): CSSProperties => ({
    padding: '0.2rem 0.75rem',
    borderRadius: 999,
    fontSize: '0.75rem',
    cursor: 'pointer',
    border: active ? '1px solid #3b82f6' : '1px solid var(--border-strong)',
    background: active ? '#3b82f6' : 'var(--surface)',
    color: active ? '#fff' : 'var(--text-muted)',
  })

  const jobsLoading = teamLabor == null || jobs == null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
      <div style={{ background: 'var(--surface)', padding: '1.25rem 1.5rem', borderRadius: 8, width: 'min(680px, 94vw)', maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <h3 style={{ margin: 0 }}>{personName}</h3>
          {pendingBalance !== 0
            ? chip(pendingBalance < 0 ? 'red' : 'green', `balance ${signedMoney(pendingBalance)}`)
            : chip('plain', 'settled')}
          {uncoveredWeeks.length > 0 &&
            chip('red', `${uncoveredWeeks.length} week${uncoveredWeeks.length === 1 ? '' : 's'} with no pay report`)}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value as CrewPnlRangePreset)}
              aria-label="Date range"
              style={{ padding: '0.3rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.8125rem', background: 'var(--surface)' }}
            >
              {RANGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={openStatement}
              style={{ padding: '0.35rem 0.8rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer', fontSize: '0.8125rem' }}
            >
              Pay statement
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close ledger"
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.1rem', cursor: 'pointer', padding: '0 0.2rem' }}
            >
              ✕
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', margin: '0.5rem 0 0.75rem' }}>
          {statCard('Paid in range', `$${formatCurrency(paidInRange)}`)}
          {statCard('Billing credit (jobs)', jobsLoading ? '…' : `$${formatCurrency(personRow?.billing ?? 0)}`)}
          {statCard('Offsets net', signedMoney(offsetsNetInRange), offsetsNetInRange < 0 ? 'red' : offsetsNetInRange > 0 ? 'green' : undefined)}
        </div>

        <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.5rem' }}>
          {(['all', 'offsets', 'payments', 'jobs'] as LedgerFilter[]).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} style={pillStyle(filter === f)}>
              {f === 'all' ? 'All' : f === 'offsets' ? 'Offsets' : f === 'payments' ? 'Payments' : 'Jobs'}
            </button>
          ))}
        </div>

        {loadError && <p style={{ color: 'var(--text-red-700)', fontSize: '0.8125rem' }}>{loadError}</p>}

        {filter === 'jobs' ? (
          jobsLoading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading job history…</p>
          ) : personRow == null || personRow.perJob.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>No clocked job labor in this range.</p>
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ display: 'flex', gap: '0.6rem', padding: '0.45rem 0.9rem', background: 'var(--bg-subtle)', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', fontWeight: 600 }}>
                <span style={{ flex: 1 }}>Job</span>
                <span style={{ width: 64, textAlign: 'right' }}>Hours</span>
                <span style={{ width: 100, textAlign: 'right' }}>Billing credit</span>
              </div>
              {personRow.perJob.map((l, i) => (
                <div key={`${l.jobId ?? 'x'}-${i}`} style={{ display: 'flex', gap: '0.6rem', padding: '0.45rem 0.9rem', borderTop: '1px solid var(--border)', fontSize: '0.8125rem', alignItems: 'center' }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    {l.label}
                    {l.estimated && <span style={{ color: 'var(--text-muted)', fontSize: '0.6875rem' }}> · estimated split</span>}
                  </span>
                  <span style={{ width: 64, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{l.hours.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                  <span style={{ width: 100, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>${formatCurrency(l.billing)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '0.6rem', padding: '0.45rem 0.9rem', borderTop: '1px solid var(--border-strong)', fontSize: '0.8125rem', fontWeight: 600 }}>
                <span style={{ flex: 1 }}>Total (clocked crew labor)</span>
                <span style={{ width: 64, textAlign: 'right' }}>{personRow.hours.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                <span style={{ width: 100, textAlign: 'right' }}>${formatCurrency(personRow.billing)}</span>
              </div>
            </div>
          )
        ) : visibleTimeline.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>Nothing in this range.</p>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {visibleTimeline.map((r, i) => (
              <div key={r.key} style={{ display: 'flex', gap: '0.6rem', padding: '0.5rem 0.9rem', borderTop: i === 0 ? 'none' : '1px solid var(--border)', fontSize: '0.8125rem', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', width: 66, flexShrink: 0 }}>{formatYmdShort(r.dateYmd)}</span>
                {chip(
                  r.kind === 'payment'
                    ? 'green'
                    : r.kind === 'payment_pending'
                      ? 'amber'
                      : r.kind === 'unreported'
                        ? 'red'
                        : r.amount < 0
                          ? 'red'
                          : 'green',
                  r.typeLabel,
                )}
                <span style={{ flex: 1, minWidth: 0 }}>
                  {r.label}
                  {r.kind === 'offset' && r.applied && <span style={{ color: 'var(--text-muted)', fontSize: '0.6875rem' }}> · applied</span>}
                </span>
                <span
                  style={{
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 600,
                    color: r.kind === 'offset' ? (r.amount < 0 ? 'var(--text-red-700)' : 'var(--text-green-800)') : r.kind === 'payment_pending' ? 'var(--text-muted)' : undefined,
                  }}
                >
                  {r.kind === 'unreported' ? '—' : r.kind === 'offset' ? signedMoney(r.amount) : `$${formatCurrency(r.amount)}`}
                </span>
              </div>
            ))}
          </div>
        )}

        <p style={{ margin: '0.6rem 0 0', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
          Job figures use clocked crew labor (Crew P&L attribution); sub-sheet labor isn't included yet. The pay statement shares hours and job names only.
        </p>
      </div>
    </div>
  )
}
