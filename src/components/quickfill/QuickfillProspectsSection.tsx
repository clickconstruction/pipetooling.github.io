import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { loadProspectTeamActivity, type ProspectTeamRow } from '../../lib/prospectTeamActivity'
import { aggregateProspectWarmthCountsFromRows, type ProspectWarmthCounts } from '../../lib/prospectWarmthCounts'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useReportQuickfillSectionMetric } from '../../contexts/QuickfillSectionMetricsContext'
import { ProspectTeamActivityLineChart } from './ProspectTeamActivityLineChart'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import { fetchAllRowsChunkedIn } from '../../lib/supabasePaging'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { formatDayLabel, formatMarkTime } from '../../lib/quickfill/markHistory'
import {
  PROSPECT_CALLBACK_LOOKBACK_DAYS,
  PROSPECT_DAYS_MAX,
  PROSPECT_DAYS_MIN,
  PROSPECT_DAYS_SETTING_KEY,
  parseProspectDays,
  prospectDueCounts,
  prospectDueRows,
  prospectsMarkNote,
  prospectsNextLine,
  prospectsSince,
  serializeProspectDays,
  type DueCallback,
  type DueProspect,
  type ProspectDays,
  type ProspectDueRow,
  type ProspectDueState,
} from '../../lib/quickfill/prospectsDue'

/**
 * Quickfill → Prospects. Until v2.5886 the station drew the warmth buckets and the team's 30-day
 * chart and reported every active prospect as its count, 268 at every mark for eight weeks. Since
 * v2.5886 (punch list #180, PR 3) it reads each prospect's last touch and the callbacks the office
 * promised (`lib/quickfill/prospectsDue.ts`): **Promised and missed**, **Past their days** (the
 * owner's days per warmth), and **On time**, where the buckets and the chart now live. The count is
 * the prospects past their day, the Next line names the first, and the Mark's note comes from the rows.
 */

const ROW_STYLE: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '0.9375rem',
  padding: '0.35rem 0',
  borderBottom: '1px solid var(--border)',
  fontVariantNumeric: 'tabular-nums',
}

const FOLD_WORDS: Record<ProspectDueState, string> = { missed: 'Promised and missed', past: 'Past their days', ontime: 'On time' }
const FOLD_ORDER: readonly ProspectDueState[] = ['missed', 'past', 'ontime']
const PROSPECT_COLUMNS = 'id, company_name, contact_name, warmth_count, last_contact, created_at, prospect_fit_status, converted_customer_id'

function WarmthBlock({ counts }: { counts: ProspectWarmthCounts }) {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-700)', marginBottom: '0.5rem' }}>Active prospects by warmth</div>
      <div style={ROW_STYLE}>
        <span>Warmth 3</span>
        <span>({counts.w3})</span>
      </div>
      <div style={ROW_STYLE}>
        <span>Warmth 2</span>
        <span>({counts.w2})</span>
      </div>
      <div style={ROW_STYLE}>
        <span>Warmth 1</span>
        <span>({counts.w1})</span>
      </div>
      <div style={{ ...ROW_STYLE, borderBottom: 'none' }}>
        <span>Warmth 0</span>
        <span>({counts.w0})</span>
      </div>
      {counts.w4plus > 0 && (
        <div style={{ ...ROW_STYLE, borderBottom: 'none', paddingTop: '0.25rem' }}>
          <span>Warmth 4+</span>
          <span>({counts.w4plus})</span>
        </div>
      )}
    </div>
  )
}

function warmthChip(w: number) {
  return <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0 6px', borderRadius: 999, background: w >= 3 ? 'var(--bg-red-100)' : w === 2 ? 'var(--bg-amber-100)' : 'var(--bg-subtle)', color: w >= 3 ? 'var(--text-red-800)' : w === 2 ? 'var(--text-amber-800)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>warm {w}</span>
}

