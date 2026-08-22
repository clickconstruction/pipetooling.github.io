import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import { buildServiceTypeTradePill } from '../../lib/serviceTypeTradePill'
import type { Database, Json } from '../../types/database'
import {
  isConfirmedForPartner,
  isValidThreshold,
  jobsToAutoConfirm,
  parseReviewQueue,
  shareOfHours,
  sortReviewRows,
  type PartnerJobReviewQueue,
} from '../../lib/partnerLedger/jobReviewQueue'
import {
  shapeReviewSessions,
  summarizeSelection,
  type ReviewSessionRow,
  type ShapedReviewSession,
  type StatementWeek,
} from '../../lib/partnerLedger/partnerSessionReview'

/**
 * Partnerships → Job review tab (PARTNERSHIPS_PLAN.md PR 2): the gate.
 *
 * Jobs the partner clocked approved hours on queue here. The hours share is a
 * suggestion; the toggle is the dev's §3 "majority of the work" decision,
 * stamped who/when via set_job_partner_majority. Until a job is toggled on,
 * the partner's app shows nothing about it; toggling off hides it again but
 * never touches ledger postings.
 *
 * Automatic threshold (v2.2107): a partnership may set auto_threshold_pct —
 * on tab load, any queued job whose share reaches it is confirmed via
 * set_job_partner_majority(p_auto_pct), stamped "auto ≥ N%" (never as a
 * person) and logged to the Timeline. A human clear exempts a job from the
 * rule permanently (server-enforced); a manual confirm clears the exemption.
 *
 * Fail-soft: if the PR 2 migration isn't pushed yet the RPC is missing — the
 * tab shows a "run db push" note instead of erroring. If the auto-threshold
 * migration isn't pushed yet, the column select fails and the control hides.
 */

/** The auto-rule's accent everywhere: purple = "a rule did this, not a person". */
const AUTO_PURPLE = '#7c3aed'

