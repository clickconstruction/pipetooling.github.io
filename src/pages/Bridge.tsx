import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useDashboardFinancials } from '../hooks/useDashboardFinancials'
import { useToastContext } from '../contexts/ToastContext'
import { formatErrorMessage } from '../utils/errorHandling'
import { BRIDGE_DAYS_AHEAD, BRIDGE_DAYS_BACK, loadBridgeData, saveBridgeTarget, type BridgeData } from '../lib/bridge/loadBridgeData'
import { bidWinLever, buildCourseModel, type CourseLever } from '../lib/bridge/courseModel'
import { BridgeCourseChart } from '../components/bridge/BridgeCourseChart'

/**
 * The Bridge — the Chart Table (v2.2677). Dev-only ship's computer:
 * position, speed, destination, hazards, course corrections. One clock: days.
 * Everything on it reads from surfaces the app already trusts; the one new
 * kernel is earned revenue (labor-weighted percentage of completion).
 */

const money = (n: number): string => `${n < 0 ? '−' : ''}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`
const shortK = (n: number): string => `${n < 0 ? '−' : ''}$${(Math.abs(n) / 1000).toFixed(Math.abs(n) >= 100_000 ? 0 : 1)}k`
const hrs = (h: number): string => `${Math.round(h).toLocaleString('en-US')}h`

