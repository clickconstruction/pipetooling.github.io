import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { UserRole } from '../../hooks/useAuth'
import type { Database } from '../../types/database'
import { supabase } from '../../lib/supabase'
import { getAccessTokenForEdgeFunctions } from '../../lib/supabaseAccessTokenForEdge'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'

function calendarDayKeyWithZone(ms: number, timeZone: string): string {
  const zone = timeZone.trim() || APP_CALENDAR_TZ
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms))
}

type ScheduleRow = Database['public']['Tables']['recurring_job_report_schedules']['Row']
type RecipientRow = Database['public']['Tables']['recurring_job_report_schedule_recipients']['Row']

/** Matches Edge + DB constraint on `activity_scope`. */
type ActivityScope =
  | 'calendar_yesterday'
  | 'calendar_today'
  | 'calendar_week'
  | 'calendar_last_week'

/** Matches Edge + DB constraint on `crew_filter`. */
type CrewFilter = 'all_users' | 'my_team'

const ACTIVITY_SCOPE_UI: readonly { value: ActivityScope; label: string }[] = [
  { value: 'calendar_yesterday', label: 'Jobs yesterday' },
  { value: 'calendar_today', label: 'Jobs today' },
  { value: 'calendar_week', label: 'Jobs this week (Sun–Sat)' },
  { value: 'calendar_last_week', label: 'Jobs last week (Sun–Sat)' },
] as const

const CREW_FILTER_UI: readonly { value: CrewFilter; label: string }[] = [
  { value: 'all_users', label: 'All users' },
  { value: 'my_team', label: 'My team (people you lead)' },
] as const

/** `field-sizing` (Chromium+) — not in `CSSProperties` yet. */
type CompactSelectStyle = CSSProperties & { fieldSizing?: 'content' }

const previewToolbarLabelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: '0.8rem',
  flex: '0 0 auto',
  width: 'fit-content',
}

const previewSelectOrgRecipient: CompactSelectStyle = {
  width: 'max-content',
  maxWidth: 'min(280px, 40vw)',
  padding: '0.4rem 0.5rem',
  boxSizing: 'border-box',
  fieldSizing: 'content',
}

const previewSelectScopeFilter: CompactSelectStyle = {
  width: 'max-content',
  maxWidth: 'max-content',
  padding: '0.4rem 0.5rem',
  boxSizing: 'border-box',
  fieldSizing: 'content',
}

const recipientTableScopeFilterSelect: CompactSelectStyle = {
  width: 'max-content',
  maxWidth: '100%',
  padding: '0.35rem',
  boxSizing: 'border-box',
  fieldSizing: 'content',
}

/** Until types reflect migration, read optional columns safely. */
type RecipientRowLoose = RecipientRow & { activity_scope?: string; crew_filter?: string; include_costs?: boolean }

function parseActivityScopeFromRow(row: RecipientRowLoose): ActivityScope {
  const v = row.activity_scope
  if (
    v === 'calendar_yesterday' ||
    v === 'calendar_today' ||
    v === 'calendar_week' ||
    v === 'calendar_last_week'
  )
    return v
  return 'calendar_yesterday'
}

function parseCrewFilterFromRow(row: RecipientRowLoose): CrewFilter {
  const v = row.crew_filter
  if (v === 'all_users' || v === 'my_team') return v
  return 'all_users'
}

function parseIncludeCostsFromRow(row: RecipientRowLoose): boolean {
  return row.include_costs === true
}

type RecipientDraftRow = {
  localId: string
  recipient_user_id: string
  activity_scope: ActivityScope
  crew_filter: CrewFilter
  include_costs: boolean
}

type Props = {
  open: boolean
  onClose: () => void
  authUserId: string | undefined
  authRole: UserRole | null
  scopeMasterChoices: readonly { id: string; label: string }[]
}

