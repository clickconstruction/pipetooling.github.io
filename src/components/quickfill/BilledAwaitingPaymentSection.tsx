import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useReportQuickfillSectionMetric } from '../../contexts/QuickfillSectionMetricsContext'
import { formatCurrency } from '../../lib/format'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import { fetchStagesHeaderStats } from '../../lib/jobs/fetchStagesHeaderStats'
import { useZzTestJobsHidden } from '../../lib/jobs/zzTestJobSwitch'
import { fetchAllRowsChunkedIn } from '../../lib/supabasePaging'
import type { StageRow } from '../../lib/jobsStagesBoard'
import { buildBilledByCustomerBreakdown, type BilledBreakdownCustomerGroup } from '../../lib/jobs/billedByCustomerBreakdown'
import { DEFAULT_SNOOZE_DAYS, parseChaseTouchesRpc, type ChaseTouch } from '../../lib/jobs/paymentChase'
import { addPaymentChaseTouch } from '../../lib/jobs/paymentChaseIo'
import { parsePromisedPayDatesRpc, type PromisedPayDate } from '../../lib/jobs/billedExpectedPay'
import { calendarYmdInAppTzFromIso, todayYmdInAppTz } from '../../utils/dateUtils'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { formatDayLabel, formatMarkTime } from '../../lib/quickfill/markHistory'
import {
  LEAN_DAYS_MAX,
  LEAN_DAYS_MIN,
  LEAN_DAYS_SETTING_KEY,
  LEAN_PAST_DUE_DAYS,
  leanCounts,
  leanMarkNote,
  leanNextLine,
  leanRows,
  leanSince,
  parseLeanDays,
  type LeanRow,
  type LeanState,
} from '../../lib/quickfill/leanRead'

/**
 * Quickfill → Billed Awaiting Payment (v2.2190): "Who owes what" — the same
 * per-customer breakdown the Pipeline's WAITING ON CUSTOMERS card opens
 * (customers ranked by what they owe, bill count, oldest bill's age; expand a
 * customer for its bills, each with a door into the Pipeline). Was a 60-row
 * flat table with no question. Rows come from the Pipeline's own lean billed
 * spine (one row per bill, Collections excluded) decorated with names.
 *
 * Since v2.5885 (punch list #180, PR 2) the station reads the lean too: the Payment Chase
 * touches and the promised pay dates the Pipeline already keeps, folded by
 * `lib/quickfill/leanRead.ts` into **Need a lean** (past due, no touch in the owner's
 * days, no promise standing), **Leaned on or promised** and **Not yet past due**. The
 * count is the customers needing a lean, each row says its last lean, a lean is logged
 * from the row (could not reach, a note) through the shared chase path, and the Mark's
 * note is written from the rows.
 */

type JobNameRow = { id: string; job_name: string | null; customer_name: string | null; customer_id: string | null }

/** The Pipeline's payment follow-up call mode (`?chase=1`, v2.2025): where a promise or a longer call is logged. */
export const LEAN_CALL_MODE_HREF = '/jobs?tab=stages&chase=1'

const FOLD_WORDS: Record<LeanState, string> = { needs: 'Need a lean', waiting: 'Leaned on or promised, waiting on them', current: 'Not yet past due' }
const FOLD_ORDER: readonly LeanState[] = ['needs', 'waiting', 'current']

