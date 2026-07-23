/** Jobs → Crew P&L (formerly "Teams"): per-person labor cost vs hours-weighted billing credit.
 * Math lives in the pure kernel `src/lib/crewPnlSummary.ts` (unit-tested); this component
 * fetches the people roster (identity resolution), holds range/search/sort/expand state, and
 * renders. Dev-only tab (gating in Jobs.tsx). */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import {
  buildCrewPnlSummary,
  crewPnlRangeForPreset,
  type CrewPnlJobInput,
  type CrewPnlPersonRow,
  type CrewPnlRange,
  type CrewPnlRangePreset,
  type CrewPnlRosterPerson,
  type CrewPnlSubLaborInput,
  DEFAULT_SUB_LABOR_EQUIVALENT_RATE,
} from '../../lib/crewPnlSummary'
import { laborJobSubCost } from '../../lib/jobs/subLaborCost'
import { formatCurrency } from '../../lib/jobs/jobFormatting'
import { formatDecimalWorkHoursToHhMm } from '../../lib/formatDecimalWorkHoursHhMm'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { APP_SETTINGS_KEY_CREW_PNL_SUB_EQUIVALENT_RATE } from '../../lib/appSettingsKeys'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { LaborJob } from '../../types/laborJob'
import type { TeamLaborRow } from '../../utils/teamLabor'

const LABOR_ASSIGNED_DELIMITER = ' | '

type SortKey = 'name' | 'hours' | 'laborCost' | 'billing' | 'profit' | 'rate'

const thBase: CSSProperties = {
  padding: '0.75rem',
  borderBottom: '1px solid var(--border)',
  cursor: 'pointer',
  userSelect: 'none',
  whiteSpace: 'nowrap',
}

function sortValue(row: CrewPnlPersonRow, key: SortKey): number | string {
  if (key === 'name') return row.displayName.toLowerCase()
  if (key === 'hours') return row.hours
  if (key === 'laborCost') return row.laborCost
  if (key === 'billing') return row.billing
  if (key === 'rate') return row.billingPerHour ?? -Infinity
  return row.profit
}

type CrewPnlAllJobRow = {
  id: string
  hcp_number: string
  click_number: string
  job_name: string | null
  revenue: number | null
  last_work_date: string | null
  team_members: Array<{ user_id: string | null; users: { name: string } | null }>
}

