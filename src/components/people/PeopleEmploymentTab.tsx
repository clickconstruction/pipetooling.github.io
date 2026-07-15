import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import type { PayConfigRow } from '../../types/peoplePayConfig'
import { KIND_LABELS } from './peopleUsersTabShared'
import type { PersonKind } from '../../hooks/usePeopleRoster'
import { SalaryWorkScheduleSettings } from '../SalaryWorkScheduleSettings'
import { denverWorkDateToday, syncSalaryClockSessionsForUserDay } from '../../lib/salaryScheduleSync'
import { timeOffKindLabel } from '../../lib/resolveCalendarWorkday'
import { CalendarDays, Banknote } from 'lucide-react'
import { EmploymentMonthScheduleModal } from './EmploymentMonthScheduleModal'
import { EmploymentPayHistoryModal } from './EmploymentPayHistoryModal'
import type { PayStubRow } from './PeoplePayStubsTab'
import { computeEmploymentStubTotals } from '../../lib/employmentPayTotals'
import {
  buildUpcomingPayrollSummary,
  upcomingPayrollFetchStartYmd,
  type UpcomingClockSessionRow,
} from '../../lib/upcomingPayrollSummary'
import { localYmdFromDate } from '../../lib/payStubPayments'
import { formatCurrency } from '../../lib/format'

type EmploymentPersonRow = {
  id: string
  name: string
  kind: string
  email: string | null
  archived_at: string | null
  account_user_id: string | null
  start_date: string | null
  end_date: string | null
}

type EmploymentUserRow = { id: string; name: string | null; role: string; email: string | null }

type EmploymentTimeOffRow = {
  id: string
  start_date: string
  end_date: string
  kind: string
  note: string | null
}

/**
 * One roster line: a login user (source 'user', optionally backed by a `people` row for
 * employment dates) or an external `people` row with no matching account (source 'people').
 * Mirrors the Users tab's users+people union — the `people` table alone mostly holds
 * externally-added primaries/superintendents, so querying it misses account-holding employees.
 */
type EmploymentEntry = {
  key: string
  name: string
  kind: string
  archived_at: string | null
  source: 'user' | 'people'
  /** `people` row backing this entry (created on first date save for user-only entries). */
  personId: string | null
  /** Login user for time off / workday schedule. */
  userId: string | null
  accountUserId: string | null
  start_date: string | null
  end_date: string | null
}

export type PeopleEmploymentTabProps = {
  users: EmploymentUserRow[]
  authUserId: string | null
  payConfig: Record<string, PayConfigRow>
  payConfigDraft: Record<string, string>
  payConfigOfficeWageDraft: Record<string, string>
  payConfigSaving: boolean
  salaryTemplateByPersonName: Record<string, boolean>
  onUpsertPayConfig: (personName: string, patch: Partial<PayConfigRow>) => void
  onHourlyWageChange: (personName: string, rawValue: string) => void
  onOfficeHourlyWageChange: (personName: string, rawValue: string) => void
  /** Opens the parent-owned pay-report view modal for a stub (People.tsx `viewPayStubInModal`). */
  onViewPayReport: (stub: PayStubRow) => void
}

const DEFAULT_PAY_CONFIG: Omit<PayConfigRow, 'person_name'> = {
  hourly_wage: null,
  office_hourly_wage: null,
  is_salary: false,
  show_in_hours: false,
  record_hours_but_salary: false,
}

/** users.role → people.kind. Subcontractors are deliberately absent — not employees. */
const ROLE_TO_KIND: Record<string, string> = {
  dev: 'dev',
  master_technician: 'master_technician',
  assistant: 'assistant',
  helpers: 'helper',
  estimator: 'estimator',
  primary: 'primary',
  superintendent: 'superintendent',
}

function kindLabel(kind: string): string {
  if (kind === 'dev') return 'Devs'
  return KIND_LABELS[kind as PersonKind] ?? kind
}

/** Login-user linkage health: explicit account link vs the trimmed-name match pay tables use. */
function entryLinkHealth(e: EmploymentEntry, users: EmploymentUserRow[]): { label: string; warn: boolean } | null {
  if (e.source === 'user') {
    if (e.personId && e.accountUserId && e.accountUserId !== e.userId) {
      return { label: 'Roster row linked to a different login user', warn: true }
    }
    return null
  }
  if (!e.userId) return { label: 'No login user', warn: false }
  if (!e.accountUserId) return { label: 'Linked by name only', warn: false }
  const nameMatch = users.find((u) => (u.name ?? '').trim() === e.name.trim())
  if (nameMatch && nameMatch.id !== e.accountUserId) {
    return { label: 'Name matches a different login user', warn: true }
  }
  return null
}