function ageChip(days: number | null, handSet: boolean) {
  if (days == null) return <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>no bill line</span>
  const tone =
    days >= 90
      ? { background: 'var(--bg-red-100)', color: 'var(--text-red-700)' }
      : days >= LEAN_PAST_DUE_DAYS
        ? { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' }
        : { background: 'var(--bg-subtle)', color: 'var(--text-muted)' }
  return (
    <span
      title={handSet ? `${days} days — from the hand-set est. bill date` : `${days} days since billed`}
      style={{ fontSize: '0.75rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums', padding: '0.05rem 0.4rem', borderRadius: 9999, whiteSpace: 'nowrap', ...tone }}
    >
      {days}d{handSet ? <span aria-hidden style={{ marginLeft: 3, opacity: 0.7 }}>·</span> : null}
    </span>
  )
}

export function BilledAwaitingPaymentSection({ lastMarkedAt = null }: { /** The station's last mark, anyone's: what "since the last look" counts from. */ lastMarkedAt?: string | null } = {}) {
  const { user: authUser, role } = useAuth()
  const { showToast } = useToastContext()
  const hideZz = useZzTestJobsHidden(role)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [groups, setGroups] = useState<BilledBreakdownCustomerGroup[]>([])
  const [excluded, setExcluded] = useState<{ count: number; total: number }>({ count: 0, total: 0 })
  const [openKeys, setOpenKeys] = useState<ReadonlySet<string>>(new Set())
  const [openFolds, setOpenFolds] = useState<ReadonlySet<LeanState>>(new Set<LeanState>(['needs']))
  const [touches, setTouches] = useState<ChaseTouch[] | null>(null)
  const [promises, setPromises] = useState<Record<string, PromisedPayDate> | null>(null)
  const [leanDays, setLeanDays] = useState(parseLeanDays(null))
  const [leanDaysDraft, setLeanDaysDraft] = useState<string | null>(null)
  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState<string | null>(null)

  const canAccess = role === 'dev' || role === 'master_technician' || isAssistantLike(role)

  // The lean: the chase touches and the promised dates (both gated to the office roles by their RPCs, null outside),
  // and the owner's number. Each fail-soft: a missing read leaves the bills as they were.
  const loadLeans = useCallback(async () => {
    const [t, p, s] = await Promise.all([
      supabase.rpc('list_payment_chase_touches' as never).then((r) => parseChaseTouchesRpc(r.data as unknown), () => null),
      supabase.rpc('list_job_promised_pay_dates' as never).then((r) => parsePromisedPayDatesRpc(r.data as unknown), () => null),
      supabase.from('app_settings').select('key, value_num, value_text').eq('key', LEAN_DAYS_SETTING_KEY).maybeSingle().then((r) => r.data as { value_num: number | null; value_text: string | null } | null, () => null),
    ])
    setTouches(t)
    setPromises(p)
    setLeanDays(parseLeanDays(s?.value_num, s?.value_text))
  }, [])

  useEffect(() => {
    if (!authUser?.id) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetchStagesHeaderStats(null, undefined, { excludeZzTestJobs: hideZz })
        if (cancelled) return
        if (!res.ok) {
          setError(res.error)
          setLoading(false)
          return
        }
        const lean = res.leanBilledRows
        const jobIds = Array.from(new Set(lean.map((r) => r.job.id)))
        const names = jobIds.length
          ? await fetchAllRowsChunkedIn<JobNameRow, string>(
              jobIds,
              (chunk, from, to) =>
                supabase.from('jobs_ledger').select('id, job_name, customer_name, customer_id').in('id', chunk).order('id', { ascending: true }).range(from, to),
              'load billed job names',
            )
          : []
        if (cancelled) return
        const byId = new Map(names.map((n) => [n.id, n]))
        // Lean rows lack names; the breakdown groups by customer_id / customer_name and labels by job_name.
        const decorated: StageRow[] = lean.map((r) => {
          const n = byId.get(r.job.id)
          const job = { ...r.job, job_name: n?.job_name ?? r.job.job_name ?? null, customer_name: n?.customer_name ?? null, customer_id: n?.customer_id ?? r.job.customer_id ?? null }
          return { ...r, job } as StageRow
        })
        const built = buildBilledByCustomerBreakdown(decorated)
        await loadLeans()
        if (!cancelled) {
          setGroups(built)
          setExcluded({ count: res.billTruth.excludedOwed.count, total: res.billTruth.excludedOwed.total })
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [authUser?.id, role, hideZz, loadLeans])

  const todayYmd = todayYmdInAppTz()
  const rows = useMemo(() => leanRows({ groups, touches, promises, todayYmd, leanDays }), [groups, touches, promises, todayYmd, leanDays])
  const counts = useMemo(() => leanCounts(rows), [rows])
  const since = useMemo(
    () => leanSince(rows, lastMarkedAt, todayYmd, calendarYmdInAppTzFromIso, (iso) => `${formatDayLabel(calendarYmdInAppTzFromIso(iso))} at ${formatMarkTime(iso)}`),
    [rows, lastMarkedAt, todayYmd],
  )
  const ready = canAccess && !!authUser?.id && !loading && !error
  useReportQuickfillSectionMetric(
    'billed-awaiting',
    ready ? counts.needs : null,
    !!(canAccess && authUser?.id && loading),
    null,
    ready ? leanMarkNote(rows, leanDays, since) : null,
    ready ? leanNextLine(rows) : null,
  )
  if (!canAccess) return null
  if (loading) return null
  if (groups.length === 0) return null

  const logTouch = async (row: LeanRow, outcome: 'cant_reach' | 'note', note?: string) => {
    if (!row.customerId) return
    setSaving(row.group.key)
    try {
      await addPaymentChaseTouch({ customerId: row.customerId, jobId: null, outcome, note: note ?? null, snoozeDays: outcome === 'cant_reach' ? DEFAULT_SNOOZE_DAYS : null })
      showToast(outcome === 'cant_reach' ? `Logged: could not reach ${row.group.customerName}.` : `Logged a lean on ${row.group.customerName}.`, 'success')
      setNoteFor(null)
      setNoteText('')
      await loadLeans()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not log the lean'), 'error')
    } finally {
      setSaving(null)
    }
  }

  const saveLeanDays = async () => {
    const n = parseLeanDays(null, leanDaysDraft)
    try {
      await withSupabaseRetry(async () => supabase.from('app_settings').upsert({ key: LEAN_DAYS_SETTING_KEY, value_num: n, value_text: String(n) }, { onConflict: 'key' }), 'save the lean days')
      setLeanDays(n)
      setLeanDaysDraft(null)
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the number'), 'error')
    }
  }

  const cell: React.CSSProperties = { padding: '0.5rem 0.6rem' }
  const muted: React.CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)' }
  return (
    <section style={{ marginBottom: '1.5rem' }} data-billed-awaiting="lean">
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }} data-lean-count-line>
        <span>
          <b style={{ color: counts.needs > 0 ? 'var(--text-red-700)' : 'var(--text-green-800)' }}>
            {counts.needs} need{counts.needs === 1 ? 's' : ''} a lean
          </b>
          {counts.past60 > 0 && <> · {counts.past60} past 60 days</>}
          {' · '}
          {counts.bills} bill{counts.bills === 1 ? '' : 's'} · ${formatCurrency(counts.total)} open · {groups.length} customer{groups.length === 1 ? '' : 's'}
          {excluded.count > 0 ? ` · ${excluded.count} bill${excluded.count === 1 ? '' : 's'} on paid or missing jobs excluded ($${formatCurrency(excluded.total)})` : ''}
        </span>
        <Link to={LEAN_CALL_MODE_HREF} style={{ marginLeft: 'auto', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-link)', whiteSpace: 'nowrap' }}>
          Call mode →
        </Link>
      </div>
      {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}
      {FOLD_ORDER.map((state) => {
        const fold = rows.filter((r) => r.state === state)
        const open = openFolds.has(state)
        return (
          <div key={state} style={{ marginBottom: '0.6rem' }} data-lean-fold={state}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() =>
                setOpenFolds((prev) => {
                  const next = new Set(prev)
                  if (next.has(state)) next.delete(state)
                  else next.add(state)
                  return next
                })
              }
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', textAlign: 'left', padding: '0.4rem 0.6rem', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: open ? '8px 8px 0 0' : 8, font: 'inherit', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}
            >
              <span aria-hidden style={{ color: 'var(--text-muted)' }}>{open ? '▾' : '▸'}</span>
              {FOLD_WORDS[state]}
              <span style={{ fontWeight: 700, fontSize: '0.75rem', padding: '0 7px', borderRadius: 999, background: state === 'needs' && fold.length > 0 ? 'var(--bg-red-100)' : 'var(--bg-blue-tint)', color: state === 'needs' && fold.length > 0 ? 'var(--text-red-800)' : 'var(--text-link)' }}>
                {fold.length}
              </span>
              {state === 'needs' && <span style={{ ...muted, fontWeight: 400 }}>past due, no lean in {leanDays} days, no promise standing</span>}
            </button>
            {open && fold.length > 0 && (
              <div style={{ border: '1px solid var(--border)', borderTop: 0, borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
                      <th style={{ ...cell, textAlign: 'left' }}>Customer</th>
                      <th style={{ ...cell, textAlign: 'center' }}>Bills</th>
                      <th style={{ ...cell, textAlign: 'center' }}>Oldest</th>
                      <th style={{ ...cell, textAlign: 'left' }}>Last lean</th>
                      <th style={{ ...cell, textAlign: 'right' }}>Owed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fold.map((r) => (
                      <GroupRows
                        key={r.group.key}
                        lean={r}
                        open={openKeys.has(r.group.key)}
                        cell={cell}
                        canLean={!!r.customerId && r.state !== 'current'}
                        saving={saving === r.group.key}
                        noteOpen={noteFor === r.group.key}
                        noteText={noteText}
                        onNoteText={setNoteText}
                        onOpenNote={() => {
                          setNoteFor(noteFor === r.group.key ? null : r.group.key)
                          setNoteText('')
                        }}
                        onCantReach={() => void logTouch(r, 'cant_reach')}
                        onSaveNote={() => {
                          if (!noteText.trim()) {
                            showToast('Say what the lean was first.', 'warning')
                            return
                          }
                          void logTouch(r, 'note', noteText)
                        }}
                        onToggle={() =>
                          setOpenKeys((prev) => {
                            const next = new Set(prev)
                            if (next.has(r.group.key)) next.delete(r.group.key)
                            else next.add(r.group.key)
                            return next
                          })
                        }
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {open && fold.length === 0 && (
              <div style={{ ...muted, border: '1px solid var(--border)', borderTop: 0, borderRadius: '0 0 8px 8px', padding: '0.4rem 0.6rem' }}>
                {state === 'needs' ? 'Nobody. Every past-due customer was leaned on inside the window or has a promise standing.' : 'Nobody here.'}
              </div>
            )}
          </div>
        )
      })}
      {since && (
        <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', fontSize: '0.8125rem', color: 'var(--text-700)', padding: '0.15rem 0.1rem 0' }} data-lean-since>
          <span>{since.words}:</span>
          <b style={{ color: 'var(--text-red-700)' }}>+{since.newPastDue} new past due</b>
          <b style={{ color: 'var(--text-green-800)' }}>{since.leanedSince} leaned on</b>
          <b>{counts.needs} still waiting on us</b>
        </div>
      )}
      <p style={{ ...muted, margin: '0.6rem 0 0', lineHeight: 1.45 }} data-lean-stance>
        <b style={{ color: 'var(--text-700)', fontWeight: 600 }}>Reads the open bills, the Payment Chase log and the promised dates.</b> A lean is a call, a note, a resend or a promise logged on the customer. Past due is {LEAN_PAST_DUE_DAYS} days since billed. {leanDays} days without a lean is the owner's number.
        {role === 'dev' &&
          (leanDaysDraft === null ? (
            <>
              {' '}
              <button type="button" onClick={() => setLeanDaysDraft(String(leanDays))} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--text-link)', fontWeight: 600, cursor: 'pointer' }}>
                Change
              </button>
            </>
          ) : (
            <>
              {' '}
              <input
                type="number"
                aria-label="Days without a lean before a customer needs one"
                min={LEAN_DAYS_MIN}
                max={LEAN_DAYS_MAX}
                value={leanDaysDraft}
                onChange={(e) => setLeanDaysDraft(e.target.value)}
                style={{ width: '3.5rem', padding: '0.1rem 0.3rem', border: '1px solid var(--border-strong)', borderRadius: 4, font: 'inherit', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text)' }}
              />{' '}
              <button type="button" onClick={() => void saveLeanDays()} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--text-link)', fontWeight: 600, cursor: 'pointer' }}>
                Save
              </button>
            </>
          ))}
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
        <Link
          to="/jobs?tab=stages&stagesSection=billed"
          style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', textDecoration: 'none', borderRadius: 4, fontSize: '0.875rem' }}
        >
          View in Jobs Pipeline
        </Link>
      </div>
    </section>
  )
}

function GroupRows({
  lean,
  open,
  cell,
  canLean,
  saving,
  noteOpen,
  noteText,
  onNoteText,
  onOpenNote,
  onCantReach,
  onSaveNote,
  onToggle,
}: {
  lean: LeanRow
  open: boolean
  cell: React.CSSProperties
  canLean: boolean
  saving: boolean
  noteOpen: boolean
  noteText: string
  onNoteText: (v: string) => void
  onOpenNote: () => void
  onCantReach: () => void
  onSaveNote: () => void
  onToggle: () => void
}) {
  const g = lean.group
  const smallBtn: React.CSSProperties = { padding: '0.2rem 0.55rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.75rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }
  return (
    <>
      <tr onClick={onToggle} aria-expanded={open} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} data-lean-row={lean.state}>
        <td style={cell}>
          <span aria-hidden style={{ display: 'inline-block', width: '1rem', color: 'var(--text-muted)' }}>{open ? '▾' : '▸'}</span>
          {g.customerName}
        </td>
        <td style={{ ...cell, textAlign: 'center', color: 'var(--text-muted)' }}>{g.count}</td>
        <td style={{ ...cell, textAlign: 'center' }}>{ageChip(g.worstAgeDays, g.worstAgeHandSet)}</td>
        <td style={{ ...cell, fontSize: '0.8125rem' }}>
          <span style={{ fontWeight: 600, color: lean.state === 'needs' ? 'var(--text-red-700)' : lean.state === 'waiting' ? 'var(--text-green-800)' : 'var(--text-muted)' }}>{lean.why}</span>
          {lean.lastTouchLine && <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{lean.lastTouchLine}</span>}
          {lean.promisedYmd && <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem' }}>promised {formatDayLabel(lean.promisedYmd)}</span>}
        </td>
        <td style={{ ...cell, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>${formatCurrency(g.total)}</td>
      </tr>
      {open && canLean && (
        <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }} data-lean-presses>
          <td colSpan={5} style={{ ...cell, paddingLeft: '2rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Log a lean:</span>
              <button type="button" disabled={saving} onClick={onCantReach} style={smallBtn}>
                Couldn't reach
              </button>
              <button type="button" disabled={saving} onClick={onOpenNote} style={smallBtn} aria-expanded={noteOpen}>
                Note…
              </button>
              <Link to={LEAN_CALL_MODE_HREF} style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-link)', whiteSpace: 'nowrap' }}>
                A promise or a longer call: call mode →
              </Link>
            </div>
            {noteOpen && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  aria-label={`What the lean on ${g.customerName} was`}
                  value={noteText}
                  onChange={(e) => onNoteText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      onSaveNote()
                    }
                  }}
                  placeholder="Called, left a message about the two open bills…"
                  maxLength={500}
                  style={{ flex: '1 1 14rem', minWidth: 0, padding: '0.3rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text)' }}
                />
                <button type="button" disabled={saving} onClick={onSaveNote} style={{ ...smallBtn, background: '#2563eb', borderColor: '#2563eb', color: '#fff' }}>
                  {saving ? 'Saving…' : 'Save the lean'}
                </button>
              </div>
            )}
          </td>
        </tr>
      )}
      {open
        ? g.bills.map((b) => (
            <tr key={`${g.key}-${b.invoiceId ?? b.jobId}`} style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
              <td style={{ ...cell, paddingLeft: '2rem' }}>
                <span style={{ fontSize: '0.8125rem' }}>
                  {b.jobNumber} · {b.jobName}
                </span>{' '}
                <Link
                  to={b.invoiceId ? `/jobs?tab=stages&stagesInvoice=${encodeURIComponent(b.invoiceId)}` : `/jobs?tab=stages&stagesJob=${encodeURIComponent(b.jobId)}`}
                  style={{ fontSize: '0.75rem', color: 'var(--text-link)', marginLeft: 6, whiteSpace: 'nowrap' }}
                >
                  View in Pipeline →
                </Link>
              </td>
              <td style={cell} />
              <td style={{ ...cell, textAlign: 'center' }}>{ageChip(b.ageDays, b.ageHandSet)}</td>
              <td style={cell} />
              <td style={{ ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>${formatCurrency(b.amount)}</td>
            </tr>
          ))
        : null}
    </>
  )
}