export default function JobsCrewPnlTab({
  jobs,
  laborJobs,
  teamLaborData,
  loading,
  driveMileageCost,
  driveTimePerMile,
  onOpenJobDetail,
}: {
  jobs: JobWithDetails[]
  laborJobs: LaborJob[]
  teamLaborData: TeamLaborRow[]
  loading: boolean
  driveMileageCost: number | null
  driveTimePerMile: number | null
  onOpenJobDetail: (jobId: string) => void
}) {
  const [people, setPeople] = useState<CrewPnlRosterPerson[] | null>(null)
  /** Complete jobs list, all statuses (v2.976) — the shared cache lazily omits Paid in Full. */
  const [allJobs, setAllJobs] = useState<CrewPnlAllJobRow[] | null>(null)
  const [preset, setPreset] = useState<CrewPnlRangePreset | 'custom'>('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('profit')
  const [sortAsc, setSortAsc] = useState(false)
  // v2.974: $/hr that converts a flat-rate sub sheet's cost into equivalent hours.
  const [subEquivalentRate, setSubEquivalentRate] = useState<number>(DEFAULT_SUB_LABOR_EQUIVALENT_RATE)
  const [rateDraft, setRateDraft] = useState('')
  const [rateSaving, setRateSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value_num')
        .eq('key', APP_SETTINGS_KEY_CREW_PNL_SUB_EQUIVALENT_RATE)
        .maybeSingle()
      if (cancelled) return
      const n = Number(data?.value_num)
      if (Number.isFinite(n) && n > 0) setSubEquivalentRate(n)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function saveEquivalentRate() {
    if (rateSaving) return
    const raw = rateDraft.trim()
    const n = Number(raw)
    const valueNum = raw !== '' && Number.isFinite(n) && n > 0 ? n : null
    setRateSaving(true)
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: APP_SETTINGS_KEY_CREW_PNL_SUB_EQUIVALENT_RATE, value_num: valueNum }, { onConflict: 'key' })
      if (error) throw error
      setSubEquivalentRate(valueNum ?? DEFAULT_SUB_LABOR_EQUIVALENT_RATE)
    } finally {
      setRateSaving(false)
    }
  }
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('people')
        .select('id, name, account_user_id')
        .is('archived_at', null)
      if (cancelled) return
      setPeople(
        ((data ?? []) as Array<{ id: string; name: string | null; account_user_id: string | null }>).map(
          (p) => ({ id: p.id, name: p.name, accountUserId: p.account_user_id }),
        ),
      )
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('jobs_ledger')
        .select('id, hcp_number, click_number, job_name, revenue, last_work_date, team_members:jobs_ledger_team_members(user_id, users(name))')
      if (cancelled) return
      setAllJobs(error ? null : ((data ?? []) as unknown as CrewPnlAllJobRow[]))
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const range: CrewPnlRange = useMemo(() => {
    if (preset === 'custom') {
      return {
        start: /^\d{4}-\d{2}-\d{2}$/.test(customStart) ? customStart : null,
        end: /^\d{4}-\d{2}-\d{2}$/.test(customEnd) ? customEnd : null,
      }
    }
    return crewPnlRangeForPreset(calendarYmdInAppTzFromIso(new Date().toISOString()), preset)
  }, [preset, customStart, customEnd])

  const summary = useMemo(() => {
    if (!people) return null
    const mileageCost = driveMileageCost ?? 0.7
    const timePerMile = driveTimePerMile ?? 0.02
    const pnlJobs: CrewPnlAllJobRow[] = allJobs ?? jobs.map((j) => ({
      id: j.id,
      hcp_number: j.hcp_number,
      click_number: j.click_number,
      job_name: j.job_name,
      revenue: j.revenue,
      last_work_date: j.last_work_date,
      team_members: (j.team_members ?? []).map((tm) => ({ user_id: tm.user_id ?? null, users: tm.users })),
    }))
    const jobInputs: CrewPnlJobInput[] = pnlJobs.map((j) => ({
      id: j.id,
      jobLabel: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || (j.job_name ?? '').trim() || j.id,
      revenue: j.revenue != null ? Number(j.revenue) : null,
      teamMembers: (j.team_members ?? []).map((tm) => ({
        userId: tm.user_id ?? null,
        userName: tm.users?.name ?? null,
      })),
      fallbackDate: j.last_work_date ?? null,
    }))
    // Sheet job_number → jobs_ledger id: match the HCP number first, then the C#
    // (sheets written against HCP-less jobs match via the C# since v2.962).
    const jobIdByNumber = new Map<string, string>()
    for (const j of jobs) {
      const hcp = (j.hcp_number ?? '').trim().toLowerCase()
      const click = (j.click_number ?? '').trim().toLowerCase()
      if (hcp && !jobIdByNumber.has(hcp)) jobIdByNumber.set(hcp, j.id)
      if (click && !jobIdByNumber.has(click)) jobIdByNumber.set(click, j.id)
    }
    const subInputs: CrewPnlSubLaborInput[] = laborJobs.map((lj) => ({
      id: lj.id,
      jobId: jobIdByNumber.get((lj.job_number ?? '').trim().toLowerCase()) ?? null,
      jobLabel: `Sub sheet ${lj.job_number?.trim() || lj.assigned_to_name || lj.id}`,
      jobDate: (lj.job_date ?? lj.created_at ?? '').slice(0, 10) || null,
      assignedNames: (lj.assigned_to_name ?? '')
        .split(LABOR_ASSIGNED_DELIMITER)
        .map((n) => n.trim())
        .filter(Boolean),
      cost: laborJobSubCost(lj, mileageCost, timePerMile),
      hours: (lj.items ?? []).reduce(
        (s, it) => s + (it.is_fixed ? 0 : Number(it.count || 0) * Number(it.hrs_per_unit || 0)),
        0,
      ),
    }))
    return buildCrewPnlSummary({
      jobs: jobInputs,
      teamLabor: teamLaborData,
      subLabor: subInputs,
      people,
      range,
      subLaborEquivalentRate: subEquivalentRate,
    })
  }, [people, jobs, laborJobs, teamLaborData, range, driveMileageCost, driveTimePerMile, subEquivalentRate])

  const visibleRows = useMemo(() => {
    if (!summary) return []
    const q = search.trim().toLowerCase()
    const filtered = q
      ? summary.rows.filter((r) => r.displayName.toLowerCase().includes(q))
      : summary.rows
    const dir = sortAsc ? 1 : -1
    return [...filtered].sort((a, b) => {
      const va = sortValue(a, sortKey)
      const vb = sortValue(b, sortKey)
      if (va < vb) return -1 * dir
      if (va > vb) return 1 * dir
      return 0
    })
  }, [summary, search, sortKey, sortAsc])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v)
    else {
      setSortKey(key)
      setSortAsc(key === 'name')
    }
  }

  function sortMark(key: SortKey): string {
    if (sortKey !== key) return ''
    return sortAsc ? ' ▲' : ' ▼'
  }

  const isLoading = loading || people === null

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
        <select
          value={preset}
          onChange={(e) => setPreset(e.target.value as CrewPnlRangePreset | 'custom')}
          style={{ padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
          aria-label="Date range"
        >
          <option value="all">All time</option>
          <option value="this_month">This month</option>
          <option value="last_month">Last month</option>
          <option value="this_quarter">This quarter</option>
          <option value="this_year">This year</option>
          <option value="custom">Custom…</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }} title="Flat-rate sub sheets count as cost ÷ this rate in equivalent hours — weighing a $3,000 sheet at $30/hr like 100 clocked hours">
          Sub $/hr eq.
          <input
            type="number"
            min={1}
            value={rateDraft}
            onChange={(e) => setRateDraft(e.target.value)}
            onBlur={() => void saveEquivalentRate()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void saveEquivalentRate()
            }}
            placeholder={String(subEquivalentRate)}
            aria-label="Sub labor equivalent hourly rate"
            style={{ width: '4.5rem', padding: '0.35rem 0.45rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-base)' }}
          />
          {rateSaving ? <span>…</span> : null}
        </label>
        {preset === 'custom' && (
          <>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              style={{ padding: '0.4rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
              aria-label="From date"
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>–</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              style={{ padding: '0.4rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
              aria-label="To date"
            />
          </>
        )}
        <input
          type="search"
          placeholder="Search person…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 160, padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
        />
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading crew P&L…</p>
      ) : !summary || summary.rows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No labor or billing activity in this range.</p>
      ) : (
        <>
          <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead style={{ background: 'var(--bg-subtle)' }}>
                <tr>
                  <th style={{ ...thBase, textAlign: 'left' }} onClick={() => toggleSort('name')} aria-sort={sortKey === 'name' ? (sortAsc ? 'ascending' : 'descending') : undefined}>
                    Person{sortMark('name')}
                  </th>
                  <th style={{ ...thBase, textAlign: 'right' }} onClick={() => toggleSort('hours')}>
                    Hours{sortMark('hours')}
                  </th>
                  <th style={{ ...thBase, textAlign: 'right' }} onClick={() => toggleSort('laborCost')}>
                    Labor Cost{sortMark('laborCost')}
                  </th>
                  <th style={{ ...thBase, textAlign: 'right' }} onClick={() => toggleSort('billing')}>
                    Billing{sortMark('billing')}
                  </th>
                  <th style={{ ...thBase, textAlign: 'right' }} onClick={() => toggleSort('profit')}>
                    Profit{sortMark('profit')}
                  </th>
                  <th style={{ ...thBase, textAlign: 'right' }} onClick={() => toggleSort('rate')}>
                    $/hr{sortMark('rate')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const expanded = expandedKeys.has(row.key)
                  return (
                    <CrewPnlRow
                      key={row.key}
                      row={row}
                      expanded={expanded}
                      onToggle={() =>
                        setExpandedKeys((prev) => {
                          const next = new Set(prev)
                          if (next.has(row.key)) next.delete(row.key)
                          else next.add(row.key)
                          return next
                        })
                      }
                      onOpenJobDetail={onOpenJobDetail}
                    />
                  )
                })}
                <tr style={{ borderTop: '1px solid var(--border)', fontWeight: 600, background: 'var(--bg-subtle)' }}>
                  <td style={{ padding: '0.75rem' }}>Total</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatDecimalWorkHoursToHhMm(summary.totals.hours)}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>${formatCurrency(summary.totals.laborCost)}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>${formatCurrency(summary.totals.billing)}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', color: summary.totals.profit >= 0 ? '#15803d' : 'var(--text-red-700)' }}>
                    {summary.totals.profit < 0 ? '−' : ''}${formatCurrency(Math.abs(summary.totals.profit))}
                  </td>
                  <td style={{ padding: '0.75rem' }} />
                </tr>
              </tbody>
            </table>
          </div>
          <p style={{ color: 'var(--text-faint)', fontSize: '0.6875rem', margin: '0.5rem 0 0' }}>
            Billing credit is weighted by clocked crew hours (job total × person's share of the
            job's hours). ≈ marks equal-split estimates for jobs with no clocked hours. Sub-sheet
            labor is split evenly across its assigned names. The date range filters work dates;
            billing follows the hours worked in the range.
          </p>
        </>
      )}
    </div>
  )
}

