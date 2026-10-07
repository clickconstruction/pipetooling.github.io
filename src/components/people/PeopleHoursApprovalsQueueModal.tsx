import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { PersonNameDoor } from '../personDesk/PersonNameDoor'
import { AssignSessionJobPopover } from '../clock-sessions'
import { approveClockSessions, heldFromApproveResult } from '../../lib/approveClockSessions'
import { describeHeld, isTypedByHand, splitForApproveAll, typedStampsVersion, typedWaitingAsEntry, type TypedWaitingRow } from '../../lib/clock/typedHours'
import { confirmTypedEntry, loadTypedHoursWaiting } from '../../lib/clock/loadTypedHoursWaiting'
import { useTypedStamps } from '../../hooks/useTypedStamps'
import { TypedHoldNote, TypedHoursStamp } from '../clock/TypedHoursStamp'
import { recordHoursApproved, type HoursApprovedSurface } from '../../lib/hoursApprovedTelemetry'
import { sessionApprovalChips } from '../../lib/people/approvalsSessionChips'
import type { SalariedPayConfigFlags } from '../../lib/salariedEffectiveHours'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { shortJobOrBidLabelFromEmbeds } from '../../types/clockSessions'
import type { ClockSessionRow } from '../../types/clockSessions'
import { denverCalendarDayKey, formatDenverTimeOnly } from '../../utils/dateUtils'
import { formatHoursShort } from '../../lib/myTeamApprovals'
import { fetchAllPendingClockSessions, PENDING_APPROVALS_FETCH_CAP } from '../../lib/people/fetchAllPendingClockSessions'
import {
  buildApprovalsQueue,
  describeApproveOutcome,
  formatFlagCounts,
  withoutSessionIds,
  type ApprovalsQueueFlagCounts,
  type ApprovalsQueuePerson,
  type ApprovalsQueueSession,
  type ApprovalsQueueWeek,
} from '../../lib/people/approvalsQueue'

type Props = {
  onClose: () => void
  /** Sessions changed (approve / reject / job) — the parent reloads its week-scoped lists. */
  onChanged: () => void
  /** Opens the parent's full clock-session editor (times / split). */
  onEditSession: (session: ClockSessionRow) => void
  authUserId: string | undefined
  /** Bump to refetch (e.g. after the parent's edit modal saves). */
  reloadKey: number
  /** Person Desk pin (v2.2701): only this account's sessions; the title names them. */
  pinUserId?: string | null
  pinDisplayName?: string | null
  /** Stack above a host that already sits at the default modal rung (the Desk drawer). */
  zIndex?: number
  /** Which door opened this queue — `hours_approved{surface}` telemetry (Tier-1 #15). */
  surface?: HoursApprovedSurface
  /** T5-03: fired with the approved count so the host can point at Draft Payroll. */
  onApproved?: (approved: number) => void
  /** Open on the Typed by hand filter (the Needs You *Look at them* action, v2.4254). */
  startTypedOnly?: boolean
  /** With `startTypedOnly`: only what this person (a `users.id`) typed — the *Hours added in bulk* door (v2.4281). The name is for the chip when none of their rows is pending. */
  startTypist?: { id: string; name: string | null } | null
  /** Opens a person's day in the clock-day editor — the "or fix it" beside Looks right. Hosts without one show no button. */
  onOpenDay?: (day: { userId: string; personName: string; workDate: string }) => void
}

const BTN: CSSProperties = {
  padding: '0.2rem 0.55rem',
  fontSize: '0.78125rem',
  fontWeight: 600,
  borderRadius: 4,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}
const BTN_APPROVE: CSSProperties = { ...BTN, border: '1px solid #22c55e', background: 'var(--bg-green-tint)', color: 'var(--text-green-800)' }
const BTN_REJECT: CSSProperties = { ...BTN, border: '1px solid #dc2626', background: 'var(--bg-red-tint)', color: 'var(--text-red-600)' }
const BTN_QUIET: CSSProperties = { ...BTN, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontWeight: 500 }
/** Neutral context chips (salary / midnight-cap) — information, not a warning, so not amber. */
const INFO_CHIP: CSSProperties = {
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: 'var(--text-muted)',
  background: 'var(--bg-subtle)',
  border: '1px solid var(--border-strong)',
  borderRadius: 999,
  padding: '0 0.4rem',
  lineHeight: 1.5,
  whiteSpace: 'nowrap',
}
const FLAG_CHIP: CSSProperties = {
  fontSize: '0.71875rem',
  fontWeight: 700,
  color: 'var(--text-amber-800)',
  background: 'var(--bg-amber-tint)',
  border: '1px solid #f59e0b',
  borderRadius: 999,
  padding: '0 0.4rem',
  lineHeight: 1.5,
  whiteSpace: 'nowrap',
}