export default function PeopleEmploymentTab({
  users,
  authUserId,
  payConfig,
  payConfigDraft,
  payConfigOfficeWageDraft,
  payConfigSaving,
  salaryTemplateByPersonName,
  onUpsertPayConfig,
  onHourlyWageChange,
  onOfficeHourlyWageChange,
  onViewPayReport,
}: PeopleEmploymentTabProps) {
  const { showToast } = useToastContext()
  const [rows, setRows] = useState<EmploymentPersonRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [archivedOpen, setArchivedOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [payHistoryOpen, setPayHistoryOpen] = useState(false)
  /** Person name pending the "turn off Salaried" confirmation modal. */
  const [salaryOffConfirm, setSalaryOffConfirm] = useState<string | null>(null)
  const [payTotals, setPayTotals] = useState<{
    paid: number
    due: number
    upcoming: number
    avgPerWeek: number | null
  } | null>(null)
  const [payTotalsLoading, setPayTotalsLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [draftStart, setDraftStart] = useState('')
  const [draftEnd, setDraftEnd] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      // Subcontractors are not employees — no employment dates, pay setup, or time off here.
      const data = await withSupabaseRetry(
        async () =>
          supabase
            .from('people')
            .select('id, name, kind, email, archived_at, account_user_id, start_date, end_date')
            .neq('kind', 'sub')
            .order('name'),
        'employment roster',
      )
      setRows((data ?? []) as EmploymentPersonRow[])
    } catch (e) {
      setLoadError(formatErrorMessage(e, 'Failed to load roster'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const entries = useMemo<EmploymentEntry[]>(() => {
    const consumed = new Set<string>()
    const out: EmploymentEntry[] = []
    for (const u of users) {
      const kind = ROLE_TO_KIND[u.role]
      if (!kind) continue
      const uname = (u.name ?? '').trim()
      if (!uname) continue
      const email = (u.email ?? '').trim().toLowerCase()
      const p =
        rows.find((r) => r.account_user_id === u.id) ??
        rows.find((r) => !consumed.has(r.id) && !r.account_user_id && email !== '' && (r.email ?? '').trim().toLowerCase() === email) ??
        rows.find((r) => !consumed.has(r.id) && !r.account_user_id && r.name.trim() === uname) ??
        null
      if (p) consumed.add(p.id)
      out.push({
        key: `u:${u.id}`,
        name: uname,
        kind,
        archived_at: null,
        source: 'user',
        personId: p?.id ?? null,
        userId: u.id,
        accountUserId: p?.account_user_id ?? null,
        start_date: p?.start_date ?? null,
        end_date: p?.end_date ?? null,
      })
    }
    for (const r of rows) {
      if (consumed.has(r.id)) continue
      const nameMatches = users.filter((u) => (u.name ?? '').trim() === r.name.trim())
      const uid = r.account_user_id ?? (nameMatches.length === 1 ? nameMatches[0]!.id : null)
      out.push({
        key: `p:${r.id}`,
        name: r.name,
        kind: r.kind,
        archived_at: r.archived_at,
        source: 'people',
        personId: r.id,
        userId: uid,
        accountUserId: r.account_user_id,
        start_date: r.start_date,
        end_date: r.end_date,
      })
    }
    return out.sort((a, b) => a.name.localeCompare(b.name))
  }, [users, rows])

  const selected = useMemo(() => entries.find((e) => e.key === selectedKey) ?? null, [entries, selectedKey])

  useEffect(() => {
    setDraftStart(selected?.start_date ?? '')
    setDraftEnd(selected?.end_date ?? '')
  }, [selected])

  useEffect(() => {
    setScheduleOpen(false)
    setPayHistoryOpen(false)
    setSalaryOffConfirm(null)
  }, [selectedKey])

  const searchLower = search.trim().toLowerCase()
  const matches = useCallback(
    (e: EmploymentEntry) => searchLower === '' || e.name.toLowerCase().includes(searchLower),
    [searchLower],
  )
  const activeEntries = entries.filter((e) => !e.archived_at).filter(matches)
  const archivedEntries = entries.filter((e) => e.archived_at).filter(matches)
  const salariedActive = activeEntries.filter((e) => !!payConfig[e.name]?.is_salary)
  const hourlyActive = activeEntries.filter((e) => !payConfig[e.name]?.is_salary)
  // Group only when the roster actually has salaried people; keep grouping stable while searching.
  const groupRoster = entries.some((e) => !e.archived_at && payConfig[e.name]?.is_salary)

  const datesDirty = selected != null && ((selected.start_date ?? '') !== draftStart || (selected.end_date ?? '') !== draftEnd)

  const selectedCfg: PayConfigRow | null = selected
    ? payConfig[selected.name] ?? { person_name: selected.name, ...DEFAULT_PAY_CONFIG }
    : null
  const timeOffUserId = selected?.userId ?? null

  const [timeOffRows, setTimeOffRows] = useState<EmploymentTimeOffRow[]>([])
  const [timeOffLoading, setTimeOffLoading] = useState(false)
  const [toStart, setToStart] = useState('')
  const [toEnd, setToEnd] = useState('')
  const [toKind, setToKind] = useState<'unpaid' | 'paid'>('unpaid')
  const [toNote, setToNote] = useState('')
  const [toSaving, setToSaving] = useState(false)

  const loadTimeOff = useCallback(async (uid: string) => {
    setTimeOffLoading(true)
    try {
      const data = await withSupabaseRetry(
        async () =>
          supabase
            .from('user_time_off')
            .select('id, start_date, end_date, kind, note')
            .eq('user_id', uid)
            .order('start_date', { ascending: false }),
        'employment time off list',
      )
      setTimeOffRows((data ?? []) as EmploymentTimeOffRow[])
    } catch (e) {
      showToast(formatErrorMessage(e, 'Failed to load time off'), 'error')
      setTimeOffRows([])
    } finally {
      setTimeOffLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    setToStart('')
    setToEnd('')
    setToKind('unpaid')
    setToNote('')
    if (!timeOffUserId) {
      setTimeOffRows([])
      return
    }
    void loadTimeOff(timeOffUserId)
  }, [timeOffUserId, loadTimeOff])

  // Paid / Due / Upcoming header totals — same math as useDashboardFinancials, scoped to one person.
  const selectedName = selected?.name.trim() ?? null
  const selectedUserId = selected?.userId ?? null
  const selectedWage = Number(payConfig[selected?.name ?? '']?.hourly_wage ?? 0)
  useEffect(() => {
    if (!selectedName) {
      setPayTotals(null)
      return
    }
    const name = selectedName
    let cancelled = false
    async function load() {
      setPayTotalsLoading(true)
      try {
        const stubs = ((await withSupabaseRetry(
          async () =>
            supabase.from('pay_stubs').select('id, period_start, period_end, gross_pay').eq('person_name', name),
          'employment pay totals stubs',
        )) ?? []) as Array<{ id: string; period_start: string; period_end: string; gross_pay: number | null }>
        const stubIds = stubs.map((s) => s.id)
        const [payments, deductions, additionalLines] =
          stubIds.length === 0
            ? [[], [], []]
            : await Promise.all([
                withSupabaseRetry(
                  async () => supabase.from('pay_stub_payments').select('pay_stub_id, amount').in('pay_stub_id', stubIds),
                  'employment pay totals payments',
                ).then((d) => (d ?? []) as Array<{ pay_stub_id: string; amount: number | null }>),
                withSupabaseRetry(
                  async () => supabase.from('pay_stub_deductions').select('pay_stub_id, amount').in('pay_stub_id', stubIds),
                  'employment pay totals deductions',
                ).then((d) => (d ?? []) as Array<{ pay_stub_id: string; amount: number | null }>),
                withSupabaseRetry(
                  async () =>
                    supabase.from('pay_stub_additional_lines').select('pay_stub_id, line_total').in('pay_stub_id', stubIds),
                  'employment pay totals additional lines',
                ).then((d) => (d ?? []) as Array<{ pay_stub_id: string; line_total: number | null }>),
              ])
        const totals = computeEmploymentStubTotals({ stubs, payments, deductions, additionalLines })

        let upcoming = 0
        if (selectedUserId) {
          const todayYmd = localYmdFromDate(new Date())
          let lastEnd: string | null = null
          for (const s of stubs) if (lastEnd === null || s.period_end > lastEnd) lastEnd = s.period_end
          const fetchStart = upcomingPayrollFetchStartYmd({
            personNames: [name],
            lastStubEndByPerson: lastEnd ? { [name]: lastEnd } : {},
            todayYmd,
          })
          const sessions = ((await withSupabaseRetry(
            async () =>
              supabase
                .from('clock_sessions')
                .select('user_id, work_date, clocked_in_at, clocked_out_at')
                .eq('user_id', selectedUserId)
                .gte('work_date', fetchStart)
                .is('rejected_at', null)
                .is('revoked_at', null),
            'employment pay totals upcoming sessions',
          )) ?? []) as UpcomingClockSessionRow[]
          upcoming = buildUpcomingPayrollSummary({
            personNames: [name],
            userIdByPersonName: { [name]: selectedUserId },
            hourlyWageByPersonName: { [name]: selectedWage },
            stubsByPerson: { [name]: stubs },
            sessions,
            todayYmd,
            nowMs: Date.now(),
          }).estimatedGrossDollars
        }

        if (!cancelled)
          setPayTotals({ paid: totals.paidTotal, due: totals.dueTotal, upcoming, avgPerWeek: totals.avgPaidPerWeek })
      } catch (e) {
        if (!cancelled) {
          setPayTotals(null)
          showToast(formatErrorMessage(e, 'Failed to load pay totals'), 'error')
        }
      } finally {
        if (!cancelled) setPayTotalsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [selectedName, selectedUserId, selectedWage, showToast])

  async function syncSelectedForToday(uid: string) {
    const today = denverWorkDateToday()
    const { error: syncErr } = await syncSalaryClockSessionsForUserDay(uid, today)
    if (syncErr) showToast(syncErr, 'warning')
  }

  async function saveDates() {
    if (!selected) return
    const start = draftStart || null
    const end = draftEnd || null
    if (start && end && end < start) {
      showToast('End date must be on or after start date', 'warning')
      return
    }
    setSaving(true)
    try {
      if (selected.personId) {
        await withSupabaseRetry(
          async () => supabase.from('people').update({ start_date: start, end_date: end }).eq('id', selected.personId!),
          'employment dates save',
        )
      } else {
        // Login user with no roster row yet — dates live on `people`, so create the row now.
        if (!authUserId) {
          showToast('Not signed in.', 'error')
          return
        }
        await withSupabaseRetry(
          async () =>
            supabase.from('people').insert({
              master_user_id: authUserId,
              kind: selected.kind,
              name: selected.name,
              account_user_id: selected.userId,
              start_date: start,
              end_date: end,
            }),
          'employment dates roster-row create',
        )
      }
      await load()
      showToast('Employment dates saved', 'success')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Save failed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function addTimeOff() {
    if (!timeOffUserId) return
    if (!toStart || !toEnd) {
      showToast('Start and end date required', 'warning')
      return
    }
    if (toEnd < toStart) {
      showToast('End date must be on or after start date', 'warning')
      return
    }
    const kind = toKind === 'paid' && selectedCfg?.is_salary ? 'paid' : 'unpaid'
    setToSaving(true)
    try {
      await withSupabaseRetry(
        async () =>
          supabase.from('user_time_off').insert({
            user_id: timeOffUserId,
            start_date: toStart,
            end_date: toEnd,
            kind,
            note: toNote.trim() || null,
          }),
        'employment time off insert',
      )
      showToast(`${timeOffKindLabel(kind)} saved`, 'success')
      setToNote('')
      await loadTimeOff(timeOffUserId)
      const today = denverWorkDateToday()
      if (today >= toStart && today <= toEnd) await syncSelectedForToday(timeOffUserId)
    } catch (e) {
      showToast(formatErrorMessage(e, 'Save failed'), 'error')
    } finally {
      setToSaving(false)
    }
  }

  async function deleteTimeOff(id: string) {
    if (!timeOffUserId) return
    if (!window.confirm('Remove this time off entry?')) return
    try {
      await withSupabaseRetry(
        async () => supabase.from('user_time_off').delete().eq('id', id).eq('user_id', timeOffUserId),
        'employment time off delete',
      )
      showToast('Removed', 'success')
      await loadTimeOff(timeOffUserId)
      await syncSelectedForToday(timeOffUserId)
    } catch (e) {
      showToast(formatErrorMessage(e, 'Delete failed'), 'error')
    }
  }

  function renderChips(e: EmploymentEntry, inSalariedGroup = false) {
    const cfg = payConfig[e.name]
    const health = entryLinkHealth(e, users)
    return (
      <span style={{ display: 'inline-flex', gap: '0.3rem', flexWrap: 'wrap' }}>
        {cfg?.is_salary ? (
          // Inside the Salaried group the label is redundant — surface only the template warning.
          inSalariedGroup ? (
            salaryTemplateByPersonName[e.name] ? null : (
              <span style={chipStyle('var(--text-amber-800)', 'var(--bg-amber-100)')}>no workday template</span>
            )
          ) : (
            <span style={chipStyle('var(--text-blue-700)', 'var(--bg-blue-50)')}>
              Salaried{salaryTemplateByPersonName[e.name] ? '' : ' · no workday template'}
            </span>
          )
        ) : null}
        {cfg?.is_salary && cfg?.record_hours_but_salary ? (
          <span style={chipStyle('var(--text-muted)', 'var(--bg-page)')}>records hours</span>
        ) : null}
        {health ? (
          <span
            style={chipStyle(health.warn ? 'var(--text-amber-800)' : 'var(--text-muted)', health.warn ? 'var(--bg-amber-100)' : 'var(--bg-page)')}
            title="How pay tables find this person's login user: an explicit account link, or an exact (trimmed) name match."
          >
            {health.label}
          </span>
        ) : null}
      </span>
    )
  }

  function renderSalarySwitch(on: boolean, disabled: boolean, onToggle: () => void) {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Salaried"
        disabled={disabled}
        onClick={onToggle}
        style={{
          position: 'relative',
          width: 36,
          height: 20,
          borderRadius: 999,
          border: 'none',
          padding: 0,
          background: on ? '#2563eb' : 'var(--border-strong)',
          cursor: disabled ? 'wait' : 'pointer',
          transition: 'background 0.15s ease',
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 2,
            left: on ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: 'var(--surface)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.35)',
            transition: 'left 0.15s ease',
          }}
        />
      </button>
    )
  }

  function renderPayTotalStat(label: string, display: string | null, title: string, color: string, subline?: string | null) {
    return (
      <span
        title={title}
        style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.05rem', cursor: 'help' }}
      >
        <span
          style={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}
        >
          {label}
        </span>
        <span style={{ fontSize: '0.95rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color }}>
          {payTotalsLoading ? '…' : display ?? '—'}
        </span>
        {!payTotalsLoading && subline ? (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            {subline}
          </span>
        ) : null}
      </span>
    )
  }

  function renderGroupHeader(label: string, count: number, first: boolean) {
    return (
      <li
        style={{
          fontSize: '0.6875rem',
          fontWeight: 700,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          padding: '0 0.1rem',
          marginTop: first ? 0 : '0.5rem',
        }}
      >
        {label} <span style={{ fontWeight: 400 }}>({count})</span>
      </li>
    )
  }

  function renderRow(e: EmploymentEntry, inSalariedGroup = false) {
    const isSelected = e.key === selectedKey
    return (
      <li key={e.key}>
        <button
          type="button"
          onClick={() => setSelectedKey(e.key)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '0.2rem',
            width: '100%',
            textAlign: 'left',
            padding: '0.45rem 0.6rem',
            border: '1px solid ' + (isSelected ? 'var(--text-blue-700)' : 'var(--border)'),
            borderRadius: 6,
            background: isSelected ? 'var(--bg-blue-50)' : 'var(--surface)',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontWeight: 600, color: 'var(--text)' }}>
            {e.name}
            <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.4rem', fontSize: '0.8125rem' }}>
              {kindLabel(e.kind)}
            </span>
          </span>
          {renderChips(e, inSalariedGroup)}
        </button>
      </li>
    )
  }

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading roster…</p>
  if (loadError) return <p style={{ color: 'var(--text-red-700)' }}>{loadError}</p>

  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 260px', minWidth: 240, maxWidth: 420 }}>
        <input
          type="search"
          placeholder="Search people…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', padding: '0.4rem 0.6rem', marginBottom: '0.6rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)' }}
        />
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {activeEntries.length === 0 ? (
            <li style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No matching people.</li>
          ) : groupRoster ? (
            <>
              {salariedActive.length > 0 ? renderGroupHeader('Salaried', salariedActive.length, true) : null}
              {salariedActive.map((e) => renderRow(e, true))}
              {hourlyActive.length > 0 ? renderGroupHeader('Hourly', hourlyActive.length, salariedActive.length === 0) : null}
              {hourlyActive.map((e) => renderRow(e))}
            </>
          ) : (
            activeEntries.map((e) => renderRow(e))
          )}
        </ul>
        {archivedEntries.length > 0 ? (
          <div style={{ marginTop: '0.75rem' }}>
            <button
              type="button"
              onClick={() => setArchivedOpen((v) => !v)}
              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-muted)', fontSize: '0.8125rem', cursor: 'pointer' }}
            >
              {archivedOpen ? '▾' : '▸'} Archived ({archivedEntries.length})
            </button>
            {archivedOpen ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: '0.4rem 0 0 0', display: 'flex', flexDirection: 'column', gap: '0.4rem', opacity: 0.75 }}>
                {archivedEntries.map((e) => renderRow(e))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      <div style={{ flex: '2 1 340px', minWidth: 300 }}>
        {!selected ? (
          <p style={{ color: 'var(--text-muted)' }}>Select a person to manage their employment details.</p>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem 1.25rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.15rem' }}>
              <h3 style={{ margin: 0 }}>{selected.name}</h3>
              <button
                type="button"
                onClick={() => setScheduleOpen(true)}
                disabled={!selected.userId}
                title={
                  selected.userId
                    ? `View ${selected.name}'s schedule for the coming month`
                    : 'No login user — schedules exist only for people with an account'
                }
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.25rem 0.55rem',
                  fontSize: '0.8125rem',
                  border: '1px solid ' + (selected.userId ? '#2563eb' : 'var(--border)'),
                  borderRadius: 4,
                  background: selected.userId ? 'var(--bg-blue-tint)' : 'var(--bg-muted)',
                  color: selected.userId ? 'var(--text-blue-700)' : 'var(--text-faint)',
                  cursor: selected.userId ? 'pointer' : 'default',
                }}
              >
                <CalendarDays size={14} strokeWidth={2.25} aria-hidden />
                Schedule
              </button>
              <button
                type="button"
                onClick={() => setPayHistoryOpen(true)}
                title={`Payments recorded for ${selected.name}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.25rem 0.55rem',
                  fontSize: '0.8125rem',
                  border: '1px solid #2563eb',
                  borderRadius: 4,
                  background: 'var(--bg-blue-tint)',
                  color: 'var(--text-blue-700)',
                  cursor: 'pointer',
                }}
              >
                <Banknote size={14} strokeWidth={2.25} aria-hidden />
                Pay history
              </button>
            </div>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {kindLabel(selected.kind)}
              {selected.archived_at ? ' · archived' : ''}
              {payConfig[selected.name]?.is_salary ? ' · salaried' : ''}
            </p>
            </div>
            <div style={{ display: 'flex', gap: '1.25rem', marginLeft: 'auto', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {renderPayTotalStat(
                'Avg',
                payTotals?.avgPerWeek != null ? `$${Math.round(payTotals.avgPerWeek).toLocaleString('en-US')}/wk` : null,
                'Average paid per week — total paid ÷ weeks with at least one recorded payment; × 52 for the yearly figure',
                'var(--text-strong)',
                payTotals?.avgPerWeek != null
                  ? `or $${Math.round(payTotals.avgPerWeek * 52).toLocaleString('en-US')}/yr`
                  : null,
              )}
              {renderPayTotalStat(
                'Paid',
                payTotals != null ? `$${formatCurrency(payTotals.paid)}` : null,
                'All payments ever recorded against this person’s pay reports',
                'var(--text-strong)',
              )}
              {renderPayTotalStat(
                'Due',
                payTotals != null ? `$${formatCurrency(payTotals.due)}` : null,
                'Generated pay reports not yet fully paid',
                (payTotals?.due ?? 0) > 0 ? '#ea580c' : 'var(--text-strong)',
              )}
              {renderPayTotalStat(
                'Upcoming',
                payTotals != null ? `$${formatCurrency(payTotals.upcoming)}` : null,
                'Estimated pay for hours worked since the last pay report — no report generated yet',
                'var(--text-700)',
              )}
            </div>
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-page)', padding: '0.75rem' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>Employment dates</div>
              <p style={{ margin: '0 0 0.6rem 0', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                Leave end date empty while the person still works here. Salaried payroll credit will be limited to
                this window.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
                <label>
                  <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Start</span>
                  <input type="date" value={draftStart} onChange={(e) => setDraftStart(e.target.value)} style={{ padding: '0.35rem' }} />
                </label>
                <label>
                  <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>End</span>
                  <input type="date" value={draftEnd} onChange={(e) => setDraftEnd(e.target.value)} style={{ padding: '0.35rem' }} />
                </label>
                <button
                  type="button"
                  disabled={!datesDirty || saving}
                  onClick={() => void saveDates()}
                  style={{
                    padding: '0.45rem 0.9rem',
                    fontWeight: 600,
                    color: 'white',
                    background: !datesDirty || saving ? 'var(--text-faint-300)' : '#2563eb',
                    border: 'none',
                    borderRadius: 6,
                    cursor: !datesDirty || saving ? 'default' : 'pointer',
                  }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>

            {(() => {
              const cfg: PayConfigRow = selectedCfg ?? { person_name: selected.name, ...DEFAULT_PAY_CONFIG }
              const scheduleUserId = selected.userId
              return (
                <>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-page)', padding: '0.75rem', marginTop: '0.75rem' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>Pay setup</div>
                    <p style={{ margin: '0 0 0.6rem 0', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                      Changes save automatically after a moment. Salaried people are paid a flat 8 hours per weekday at
                      the hourly wage — clock time never changes their pay.
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '0.6rem' }}>
                      <label>
                        <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Hourly wage ($)</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={payConfigDraft[selected.name] !== undefined ? payConfigDraft[selected.name] : (cfg.hourly_wage ?? '')}
                          onChange={(e) => onHourlyWageChange(selected.name, e.target.value)}
                          disabled={payConfigSaving}
                          style={{ width: 100, padding: '0.3rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                        />
                      </label>
                      <label>
                        <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Office wage ($)</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={
                            payConfigOfficeWageDraft[selected.name] !== undefined
                              ? payConfigOfficeWageDraft[selected.name]
                              : (cfg.office_hourly_wage ?? '')
                          }
                          onChange={(e) => onOfficeHourlyWageChange(selected.name, e.target.value)}
                          disabled={payConfigSaving || cfg.is_salary}
                          placeholder={cfg.is_salary ? '—' : 'same'}
                          title={
                            cfg.is_salary
                              ? 'Office rate does not apply to salaried people'
                              : 'Optional: rate for office/bid/unassigned time. Blank = same as hourly wage.'
                          }
                          style={{
                            width: 100,
                            padding: '0.3rem 0.5rem',
                            border: '1px solid var(--border-strong)',
                            borderRadius: 4,
                            background: cfg.is_salary ? 'var(--bg-muted)' : 'var(--surface)',
                          }}
                        />
                      </label>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', marginBottom: '0.45rem', fontSize: '0.875rem' }}>
                      {renderSalarySwitch(cfg.is_salary, payConfigSaving, () => {
                        if (cfg.is_salary) setSalaryOffConfirm(selected.name)
                        else onUpsertPayConfig(selected.name, { is_salary: true })
                      })}
                      <span>
                        <strong>Salaried</strong> — credited 8 hours on weekdays, 0 on weekends, on all pay and cost
                        screens. Turning this on also starts today&rsquo;s scheduled sessions once a workday template exists.
                        {!cfg.is_salary && salaryTemplateByPersonName[selected.name] ? (
                          <span style={{ display: 'block', color: 'var(--text-amber-800)', marginTop: '0.2rem' }}>
                            A salaried workday template still exists for this person — schedule-driven sessions may
                            continue until it is removed.
                          </span>
                        ) : null}
                      </span>
                    </div>
                    {cfg.is_salary ? (
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', marginBottom: '0.45rem', fontSize: '0.875rem' }}>
                        <input
                          type="checkbox"
                          checked={cfg.record_hours_but_salary}
                          onChange={(e) => onUpsertPayConfig(selected.name, { record_hours_but_salary: e.target.checked })}
                          disabled={payConfigSaving}
                          style={{ marginTop: 2 }}
                        />
                        <span>
                          <strong>Record hours anyway</strong> — their logged hours show on the Hours grids for
                          record-keeping, but pay still uses the flat salary day.
                        </span>
                      </label>
                    ) : null}
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', fontSize: '0.875rem' }}>
                      <input
                        type="checkbox"
                        checked={cfg.show_in_hours}
                        onChange={(e) => onUpsertPayConfig(selected.name, { show_in_hours: e.target.checked })}
                        disabled={payConfigSaving}
                        style={{ marginTop: 2 }}
                      />
                      <span>
                        <strong>Include in Hours &amp; crew costing</strong> — show this person on the Hours tab and in
                        crew-costing rosters and team labor totals.
                      </span>
                    </label>
                  </div>

                  {cfg.is_salary ? (
                    <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-page)', padding: '0.75rem', marginTop: '0.75rem' }}>
                      <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>Salaried workday</div>
                      {scheduleUserId ? (
                        <SalaryWorkScheduleSettings
                          key={scheduleUserId}
                          userId={scheduleUserId}
                          userPayName={selected.name.trim()}
                          canEditPastDayOverrides
                        />
                      ) : (
                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                          No login user is linked to this person, so a workday schedule cannot be set up. Invite them
                          or fix the roster name first.
                        </p>
                      )}
                    </div>
                  ) : null}
                </>
              )
            })()}

            <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-page)', padding: '0.75rem', marginTop: '0.75rem' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>Time off</div>
              {!timeOffUserId ? (
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  No login user is linked to this person, so time off cannot be recorded here.
                </p>
              ) : (
                <>
                  <p style={{ margin: '0 0 0.6rem 0', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                    Company-calendar dates, inclusive. Time off always clears scheduled salary sessions.
                    {selectedCfg?.is_salary
                      ? ' Unpaid days reduce salaried pay; paid days keep it.'
                      : ' Hourly pay follows logged hours, so entries here are informational.'}
                  </p>
                  {timeOffLoading ? (
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 0.75rem 0' }}>
                      {timeOffRows.length === 0 ? (
                        <li style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No entries.</li>
                      ) : (
                        timeOffRows.map((r) => (
                          <li
                            key={r.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '0.5rem',
                              padding: '0.4rem 0',
                              borderBottom: '1px solid var(--border)',
                              fontSize: '0.875rem',
                            }}
                          >
                            <span>
                              <strong>{timeOffKindLabel(r.kind)}</strong> · {r.start_date} → {r.end_date}
                              {r.note ? ` — ${r.note}` : ''}
                            </span>
                            <button
                              type="button"
                              onClick={() => void deleteTimeOff(r.id)}
                              style={{
                                padding: '0.2rem 0.5rem',
                                fontSize: '0.8125rem',
                                color: 'var(--text-red-700)',
                                border: '1px solid #fecaca',
                                borderRadius: 4,
                                background: 'var(--surface)',
                                cursor: 'pointer',
                              }}
                            >
                              Remove
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
                    <label>
                      <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Start</span>
                      <input type="date" value={toStart} onChange={(e) => setToStart(e.target.value)} style={{ padding: '0.35rem' }} />
                    </label>
                    <label>
                      <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>End</span>
                      <input type="date" value={toEnd} onChange={(e) => setToEnd(e.target.value)} style={{ padding: '0.35rem' }} />
                    </label>
                    {selectedCfg?.is_salary ? (
                      <label>
                        <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Kind</span>
                        <select
                          value={toKind}
                          onChange={(e) => setToKind(e.target.value === 'paid' ? 'paid' : 'unpaid')}
                          style={{ padding: '0.35rem' }}
                        >
                          <option value="unpaid">Unpaid</option>
                          <option value="paid">Paid</option>
                        </select>
                      </label>
                    ) : null}
                    <label style={{ flex: '1 1 160px' }}>
                      <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Note (optional)</span>
                      <input
                        type="text"
                        value={toNote}
                        onChange={(e) => setToNote(e.target.value)}
                        style={{ width: '100%', padding: '0.35rem', boxSizing: 'border-box' }}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={toSaving}
                      onClick={() => void addTimeOff()}
                      style={{
                        padding: '0.45rem 0.9rem',
                        fontWeight: 600,
                        color: 'white',
                        background: toSaving ? 'var(--text-faint-300)' : '#ea580c',
                        border: 'none',
                        borderRadius: 6,
                        cursor: toSaving ? 'wait' : 'pointer',
                      }}
                    >
                      {toSaving ? 'Saving…' : 'Add time off'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {scheduleOpen && selected?.userId ? (
        <EmploymentMonthScheduleModal
          userId={selected.userId}
          displayName={selected.name}
          onClose={() => setScheduleOpen(false)}
        />
      ) : null}

      {payHistoryOpen && selected ? (
        <EmploymentPayHistoryModal
          personName={selected.name}
          onClose={() => setPayHistoryOpen(false)}
          onOpenPayReport={onViewPayReport}
        />
      ) : null}

      {salaryOffConfirm != null ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1200,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            boxSizing: 'border-box',
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="salary-off-confirm-title"
          onClick={() => setSalaryOffConfirm(null)}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 8,
              width: 'min(94vw, 460px)',
              padding: '1rem 1.1rem',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="salary-off-confirm-title" style={{ margin: '0 0 0.5rem 0', color: 'var(--text-strong)' }}>
              Turn off Salaried for {salaryOffConfirm}?
            </h3>
            <ul style={{ margin: '0 0 0.6rem 0', paddingLeft: '1.1rem', fontSize: '0.875rem', color: 'var(--text-700)', display: 'grid', gap: '0.35rem' }}>
              {salaryTemplateByPersonName[salaryOffConfirm] ? (
                <li>
                  Their salaried workday template and every per-day override are{' '}
                  <strong style={{ color: 'var(--text-red-600)' }}>permanently deleted</strong> — turning Salaried back on will
                  not restore them; the schedule must be rebuilt by hand.
                </li>
              ) : null}
              <li>Today&rsquo;s auto-generated schedule sessions are removed and no future ones are created; their dashboard returns to manual clock in/out.</li>
              <li>Pay and cost math switches to logged hours × hourly wage.</li>
              <li>Past pay reports, payments, and clock history are not affected.</li>
            </ul>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setSalaryOffConfirm(null)}
                style={{
                  padding: '0.35rem 0.7rem',
                  fontSize: '0.875rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  background: 'var(--surface)',
                  color: 'var(--text-700)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpsertPayConfig(salaryOffConfirm, { is_salary: false })
                  setSalaryOffConfirm(null)
                }}
                style={{
                  padding: '0.35rem 0.7rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 4,
                  background: '#dc2626',
                  color: 'white',
                  cursor: 'pointer',
                }}
              >
                Turn off Salaried
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function chipStyle(color: string, background: string): React.CSSProperties {
  return {
    display: 'inline-block',
    padding: '0.05rem 0.45rem',
    borderRadius: 999,
    fontSize: '0.75rem',
    fontWeight: 600,
    color,
    background,
    border: '1px solid var(--border)',
  }
}