function CrewPnlRow({
  row,
  expanded,
  onToggle,
  onOpenJobDetail,
}: {
  row: CrewPnlPersonRow
  expanded: boolean
  onToggle: () => void
  onOpenJobDetail: (jobId: string) => void
}) {
  return (
    <>
      <tr
        style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <td style={{ padding: '0.75rem' }}>
          <span style={{ color: 'var(--text-faint)', marginRight: '0.4rem' }}>{expanded ? '▾' : '▸'}</span>
          {row.displayName}
          {row.unmatched && (
            <span
              title="Not matched to a roster person — name appears only in free-text fields"
              style={{ marginLeft: '0.4rem', fontSize: '0.6875rem', color: 'var(--text-amber-700)' }}
            >
              unmatched
            </span>
          )}
        </td>
        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
          {row.hours > 0 ? formatDecimalWorkHoursToHhMm(row.hours) : '—'}
        </td>
        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
          {row.laborCost > 0 ? `$${formatCurrency(row.laborCost)}` : '—'}
        </td>
        <td
          style={{ padding: '0.75rem', textAlign: 'right' }}
          title={row.hasEstimatedBilling ? 'Includes equal-split estimates (≈)' : undefined}
        >
          {row.billing > 0 ? `${row.hasEstimatedBilling ? '≈ ' : ''}$${formatCurrency(row.billing)}` : '—'}
        </td>
        <td
          style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600, color: row.profit >= 0 ? '#15803d' : 'var(--text-red-700)' }}
        >
          {row.profit < 0 ? '−' : ''}${formatCurrency(Math.abs(row.profit))}
        </td>
        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
          {row.billingPerHour != null ? `$${formatCurrency(row.billingPerHour)}` : '—'}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} style={{ padding: '0.25rem 0.75rem 0.75rem 2rem', background: 'var(--bg-page)', borderBottom: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)' }}>
                  <th style={{ textAlign: 'left', padding: '0.35rem 0.5rem' }}>Job</th>
                  <th style={{ textAlign: 'right', padding: '0.35rem 0.5rem' }}>Hours</th>
                  <th style={{ textAlign: 'right', padding: '0.35rem 0.5rem' }}>Labor cost</th>
                  <th style={{ textAlign: 'right', padding: '0.35rem 0.5rem' }}>Billing</th>
                </tr>
              </thead>
              <tbody>
                {row.perJob.map((line, i) => (
                  <tr key={`${line.kind}-${line.jobId ?? line.label}-${i}`} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.35rem 0.5rem' }}>
                      {line.jobId ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onOpenJobDetail(line.jobId as string)
                          }}
                          style={{ border: 'none', background: 'transparent', color: 'var(--text-blue-700)', cursor: 'pointer', padding: 0, font: 'inherit', textDecoration: 'underline' }}
                        >
                          {line.label}
                        </button>
                      ) : (
                        line.label
                      )}
                      {line.estimated && (
                        <span title="Equal-split estimate: no clocked crew hours on this job" style={{ marginLeft: '0.35rem', color: 'var(--text-amber-700)' }}>
                          ≈
                        </span>
                      )}
                      {line.kind === 'sub' && (
                        <span style={{ marginLeft: '0.35rem', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>sub labor</span>
                      )}
                    </td>
                    <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>
                      {line.hours > 0 ? formatDecimalWorkHoursToHhMm(line.hours) : '—'}
                    </td>
                    <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>
                      {line.laborCost > 0 ? `$${formatCurrency(line.laborCost)}` : '—'}
                    </td>
                    <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right' }}>
                      {line.billing > 0 ? `$${formatCurrency(line.billing)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  )
}