function dayLabel(ymd: string): string {
  return new Date(`${ymd}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }).replace(',', '')
}

function FlagSummary({ counts, prefix }: { counts: ApprovalsQueueFlagCounts; prefix?: string }) {
  const text = formatFlagCounts(counts)
  if (!text) return null
  return (
    <span style={{ fontSize: '0.78125rem', fontWeight: 600, color: 'var(--text-amber-800)' }}>
      {prefix ? `${prefix} ` : ''}⚠ {text}
    </span>
  )
}

export function PeopleHoursApprovalsQueueModal({ onClose, onChanged, onEditSession, authUserId, reloadKey, pinUserId, pinDisplayName, zIndex = 760, surface = 'approvals-queue', onApproved, startTypedOnly, startTypist, onOpenDay }: Props) {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const prefixMap = useLedgerPrefixMap()
  const { user: authUser, role } = useAuth()
  const [rows, setRows] = useState<ClockSessionRow[] | null>(null)
  /** person_name → salary flags for the "salary — counts as flat hours" chip; empty when the read fails (chips are optional). */
  const [payFlagsByName, setPayFlagsByName] = useState<ReadonlyMap<string, SalariedPayConfigFlags>>(() => new Map())
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  /** v2.4247: only the sessions someone typed hours onto — the ones that want a second person. */
  const [typedOnly, setTypedOnly] = useState(startTypedOnly === true)
  /** v2.4281: narrow the typed rows to one typist (the bulk-hours door); cleared with its chip. */
  const [typist, setTypist] = useState<string | null>(startTypedOnly === true ? (startTypist?.id ?? null) : null)
  /** Hours typed onto sessions that are already approved: they count in pay now and wait on a "Looks right" (v2.4254). */
  const [typedOntoApproved, setTypedOntoApproved] = useState<TypedWaitingRow[]>([])
  const [lookBusyId, setLookBusyId] = useState<string | null>(null)
  const [collapsedPeople, setCollapsedPeople] = useState<Set<string>>(() => new Set())
  const [openWeeks, setOpenWeeks] = useState<Set<string>>(() => new Set())

  const load = useCallback(async () => {
    try {
      setLoadError(null)
      const [data, payRes] = await Promise.all([
        fetchAllPendingClockSessions({ userId: pinUserId ?? null }),
        supabase.from('people_pay_config').select('person_name, is_salary, record_hours_but_salary'),
      ])
      setRows(data)
      void loadTypedHoursWaiting().then((waiting) => {
        setTypedOntoApproved(waiting.filter((w) => w.state === 'approved' && (!pinUserId || w.userId === pinUserId)))
      })
      if (!payRes.error) {
        const next = new Map<string, SalariedPayConfigFlags>()
        for (const r of (payRes.data ?? []) as Array<{ person_name: string; is_salary: boolean | null; record_hours_but_salary: boolean | null }>) {
          next.set(r.person_name.trim(), { is_salary: r.is_salary, record_hours_but_salary: r.record_hours_but_salary })
        }
        setPayFlagsByName(next)
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load pending sessions')
      setRows((prev) => prev ?? [])
    }
  }, [pinUserId])

  useEffect(() => {
    void load()
  }, [load, reloadKey])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const todayYmd = denverCalendarDayKey(Date.now())
  const fullQueue = useMemo(() => buildApprovalsQueue(rows ?? [], { todayYmd }), [rows, todayYmd])
  // Typed hours (v2.4247): the stamp on each row, and which rows an "Approve …" button may take.
  const allIds = useMemo(() => (rows ?? []).map((r) => r.id), [rows])
  const stampsVersion = useMemo(() => typedStampsVersion(rows ?? []), [rows])
  const { stamps, reload: reloadStamps } = useTypedStamps(allIds, stampsVersion)
  const typedCount = useMemo(() => allIds.filter((id) => isTypedByHand(stamps.get(id))).length, [allIds, stamps])
  const hoursById = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows ?? []) {
      m.set(r.id, r.clocked_out_at ? (new Date(r.clocked_out_at).getTime() - new Date(r.clocked_in_at).getTime()) / 3_600_000 : 0)
    }
    return m
  }, [rows])
  /** The part of a batch one press may approve: the punches. Typed and held rows are set aside. */
  const batchOf = useCallback(
    (ids: readonly string[]) => {
      const split = splitForApproveAll(ids, stamps)
      const hours = split.punchIds.reduce((sum, id) => sum + (hoursById.get(id) ?? 0), 0)
      return { ids: split.punchIds, hours, setAside: split.typedIds.length + split.heldIds.length }
    },
    [stamps, hoursById],
  )

  const queue = useMemo(() => {
    if (!flaggedOnly && !typedOnly) return fullQueue
    const keep = new Set<string>()
    for (const p of fullQueue.people) {
      for (const w of p.weeks) {
        for (const s of w.sessions) {
          if (flaggedOnly && !s.flagged) continue
          if (typedOnly && !isTypedByHand(stamps.get(s.id))) continue
          if (typedOnly && typist && !(stamps.get(s.id)?.entries ?? []).some((e) => e.kind === 'added' && e.typedBy === typist)) continue
          keep.add(s.id)
        }
      }
    }
    return buildApprovalsQueue((rows ?? []).filter((r) => keep.has(r.id)), { todayYmd })
  }, [flaggedOnly, typedOnly, typist, fullQueue, rows, todayYmd, stamps])
  /** The typist's name as the stamps say it, for the chip. */
  const typistName = useMemo(() => {
    if (!typist) return null
    for (const st of stamps.values()) {
      const e = st.entries.find((x) => x.typedBy === typist)
      if (e) return e.typedByName
    }
    return startTypist?.id === typist ? (startTypist.name ?? null) : null
  }, [typist, stamps, startTypist])

  const removeLocally = useCallback((ids: string[]) => {
    setRows((prev) => (prev ? withoutSessionIds(prev, ids) : prev))
  }, [])

  async function approve(ids: string[], what: string, hours: number, confirmBulk: boolean, setAside = 0): Promise<void> {
    if (busy || ids.length === 0) return
    if (confirmBulk) {
      const aside = setAside > 0 ? ` ${setAside} typed by hand or held ${setAside === 1 ? 'is' : 'are'} left out — those are approved one at a time.` : ''
      const ok = await confirmDialog({
        message: `Approve ${ids.length} session${ids.length === 1 ? '' : 's'} · ${formatHoursShort(hours)} for ${what}? This adds the hours to payroll.${aside}`,
        confirmLabel: `Approve ${ids.length}`,
      })
      if (!ok) return
    }
    setBusy(true)
    const { data, error } = await approveClockSessions(ids)
    setBusy(false)
    if (error) {
      showToast(error.message, 'error')
      return
    }
    const row = data?.[0]
    if (row?.error_message) {
      showToast(row.error_message, 'error')
      return
    }
    const approved = row?.approved_count ?? ids.length
    // Held sessions (the approver typed them, or they are the approver's own) are not "skipped".
    const { heldOwn, heldTyped } = heldFromApproveResult(data)
    const held = describeHeld(heldOwn, heldTyped)
    if (approved > 0) recordHoursApproved(authUserId ?? authUser?.id, role, surface, approved)
    const outcome = describeApproveOutcome(Math.max(0, ids.length - heldOwn - heldTyped), approved)
    showToast(held ? `${outcome.message}${outcome.message.endsWith('.') ? '' : '.'} ${held}` : outcome.message, held ? 'warning' : outcome.variant)
    if (approved > 0) onApproved?.(approved)
    if (approved >= ids.length) removeLocally(ids)
    else await load()
    reloadStamps()
    onChanged()
  }

  /** "Looks right": the second look on hours typed onto approved time. */
  async function looksRight(row: TypedWaitingRow): Promise<void> {
    if (lookBusyId) return
    setLookBusyId(row.entryId)
    const refused = await confirmTypedEntry(row.entryId)
    setLookBusyId(null)
    if (refused) {
      showToast(refused, 'error')
      return
    }
    showToast(`Recorded — ${row.personName}’s ${dayLabel(row.workDate)} looks right`, 'success')
    setTypedOntoApproved((prev) => prev.filter((w) => w.entryId !== row.entryId))
    reloadStamps()
    onChanged()
  }

  async function reject(s: ClockSessionRow): Promise<void> {
    if (busy) return
    const ok = await confirmDialog({
      message: `Reject ${s.users?.name?.trim() || 'this'} · ${dayLabel(s.work_date)} · ${formatHoursShort(hoursOf(s))}? Rejected time never reaches payroll.`,
      confirmLabel: 'Reject',
    })
    if (!ok) return
    setBusy(true)
    const { error } = await supabase
      .from('clock_sessions')
      .update({ rejected_at: new Date().toISOString(), rejected_by: authUserId ?? null })
      .eq('id', s.id)
    setBusy(false)
    if (error) {
      showToast(error.message, 'error')
      return
    }
    showToast('Session rejected', 'success')
    removeLocally([s.id])
    onChanged()
  }

  function hoursOf(s: ClockSessionRow): number {
    if (!s.clocked_out_at) return 0
    return (new Date(s.clocked_out_at).getTime() - new Date(s.clocked_in_at).getTime()) / 3_600_000
  }

  function togglePerson(userId: string) {
    setCollapsedPeople((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  /** v2.2822: every week of every person open at once, or everything folded. */
  const allWeekKeys = useMemo(() => queue.people.flatMap((p) => p.weeks.map((w) => `${p.userId}|${w.weekStart}`)), [queue])
  const allOpen = allWeekKeys.length > 0 && collapsedPeople.size === 0 && allWeekKeys.every((k) => openWeeks.has(k))
  // The typed-by-hand list is short and each row wants a look: open it all the way.
  useEffect(() => {
    if (!typedOnly) return
    setCollapsedPeople(new Set())
    setOpenWeeks(new Set(allWeekKeys))
  }, [typedOnly, allWeekKeys])
  function expandAll() {
    setCollapsedPeople(new Set())
    setOpenWeeks(new Set(allWeekKeys))
  }
  function collapseAll() {
    setOpenWeeks(new Set())
    setCollapsedPeople(new Set(queue.people.map((p) => p.userId)))
  }

  function toggleWeek(key: string) {
    setOpenWeeks((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const loading = rows == null
  const everything = batchOf(queue.sessionIds)
  const capped = (rows?.length ?? 0) >= PENDING_APPROVALS_FETCH_CAP

  function renderSession(s: ApprovalsQueueSession<ClockSessionRow>) {
    const r = s.row
    const inMs = new Date(r.clocked_in_at).getTime()
    const outMs = r.clocked_out_at ? new Date(r.clocked_out_at).getTime() : inMs
    const jobLabel = shortJobOrBidLabelFromEmbeds(r, prefixMap)
    const note = (r.notes ?? '').trim()
    const stamp = stamps.get(s.id)
    return (
      <div
        key={s.id}
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gap: '0.35rem 0.75rem',
          alignItems: 'center',
          padding: '0.4rem 0.6rem 0.4rem 1.6rem',
          borderTop: '1px solid var(--border)',
          background: s.flagged ? 'var(--bg-amber-tint)' : 'transparent',
          fontSize: '0.8125rem',
        }}
      >
        <div style={{ minWidth: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem 0.6rem' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-strong)', whiteSpace: 'nowrap' }}>{dayLabel(s.workDate)}</span>
          <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {formatDenverTimeOnly(inMs)} – {formatDenverTimeOnly(outMs)}
          </span>
          <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatHoursShort(s.hours)}</span>
          {s.flags.long ? (
            <span style={FLAG_CHIP} title="Longer than 12 hours — a forgotten clock-out looks exactly like this. Check before approving.">
              ⚠ long day
            </span>
          ) : null}
          {s.flags.tiny ? (
            <span style={FLAG_CHIP} title="Under a minute — almost always a double-tap. Reject it, or Edit the times if it was real.">
              ⚠ near-zero
            </span>
          ) : null}
          {s.flags.noJob ? (
            <span style={FLAG_CHIP} title="No job or bid — the hours get paid but no job carries the labor. Assign one first.">
              ⚠ no job
            </span>
          ) : null}
          {sessionApprovalChips({ payConfig: payFlagsByName.get((r.users?.name ?? '').trim()), clockedOutAt: r.clocked_out_at }).map((c) => (
            <span key={c.label} style={INFO_CHIP} title={c.title}>
              {c.label}
            </span>
          ))}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
            <span style={{ color: jobLabel ? 'var(--text-700)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '18rem' }} title={jobLabel ?? undefined}>
              {jobLabel ?? 'No job/bid'}
            </span>
            <AssignSessionJobPopover
              session={r}
              onSaved={() => {
                showToast('Job assigned', 'success')
                void load()
                onChanged()
              }}
              onError={(msg) => showToast(msg, 'error')}
              popoverZIndex={1250}
              compactTrigger
              dispatchScheduleAssigneeUserId={r.user_id}
              dispatchScheduleWorkDateYmd={r.work_date}
            />
          </span>
          {note ? (
            <span
              style={{ color: 'var(--text-muted)', fontStyle: 'italic', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}
              title={note}
            >
              “{note}”
            </span>
          ) : null}
          <TypedHoursStamp stamp={stamp} size="full" workDate={r.work_date} style={{ flexBasis: '100%' }} />
        </div>
        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'nowrap', alignItems: 'center' }}>
          {stamp?.hold ? (
            <TypedHoldNote hold={stamp.hold} style={{ maxWidth: '13rem' }} />
          ) : (
            <button type="button" style={BTN_APPROVE} disabled={busy} onClick={() => void approve([s.id], s.row.users?.name?.trim() || 'this person', s.hours, false)}>
              Approve
            </button>
          )}
          <button type="button" style={BTN_REJECT} disabled={busy} onClick={() => void reject(r)}>
            Reject
          </button>
          <button type="button" style={BTN_QUIET} disabled={busy} onClick={() => onEditSession(r)}>
            Edit
          </button>
        </div>
      </div>
    )
  }

  function renderWeek(p: ApprovalsQueuePerson<ClockSessionRow>, w: ApprovalsQueueWeek<ClockSessionRow>) {
    const key = `${p.userId}|${w.weekStart}`
    const open = openWeeks.has(key)
    const flagText = formatFlagCounts(w.flagCounts)
    const batch = batchOf(w.sessionIds)
    return (
      <div key={key} style={{ borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.6rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => toggleWeek(key)}
            aria-expanded={open}
            style={{
              flex: '1 1 auto',
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              border: 'none',
              background: 'none',
              padding: 0,
              cursor: 'pointer',
              textAlign: 'left',
              color: 'var(--text-strong)',
              fontSize: '0.8125rem',
            }}
          >
            <span aria-hidden style={{ color: 'var(--text-muted)', width: '0.8rem', display: 'inline-block' }}>{open ? '▾' : '▸'}</span>
            <span style={{ fontWeight: 600 }}>Week of {w.label}</span>
            <span style={{ color: 'var(--text-muted)' }}>
              {w.count} session{w.count === 1 ? '' : 's'} · {formatHoursShort(w.hours)}
            </span>
            {flagText ? <span style={{ color: 'var(--text-amber-800)', fontWeight: 600 }}>⚠ {flagText}</span> : null}
          </button>
          <button
            type="button"
            style={BTN_APPROVE}
            disabled={busy || batch.ids.length === 0}
            title={batch.setAside > 0 ? `${batch.setAside} typed by hand or held — approved one at a time, not by this button` : undefined}
            onClick={() => void approve(batch.ids, `${p.name} · week of ${w.label}`, batch.hours, true, batch.setAside)}
          >
            Approve week · {batch.ids.length}
            {batch.setAside > 0 ? ` of ${w.count}` : ''}
          </button>
        </div>
        {open ? w.sessions.map(renderSession) : null}
      </div>
    )
  }

  function renderPerson(p: ApprovalsQueuePerson<ClockSessionRow>) {
    const collapsed = collapsedPeople.has(p.userId)
    const batch = batchOf(p.sessionIds)
    return (
      <section key={p.userId} style={{ flexShrink: 0, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem 0.75rem', padding: '0.5rem 0.6rem', background: 'var(--bg-subtle)', flexWrap: 'wrap' }}>
          {/* The name door is its own <button>, so it sits beside the toggle rather than inside it (nested buttons are invalid DOM). */}
          <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-strong)' }}><PersonNameDoor name={p.name} userId={p.userId} /></span>
            <button
              type="button"
              onClick={() => togglePerson(p.userId)}
              aria-expanded={!collapsed}
              aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${p.name}: ${p.count} session${p.count === 1 ? '' : 's'}, ${formatHoursShort(p.hours)}`}
              style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', alignItems: 'baseline', gap: '0.5rem', border: 'none', background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', flexWrap: 'wrap', font: 'inherit' }}
            >
              <span aria-hidden style={{ color: 'var(--text-muted)', width: '0.8rem', display: 'inline-block', alignSelf: 'center' }}>{collapsed ? '▸' : '▾'}</span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {p.count} session{p.count === 1 ? '' : 's'} · {formatHoursShort(p.hours)} · {p.weeks.length} week{p.weeks.length === 1 ? '' : 's'} · oldest {dayLabel(p.oldestWorkDate)}
                {p.oldestAgeDays >= 7 ? ` (${p.oldestAgeDays}d)` : ''}
              </span>
              <FlagSummary counts={p.flagCounts} />
            </button>
          </div>
          <button
            type="button"
            style={BTN_APPROVE}
            disabled={busy || batch.ids.length === 0}
            title={batch.setAside > 0 ? `${batch.setAside} typed by hand or held — approved one at a time, not by this button` : undefined}
            onClick={() => void approve(batch.ids, p.name, batch.hours, true, batch.setAside)}
          >
            {batch.setAside > 0 ? `Approve ${batch.ids.length} of ${p.count}` : `Approve all ${p.count}`} · {formatHoursShort(batch.hours)}
          </button>
        </div>
        {collapsed ? null : p.weeks.map((w) => renderWeek(p, w))}
      </section>
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Hours approvals, every week"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex, paddingTop: 'var(--app-top-chrome, 0px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '0.9rem 1rem',
          width: 'min(960px, 96vw)',
          maxHeight: 'min(92vh, 100%)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.35rem' }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '1.125rem', lineHeight: 1.2 }}>
              {pinUserId ? `Hours approvals · ${pinDisplayName?.trim() || 'this person'} · every week` : 'Hours approvals · every week'}
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              {loading ? (
                'Loading every pending session…'
              ) : fullQueue.count === 0 ? (
                'Nothing waiting — every closed session is approved or rejected.'
              ) : (
                <>
                  <strong style={{ color: 'var(--text-strong)' }}>{fullQueue.count}</strong> session{fullQueue.count === 1 ? '' : 's'} ·{' '}
                  <strong style={{ color: 'var(--text-strong)' }}>{fullQueue.peopleCount}</strong> {fullQueue.peopleCount === 1 ? 'person' : 'people'} ·{' '}
                  <strong style={{ color: 'var(--text-strong)' }}>{formatHoursShort(fullQueue.hours)}</strong> not yet in payroll · oldest{' '}
                  {fullQueue.oldestAgeDays === 0 ? 'today' : `${fullQueue.oldestAgeDays} day${fullQueue.oldestAgeDays === 1 ? '' : 's'} ago`}
                  {formatFlagCounts(fullQueue.flagCounts) ? (
                    <>
                      {' '}
                      · <FlagSummary counts={fullQueue.flagCounts} />
                    </>
                  ) : null}
                  {typedCount > 0 ? ` · ${typedCount} typed by hand` : ''}
                  {capped ? ` · showing the first ${PENDING_APPROVALS_FETCH_CAP}` : ''}
                </>
              )}
            </p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, color: 'var(--text-muted)', padding: '0 0.15rem' }}>
            ×
          </button>
        </div>

        {loadError ? (
          <p role="alert" style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--text-red-600)' }}>
            {loadError}
          </p>
        ) : null}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8125rem', color: 'var(--text-700)', cursor: 'pointer' }}>
            <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />
            Flagged only
          </label>
          {typedCount > 0 || typedOnly ? (
            <label
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8125rem', color: 'var(--text-700)', cursor: 'pointer' }}
              title="Hours someone typed rather than punched. Whoever typed them cannot approve them."
            >
              <input type="checkbox" checked={typedOnly} onChange={(e) => setTypedOnly(e.target.checked)} />
              Typed by hand · {typedCount}
            </label>
          ) : null}
          {typedOnly && typist ? (
            <button
              type="button"
              onClick={() => setTypist(null)}
              title="Only what this person typed. Press to see everything typed by hand."
              style={{ ...BTN_QUIET, borderRadius: 999, fontSize: '0.78125rem' }}
            >
              typed by {typistName ?? 'one person'} ×
            </button>
          ) : null}
          {typedCount > 0 || typedOnly ? null : (
            <span style={{ fontSize: '0.78125rem', color: 'var(--text-muted)' }}>People lead with the oldest stall. Open a week to see its sessions.</span>
          )}
          <button type="button" disabled={loading || allWeekKeys.length === 0} onClick={() => (allOpen ? collapseAll() : expandAll())} style={{ ...BTN_QUIET, opacity: loading || allWeekKeys.length === 0 ? 0.55 : 1 }}>
            {allOpen ? 'Collapse all' : 'Expand all'}
          </button>
          <button
            type="button"
            disabled={busy || loading || everything.ids.length === 0}
            title={everything.setAside > 0 ? `${everything.setAside} typed by hand or held — approved one at a time, not by this button` : undefined}
            onClick={() => void approve(everything.ids, flaggedOnly ? 'every flagged session' : 'everyone', everything.hours, true, everything.setAside)}
            style={{
              marginLeft: 'auto',
              padding: '0.4rem 0.9rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              border: '1px solid #15803d',
              background: busy || loading || everything.ids.length === 0 ? '#86efac' : '#22c55e',
              color: 'white',
              borderRadius: 4,
              cursor: busy || loading || everything.ids.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {busy
              ? 'Approving…'
              : `Approve ${flaggedOnly ? 'flagged' : everything.setAside > 0 ? 'the punches' : 'everything'} · ${everything.ids.length} · ${formatHoursShort(everything.hours)}`}
          </button>
        </div>

        <div style={{ overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingRight: '0.1rem' }}>
          {typedOntoApproved.length > 0 ? (
            <section
              data-testid="typed-onto-approved"
              style={{ flexShrink: 0, border: '1px solid var(--border-blue)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)' }}
            >
              <div style={{ padding: '0.5rem 0.6rem', background: 'var(--bg-blue-tint)' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-strong)' }}>
                  Typed onto hours already approved · {typedOntoApproved.length}
                </div>
                <div style={{ fontSize: '0.78125rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  These hours count in pay now. Someone other than who typed them says they look right{onOpenDay ? ' — or opens the day and fixes it' : ''}.
                </div>
              </div>
              {typedOntoApproved.map((w) => (
                <div
                  key={w.entryId}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    gap: '0.35rem 0.75rem',
                    alignItems: 'center',
                    padding: '0.4rem 0.6rem',
                    borderTop: '1px solid var(--border)',
                    fontSize: '0.8125rem',
                  }}
                >
                  <div style={{ minWidth: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem 0.6rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-strong)' }}><PersonNameDoor name={w.personName} userId={w.userId} /></span>
                    <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{dayLabel(w.workDate)}</span>
                    <TypedHoursStamp stamp={{ hold: null, entries: [typedWaitingAsEntry(w)] }} size="full" workDate={w.workDate} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                    {w.canAct ? (
                      <button type="button" style={BTN_APPROVE} disabled={lookBusyId === w.entryId} onClick={() => void looksRight(w)}>
                        {lookBusyId === w.entryId ? 'Recording…' : 'Looks right'}
                      </button>
                    ) : (
                      <TypedHoldNote hold={w.typedBy != null && w.typedBy === (authUserId ?? authUser?.id) ? 'typed' : 'own'} style={{ maxWidth: '13rem' }} />
                    )}
                    {onOpenDay ? (
                      <button type="button" style={BTN_QUIET} onClick={() => onOpenDay({ userId: w.userId, personName: w.personName, workDate: w.workDate })}>
                        Open day
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </section>
          ) : null}
          {!loading && queue.count === 0 && fullQueue.count > 0 && !(typedOnly && typedOntoApproved.length > 0) ? (
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {typedOnly && !flaggedOnly ? 'Nothing typed by hand is waiting.' : 'No flagged sessions — everything left looks ordinary.'}
            </p>
          ) : null}
          {queue.people.map(renderPerson)}
        </div>
      </div>
    </div>
  )
}