export function PartnershipJobReviewTab({
  partnershipId,
  partnerName,
}: {
  partnershipId: string
  partnerName: string
}) {
  const [queue, setQueue] = useState<PartnerJobReviewQueue | null>(null)
  const [rpcMissing, setRpcMissing] = useState(false)
  const [busyJobId, setBusyJobId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [tradeByJobId, setTradeByJobId] = useState<Record<string, string>>({})
  // Session drill-down + bulk move-hours state (one job expanded at a time).
  const [accountUserId, setAccountUserId] = useState<string | null>(null)
  const [stmtWeeks, setStmtWeeks] = useState<StatementWeek[]>([])
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<ShapedReviewSession[] | null>(null)
  const [sessionsError, setSessionsError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [moveSearch, setMoveSearch] = useState('')
  const [moveResults, setMoveResults] = useState<{ id: string; label: string; trade: string | null }[]>([])
  const [moveTarget, setMoveTarget] = useState<{ id: string; label: string; trade: string | null } | null>(null)
  const [moveBusy, setMoveBusy] = useState(false)
  const [moveError, setMoveError] = useState<string | null>(null)
  const [movedNote, setMovedNote] = useState<string | null>(null)
  // Automatic threshold (v2.2107). null = rule off; thresholdReady=false hides
  // the whole control (column not migrated yet, or still loading).
  const [thresholdReady, setThresholdReady] = useState(false)
  const [autoThresholdPct, setAutoThresholdPct] = useState<number | null>(null)
  const [thresholdEditing, setThresholdEditing] = useState(false)
  const [thresholdDraft, setThresholdDraft] = useState('60')
  const [thresholdBusy, setThresholdBusy] = useState(false)
  const [autoAddedNote, setAutoAddedNote] = useState<string | null>(null)
  const jobFormModal = useJobFormModal()
  const { user: authUser } = useAuth()

  const fetchQueue = useCallback(async (): Promise<PartnerJobReviewQueue | null> => {
    const { data, error } = await supabase.rpc('get_partner_job_review_queue', {
      p_partnership_id: partnershipId,
    })
    if (error) return null
    return parseReviewQueue(data)
  }, [partnershipId])

  const load = useCallback(async () => {
    // Threshold first (fail-soft: pre-migration the column select errors and
    // the control simply doesn't render).
    let threshold: number | null = null
    let ready = false
    const thrRes = await supabase.from('partnerships').select('auto_threshold_pct').eq('id', partnershipId).single()
    if (!thrRes.error) {
      ready = true
      const raw = (thrRes.data as unknown as { auto_threshold_pct: number | null } | null)?.auto_threshold_pct
      threshold = isValidThreshold(raw) ? raw : null
    }
    setThresholdReady(ready)
    setAutoThresholdPct(threshold)

    let parsed = await fetchQueue()
    if (parsed == null) {
      setRpcMissing(true)
      setQueue(null)
      return
    }
    setRpcMissing(false)

    // The rule fires here — the same moment the shares are computed. Adds are
    // stamped auto (p_auto_pct) and logged once to the Timeline; the queue is
    // re-fetched so the rows render already-confirmed.
    if (parsed.linked && parsed.partner_person_id && isValidThreshold(threshold)) {
      const eligible = jobsToAutoConfirm(parsed.rows, threshold)
      if (eligible.length > 0) {
        for (const r of eligible) {
          await supabase.rpc(
            'set_job_partner_majority',
            {
              p_job_id: r.job_id,
              p_person_id: parsed.partner_person_id,
              p_auto_pct: threshold,
            } as { p_job_id: string; p_person_id?: string },
          )
        }
        await supabase.from('partnership_events').insert({
          partnership_id: partnershipId,
          event_type: 'config_changed',
          patch: {
            auto_confirmed: {
              threshold_pct: threshold,
              jobs: eligible.map((r) => ({ job_id: r.job_id, label: r.label, share_pct: shareOfHours(r.partner_hours, r.total_hours) })),
            },
          } as unknown as Json,
          actor_user_id: authUser?.id ?? null,
        })
        setAutoAddedNote(
          `Auto-added ${eligible.length === 1 ? `job ${eligible[0]?.label}` : `${eligible.length} jobs`} at ≥ ${threshold}% just now.`,
        )
        parsed = (await fetchQueue()) ?? parsed
      }
    }
    setQueue(parsed)
    // Trade pills (PLUM / ELEC) beside the job number — the queue RPC doesn't
    // carry service types, so resolve them office-side. Fail-soft: no map, no
    // pill, the row falls back to the plain #number.
    const ids = (parsed?.rows ?? []).map((r) => r.job_id)
    if (ids.length > 0) {
      const stRes = await supabase.from('jobs_ledger').select('id, service_types(name)').in('id', ids)
      const map: Record<string, string> = {}
      for (const j of (stRes.data ?? []) as { id: string; service_types: { name: string } | null }[]) {
        if (j.service_types?.name) map[j.id] = j.service_types.name
      }
      setTradeByJobId(map)
    } else {
      setTradeByJobId({})
    }
    // Session drill-down needs the partner's app user (sessions key on user_id)
    // and the generated statement weeks (to flag already-priced sessions).
    if (parsed?.partner_person_id) {
      const [personRes, stubsRes] = await Promise.all([
        supabase.from('people').select('account_user_id').eq('id', parsed.partner_person_id).single(),
        supabase.from('pay_stubs').select('period_start, period_end').eq('person_id', parsed.partner_person_id),
      ])
      setAccountUserId((personRes.data as { account_user_id: string | null } | null)?.account_user_id ?? null)
      setStmtWeeks(stubsRes.error ? [] : ((stubsRes.data ?? []) as StatementWeek[]))
    }
  }, [partnershipId, fetchQueue, authUser?.id])

  useEffect(() => {
    setQueue(null)
    void load()
  }, [load])

  async function toggle(jobId: string, currentlyConfirmed: boolean) {
    if (!queue) return
    setBusyJobId(jobId)
    setActionError(null)
    const { error } = await supabase.rpc('set_job_partner_majority', {
      p_job_id: jobId,
      p_person_id: currentlyConfirmed ? undefined : (queue.partner_person_id ?? undefined),
    })
    if (error) setActionError(error.message)
    await load()
    setBusyJobId(null)
  }

  /** Save (or clear, with null) the automatic threshold; a save reloads, which fires the rule immediately. */
  async function saveThreshold(next: number | null) {
    setThresholdBusy(true)
    setActionError(null)
    const { error } = await supabase
      .from('partnerships')
      .update({
        auto_threshold_pct: next,
        updated_at: new Date().toISOString(),
        updated_by: authUser?.id ?? null,
      } as Database['public']['Tables']['partnerships']['Update'])
      .eq('id', partnershipId)
    if (error) {
      setActionError(error.message)
      setThresholdBusy(false)
      return
    }
    await supabase.from('partnership_events').insert({
      partnership_id: partnershipId,
      event_type: 'config_changed',
      patch: { auto_threshold_pct: { from: autoThresholdPct, to: next } } as unknown as Json,
      actor_user_id: authUser?.id ?? null,
    })
    setThresholdEditing(false)
    setAutoAddedNote(null)
    await load()
    setThresholdBusy(false)
  }

  async function toggleSessions(jobId: string) {
    if (expandedJobId === jobId) {
      setExpandedJobId(null)
      setSessions(null)
      setSelected(new Set())
      setMoveTarget(null)
      setMovedNote(null)
      return
    }
    setExpandedJobId(jobId)
    setSessions(null)
    setSessionsError(null)
    setSelected(new Set())
    setMoveTarget(null)
    setMoveSearch('')
    setMoveResults([])
    setMovedNote(null)
    if (!accountUserId) {
      setSessionsError('No linked app user for this partner — sessions can’t be listed.')
      setSessions([])
      return
    }
    const { data, error } = await supabase
      .from('clock_sessions')
      .select('id, work_date, clocked_in_at, clocked_out_at, notes, approved_at, rejected_at, revoked_at')
      .eq('user_id', accountUserId)
      .eq('job_ledger_id', jobId)
    if (error) {
      setSessionsError(error.message)
      setSessions([])
      return
    }
    setSessions(shapeReviewSessions((data ?? []) as ReviewSessionRow[], stmtWeeks))
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function searchMoveJobs(q: string) {
    setMoveSearch(q)
    const term = q.trim()
    if (term.length < 2) {
      setMoveResults([])
      return
    }
    const { data } = await supabase
      .from('jobs_ledger')
      .select('id, hcp_number, click_number, job_name, service_types(name)')
      .or(`hcp_number.ilike.%${term}%,click_number.ilike.%${term}%,job_name.ilike.%${term}%`)
      .limit(8)
    setMoveResults(
      ((data ?? []) as { id: string; hcp_number: string | null; click_number: string | null; job_name: string | null; service_types: { name: string } | null }[])
        .filter((j) => j.id !== expandedJobId)
        .map((j) => ({
          id: j.id,
          label: [j.hcp_number?.trim() || j.click_number?.trim() || '', j.job_name?.trim() || ''].filter(Boolean).join(' — ') || j.id,
          trade: j.service_types?.name ?? null,
        })),
    )
  }

  async function moveSelected() {
    if (!moveTarget || !expandedJobId || selected.size === 0 || !sessions) return
    setMoveBusy(true)
    setMoveError(null)
    const ids = [...selected]
    const { error } = await supabase
      .from('clock_sessions')
      .update({ job_ledger_id: moveTarget.id })
      .in('id', ids)
    if (error) {
      setMoveError(error.message)
      setMoveBusy(false)
      return
    }
    // Audit trail — best effort, never fails the move.
    const summary = summarizeSelection(sessions, selected)
    await supabase.from('partnership_events').insert({
      partnership_id: partnershipId,
      event_type: 'config_changed',
      patch: {
        sessions_reassigned: {
          from_job_id: expandedJobId,
          to_job_id: moveTarget.id,
          to_job_label: moveTarget.label,
          session_ids: ids,
          hours: summary.hours,
        },
      } as unknown as Json,
      actor_user_id: authUser?.id ?? null,
    })
    setMovedNote(`Moved ${summary.count} session(s) · ${summary.hours.toFixed(1)} h to ${moveTarget.label}`)
    setSelected(new Set())
    setMoveTarget(null)
    setMoveSearch('')
    setMoveResults([])
    setMoveBusy(false)
    await load()
    // Refresh the open panel so the moved rows disappear from this job's list.
    const { data } = await supabase
      .from('clock_sessions')
      .select('id, work_date, clocked_in_at, clocked_out_at, notes, approved_at, rejected_at, revoked_at')
      .eq('user_id', accountUserId ?? '')
      .eq('job_ledger_id', expandedJobId)
    setSessions(shapeReviewSessions((data ?? []) as ReviewSessionRow[], stmtWeeks))
  }

  if (rpcMissing) {
    return (
      <p style={{ fontSize: '0.875rem', color: 'var(--text-700)', margin: '0.5rem 0 0' }}>
        The job-review RPCs aren’t in the database yet — run <code>supabase db push</code> for migration
        <code> 20260820150000_partner_majority_anchors.sql</code>, then reload.
      </p>
    )
  }
  if (!queue) {
    return <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>Loading…</p>
  }
  if (!queue.linked) {
    return (
      <p style={{ fontSize: '0.875rem', color: 'var(--text-700)', margin: '0.5rem 0 0' }}>
        {partnerName} isn’t linked to an app user yet (People → roster → account link), so there are no clocked hours
        to review. Link the person, then reload.
      </p>
    )
  }

  const rows = sortReviewRows(queue.rows, queue.partner_person_id)
  const waiting = rows.filter((r) => !isConfirmedForPartner(r, queue.partner_person_id) && r.partner_person_id == null).length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap', margin: '0.25rem 0 0.5rem' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 650 }}>Jobs {partnerName} worked</span>
        <span style={{ fontSize: '0.72rem', color: waiting > 0 ? 'var(--text-amber-700)' : 'var(--text-muted)', fontWeight: 650 }}>
          {waiting > 0 ? `${waiting} awaiting review` : rows.length > 0 ? 'all reviewed' : ''}
        </span>
      </div>
      {rows.length === 0 ? (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
          No jobs with approved clocked hours yet.
        </p>
      ) : (
        rows.map((r) => {
          const confirmed = isConfirmedForPartner(r, queue.partner_person_id)
          const otherPartner = !confirmed && r.partner_person_id != null
          const pct = shareOfHours(r.partner_hours, r.total_hours)
          const pill = buildServiceTypeTradePill(tradeByJobId[r.job_id])
          return (
            <div
              key={r.job_id}
              style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem 0.75rem', padding: '0.6rem 0', borderBottom: '1px solid var(--border)' }}
            >
              <div
                role={jobFormModal ? 'button' : undefined}
                tabIndex={jobFormModal ? 0 : undefined}
                aria-label={jobFormModal ? `Open job ${r.label}` : undefined}
                onClick={jobFormModal ? () => jobFormModal.openEditJob(r.job_id, { onSaved: () => void load() }) : undefined}
                onKeyDown={
                  jobFormModal
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          jobFormModal.openEditJob(r.job_id, { onSaved: () => void load() })
                        }
                      }
                    : undefined
                }
                style={{ flex: '1 1 240px', minWidth: 0, cursor: jobFormModal ? 'pointer' : undefined }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: jobFormModal ? 'var(--text-link)' : undefined }}>
                  {pill ? (
                    <span style={{ ...pill.style, marginTop: 0, marginRight: '0.4rem', verticalAlign: '1px' }}>{pill.label}</span>
                  ) : null}
                  {pill ? r.label : `#${r.label}`}
                  {r.job_name && r.job_name.trim() !== '' && r.job_name !== r.label ? ` — ${r.job_name}` : ''}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {partnerName} {r.partner_hours.toFixed(1)} of {r.total_hours.toFixed(1)} labor hours · {pct}%
                  {' · '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      void toggleSessions(r.job_id)
                    }}
                    style={{ font: 'inherit', fontSize: '0.75rem', fontWeight: 650, border: 'none', background: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer' }}
                  >
                    {expandedJobId === r.job_id ? 'sessions ▴' : 'sessions ▾'}
                  </button>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-muted)', marginTop: 5, maxWidth: 180, overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: '#2a78d6', borderRadius: 3 }} />
                </div>
              </div>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: confirmed ? '#16a34a' : 'var(--text-muted)' }}>
                {confirmed ? (
                  r.confirmed_auto_pct != null ? (
                    <>
                      {`confirmed ${r.confirmed_at ? new Date(r.confirmed_at).toLocaleDateString() : ''}`}
                      <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#fff', background: AUTO_PURPLE, borderRadius: 999, padding: '0.08rem 0.45rem', margin: '0 0.3rem', whiteSpace: 'nowrap' }}>
                        auto ≥ {r.confirmed_auto_pct}%
                      </span>
                      · visible
                    </>
                  ) : (
                    `confirmed ${r.confirmed_at ? new Date(r.confirmed_at).toLocaleDateString() : ''}${r.confirmed_by_name ? ` by ${r.confirmed_by_name}` : ''} · visible`
                  )
                ) : otherPartner ? (
                  'assigned to another partner'
                ) : (
                  <>
                    not visible yet
                    {r.auto_exempt && isValidThreshold(autoThresholdPct) && pct >= autoThresholdPct ? (
                      <span style={{ fontWeight: 650, color: 'var(--text-amber-700)' }}> · turned off by hand — won’t auto-add</span>
                    ) : null}
                  </>
                )}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={confirmed}
                aria-label={`${confirmed ? 'Clear' : 'Confirm'} ${partnerName} majority on job ${r.label}`}
                disabled={busyJobId === r.job_id || otherPartner}
                onClick={() => void toggle(r.job_id, confirmed)}
                style={{
                  width: 38,
                  height: 22,
                  borderRadius: 11,
                  border: '1px solid',
                  borderColor: confirmed ? '#16a34a' : 'var(--border-strong)',
                  background: confirmed ? '#16a34a' : 'var(--bg-muted)',
                  position: 'relative',
                  cursor: busyJobId === r.job_id || otherPartner ? 'default' : 'pointer',
                  opacity: busyJobId === r.job_id || otherPartner ? 0.55 : 1,
                  padding: 0,
                  flex: 'none',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: confirmed ? 18 : 2,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: confirmed ? 'var(--surface)' : 'var(--text-muted)',
                  }}
                />
              </button>
              {expandedJobId === r.job_id ? (
                <div style={{ flexBasis: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.7rem' }}>
                  {sessions == null ? (
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>Loading…</p>
                  ) : sessionsError ? (
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-700)', margin: 0 }}>{sessionsError}</p>
                  ) : sessions.length === 0 ? (
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>No sessions on this job.</p>
                  ) : (
                    <>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.72rem', color: 'var(--text-muted)', paddingBottom: '0.35rem', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={selected.size === sessions.length && sessions.length > 0}
                          onChange={(e) => setSelected(e.target.checked ? new Set(sessions.map((s) => s.id)) : new Set())}
                        />
                        select all · {sessions.length} session{sessions.length === 1 ? '' : 's'} of {partnerName}’s on this job, newest first
                      </label>
                      {sessions.map((s) => (
                        <label
                          key={s.id}
                          style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', padding: '0.35rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.78rem', cursor: 'pointer' }}
                        >
                          <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelected(s.id)} style={{ alignSelf: 'center' }} />
                          <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {new Date(`${s.work_date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' })}
                          </span>
                          <span style={{ whiteSpace: 'nowrap' }}>
                            {new Date(s.clocked_in_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            {' – '}
                            {s.clocked_out_at ? new Date(s.clocked_out_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'open'}
                          </span>
                          <span style={{ fontWeight: 650, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{s.hours != null ? `${s.hours.toFixed(1)} h` : '—'}</span>
                          <span style={{ flex: '1 1 160px', minWidth: 0, fontStyle: s.note ? 'italic' : 'normal', color: s.note ? 'var(--text-700)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {s.note || 'no note'}
                          </span>
                          {s.statement_week ? (
                            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-amber-700)', border: '1px solid var(--border)', borderRadius: 999, padding: '0.05rem 0.45rem', whiteSpace: 'nowrap' }}>
                              on stmt wk {s.statement_week.slice(5)}
                            </span>
                          ) : null}
                          <span style={{ fontSize: '0.62rem', fontWeight: 700, color: s.status === 'approved' ? '#16a34a' : 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 999, padding: '0.05rem 0.45rem', whiteSpace: 'nowrap' }}>
                            {s.status === 'approved' ? 'approved' : s.status === 'open' ? 'still clocked in' : 'pending approval'}
                          </span>
                        </label>
                      ))}
                      {selected.size > 0 ? (
                        (() => {
                          const sum = summarizeSelection(sessions, selected)
                          return (
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem 0.6rem', marginTop: '0.5rem', padding: '0.45rem 0.6rem', background: 'var(--bg-blue-tint)', borderRadius: 8 }}>
                              <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                                {sum.count} session{sum.count === 1 ? '' : 's'} · {sum.hours.toFixed(1)} h
                              </span>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-700)' }}>move to</span>
                              {moveTarget ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', fontWeight: 600, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0.2rem 0.5rem' }}>
                                  {(() => {
                                    const p = buildServiceTypeTradePill(moveTarget.trade)
                                    return p ? <span style={{ ...p.style, marginTop: 0 }}>{p.label}</span> : null
                                  })()}
                                  {moveTarget.label}
                                  <button
                                    type="button"
                                    aria-label="clear target job"
                                    onClick={() => setMoveTarget(null)}
                                    style={{ font: 'inherit', border: 'none', background: 'none', padding: 0, color: 'var(--text-muted)', cursor: 'pointer' }}
                                  >
                                    ✕
                                  </button>
                                </span>
                              ) : (
                                <span style={{ position: 'relative', flex: '1 1 180px', minWidth: 0 }}>
                                  <input
                                    type="text"
                                    placeholder="Search jobs (HCP #, Click #, name)…"
                                    value={moveSearch}
                                    onChange={(e) => void searchMoveJobs(e.target.value)}
                                    style={{ width: '100%', font: 'inherit', fontSize: '0.78rem', padding: '0.25rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit' }}
                                  />
                                  {moveResults.length > 0 ? (
                                    <span style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 5, display: 'block', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                                      {moveResults.map((j) => (
                                        <button
                                          key={j.id}
                                          type="button"
                                          onClick={() => {
                                            setMoveTarget(j)
                                            setMoveResults([])
                                          }}
                                          style={{ display: 'block', width: '100%', textAlign: 'left', font: 'inherit', fontSize: '0.75rem', padding: '0.3rem 0.5rem', border: 'none', borderBottom: '1px solid var(--border)', background: 'var(--surface)', color: 'inherit', cursor: 'pointer' }}
                                        >
                                          {(() => {
                                            const p = buildServiceTypeTradePill(j.trade)
                                            return p ? <span style={{ ...p.style, marginTop: 0, marginRight: '0.35rem' }}>{p.label}</span> : null
                                          })()}
                                          {j.label}
                                        </button>
                                      ))}
                                    </span>
                                  ) : null}
                                </span>
                              )}
                              <button
                                type="button"
                                disabled={!moveTarget || moveBusy}
                                onClick={() => void moveSelected()}
                                style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 650, padding: '0.3rem 0.7rem', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', opacity: !moveTarget || moveBusy ? 0.55 : 1 }}
                              >
                                {moveBusy ? 'Moving…' : 'Move hours'}
                              </button>
                              {sum.onStatementCount > 0 ? (
                                <span style={{ flexBasis: '100%', fontSize: '0.7rem', color: 'var(--text-amber-700)' }}>
                                  {sum.onStatementCount} selected session{sum.onStatementCount === 1 ? ' is' : 's are'} on a generated statement — pay stays as
                                  stamped; the hours move for job costing and review shares.
                                </span>
                              ) : null}
                              {moveError ? <span style={{ flexBasis: '100%', fontSize: '0.75rem', color: 'var(--text-red-600)' }}>{moveError}</span> : null}
                            </div>
                          )
                        })()
                      ) : movedNote ? (
                        <p style={{ fontSize: '0.75rem', color: '#16a34a', margin: '0.4rem 0 0' }}>{movedNote}</p>
                      ) : null}
                      <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: '0.45rem 0 0' }}>
                        Moving a session changes the real clock record — job costing, Crew P&L, and the shares above all
                        follow. Approval status doesn’t change.
                      </p>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          )
        })
      )}
      {actionError ? <p style={{ fontSize: '0.8rem', color: 'var(--text-red-600)', margin: '0.5rem 0 0' }}>{actionError}</p> : null}
      {autoAddedNote ? <p style={{ fontSize: '0.75rem', fontWeight: 650, color: AUTO_PURPLE, margin: '0.5rem 0 0' }}>{autoAddedNote}</p> : null}

      {/* Automatic threshold control (v2.2107). Hidden until the migration's
          column is readable; purple = the rule's accent throughout. */}
      {thresholdReady ? (
        <div style={{ marginTop: '0.7rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Automatic threshold</span>
            {isValidThreshold(autoThresholdPct) && !thresholdEditing ? (
              <>
                <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.3rem', fontSize: '0.78rem', fontWeight: 800, color: '#fff', background: AUTO_PURPLE, borderRadius: 999, padding: '0.22rem 0.7rem' }}>
                  ≥ {autoThresholdPct}%
                  {(() => {
                    const n = rows.filter((r) => isConfirmedForPartner(r, queue.partner_person_id) && r.confirmed_auto_pct != null).length
                    return n > 0 ? <small style={{ fontWeight: 600, fontSize: '0.68rem', opacity: 0.85 }}>· {n} job{n === 1 ? '' : 's'} auto-added</small> : null
                  })()}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setThresholdDraft(String(autoThresholdPct))
                    setThresholdEditing(true)
                  }}
                  style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, border: 'none', background: 'none', padding: '0.32rem 0.2rem', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  Change…
                </button>
                <button
                  type="button"
                  disabled={thresholdBusy}
                  onClick={() => void saveThreshold(null)}
                  style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, border: 'none', background: 'none', padding: '0.32rem 0.2rem', color: 'var(--text-muted)', cursor: 'pointer', opacity: thresholdBusy ? 0.55 : 1 }}
                >
                  Turn off
                </button>
              </>
            ) : !thresholdEditing ? (
              <>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>off — jobs are only added by hand</span>
                <button
                  type="button"
                  onClick={() => {
                    setThresholdDraft('60')
                    setThresholdEditing(true)
                  }}
                  style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 650, padding: '0.32rem 0.75rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-link)', cursor: 'pointer' }}
                >
                  Set a threshold…
                </button>
              </>
            ) : null}
          </div>
          {thresholdEditing ? (
            (() => {
              const draftNum = Number(thresholdDraft)
              const draftValid = isValidThreshold(draftNum)
              const wouldAdd = draftValid && queue.partner_person_id ? jobsToAutoConfirm(rows, draftNum) : []
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.55rem', padding: '0.55rem 0.7rem', background: 'var(--bg-blue-tint)', borderRadius: 8 }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-700)' }}>add jobs at</span>
                  <span style={{ display: 'inline-flex', gap: '0.3rem' }}>
                    {[50, 60, 75].map((p) => {
                      const sel = thresholdDraft === String(p)
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setThresholdDraft(String(p))}
                          style={{ font: 'inherit', fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: 999, border: `1px solid ${sel ? AUTO_PURPLE : 'var(--border-strong)'}`, background: sel ? AUTO_PURPLE : 'var(--surface)', color: sel ? '#fff' : 'var(--text-700)', cursor: 'pointer' }}
                        >
                          {p}%
                        </button>
                      )
                    })}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={thresholdDraft}
                    onChange={(e) => setThresholdDraft(e.target.value)}
                    aria-label="Automatic threshold percent"
                    style={{ width: '4.2rem', font: 'inherit', fontSize: '0.9rem', fontWeight: 700, padding: '0.28rem 0.45rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', textAlign: 'right' }}
                  />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>%</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-700)' }}>of labor hours</span>
                  <button
                    type="button"
                    disabled={!draftValid || thresholdBusy}
                    onClick={() => void saveThreshold(draftNum)}
                    style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 650, padding: '0.32rem 0.75rem', borderRadius: 6, border: 'none', background: AUTO_PURPLE, color: '#fff', cursor: 'pointer', opacity: !draftValid || thresholdBusy ? 0.55 : 1 }}
                  >
                    {thresholdBusy ? 'Saving…' : isValidThreshold(autoThresholdPct) ? 'Save' : 'Turn on'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setThresholdEditing(false)}
                    style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 600, border: 'none', background: 'none', padding: '0.32rem 0.2rem', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <p style={{ flexBasis: '100%', fontSize: '0.72rem', color: 'var(--text-700)', margin: 0 }}>
                    {draftValid
                      ? wouldAdd.length > 0
                        ? (
                          <>
                            Right now this would add <b style={{ color: AUTO_PURPLE }}>{wouldAdd.length} job{wouldAdd.length === 1 ? '' : 's'}</b>:{' '}
                            {wouldAdd.slice(0, 3).map((r) => `${r.label} (${shareOfHours(r.partner_hours, r.total_hours)}%)`).join(', ')}
                            {wouldAdd.length > 3 ? ` and ${wouldAdd.length - 3} more` : ''}.
                          </>
                        )
                        : 'Right now no queued job reaches this share — the rule waits for hours to grow.'
                      : 'Enter a whole number from 1 to 100.'}
                  </p>
                </div>
              )
            })()
          ) : null}
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0.45rem 0 0' }}>
            {isValidThreshold(autoThresholdPct)
              ? `When ${partnerName}’s approved share of a job’s labor hours reaches ${autoThresholdPct}%, the job is confirmed and made visible automatically — stamped “auto ≥ ${autoThresholdPct}%” and logged on the Timeline. Turning a job off by hand exempts it; the rule never re-adds it.`
              : `The toggle is the §3 “majority of the work” decision, stamped with who and when. Turning a job off hides it from ${partnerName} but never touches postings already on the ledger.`}
          </p>
        </div>
      ) : (
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0.6rem 0 0' }}>
          The toggle is the §3 “majority of the work” decision, stamped with who and when. Turning a job off hides it
          from {partnerName} but never touches postings already on the ledger.
        </p>
      )}
    </div>
  )
}
