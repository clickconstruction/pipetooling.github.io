import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/format'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { fetchLaborPayConfigMap, loadTeamLaborData, type TeamLaborRow } from '../../utils/teamLabor'
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
  buildPayStatementHtml,
  buildPayStatementPayments,
  buildWeeklyHistoryGroups,
  personSettleUp,
  priceUncoveredWeeks,
  uncoveredApprovedWeeks,
  type ApprovedDayHours,
  type PayStubLike,
  type PersonOffsetLike,
  type PersonWorkDay,
  type StubPaymentLike,
} from '../../lib/people/personMoneyLedger'
import { openPayStubWindow } from '../../lib/peopleDocuments/buildPayStubHtml'

/**
 * The person money ledger (v2.1668 settle-up redesign, owner-approved
 * mockups): equation banner first (unpaid + unreported-priced + credits −
 * charges = the number), then a Needs-action list where every line has its
 * verb, with History (weekly blocks: report + payments + that week's offsets)
 * and Jobs (Crew P&L attribution) folded behind toggles. All-time — no range
 * picker hiding old offsets. Office-pool surface.
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
  /** Open the existing apply-to-report modal for a pending charge (closes this ledger first). */
  onApplyOffset?: (offsetId: string) => void
}

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

function money(n: number): string {
  return `$${formatCurrency(Math.abs(n))}`
}

const JOBS_RANGE_OPTIONS: Array<{ value: CrewPnlRangePreset; label: string }> = [
  { value: 'this_year', label: 'This year' },
  { value: 'this_quarter', label: 'This quarter' },
  { value: 'this_month', label: 'This month' },
  { value: 'all', label: 'All time' },
]