function DueRow({ row }: { row: ProspectDueRow }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap', padding: '0.35rem 0', borderTop: '1px solid var(--border)', fontSize: '0.875rem' }} data-prospect-due={row.state}>
      <span style={{ display: 'inline-flex', justifyContent: 'center', minWidth: 34, padding: '0 6px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700, background: row.state === 'missed' ? 'var(--bg-red-100)' : row.overDays >= 14 ? 'var(--bg-red-100)' : 'var(--bg-amber-100)', color: row.state === 'missed' || row.overDays >= 14 ? 'var(--text-red-800)' : 'var(--text-amber-800)' }}>{row.overDays}d</span>
      {warmthChip(row.warmth)}
      <span style={{ flex: '1 1 12rem', minWidth: 0 }}>
        <b style={{ fontWeight: 600 }}>{row.name}</b>
        <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{row.words}</span>
      </span>
      <Link to={`/prospects?tab=prospect-list&prospect_id=${encodeURIComponent(row.prospect.id)}`} style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-link)', whiteSpace: 'nowrap' }}>
        Open →
      </Link>
    </div>
  )
}

export function QuickfillProspectsSection({ lastMarkedAt = null }: { /** The station's last mark, anyone's: what "since the last look" counts from. */ lastMarkedAt?: string | null } = {}) {
  const { user: authUser, role, estimatorProspectsAccess } = useAuth()
  const { showToast } = useToastContext()
  const canAccess =
    authUser != null &&
    role != null &&
    (role === 'dev' || role === 'master_technician' || isAssistantLike(role) || (role === 'estimator' && estimatorProspectsAccess))
  const canAccessTeam = role != null && (role === 'dev' || role === 'master_technician' || isAssistantLike(role))

  const [prospects, setProspects] = useState<DueProspect[] | null>(null)
  const [callbacks, setCallbacks] = useState<DueCallback[]>([])
  const [days, setDays] = useState<ProspectDays>(parseProspectDays(null))
  const [daysDraft, setDaysDraft] = useState<ProspectDays | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadProblem, setLoadProblem] = useState<string | null>(null)
  const [openFolds, setOpenFolds] = useState<ReadonlySet<ProspectDueState>>(new Set<ProspectDueState>(['missed', 'past']))
  const [teamDataByDate, setTeamDataByDate] = useState<Record<string, ProspectTeamRow[]>>({})
  const [teamLoading, setTeamLoading] = useState(false)
  const [teamError, setTeamError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!canAccess) return
    setLoading(true)
    setLoadProblem(null)
    try {
      const rows = (await withSupabaseRetry(async () => supabase.from('prospects').select(PROSPECT_COLUMNS).eq('kind', 'customer'), 'load prospects for quickfill')) as DueProspect[] | null
      const list = rows ?? []
      setProspects(list)
      // The promised callbacks, far enough back to catch a miss nobody touched since. Fail-soft: the days still read.
      const sinceIso = new Date(Date.now() - PROSPECT_CALLBACK_LOOKBACK_DAYS * 86_400_000).toISOString()
      const ids = list.map((p) => p.id)
      try {
        const cbs = ids.length
          ? await fetchAllRowsChunkedIn<DueCallback, string>(
              ids,
              (chunk, from, to) => supabase.from('prospect_callbacks').select('prospect_id, callback_date, title').in('prospect_id', chunk).gte('callback_date', sinceIso).order('callback_date', { ascending: true }).range(from, to),
              'load prospect callbacks for quickfill',
            )
          : []
        setCallbacks(cbs)
      } catch {
        setCallbacks([])
      }
      try {
        const { data } = await supabase.from('app_settings').select('key, value_text').eq('key', PROSPECT_DAYS_SETTING_KEY).maybeSingle()
        setDays(parseProspectDays((data as { value_text: string | null } | null)?.value_text))
      } catch {
        setDays(parseProspectDays(null))
      }
    } catch (e) {
      setProspects(null)
      setLoadProblem(formatErrorMessage(e, 'Could not load the prospects.'))
    } finally {
      setLoading(false)
    }
    if (canAccessTeam) {
      setTeamLoading(true)
      try {
        const t = await loadProspectTeamActivity(supabase)
        setTeamDataByDate(t)
      } catch {
        setTeamDataByDate({})
        setTeamError('Could not load team activity.')
      } finally {
        setTeamLoading(false)
      }
    } else {
      setTeamDataByDate({})
      setTeamLoading(false)
    }
  }, [canAccess, canAccessTeam])

  useEffect(() => {
    void load()
  }, [load])

  const nowIso = new Date().toISOString()
  const rows = useMemo(
    () => prospectDueRows({ prospects: prospects ?? [], callbacks, nowIso, days }),
    // `nowIso` moves every render; the rows follow the data, the callbacks and the days.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prospects, callbacks, days],
  )
  const counts = useMemo(() => prospectDueCounts(rows), [rows])
  const warmth = useMemo(() => (prospects ? aggregateProspectWarmthCountsFromRows(prospects) : null), [prospects])
  const since = useMemo(
    () => prospectsSince(rows, lastMarkedAt, nowIso, (iso) => `${formatDayLabel(calendarYmdInAppTzFromIso(iso))} at ${formatMarkTime(iso)}`),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, lastMarkedAt],
  )
  const ready = canAccess && !loading && prospects !== null
  useReportQuickfillSectionMetric('prospects', ready ? counts.due : null, !!(canAccess && loading), null, ready ? prospectsMarkNote(rows, days, since) : null, ready ? prospectsNextLine(rows) : null)

  if (!canAccess) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>You do not have access to Prospects in Quickfill.</p>
  }

  const saveDays = async () => {
    if (!daysDraft) return
    const next = parseProspectDays(serializeProspectDays(daysDraft))
    try {
      await withSupabaseRetry(async () => supabase.from('app_settings').upsert({ key: PROSPECT_DAYS_SETTING_KEY, value_text: serializeProspectDays(next) }, { onConflict: 'key' }), 'save the prospect days')
      setDays(next)
      setDaysDraft(null)
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the days'), 'error')
    }
  }

  const muted: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)' }
  const numInput: CSSProperties = { width: '3.2rem', padding: '0.1rem 0.3rem', border: '1px solid var(--border-strong)', borderRadius: 4, font: 'inherit', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text)' }
  return (
    <div style={{ marginBottom: '1rem' }} data-prospects-station="due">
      {loading && prospects === null ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : loadProblem ? (
        <p style={{ color: 'var(--text-red-700)' }}>{loadProblem}</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }} data-prospects-count-line>
            <span>
              <b style={{ color: counts.due > 0 ? 'var(--text-red-700)' : 'var(--text-green-800)' }}>{counts.due} past their day</b>
              {counts.missed > 0 && <> · {counts.missed} promised and missed</>}
              {' · '}
              {counts.ontime} on time of {counts.total}
            </span>
            <Link to="/prospects?tab=follow-up" style={{ marginLeft: 'auto', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-link)', whiteSpace: 'nowrap' }}>
              Follow Up →
            </Link>
          </div>
          {FOLD_ORDER.map((state) => {
            const fold = rows.filter((r) => r.state === state)
            const open = openFolds.has(state)
            return (
              <div key={state} style={{ marginBottom: '0.6rem' }} data-prospects-fold={state}>
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
                  <span style={{ fontWeight: 700, fontSize: '0.75rem', padding: '0 7px', borderRadius: 999, background: state !== 'ontime' && fold.length > 0 ? 'var(--bg-red-100)' : state === 'ontime' ? 'var(--bg-green-100)' : 'var(--bg-blue-tint)', color: state !== 'ontime' && fold.length > 0 ? 'var(--text-red-800)' : state === 'ontime' ? 'var(--text-green-800)' : 'var(--text-link)' }}>
                    {fold.length}
                  </span>
                  {state === 'missed' && <span style={{ ...muted, fontWeight: 400 }}>a callback we set, now past, nothing since</span>}
                  {state === 'past' && <span style={{ ...muted, fontWeight: 400 }}>no touch inside their warmth's days</span>}
                </button>
                {open && (
                  <div style={{ border: '1px solid var(--border)', borderTop: 0, borderRadius: '0 0 8px 8px', padding: '0.2rem 0.75rem 0.5rem' }}>
                    {state === 'ontime' ? (
                      <div style={{ paddingTop: '0.6rem' }}>
                        {warmth && <WarmthBlock counts={warmth} />}
                        {canAccessTeam && (
                          <div style={{ marginBottom: '0.5rem' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-700)', marginBottom: '0.25rem' }}>Team (last 30 days)</div>
                            <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Daily total = Marked + Updated (unique prospects per day from timers and from comments)</p>
                            <ProspectTeamActivityLineChart teamDataByDate={teamDataByDate} teamLoading={teamLoading} teamError={teamError} />
                          </div>
                        )}
                      </div>
                    ) : fold.length === 0 ? (
                      <p style={{ ...muted, margin: '0.4rem 0 0.2rem' }}>{state === 'missed' ? 'No promised callback is past.' : 'Every prospect heard from us inside its days.'}</p>
                    ) : (
                      fold.map((r) => <DueRow key={r.prospect.id} row={r} />)
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {since && (
            <div style={{ display: 'flex', gap: '0.9rem', flexWrap: 'wrap', fontSize: '0.8125rem', color: 'var(--text-700)', padding: '0.15rem 0.1rem 0' }} data-prospects-since>
              <span>{since.words}:</span>
              <b style={{ color: 'var(--text-red-700)' }}>+{since.newPast} new past</b>
              <b style={{ color: 'var(--text-green-800)' }}>{since.touchedSince} touched</b>
              <b>{counts.due} still waiting</b>
            </div>
          )}
          <p style={{ ...muted, margin: '0.6rem 0 0', lineHeight: 1.45 }} data-prospects-stance>
            <b style={{ color: 'var(--text-700)', fontWeight: 600 }}>Reads each prospect's last touch and the callbacks we promised.</b> The days per warmth are the owner's numbers: warm 3 every {days.w3}, warm 2 every {days.w2}, warm 1 every {days.w1}, warm 0 every {days.w0}.
            {role === 'dev' &&
              (daysDraft === null ? (
                <>
                  {' '}
                  <button type="button" onClick={() => setDaysDraft({ ...days })} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--text-link)', fontWeight: 600, cursor: 'pointer' }}>
                    Change
                  </button>
                </>
              ) : (
                <span style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', marginLeft: '0.4rem' }}>
                  {(['w3', 'w2', 'w1', 'w0'] as const).map((k) => (
                    <label key={k} style={{ display: 'inline-flex', gap: '0.2rem', alignItems: 'center' }}>
                      {k.replace('w', 'warm ')}
                      <input type="number" aria-label={`Days for ${k.replace('w', 'warmth ')}`} min={PROSPECT_DAYS_MIN} max={PROSPECT_DAYS_MAX} value={daysDraft[k]} onChange={(e) => setDaysDraft((d) => (d ? { ...d, [k]: Number(e.target.value) } : d))} style={numInput} />
                    </label>
                  ))}
                  <button type="button" onClick={() => void saveDays()} style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--text-link)', fontWeight: 600, cursor: 'pointer' }}>
                    Save
                  </button>
                </span>
              ))}
          </p>
        </>
      )}
      <Link
        to="/prospects?tab=prospect-list"
        style={{ display: 'block', textAlign: 'center', padding: '0.7rem 1.25rem', marginTop: '0.9rem', background: '#3b82f6', color: 'white', fontWeight: 600, fontSize: '1rem', borderRadius: 8, textDecoration: 'none' }}
      >
        Open Prospects
      </Link>
    </div>
  )
}
