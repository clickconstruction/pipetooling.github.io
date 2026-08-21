import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import { buildServiceTypeTradePill } from '../../lib/serviceTypeTradePill'
import type { Json } from '../../types/database'
import {
  isConfirmedForPartner,
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
 * Fail-soft: if the PR 2 migration isn't pushed yet the RPC is missing — the
 * tab shows a "run db push" note instead of erroring.
 */

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
  const jobFormModal = useJobFormModal()
  const { user: authUser } = useAuth()

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_partner_job_review_queue', {
      p_partnership_id: partnershipId,
    })
    if (error) {
      setRpcMissing(true)
      setQueue(null)
      return
    }
    setRpcMissing(false)
    const parsed = parseReviewQueue(data)
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
  }, [partnershipId])

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
                {confirmed
                  ? `confirmed ${r.confirmed_at ? new Date(r.confirmed_at).toLocaleDateString() : ''}${r.confirmed_by_name ? ` by ${r.confirmed_by_name}` : ''} · visible`
                  : otherPartner
                    ? 'assigned to another partner'
                    : 'not visible yet'}
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
      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0.6rem 0 0' }}>
        The toggle is the §3 “majority of the work” decision, stamped with who and when. Hours share is a suggestion —
        there is no automatic threshold. Turning a job off hides it from {partnerName} but never touches postings
        already on the ledger.
      </p>
    </div>
  )
}