/** `time` HH:MM (15-minute step expected). */
function toPgTime(hhMm: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(hhMm.trim())
  if (!m) return '06:00:00'
  return `${m[1]}:${m[2]}:00`
}

/** Extract HH:MM for `<input type="time" />` from Postgres `HH:MM:SS`. */
function fromPgTime(t: string | null | undefined): string {
  const s = (t ?? '06:00:00').slice(0, 5)
  const m = /^(\d{2}):(\d{2})$/.exec(s)
  return m ? s : '06:00'
}

function defaultWeekdays(): number[] {
  return [1, 2, 3, 4, 5]
}

const WEEKDAYS: { bit: number; label: string }[] = [
  { bit: 0, label: 'Sun' },
  { bit: 1, label: 'Mon' },
  { bit: 2, label: 'Tue' },
  { bit: 3, label: 'Wed' },
  { bit: 4, label: 'Thu' },
  { bit: 5, label: 'Fri' },
  { bit: 6, label: 'Sat' },
]

export default function RecurringEmailReportsModal({
  open,
  onClose,
  authUserId,
  authRole,
  scopeMasterChoices,
}: Props) {
  const { showToast } = useToastContext()
  const [loading, setLoading] = useState(false)
  const [schedules, setSchedules] = useState<ScheduleRow[]>([])
  const [recipientsBySchedule, setRecipientsBySchedule] = useState<Map<string, RecipientRow[]>>(
    () => new Map(),
  )

  /** Scope master selected for Preview / Test (defaults to sole choice). */
  const [scopeMasterId, setScopeMasterId] = useState<string | null>(() => scopeMasterChoices[0]?.id ?? null)
  /** Preview & test sandbox: activity window under selected org master. */
  const [sandboxActivityScope, setSandboxActivityScope] = useState<ActivityScope>('calendar_yesterday')
  const [sandboxCrewFilter, setSandboxCrewFilter] = useState<CrewFilter>('all_users')
  const [sandboxIncludeCosts, setSandboxIncludeCosts] = useState(false)
  const [sandboxRecipientUserId, setSandboxRecipientUserId] = useState<string | null>(null)
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [testSendLoading, setTestSendLoading] = useState(false)

  /** New / edit draft for one schedule. */
  const [draft, setDraft] = useState<{
    id: string | null
    name: string
    enabled: boolean
    timeHm: string
    daysOfWeek: number[]
    timezone: string
    recipientDrafts: RecipientDraftRow[]
  } | null>(null)

  /** Roster for recipient pickers. */
  const [rosterUsers, setRosterUsers] = useState<Array<{ id: string; name: string; email: string }>>([])

  useEffect(() => {
    setScopeMasterId((prev) => {
      const ids = new Set(scopeMasterChoices.map((x) => x.id))
      if (prev && ids.has(prev)) return prev
      return scopeMasterChoices[0]?.id ?? null
    })
  }, [scopeMasterChoices])

  useEffect(() => {
    if (!authUserId) setSandboxRecipientUserId(null)
    else setSandboxRecipientUserId(authUserId)
  }, [authUserId])

  const loadRecipients = useCallback(async (scheduleIds: string[]) => {
    const next = new Map<string, RecipientRow[]>()
    if (scheduleIds.length === 0) {
      setRecipientsBySchedule(next)
      return next
    }
    const { data, error } = await supabase
      .from('recurring_job_report_schedule_recipients')
      .select('*')
      .in('schedule_id', scheduleIds)
      .limit(500)

    if (error) throw error
    for (const sid of scheduleIds) next.set(sid, [])
    for (const r of (data ?? []) as RecipientRow[]) {
      const list = next.get(r.schedule_id ?? '') ?? []
      list.push(r)
      next.set(r.schedule_id!, list)
    }
    setRecipientsBySchedule(next)
    return next
  }, [])

  const reload = useCallback(async () => {
    if (!authUserId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('recurring_job_report_schedules')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      const rows = (data ?? []) as ScheduleRow[]
      setSchedules(rows)
      await loadRecipients(rows.map((r) => r.id))
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setLoading(false)
    }
  }, [authUserId, loadRecipients, showToast])

  useEffect(() => {
    if (!open || !authUserId) return
    let cancelled = false
    async function roster() {
      try {
        const rows = await withSupabaseRetry(
          async () =>
            supabase
              .from('users')
              .select('id,name,email')
              .is('archived_at', null)
              .order('name', { ascending: true })
              .limit(300),
          'recurring email reports roster',
        )
        if (!cancelled) {
          setRosterUsers((rows ?? []) as Array<{ id: string; name: string; email: string }>)
        }
      } catch {
        if (!cancelled) setRosterUsers([])
      }
    }
    void roster()
    void reload()
    return () => {
      cancelled = true
    }
  }, [open, authUserId, reload])

  const sandboxRecipientOptions = useMemo(() => rosterUsers, [rosterUsers])

  function startCreate() {
    if (!scopeMasterId) return
    setDraft({
      id: null,
      name: 'Daily recap',
      enabled: true,
      timeHm: '07:00',
      daysOfWeek: defaultWeekdays(),
      timezone: APP_CALENDAR_TZ,
      recipientDrafts: [],
    })
  }

  function startEdit(s: ScheduleRow) {
    const recs = recipientsBySchedule.get(s.id) ?? []
    setDraft({
      id: s.id,
      name: s.name,
      enabled: s.enabled,
      timeHm: fromPgTime(s.time_local ?? undefined),
      daysOfWeek: [...(Array.isArray(s.days_of_week) ? s.days_of_week : [])].sort((a, b) => a - b),
      timezone: s.timezone ?? APP_CALENDAR_TZ,
      recipientDrafts: recs.map((r) => ({
        localId: crypto.randomUUID(),
        recipient_user_id: r.recipient_user_id,
        activity_scope: parseActivityScopeFromRow(r as RecipientRowLoose),
        crew_filter: parseCrewFilterFromRow(r as RecipientRowLoose),
        include_costs: parseIncludeCostsFromRow(r as RecipientRowLoose),
      })),
    })
  }

  function toggleDraftDay(day: number) {
    setDraft((d) => {
      if (!d) return d
      const has = d.daysOfWeek.includes(day)
      const nextDays = has ? d.daysOfWeek.filter((x) => x !== day) : [...d.daysOfWeek, day].sort((a, b) => a - b)
      return { ...d, daysOfWeek: nextDays }
    })
  }

  async function saveDraft() {
    if (!draft || !scopeMasterChoices.length) return
    const [, mm] = draft.timeHm.split(':').map((x) => Number.parseInt(x, 10))
    if ((mm ?? NaN) % 15 !== 0) {
      showToast('Pick a time on a 15‑minute boundary (cron runs every 15 minutes)', 'warning')
      return
    }
    const scopeMaster = draft.id ? schedules.find((s) => s.id === draft.id)?.scope_master_user_id : scopeMasterId
    if (!scopeMaster) {
      showToast('Choose scope master user', 'warning')
      return
    }
    if (!authUserId) return
    if (draft.recipientDrafts.length > 50) {
      showToast('At most 50 recipients per schedule', 'warning')
      return
    }

    try {
      if (!draft.id) {
        const { data: inserted, error } = await supabase
          .from('recurring_job_report_schedules')
          .insert({
            name: draft.name.trim(),
            enabled: draft.enabled,
            time_local: toPgTime(draft.timeHm),
            days_of_week: draft.daysOfWeek.map((x: number) => x as number),
            timezone: draft.timezone,
            reporting_preset: 'prior_calendar_day',
            scope_master_user_id: scopeMaster,
            created_by: authUserId,
          })
          .select('id')
          .single()

        if (error) throw error
        const newId = inserted?.id
        if (!newId) throw new Error('Missing id after insert')
        const recIns = draft.recipientDrafts
          .filter((r) => r.recipient_user_id)
          .map((r) => ({
            schedule_id: newId,
            recipient_user_id: r.recipient_user_id,
            activity_scope: r.activity_scope,
            crew_filter: r.crew_filter,
            include_costs: r.include_costs,
          }))
        if (recIns.length) {
          const { error: ie } = await supabase.from('recurring_job_report_schedule_recipients').insert(recIns)
          if (ie) throw ie
        }
        showToast('Schedule created', 'success')
      } else {
        const { error: ue } = await supabase
          .from('recurring_job_report_schedules')
          .update({
            name: draft.name.trim(),
            enabled: draft.enabled,
            time_local: toPgTime(draft.timeHm),
            days_of_week: draft.daysOfWeek.map((x) => x as number),
            timezone: draft.timezone,
            updated_at: new Date().toISOString(),
          })
          .eq('id', draft.id)
        if (ue) throw ue

        await supabase.from('recurring_job_report_schedule_recipients').delete().eq('schedule_id', draft.id)

        const recIns = draft.recipientDrafts
          .filter((r) => r.recipient_user_id)
          .map((r) => ({
            schedule_id: draft.id!,
            recipient_user_id: r.recipient_user_id,
            activity_scope: r.activity_scope,
            crew_filter: r.crew_filter,
            include_costs: r.include_costs,
          }))
        if (recIns.length) {
          const { error: ie } = await supabase.from('recurring_job_report_schedule_recipients').insert(recIns)
          if (ie) throw ie
        }
        showToast('Schedule updated', 'success')
      }
      setDraft(null)
      await reload()
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error')
    }
  }

  async function deleteSchedule(id: string) {
    const okDel =
      typeof window !== 'undefined' &&
      window.confirm(
        `Delete this schedule?\n\nThis removes all recipients tied to it.`,
      )
    if (!okDel) return
    try {
      const { error } = await supabase.from('recurring_job_report_schedules').delete().eq('id', id)
      if (error) throw error
      showToast('Schedule deleted', 'success')
      if (draft?.id === id) setDraft(null)
      await reload()
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error')
    }
  }

  async function runPreview() {
    if (!scopeMasterId) return
    setPreviewLoading(true)
    try {
      const token = await getAccessTokenForEdgeFunctions()
      if (!token) {
        showToast('Your session expired. Sign in again, then retry Preview.', 'error')
        return
      }
      const tz = draft?.timezone ?? APP_CALENDAR_TZ
      const anchorYmd = calendarDayKeyWithZone(Date.now(), tz)

      const data = await withSupabaseRetry(
        async () =>
          supabase.functions.invoke('recurring-job-report-preview', {
            headers: { Authorization: `Bearer ${token}` },
            body: {
              scope_master_user_id: scopeMasterId,
              recipient_user_id: sandboxRecipientUserId ?? undefined,
              activity_scope: sandboxActivityScope,
              crew_filter: sandboxCrewFilter,
              timezone: tz,
              anchor_date: anchorYmd,
              include_costs: sandboxIncludeCosts,
            },
          }),
        'recurring-job-report-preview',
      )
      const payload = data as unknown as { html?: string }
      const html = typeof payload.html === 'string' ? payload.html : ''
      setPreviewHtml(html)
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setPreviewLoading(false)
    }
  }

  async function runTestSend() {
    if (!scopeMasterId) return
    setTestSendLoading(true)
    try {
      const token = await getAccessTokenForEdgeFunctions()
      if (!token) {
        showToast('Your session expired. Sign in again, then retry.', 'error')
        return
      }
      const tz = draft?.timezone ?? APP_CALENDAR_TZ
      const anchorYmd = calendarDayKeyWithZone(Date.now(), tz)

      await withSupabaseRetry(
        async () =>
          supabase.functions.invoke('recurring-job-report-test-send', {
            headers: { Authorization: `Bearer ${token}` },
            body: {
              scope_master_user_id: scopeMasterId,
              recipient_user_id: sandboxRecipientUserId ?? undefined,
              activity_scope: sandboxActivityScope,
              crew_filter: sandboxCrewFilter,
              timezone: tz,
              anchor_date: anchorYmd,
              include_costs: sandboxIncludeCosts,
            },
          }),
        'recurring-job-report-test-send',
      )
      showToast('Test email sent (to your login email)', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setTestSendLoading(false)
    }
  }

  function addRecipientDraft() {
    setDraft((d) =>
      !d
        ? d
        : {
            ...d,
            recipientDrafts: [
              ...d.recipientDrafts,
              {
                localId: crypto.randomUUID(),
                recipient_user_id: '',
                activity_scope: 'calendar_yesterday',
                crew_filter: 'all_users',
                include_costs: false,
              },
            ],
          },
    )
  }

  if (!open) return null

  const canConfigure =
    authRole === 'dev' || authRole === 'master_technician' || isAssistantLike(authRole)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        overflowY: 'auto',
      }}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="recurring-email-reports-heading"
        style={{
          background: 'var(--surface)',
          borderRadius: 10,
          maxWidth: 900,
          width: '100%',
          maxHeight: '92vh',
          overflow: 'auto',
          padding: '1.25rem 1.5rem',
          boxShadow: '0 22px 50px rgba(0,0,0,.2)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <h2 id="recurring-email-reports-heading" style={{ margin: 0, fontSize: '1.25rem' }}>
            Recurring Email Reports
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              flexShrink: 0,
              background: 'var(--bg-muted)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: 'pointer',
              padding: '0.35rem 0.6rem',
            }}
          >
            Close
          </button>
        </div>

        {!canConfigure ? (
          <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>
            Only dev, master technician, or assistant can configure recurring report emails.
          </p>
        ) : scopeMasterChoices.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>Could not resolve a scope master account for schedules.</p>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
              <label style={previewToolbarLabelStyle}>
                <span>Org</span>
                <select
                  value={scopeMasterId ?? ''}
                  onChange={(e) => setScopeMasterId(e.target.value || null)}
                  style={previewSelectOrgRecipient}
                >
                  {scopeMasterChoices.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={previewToolbarLabelStyle}>
                <span>Recipient</span>
                <select
                  value={sandboxRecipientUserId ?? ''}
                  onChange={(e) => setSandboxRecipientUserId(e.target.value || null)}
                  style={previewSelectOrgRecipient}
                >
                  {sandboxRecipientOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {(u.name ?? '').trim() || u.email}
                    </option>
                  ))}
                </select>
              </label>
              <label style={previewToolbarLabelStyle}>
                <span>Scope</span>
                <select
                  value={sandboxActivityScope}
                  onChange={(e) => setSandboxActivityScope(e.target.value as ActivityScope)}
                  style={previewSelectScopeFilter}
                >
                  {ACTIVITY_SCOPE_UI.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={previewToolbarLabelStyle}>
                <span>Filter</span>
                <select
                  value={sandboxCrewFilter}
                  onChange={(e) => setSandboxCrewFilter(e.target.value as CrewFilter)}
                  style={previewSelectScopeFilter}
                >
                  {CREW_FILTER_UI.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ ...previewToolbarLabelStyle, justifyContent: 'flex-end', marginBottom: 2 }}>
                <span aria-hidden />
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.4rem 0' }}>
                  <input
                    type="checkbox"
                    checked={sandboxIncludeCosts}
                    onChange={(e) => setSandboxIncludeCosts(e.target.checked)}
                    style={{ width: '1.1rem', height: '1.1rem', flexShrink: 0 }}
                  />
                  Include costs
                </span>
              </label>
              <button
                type="button"
                onClick={() => void runPreview()}
                disabled={previewLoading || testSendLoading || !scopeMasterId}
                style={{
                  padding: '0.45rem 0.75rem',
                  flexShrink: 0,
                  background: 'var(--bg-muted)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 6,
                  cursor:
                    previewLoading || testSendLoading ? 'wait' : !scopeMasterId ? 'not-allowed' : 'pointer',
                }}
              >
                {previewLoading ? 'Preview…' : 'Preview HTML'}
              </button>
              <button
                type="button"
                onClick={() => void runTestSend()}
                disabled={!scopeMasterId || previewLoading || testSendLoading}
                style={{
                  padding: '0.45rem 0.75rem',
                  flexShrink: 0,
                  background: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor:
                    testSendLoading || previewLoading ? 'wait' : !scopeMasterId ? 'not-allowed' : 'pointer',
                }}
              >
                {testSendLoading ? 'Sending…' : 'Send test email'}
              </button>
            </div>

            {previewHtml ? (
              <div style={{ marginBottom: 20, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <iframe
                  title="Email preview"
                  sandbox=""
                  style={{ width: '100%', minHeight: 280, border: 'none', background: 'var(--bg-page)' }}
                  srcDoc={previewHtml}
                />
              </div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Schedules</h3>
              <button
                type="button"
                onClick={startCreate}
                disabled={!scopeMasterId}
                style={{
                  padding: '0.45rem 0.75rem',
                  background: '#111827',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                New schedule
              </button>
            </div>

            {loading ? (
              <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
            ) : schedules.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No schedules yet.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {schedules.map((s) => (
                  <li
                    key={s.id}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: 12,
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <div>
                        <strong>{s.name}</strong>{' '}
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                          {s.enabled ? 'On' : 'Off'} · {fromPgTime(s.time_local ?? undefined)} ·{' '}
                          {(s.days_of_week ?? []).join(', ')} · {s.timezone}
                        </span>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: 4 }}>
                          {(recipientsBySchedule.get(s.id) ?? []).length} recipient(s)
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => startEdit(s)}
                          style={{
                            padding: '0.35rem 0.6rem',
                            background: 'var(--bg-subtle)',
                            border: '1px solid var(--border)',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: '0.8125rem',
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteSchedule(s.id)}
                          style={{
                            padding: '0.35rem 0.6rem',
                            background: 'var(--bg-red-tint)',
                            border: '1px solid #fecaca',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: '0.8125rem',
                            color: 'var(--text-red-700)',
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {draft && canConfigure && (
          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: '1px solid var(--border)',
            }}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: '1rem' }}>{draft.id ? 'Edit schedule' : 'New schedule'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                Name
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  style={{ padding: '0.4rem 0.5rem' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                Send time ({draft.timezone})
                <input
                  type="time"
                  step={900}
                  value={draft.timeHm}
                  onChange={(e) => setDraft({ ...draft, timeHm: e.target.value })}
                  style={{ padding: '0.4rem 0.5rem' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>Enabled</span>
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
                  style={{ width: '1.25rem', height: '1.25rem' }}
                />
              </label>
            </div>
            <div style={{ marginTop: 12, fontSize: '0.8rem' }}>
              <strong>Days (0=Sun)</strong>{' '}
              <span style={{ color: 'var(--text-muted)' }}>— picks which weekdays the email fires</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                {WEEKDAYS.map((d) => (
                  <label key={d.bit} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="checkbox"
                      checked={draft.daysOfWeek.includes(d.bit)}
                      onChange={() => toggleDraftDay(d.bit)}
                    />
                    {d.label}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>Recipients</strong>
                <button
                  type="button"
                  onClick={addRecipientDraft}
                  style={{
                    padding: '0.3rem 0.55rem',
                    background: 'var(--bg-muted)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                  }}
                >
                  Add recipient
                </button>
              </div>
              {draft.recipientDrafts.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No recipients — add at least one to receive mail.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8, fontSize: '0.875rem' }}>
                  <colgroup>
                    <col />
                    <col style={{ width: '1%' }} />
                    <col style={{ width: '1%' }} />
                    <col style={{ width: '1%' }} />
                    <col style={{ width: '1%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th
                        align="left"
                        style={{ borderBottom: '1px solid var(--border)', padding: 6, whiteSpace: 'nowrap' }}
                      >
                        User
                      </th>
                      <th
                        align="left"
                        style={{ borderBottom: '1px solid var(--border)', padding: 6, whiteSpace: 'nowrap' }}
                      >
                        Scope
                      </th>
                      <th
                        align="left"
                        style={{ borderBottom: '1px solid var(--border)', padding: 6, whiteSpace: 'nowrap' }}
                      >
                        Filter
                      </th>
                      <th
                        align="left"
                        style={{ borderBottom: '1px solid var(--border)', padding: 6, whiteSpace: 'nowrap' }}
                      >
                        Include costs
                      </th>
                      <th style={{ borderBottom: '1px solid var(--border)', padding: 6, whiteSpace: 'nowrap' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {draft.recipientDrafts.map((r) => (
                      <tr key={r.localId}>
                        <td style={{ padding: 6, borderBottom: '1px solid #f3f4f6' }}>
                          <select
                            value={r.recipient_user_id}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                recipientDrafts: draft.recipientDrafts.map((x) =>
                                  x.localId === r.localId ? { ...x, recipient_user_id: e.target.value } : x,
                                ),
                              })
                            }
                            style={{ width: '100%', padding: '0.35rem' }}
                          >
                            <option value="">Select…</option>
                            {rosterUsers.map((u) => (
                              <option key={u.id} value={u.id}>
                                {(u.name ?? '').trim() || u.email}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td
                          style={{
                            padding: 6,
                            borderBottom: '1px solid #f3f4f6',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <select
                            value={r.activity_scope}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                recipientDrafts: draft.recipientDrafts.map((x) =>
                                  x.localId === r.localId
                                    ? { ...x, activity_scope: e.target.value as ActivityScope }
                                    : x,
                                ),
                              })
                            }
                            style={recipientTableScopeFilterSelect}
                          >
                            {ACTIVITY_SCOPE_UI.map(({ value, label }) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td
                          style={{
                            padding: 6,
                            borderBottom: '1px solid #f3f4f6',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <select
                            value={r.crew_filter}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                recipientDrafts: draft.recipientDrafts.map((x) =>
                                  x.localId === r.localId
                                    ? { ...x, crew_filter: e.target.value as CrewFilter }
                                    : x,
                                ),
                              })
                            }
                            style={recipientTableScopeFilterSelect}
                          >
                            {CREW_FILTER_UI.map(({ value, label }) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td
                          style={{
                            padding: 6,
                            borderBottom: '1px solid #f3f4f6',
                            whiteSpace: 'nowrap',
                            textAlign: 'center',
                          }}
                          title="Add Cost column: hours × hourly wage from People pay config when user name matches person_name."
                        >
                          <input
                            type="checkbox"
                            checked={r.include_costs}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                recipientDrafts: draft.recipientDrafts.map((x) =>
                                  x.localId === r.localId ? { ...x, include_costs: e.target.checked } : x,
                                ),
                              })
                            }
                            style={{ width: '1.15rem', height: '1.15rem' }}
                            aria-label="Include costs for this recipient"
                          />
                        </td>
                        <td
                          style={{
                            padding: 6,
                            borderBottom: '1px solid #f3f4f6',
                            textAlign: 'right',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                recipientDrafts: draft.recipientDrafts.filter((x) => x.localId !== r.localId),
                              })
                            }
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-red-700)',
                              cursor: 'pointer',
                            }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => void saveDraft()}
                style={{
                  padding: '0.5rem 0.9rem',
                  background: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setDraft(null)}
                style={{
                  padding: '0.5rem 0.9rem',
                  background: 'var(--bg-muted)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