export default function PersonMoneyLedgerModal({ personName, offsets, payStubs, onClose, onApplyOffset }: PersonMoneyLedgerModalProps) {
  const [, setSearchParams] = useSearchParams()
  const [teamLabor, setTeamLabor] = useState<TeamLaborRow[] | null>(null)
  const [jobs, setJobs] = useState<JobRow[] | null>(null)
  const [roster, setRoster] = useState<CrewPnlRosterPerson[]>([])
  const [stubPayments, setStubPayments] = useState<StubPaymentLike[] | null>(null)
  const [approvedDayHours, setApprovedDayHours] = useState<ApprovedDayHours[]>([])
  const [hourlyWage, setHourlyWage] = useState<number | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [jobsOpen, setJobsOpen] = useState(false)
  const [jobsPreset, setJobsPreset] = useState<CrewPnlRangePreset>('this_year')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const stubIds = payStubs.map((s) => s.id)
        const [labor, peopleRes, paymentsRes, hoursRes, payConfig] = await Promise.all([
          loadTeamLaborData(supabase),
          supabase.from('people').select('id, name, account_user_id'),
          stubIds.length > 0
            ? supabase.from('pay_stub_payments').select('id, pay_stub_id, amount, paid_at, memo').in('pay_stub_id', stubIds)
            : Promise.resolve({ data: [], error: null }),
          supabase.from('people_hours').select('work_date, hours').eq('person_name', personName.trim()),
          fetchLaborPayConfigMap(supabase, [personName.trim()]),
        ])
        if (cancelled) return
        setTeamLabor(labor)
        setRoster(
          ((peopleRes.data ?? []) as Array<{ id: string; name: string | null; account_user_id: string | null }>).map((p) => ({
            id: p.id,
            name: p.name,
            accountUserId: p.account_user_id,
          })),
        )
        setStubPayments((paymentsRes.data ?? []) as StubPaymentLike[])
        setApprovedDayHours(
          ((hoursRes.data ?? []) as Array<{ work_date: string; hours: number }>).map((h) => ({ workDate: h.work_date, hours: h.hours })),
        )
        const wage = payConfig[personName.trim()]?.hourly_wage
        setHourlyWage(wage != null && wage > 0 ? wage : null)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one load per open
  }, [personName])

  const pricedWeeks = useMemo(
    () => priceUncoveredWeeks(uncoveredApprovedWeeks({ dayHours: approvedDayHours, payStubs }), hourlyWage),
    [approvedDayHours, payStubs, hourlyWage],
  )

  const settle = useMemo(
    () => personSettleUp({ payStubs, stubPayments: stubPayments ?? [], offsets, pricedWeeks }),
    [payStubs, stubPayments, offsets, pricedWeeks],
  )

  const weeklyGroups = useMemo(
    () => buildWeeklyHistoryGroups({ payStubs, stubPayments: stubPayments ?? [], offsets }),
    [payStubs, stubPayments, offsets],
  )

  const unpaidStubs = useMemo(() => {
    const paidByStub = new Map<string, number>()
    for (const p of stubPayments ?? []) paidByStub.set(p.pay_stub_id, (paidByStub.get(p.pay_stub_id) ?? 0) + Number(p.amount))
    return payStubs
      .map((s) => {
        const paid = paidByStub.get(s.id)
        if (paid == null && s.paid_at != null) return null
        const remaining = Math.round((s.gross_pay - (paid ?? 0)) * 100) / 100
        return remaining > 0.01 ? { stub: s, remaining, partial: (paid ?? 0) > 0 } : null
      })
      .filter((x): x is { stub: PayStubLike; remaining: number; partial: boolean } => x != null)
      .sort((a, b) => b.stub.period_start.localeCompare(a.stub.period_start))
  }, [payStubs, stubPayments])

  const pendingOffsets = useMemo(
    () => offsets.filter((o) => o.pay_stub_id == null).sort((a, b) => b.occurred_date.localeCompare(a.occurred_date)),
    [offsets],
  )

  const jobsRange: CrewPnlRange = useMemo(
    () => crewPnlRangeForPreset(calendarYmdInAppTzFromIso(new Date().toISOString()), jobsPreset),
    [jobsPreset],
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
    const summary = buildCrewPnlSummary({ jobs: jobInputs, teamLabor: laborInputs, subLabor: [], people: roster, range: jobsRange })
    const target = personName.trim().toLowerCase()
    return summary.rows.find((r) => r.displayName.trim().toLowerCase() === target) ?? null
  }, [teamLabor, jobs, roster, jobsRange, personName])

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

  function openStatement() {
    const payments = buildPayStatementPayments({
      payStubs,
      offsets,
      workDays,
      stubPayments: stubPayments ?? [],
      rangeStart: null,
      rangeEnd: null,
    })
    const html = buildPayStatementHtml({
      personName,
      companyName: 'Click Plumbing',
      rangeLabel: 'All payments on record',
      payments,
      generatedYmd: calendarYmdInAppTzFromIso(new Date().toISOString()),
    })
    openPayStubWindow(html, false)
  }

  function goToPayroll() {
    onClose()
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.set('tab', 'payroll')
      return next
    })
  }

  const chip = (tone: 'plain' | 'amber' | 'red' | 'green', text: string): React.ReactNode => (
    <span
      style={{
        padding: '0.15rem 0.6rem',
        borderRadius: 999,
        fontSize: '0.6875rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        background:
          tone === 'amber' ? 'var(--bg-amber-100)' : tone === 'red' ? 'var(--bg-red-100)' : tone === 'green' ? 'var(--bg-green-100)' : 'var(--bg-subtle)',
        color:
          tone === 'amber' ? 'var(--text-amber-800)' : tone === 'red' ? 'var(--text-red-700)' : tone === 'green' ? 'var(--text-green-800)' : 'var(--text-muted)',
      }}
    >
      {text}
    </span>
  )

  const actionBtn: CSSProperties = {
    padding: '0.3rem 0.7rem',
    fontSize: '0.75rem',
    border: '1px solid var(--border-strong)',
    borderRadius: 6,
    background: 'var(--surface)',
    cursor: 'pointer',
    flexShrink: 0,
  }

  const rowStyle = (i: number): CSSProperties => ({
    display: 'flex',
    gap: '0.6rem',
    padding: '0.5rem 0.9rem',
    borderTop: i === 0 ? 'none' : '1px solid var(--border)',
    fontSize: '0.8125rem',
    alignItems: 'center',
    flexWrap: 'wrap',
  })

  const sectionToggle = (open: boolean, onClick: () => void, label: string): React.ReactNode => (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        width: '100%',
        textAlign: 'left',
        padding: '0.55rem 0.9rem',
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'var(--surface)',
        color: 'var(--text-muted)',
        fontSize: '0.8125rem',
        cursor: 'pointer',
        marginTop: '0.75rem',
      }}
    >
      <span aria-hidden="true" style={{ display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.1s' }}>›</span>
      {label}
    </button>
  )

  const paymentsLoading = stubPayments == null
  const settleTone = settle.net > 0 ? 'green' : settle.net < 0 ? 'red' : 'plain'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
      <div style={{ background: 'var(--surface)', padding: '1.25rem 1.5rem', borderRadius: 8, width: 'min(680px, 94vw)', maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
          <h3 style={{ margin: 0 }}>{personName}</h3>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button type="button" onClick={openStatement} style={{ ...actionBtn, fontSize: '0.8125rem', padding: '0.35rem 0.8rem' }}>
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

        {loadError && <p style={{ color: 'var(--text-red-700)', fontSize: '0.8125rem' }}>{loadError}</p>}

        <div
          role="status"
          style={{
            borderRadius: 8,
            padding: '0.65rem 0.9rem',
            marginBottom: '0.85rem',
            fontSize: '0.8125rem',
            background: settleTone === 'red' ? 'var(--bg-red-100)' : settleTone === 'green' ? 'var(--bg-green-100)' : 'var(--bg-subtle)',
            color: settleTone === 'red' ? 'var(--text-red-700)' : settleTone === 'green' ? 'var(--text-green-800)' : 'var(--text-muted)',
          }}
        >
          {paymentsLoading ? (
            'Doing the math…'
          ) : (
            <>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                Unpaid reports {money(settle.unpaidRemaining)}
                {settle.unreportedHours > 0 && (
                  <> + unreported {settle.unreportedEst != null ? `~${money(settle.unreportedEst)}` : `${settle.unreportedHours} h (no wage on file)`}</>
                )}
                {' '}+ credits {money(settle.credits)} − charges {money(settle.charges)} ={' '}
              </span>
              <strong>
                {settle.net > 0
                  ? `pay ${personName} ${money(settle.net)}`
                  : settle.net < 0
                    ? `${personName} owes the company ${money(settle.net)}`
                    : 'settled'}
              </strong>
              {settle.netMissingUnpricedHours && <> (plus {settle.unreportedHours} unpriced hours)</>}
            </>
          )}
        </div>

        <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.4rem' }}>Needs action</div>
        {paymentsLoading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', margin: 0 }}>Loading…</p>
        ) : unpaidStubs.length === 0 && pricedWeeks.length === 0 && pendingOffsets.length === 0 ? (
          <p style={{ color: 'var(--text-green-800)', fontSize: '0.8125rem', margin: 0 }}>Nothing needs action — all settled.</p>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {unpaidStubs.map((u, i) => (
              <div key={u.stub.id} style={rowStyle(i)}>
                {chip('amber', u.partial ? 'Partly paid' : 'Unpaid')}
                <span style={{ flex: 1, minWidth: 160 }}>
                  Report {formatYmdShort(u.stub.period_start)} – {formatYmdShort(u.stub.period_end)} · {u.stub.hours_total} h
                </span>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>${formatCurrency(u.remaining)}</span>
                <button type="button" style={actionBtn} onClick={goToPayroll}>
                  Record payment
                </button>
              </div>
            ))}
            {pricedWeeks.length > 0 && (
              <div style={rowStyle(unpaidStubs.length)}>
                {chip('red', 'No report')}
                <span style={{ flex: 1, minWidth: 160 }}>
                  {pricedWeeks.length} week{pricedWeeks.length === 1 ? '' : 's'}, {formatYmdShort(pricedWeeks[pricedWeeks.length - 1]!.weekStart)} –{' '}
                  {formatYmdShort(pricedWeeks[0]!.weekEnd)} · {settle.unreportedHours} h approved
                </span>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: settle.unreportedEst == null ? 'var(--text-muted)' : undefined }}>
                  {settle.unreportedEst != null ? `~$${formatCurrency(settle.unreportedEst)}` : '—'}
                </span>
                <button type="button" style={actionBtn} onClick={goToPayroll}>
                  Draft reports
                </button>
              </div>
            )}
            {pendingOffsets.map((o, i) => {
              const signed = o.type === 'employee_credit' ? o.amount : -o.amount
              return (
                <div key={o.id} style={rowStyle(unpaidStubs.length + (pricedWeeks.length > 0 ? 1 : 0) + i)}>
                  {chip(signed < 0 ? 'red' : 'green', signed < 0 ? 'Charge' : 'Credit')}
                  <span style={{ flex: 1, minWidth: 160 }}>
                    {(o.description ?? '').trim() || o.type} · {formatYmdShort(o.occurred_date)}
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: signed < 0 ? 'var(--text-red-700)' : 'var(--text-green-800)' }}>
                    {signed < 0 ? '−' : '+'}${formatCurrency(Math.abs(signed))}
                  </span>
                  {signed < 0 && onApplyOffset ? (
                    <button type="button" style={actionBtn} onClick={() => onApplyOffset(o.id)}>
                      Apply to report
                    </button>
                  ) : (
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>counts toward next payment</span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {sectionToggle(
          historyOpen,
          () => setHistoryOpen((v) => !v),
          `History — ${weeklyGroups.length} week${weeklyGroups.length === 1 ? '' : 's'} of reports, payments, and offsets`,
        )}
        {historyOpen && (
          <div style={{ marginTop: '0.5rem' }}>
            {weeklyGroups.map((g) => (
              <div key={g.weekStart} style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: '0.5rem', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.9rem', background: 'var(--bg-subtle)', fontSize: '0.8125rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600 }}>
                    Week {formatYmdShort(g.weekStart)} – {formatYmdShort(g.weekEnd)}
                  </span>
                  {g.reportHours != null && <span style={{ color: 'var(--text-muted)' }}>· {g.reportHours} h</span>}
                  <span style={{ marginLeft: 'auto' }}>
                    {g.remaining != null && g.remaining > 0.01
                      ? chip('amber', `$${formatCurrency(g.remaining)} still owed`)
                      : g.reportGross != null
                        ? chip('green', 'paid')
                        : null}
                  </span>
                </div>
                {g.reportGross != null && (
                  <div style={{ padding: '0.35rem 0.9rem 0.35rem 1.6rem', fontSize: '0.8125rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
                    Report ${formatCurrency(g.reportGross)}
                    {g.legacyPaid && ' — marked paid'}
                  </div>
                )}
                {g.payments.map((p, i) => (
                  <div key={`${g.weekStart}-p-${i}`} style={{ padding: '0.35rem 0.9rem 0.35rem 1.6rem', fontSize: '0.8125rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem' }}>
                    <span style={{ flex: 1 }}>
                      Paid {formatYmdShort(p.dateYmd)}
                      {p.memo ? ` · ${p.memo}` : ''}
                    </span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>${formatCurrency(p.amount)}</span>
                  </div>
                ))}
                {g.offsets.map((o, i) => (
                  <div key={`${g.weekStart}-o-${i}`} style={{ padding: '0.35rem 0.9rem 0.35rem 1.6rem', fontSize: '0.8125rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem' }}>
                    <span style={{ flex: 1, color: 'var(--text-muted)' }}>
                      {o.typeLabel} · {o.label}
                      {o.applied ? ' · applied' : ' · pending'}
                    </span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', color: o.amount < 0 ? 'var(--text-red-700)' : 'var(--text-green-800)' }}>
                      {o.amount < 0 ? '−' : '+'}${formatCurrency(Math.abs(o.amount))}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {sectionToggle(jobsOpen, () => setJobsOpen((v) => !v), 'Jobs worked — hours and billing credit (Crew P&L attribution)')}
        {jobsOpen && (
          <div style={{ marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.4rem' }}>
              <select
                value={jobsPreset}
                onChange={(e) => setJobsPreset(e.target.value as CrewPnlRangePreset)}
                aria-label="Jobs date range"
                style={{ padding: '0.25rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 6, fontSize: '0.75rem', background: 'var(--surface)' }}
              >
                {JOBS_RANGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {teamLabor == null || jobs == null ? (
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
            )}
          </div>
        )}

        <p style={{ margin: '0.6rem 0 0', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
          Unreported weeks are priced at the person's hourly wage (~estimates). Job figures use clocked crew labor; sub-sheet labor isn't included yet.
          The pay statement shares hours and job names only.
        </p>
      </div>
    </div>
  )
}