const panel: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem' }
const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const big: CSSProperties = { fontSize: '1.5rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.15, margin: '0.1rem 0' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }

export default function Bridge() {
  const { user, role, loading: authLoading } = useAuth()
  const { showToast } = useToastContext()
  const [data, setData] = useState<BridgeData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [targetDraft, setTargetDraft] = useState<string>('')
  const fin = useDashboardFinancials(role === 'dev', refreshKey, role)

  useEffect(() => {
    if (role !== 'dev' || !user?.id) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const d = await loadBridgeData()
        if (cancelled) return
        setData(d)
        setTargetDraft(d.targetUsd == null ? '' : String(d.targetUsd))
      } catch (e) {
        if (!cancelled) setError(formatErrorMessage(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [role, user?.id, refreshKey])

  const baseModel = useMemo(
    () =>
      data
        ? buildCourseModel({
            todayYmd: data.todayYmd,
            daysBack: BRIDGE_DAYS_BACK,
            daysAhead: BRIDGE_DAYS_AHEAD,
            earnedByDay: data.earnedByDay,
            directByDay: data.directByDay,
            overheadByDay: data.overheadByDay,
            targetUsd: data.targetUsd,
            overheadPerDayBaseline: data.overheadPerDayBaseline,
          })
        : null,
    [data],
  )

  const leverDefs = useMemo<Array<{ lever: CourseLever; effect: string; sub: string }>>(() => {
    if (!data || !baseModel) return []
    const out: Array<{ lever: CourseLever; effect: string; sub: string }> = []
    for (const b of data.levers.bidsDue.slice(0, 4)) {
      const l = bidWinLever({ key: `bid:${b.id}`, label: `Win ${b.label}`, bidValueUsd: b.bidValueUsd, contributionMargin: baseModel.contributionMargin, startOffset: b.startOffset })
      if (l) out.push({ lever: l, effect: `+${money(l.ratePerDay ?? 0)}/day from +${l.fromOffset ?? 1}d`, sub: `${money(b.bidValueUsd)} · due ${b.dueYmd} · at the window's ${baseModel.contributionMargin == null ? '—' : Math.round(baseModel.contributionMargin * 100)}% contribution, spread over 60 days` })
    }
    const oh = baseModel.speed.overheadPerDay
    if (oh > 0) out.push({ lever: { key: 'oh10', label: 'Cut overhead 10%', ratePerDay: oh * 0.1 }, effect: `+${money(oh * 0.1)}/day`, sub: `of ${money(oh)}/day overhead drag` })
    if (data.totals.earnedUsd > 0 && data.crew.fieldHoursWindow > 0) {
      const perHour = data.totals.earnedUsd / data.crew.fieldHoursWindow
      const margin = baseModel.contributionMargin ?? 0
      out.push({ lever: { key: 'crew8', label: 'One more field day a week (8h at the window\'s earning rate)', ratePerDay: (perHour * margin * 8) / 7 }, effect: `+${money((perHour * margin * 8) / 7)}/day`, sub: `field earned ${money(perHour)} per approved hour over the window; ${Math.round(margin * 100)}% of it is contribution` })
    }
    return out
  }, [data, baseModel])

  const model = useMemo(
    () =>
      data
        ? buildCourseModel({
            todayYmd: data.todayYmd,
            daysBack: BRIDGE_DAYS_BACK,
            daysAhead: BRIDGE_DAYS_AHEAD,
            earnedByDay: data.earnedByDay,
            directByDay: data.directByDay,
            overheadByDay: data.overheadByDay,
            targetUsd: data.targetUsd,
            levers: leverDefs.filter((l) => checked.has(l.lever.key)).map((l) => l.lever),
            overheadPerDayBaseline: data.overheadPerDayBaseline,
          })
        : null,
    [data, leverDefs, checked],
  )

  const saveTarget = useCallback(async () => {
    const v = targetDraft.trim() === '' ? null : Number(targetDraft.replace(/[^0-9.-]/g, ''))
    if (v != null && !Number.isFinite(v)) {
      showToast('Target must be a number', 'error', 2500)
      return
    }
    try {
      await saveBridgeTarget(v)
      setData((prev) => (prev ? { ...prev, targetUsd: v } : prev))
      showToast(v == null ? 'Target cleared' : `Target set: ${money(v)} over the next ${BRIDGE_DAYS_AHEAD / 7} weeks`, 'success', 2500)
    } catch (e) {
      showToast(formatErrorMessage(e), 'error', 4000)
    }
  }, [targetDraft, showToast])

  if (authLoading) return null
  if (role !== 'dev') return <Navigate to="/dashboard" replace />

  const speed = model?.speed
  const climbColor = speed && speed.climbPerDay >= 0 ? 'var(--text-green-700)' : 'var(--text-red-700)'
  const verdict = model?.verdict
  const verdictText =
    !model || !verdict
      ? ''
      : verdict.kind === 'no-target'
        ? `At this speed: ${shortK(model.endUsd)} net in ${BRIDGE_DAYS_AHEAD / 7} weeks — set a destination to get a verdict`
        : verdict.kind === 'makes'
          ? `Makes port · ${shortK(model.endUsd)} by +${BRIDGE_DAYS_AHEAD / 7}w, ${shortK(verdict.gapUsd ?? 0)} ahead`
          : `Misses port by ${shortK(-(verdict.gapUsd ?? 0))} at current speed${verdict.underwaterDays ? ` · underwater ${verdict.underwaterDays} days` : ''}`

  return (
    <div style={{ padding: '0.25rem 0 3rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>The Bridge</h1>
        <span style={det}>Position · speed · destination · hazards · corrections. One clock: days. Dev only.</span>
        <button type="button" onClick={() => setRefreshKey((k) => k + 1)} disabled={loading} style={{ marginLeft: 'auto', font: 'inherit', fontSize: '0.8rem', padding: '0.25rem 0.7rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
          {loading ? 'Reading instruments…' : 'Refresh'}
        </button>
      </div>
      {error ? <p style={{ color: 'var(--text-red-700)' }}>{error}</p> : null}
      {!data || !model || !speed ? (
        <p style={det}>{loading ? 'Reading the last 8 weeks — sessions, allocations, sheets, the overhead pool…' : '—'}</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.6rem' }}>
            <div style={panel}>
              <div style={label}>Speed — net climb</div>
              <div style={{ ...big, color: climbColor }}>
                {speed.climbPerDay >= 0 ? '+' : '−'}
                {money(Math.abs(speed.climbPerDay))} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>/day · {speed.days}-day avg</span>
              </div>
              <div style={det}>
                earned <b style={{ color: 'var(--text)' }}>{money(speed.earnedPerDay)}</b>/day · burn <b style={{ color: 'var(--text)' }}>{money(speed.burnPerDay)}</b>/day (direct {money(speed.directPerDay)} + overhead {money(speed.overheadPerDay)} at the 90-day rate)
                {model.contributionMargin != null && <> · contribution {Math.round(model.contributionMargin * 100)}%</>}
              </div>
            </div>
            <div style={panel}>
              <div style={label}>Fuel — money in flight</div>
              {fin.data ? (
                <>
                  <div style={big}>
                    {shortK(fin.data.ar.total)} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>owed to you</span>
                  </div>
                  <div style={det}>
                    owed by you <b style={{ color: 'var(--text)' }}>{shortK(fin.data.ap.total)}</b> · not billed yet <b style={{ color: 'var(--text)' }}>{shortK(fin.data.unbilled.total)}</b> · collections <b style={{ color: 'var(--text)' }}>{shortK(data.levers.collections.openUsd)}</b> ({data.levers.collections.count})
                  </div>
                  <div style={{ ...det, marginTop: '0.2rem' }}>Cash runway needs a Mercury balance sync — not wired yet.</div>
                </>
              ) : (
                <div style={det}>{fin.loading ? 'Loading…' : fin.error ?? '—'}</div>
              )}
            </div>
            <div style={panel}>
              <div style={label}>Engine — crew, last 7 days</div>
              <div style={big}>
                {hrs(data.crew.fieldHours7d)} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>approved field</span>
              </div>
              <div style={det}>
                office + bid <b style={{ color: 'var(--text)' }}>{hrs(data.crew.officeBidHours7d)}</b> · awaiting approval <b style={{ color: data.crew.pendingClosedHours > 0 ? 'var(--text-amber-800)' : 'var(--text)' }}>{hrs(data.crew.pendingClosedHours)}</b> ({data.crew.pendingClosedSessions}) · {data.jobsWorked} jobs worked in 8w
              </div>
            </div>
          </div>

          <div style={{ ...panel, marginTop: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span style={label}>Course — cumulative net · {BRIDGE_DAYS_BACK / 7} weeks back · {BRIDGE_DAYS_AHEAD / 7} weeks ahead</span>
              <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums', color: verdict?.kind === 'makes' ? 'var(--text-green-700)' : verdict?.kind === 'misses' ? 'var(--text-red-700)' : 'var(--text-muted)' }}>
                {verdictText}
              </span>
            </div>
            <BridgeCourseChart model={model} daysBack={BRIDGE_DAYS_BACK} daysAhead={BRIDGE_DAYS_AHEAD} hazards={data.hazards} />
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.3rem', ...det }}>
              <span><i aria-hidden style={{ display: 'inline-block', width: 14, borderTop: '2px solid var(--text-strong)', marginRight: 5, verticalAlign: 3 }} />Track (earned − direct − overhead, cumulative)</span>
              <span><i aria-hidden style={{ display: 'inline-block', width: 14, borderTop: '2px dashed #8b5cf6', marginRight: 5, verticalAlign: 3 }} />Projection at current speed{checked.size ? ` + ${checked.size} correction${checked.size === 1 ? '' : 's'}` : ''}</span>
              <span><i aria-hidden style={{ display: 'inline-block', width: 14, borderTop: '2px dotted #16a34a', marginRight: 5, verticalAlign: 3 }} />Destination</span>
              <span style={{ color: 'var(--text-red-600)' }}>▼ supply invoices due (cash, not net)</span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <label htmlFor="bridge-target" style={det}>Destination: net over the next {BRIDGE_DAYS_AHEAD / 7} weeks</label>
                <input id="bridge-target" value={targetDraft} onChange={(e) => setTargetDraft(e.target.value)} placeholder="e.g. 45000" inputMode="numeric" style={{ width: 110, font: 'inherit', fontSize: '0.8rem', padding: '0.2rem 0.4rem', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text)' }} />
                <button type="button" onClick={() => void saveTarget()} style={{ font: 'inherit', fontSize: '0.8rem', padding: '0.2rem 0.6rem', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>Set</button>
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '0.6rem', marginTop: '0.6rem' }}>
            <div style={panel}>
              <div style={label}>Course corrections — tick to bend the projection</div>
              {leverDefs.length === 0 ? (
                <div style={{ ...det, marginTop: '0.3rem' }}>No sizable levers right now — no open bids due within 14 days and no overhead drag to cut.</div>
              ) : (
                <ul style={{ listStyle: 'none', margin: '0.3rem 0 0', padding: 0 }}>
                  {leverDefs.map(({ lever, effect, sub }) => (
                    <li key={lever.key} style={{ display: 'grid', gridTemplateColumns: '20px 1fr auto', gap: '0.5rem', alignItems: 'center', padding: '0.4rem 0', borderTop: '1px solid var(--border)', fontSize: '0.85rem' }}>
                      <input
                        type="checkbox"
                        checked={checked.has(lever.key)}
                        onChange={(e) => setChecked((prev) => { const next = new Set(prev); if (e.target.checked) next.add(lever.key); else next.delete(lever.key); return next })}
                        aria-label={lever.label}
                      />
                      <span>
                        {lever.label}
                        <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{sub}</span>
                      </span>
                      <span style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-green-700)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{effect}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div style={{ ...det, marginTop: '0.5rem', borderTop: '1px dashed var(--border)', paddingTop: '0.4rem' }}>
                Moves cash, not the line: bill the <b style={{ color: 'var(--text)' }}>{data.levers.rtb.count}</b> Ready-to-bill job{data.levers.rtb.count === 1 ? '' : 's'} (<b style={{ color: 'var(--text)' }}>{shortK(data.levers.rtb.revenueUsd)}</b>) · collect <b style={{ color: 'var(--text)' }}>{shortK(data.levers.collections.openUsd)}</b> in collections. <Link to="/jobs?tab=stages">Open Stages</Link>
              </div>
            </div>
            <div style={panel}>
              <div style={label}>Hazards — next {BRIDGE_DAYS_AHEAD / 7} weeks (cash events)</div>
              {data.hazards.length === 0 ? (
                <div style={{ ...det, marginTop: '0.3rem' }}>No unpaid supply invoices due in the window.</div>
              ) : (
                <ul style={{ listStyle: 'none', margin: '0.3rem 0 0', padding: 0 }}>
                  {data.hazards.slice(0, 8).map((h) => (
                    <li key={h.ymd} style={{ display: 'flex', gap: '0.5rem', padding: '0.35rem 0', borderTop: '1px solid var(--border)', fontSize: '0.85rem' }}>
                      <span>{h.ymd} · {h.label}</span>
                      <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-red-700)', fontVariantNumeric: 'tabular-nums' }}>−{money(h.usd)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div style={{ ...det, marginTop: '0.5rem' }}>Payroll, insurance, and jobs finishing aren't wired as hazards yet — supply-house due dates are.</div>
            </div>
          </div>

          {(data.crew.pendingClosedHours > 0 || (data.hygiene.unattributedNoncard ?? 0) > 0 || (data.hygiene.unlinkedCard ?? 0) > 0 || data.earned.assumedHalfJobs.length > 0 || data.earned.noRevenueJobs.length > 0) && (
            <div style={{ marginTop: '0.6rem', border: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)', borderRadius: 8, padding: '0.5rem 0.9rem', fontSize: '0.8rem', color: 'var(--text-amber-900)', display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <strong style={{ letterSpacing: '0.12em', fontSize: '0.68rem' }}>HULL</strong>
              {data.crew.pendingClosedHours > 0 && <span>{hrs(data.crew.pendingClosedHours)} unapproved</span>}
              {(data.hygiene.unattributedNoncard ?? 0) > 0 && <span>{data.hygiene.unattributedNoncard} bank transfers unsorted</span>}
              {(data.hygiene.unlinkedCard ?? 0) > 0 && <span>{data.hygiene.unlinkedCard} card purchases unsorted</span>}
              {data.earned.assumedHalfJobs.length > 0 && <span>{data.earned.assumedHalfJobs.length} open job{data.earned.assumedHalfJobs.length === 1 ? '' : 's'} with no % complete — assumed half done</span>}
              {data.earned.noRevenueJobs.length > 0 && <span>{data.earned.noRevenueJobs.length} worked job{data.earned.noRevenueJobs.length === 1 ? '' : 's'} with no contract $ — earning $0</span>}
              <span style={{ marginLeft: 'auto', fontStyle: 'italic' }}>speed and track read low until these are clean</span>
            </div>
          )}

          <p style={{ ...det, marginTop: '0.8rem', maxWidth: '90ch' }}>
            <b>How the track is drawn:</b> earned = each approved field hour × its job's contract ÷ expected hours (finished jobs 100%; open jobs by % complete; no % → assumed half). Direct = field labor at wage + card/transfer allocations to jobs + supply invoices allocated to jobs + sub labor sheets, by date. Overhead = the same 90-day pool as People → Overhead, by day. Window {data.windowStart} → {data.todayYmd}: earned {shortK(data.totals.earnedUsd)} · field labor {shortK(data.totals.fieldLaborUsd)} · materials {shortK(data.totals.materialsUsd)} · subs {shortK(data.totals.subLaborUsd)} · overhead {shortK(data.totals.overheadUsd)}.
          </p>
        </>
      )}
    </div>
  )
}
