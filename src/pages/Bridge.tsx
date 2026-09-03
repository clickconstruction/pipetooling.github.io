import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useDashboardFinancials } from '../hooks/useDashboardFinancials'
import { useToastContext } from '../contexts/ToastContext'
import { formatErrorMessage } from '../utils/errorHandling'
import { BRIDGE_DAYS_AHEAD, BRIDGE_DAYS_BACK, loadBridgeData, saveBridgeCashOnHand, saveBridgeFloor, type BridgeData } from '../lib/bridge/loadBridgeData'
import { buildCourseModel } from '../lib/bridge/courseModel'
import { buildNetPositionHistory, cashTodayFromAsOf } from '../lib/bridge/netPosition'
import { buildCashForecast, type CashEvent } from '../lib/bridge/cashForecast'
import { billedExpectedPayModel } from '../lib/jobs/billedExpectedPay'
import { BridgeCashChart, BridgeNetPositionChart } from '../components/bridge/BridgeCashCharts'

/**
 * The Bridge (v2.2726 — the plain version). Dev only. Where we stand (net
 * position), where cash is going (forecast by date), what would change it.
 * Cash on hand is typed on this page and rolled forward through the bank
 * flows since; the floor is set here too. No ship words on the instruments.
 */

const money = (n: number): string => `${n < 0 ? '−' : ''}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`
const shortK = (n: number): string => `${n < 0 ? '−' : ''}$${(Math.abs(n) / 1000).toFixed(Math.abs(n) >= 100_000 ? 0 : 1)}k`
const hrs = (h: number): string => `${Math.round(h).toLocaleString('en-US')}h`
const md = (ymd: string): string => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const DEFAULT_PAY_DAYS = 45
const SUB_LABOR_DEFAULT_DAYS = 14
const nextDay = (ymd: string): string => new Date(Date.parse(`${ymd}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)

const panel: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem' }
const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const big: CSSProperties = { fontSize: '1.5rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.15, margin: '0.1rem 0' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const inputStyle: CSSProperties = { width: 110, font: 'inherit', fontSize: '0.8rem', padding: '0.2rem 0.4rem', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text)' }
const btnStyle: CSSProperties = { font: 'inherit', fontSize: '0.8rem', padding: '0.2rem 0.6rem', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }
const listRow: CSSProperties = { display: 'flex', gap: '0.5rem', alignItems: 'baseline', padding: '0.35rem 0', borderTop: '1px solid var(--border)', fontSize: '0.85rem' }

export default function Bridge() {
  const { user, role, loading: authLoading } = useAuth()
  const { showToast } = useToastContext()
  const [data, setData] = useState<BridgeData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [cashDraft, setCashDraft] = useState('')
  const [floorDraft, setFloorDraft] = useState('')
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
        setCashDraft(d.cashSetting ? String(d.cashSetting.usd) : '')
        setFloorDraft(String(d.floorUsd))
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

  const profit = useMemo(
    () =>
      data
        ? buildCourseModel({
            todayYmd: data.todayYmd,
            daysBack: BRIDGE_DAYS_BACK,
            daysAhead: 1,
            earnedByDay: data.earnedByDay,
            directByDay: data.directByDay,
            overheadByDay: data.overheadByDay,
            targetUsd: null,
            overheadPerDayBaseline: data.overheadPerDayBaseline,
          })
        : null,
    [data],
  )

  const cashToday = useMemo(() => {
    if (!data?.cashSetting) return null
    return cashTodayFromAsOf({ cashAsOfUsd: data.cashSetting.usd, asOfYmd: data.cashSetting.asOfYmd, todayYmd: data.todayYmd, bankFlowByDay: data.bankFlowByDay })
  }, [data])

  const history = useMemo(() => {
    if (!data || cashToday == null || !fin.data) return null
    return buildNetPositionHistory({
      todayYmd: data.todayYmd,
      daysBack: BRIDGE_DAYS_BACK,
      cashTodayUsd: cashToday,
      arTodayUsd: fin.data.ar.total,
      apTodayUsd: fin.data.ap.total,
      bankFlowByDay: data.bankFlowByDay,
      invoicesSentByDay: data.invoicesSentByDay,
      paymentsReceivedByDay: data.paymentsReceivedByDay,
      supplyDatedByDay: data.supplyDatedByDay,
      supplyPaidByDay: data.supplyPaidByDay,
    })
  }, [data, cashToday, fin.data])

  // Receipts: each open AR item on its expected day — promise → customer median → company median → 45 days.
  const receipts = useMemo<Array<CashEvent & { source: string }>>(() => {
    if (!data || !fin.data) return []
    const out: Array<CashEvent & { source: string }> = []
    for (const item of fin.data.ar.items) {
      if (item.amount <= 0) continue
      const promise = item.jobId && data.promisedByJob ? data.promisedByJob[item.jobId] : undefined
      const model = billedExpectedPayModel({ billedAtIso: item.dateYmd, estBillYmd: item.dateYmd, customerId: item.customerId ?? null }, data.paySpeeds, data.todayYmd, promise ?? null)
      let expectedYmd: string
      let source: string
      if (model) {
        expectedYmd = model.expectedYmd
        source = model.source === 'promised' ? 'promised' : model.source === 'customer' ? `pays in ~${model.medianDays}d` : `company pace ~${model.medianDays}d`
      } else {
        const base = item.dateYmd ?? data.todayYmd
        expectedYmd = new Date(Date.parse(`${base}T00:00:00Z`) + DEFAULT_PAY_DAYS * 86_400_000).toISOString().slice(0, 10)
        source = `no history · ${DEFAULT_PAY_DAYS}d default`
      }
      // Already past its expected day → it lands on the first forecast day, and the list says it's late.
      const late = expectedYmd <= data.todayYmd
      const ymd = late ? nextDay(data.todayYmd) : expectedYmd
      out.push({ ymd, usd: item.amount, label: item.label, kind: 'receipt', source: late ? `late — expected ${md(expectedYmd)}` : source })
    }
    return out.sort((a, b) => (a.ymd < b.ymd ? -1 : a.ymd > b.ymd ? 1 : 0))
  }, [data, fin.data])

  // Bills: supply due dates + payroll Fridays from the loader, plus sub labor owed
  // (the finance hook's AP figure — the same number the Dashboard shows) on the
  // default payable-after horizon.
  const bills = useMemo(() => {
    if (!data) return []
    const out = [...data.bills]
    const sub = fin.data?.ap.subLaborTotal ?? 0
    if (sub > 0) out.push({ ymd: new Date(Date.parse(`${data.todayYmd}T00:00:00Z`) + SUB_LABOR_DEFAULT_DAYS * 86_400_000).toISOString().slice(0, 10), usd: sub, label: 'Sub labor owed' })
    return out.sort((a, b) => (a.ymd < b.ymd ? -1 : a.ymd > b.ymd ? 1 : 0))
  }, [data, fin.data])

  const forecast = useMemo(() => {
    if (!data || cashToday == null) return null
    const events: CashEvent[] = [...bills.map((b) => ({ ymd: b.ymd, usd: b.usd, label: b.label, kind: 'bill' as const })), ...receipts]
    return buildCashForecast({ todayYmd: data.todayYmd, daysAhead: BRIDGE_DAYS_AHEAD, cashTodayUsd: cashToday, floorUsd: data.floorUsd, events, dailyDrainUsd: data.dailyDrainUsd })
  }, [data, cashToday, receipts, bills])

  const saveCash = useCallback(async () => {
    const v = Number(cashDraft.replace(/[^0-9.-]/g, ''))
    if (!Number.isFinite(v)) {
      showToast('Cash on hand must be a number', 'error', 2500)
      return
    }
    if (!data) return
    try {
      await saveBridgeCashOnHand(v, data.todayYmd)
      setData((prev) => (prev ? { ...prev, cashSetting: { usd: v, asOfYmd: prev.todayYmd } } : prev))
      showToast(`Cash on hand set: ${money(v)} as of today`, 'success', 2500)
    } catch (e) {
      showToast(formatErrorMessage(e), 'error', 4000)
    }
  }, [cashDraft, data, showToast])

  const saveFloor = useCallback(async () => {
    const v = Number(floorDraft.replace(/[^0-9.-]/g, ''))
    if (!Number.isFinite(v) || v < 0) {
      showToast('Floor must be a number', 'error', 2500)
      return
    }
    try {
      await saveBridgeFloor(v)
      setData((prev) => (prev ? { ...prev, floorUsd: v } : prev))
      showToast(`Cash floor set: ${money(v)}`, 'success', 2500)
    } catch (e) {
      showToast(formatErrorMessage(e), 'error', 4000)
    }
  }, [floorDraft, showToast])

  if (authLoading) return null
  if (role !== 'dev') return <Navigate to="/dashboard" replace />

  const speed = profit?.speed
  const climbColor = speed && speed.climbPerDay >= 0 ? 'var(--text-green-700)' : 'var(--text-red-700)'
  const windowStartLabel = data ? md(data.windowStart) : ''
  const netToday = history ? (history[history.length - 1]?.netUsd ?? 0) : null
  const netStart = history ? (history[0]?.netUsd ?? 0) : null
  const cashRead = forecast
    ? forecast.clearsFloor
      ? `Lowest point: ${shortK(forecast.lowest.cashUsd)} on ${md(forecast.lowest.ymd)} — stays above your ${shortK(forecast.floorUsd)} floor`
      : `Lowest point: ${shortK(forecast.lowest.cashUsd)} on ${md(forecast.lowest.ymd)} — ${shortK(forecast.floorUsd - forecast.lowest.cashUsd)} under your ${shortK(forecast.floorUsd)} floor · ${forecast.daysUnderFloor} day${forecast.daysUnderFloor === 1 ? '' : 's'} below it`
    : ''
  const billsByDay = groupByDay(bills)
  const receiptsByDay = groupByDay(receipts)

  return (
    <div style={{ padding: '0.25rem 0 3rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>The Bridge</h1>
        <span style={det}>Where we stand, where cash is going, what would change it. Dev only.</span>
        <button type="button" onClick={() => setRefreshKey((k) => k + 1)} disabled={loading} style={{ ...btnStyle, marginLeft: 'auto', borderRadius: 6, padding: '0.25rem 0.7rem' }}>
          {loading ? 'Reading…' : 'Refresh'}
        </button>
      </div>
      {error ? <p style={{ color: 'var(--text-red-700)' }}>{error}</p> : null}
      {!data || !profit || !speed ? (
        <p style={det}>{loading ? 'Reading the last 8 weeks — sessions, bank flows, invoices, payments, the overhead pool…' : '—'}</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.6rem' }}>
            <div style={panel}>
              <div style={label}>Daily profit rate</div>
              <div style={{ ...big, color: climbColor }}>
                {speed.climbPerDay >= 0 ? '+' : '−'}
                {money(Math.abs(speed.climbPerDay))} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>/day · {speed.days}-day avg</span>
              </div>
              <div style={det}>
                earned <b style={{ color: 'var(--text)' }}>{money(speed.earnedPerDay)}</b>/day · costs <b style={{ color: 'var(--text)' }}>{money(speed.burnPerDay)}</b>/day (jobs {money(speed.directPerDay)} + overhead {money(speed.overheadPerDay)} at the 90-day rate)
                {profit.contributionMargin != null && <> · {Math.round(profit.contributionMargin * 100)}% of earned is margin</>}
              </div>
            </div>
            <div style={panel}>
              <div style={label}>Money owed</div>
              {fin.data ? (
                <>
                  <div style={big}>
                    {shortK(fin.data.ar.total)} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>owed to you</span>
                  </div>
                  <div style={det}>
                    owed by you <b style={{ color: 'var(--text)' }}>{shortK(fin.data.ap.total)}</b> · finished work not yet billed <b style={{ color: 'var(--text)' }}>{shortK(fin.data.unbilled.total)}</b> · collections {shortK(fin.data.arCollections.total)} ({fin.data.arCollections.count}) written off for planning
                  </div>
                </>
              ) : (
                <div style={det}>{fin.loading ? 'Loading…' : fin.error ?? '—'}</div>
              )}
            </div>
            <div style={panel}>
              <div style={label}>Crew hours · last 7 days</div>
              <div style={big}>
                {hrs(data.crew.fieldHours7d)} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>approved field</span>
              </div>
              <div style={det}>
                office + bid <b style={{ color: 'var(--text)' }}>{hrs(data.crew.officeBidHours7d)}</b> · awaiting approval <b style={{ color: data.crew.pendingClosedHours > 0 ? 'var(--text-amber-800)' : 'var(--text)' }}>{hrs(data.crew.pendingClosedHours)}</b> ({data.crew.pendingClosedSessions}) · {data.jobsWorked} jobs worked in 8 weeks
              </div>
            </div>
          </div>

          {/* Net position */}
          <div style={{ ...panel, marginTop: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span style={label}>Net position — last 8 weeks</span>
              <span style={det}>cash + owed to you (collections excluded) − owed by you</span>
              {netToday != null && netStart != null && (
                <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums', color: netToday - netStart >= 0 ? 'var(--text-green-700)' : 'var(--text-red-700)' }}>
                  Today: {shortK(netToday)} · {netToday - netStart >= 0 ? 'up' : 'down'} {shortK(Math.abs(netToday - netStart))} since {windowStartLabel}
                </span>
              )}
            </div>
            {history ? (
              <BridgeNetPositionChart history={history} />
            ) : (
              <div style={{ ...det, padding: '1.2rem 0' }}>{fin.data ? 'Type cash on hand below to anchor this line.' : 'Loading money owed…'}</div>
            )}
            <div style={det}>Payroll and sub-labor owed are carried flat in the history (they turn over weekly); supply invoices move it on their invoice and payment dates.</div>
          </div>

          {/* Cash forecast */}
          <div style={{ ...panel, marginTop: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span style={label}>Cash — next 8 weeks</span>
              <span style={det}>bank balance today, then every bill on the day it's due and every receipt on the day it's expected</span>
              {forecast && (
                <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums', color: forecast.clearsFloor ? 'var(--text-green-700)' : 'var(--text-red-700)' }}>{cashRead}</span>
              )}
            </div>
            {forecast && cashToday != null ? <BridgeCashChart forecast={forecast} cashTodayUsd={cashToday} /> : <div style={{ ...det, padding: '1.2rem 0' }}>Type cash on hand below to start the forecast.</div>}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.3rem', ...det }}>
              <span><i aria-hidden style={{ display: 'inline-block', width: 14, borderTop: '2px dashed #8b5cf6', marginRight: 5, verticalAlign: 3 }} />Cash forecast</span>
              <span><i aria-hidden style={{ display: 'inline-block', width: 14, borderTop: '2px dotted var(--text-red-600)', marginRight: 5, verticalAlign: 3 }} />Cash floor</span>
              <span style={{ color: 'var(--text-red-600)' }}>▼ bill due</span>
              <span style={{ color: 'var(--text-green-700)' }}>▲ receipt expected</span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <label htmlFor="bridge-cash" style={det}>Cash on hand today</label>
                <input id="bridge-cash" value={cashDraft} onChange={(e) => setCashDraft(e.target.value)} placeholder="e.g. 164000" inputMode="numeric" style={inputStyle} />
                <button type="button" onClick={() => void saveCash()} style={btnStyle}>Set</button>
                {data.cashSetting && data.cashSetting.asOfYmd !== data.todayYmd && cashToday != null && (
                  <span style={det}>typed {md(data.cashSetting.asOfYmd)} · rolled to {shortK(cashToday)} through bank flows since</span>
                )}
                <label htmlFor="bridge-floor" style={{ ...det, marginLeft: '0.6rem' }}>Floor</label>
                <input id="bridge-floor" value={floorDraft} onChange={(e) => setFloorDraft(e.target.value)} inputMode="numeric" style={{ ...inputStyle, width: 80 }} />
                <button type="button" onClick={() => void saveFloor()} style={btnStyle}>Set</button>
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '0.6rem', marginTop: '0.6rem' }}>
            <div style={panel}>
              <div style={label}>Bills coming due · next 8 weeks</div>
              <div style={{ ...det, marginTop: '0.2rem' }}>payroll ≈ {money(data.payrollWeeklyEstUsd)}/week (8-week labor average{data.crew.pendingClosedHours > 0 ? ' — reads low while hours await approval' : ''}) · sub labor owed on a {SUB_LABOR_DEFAULT_DAYS}-day horizon · other spend ≈ {money(data.dailyDrainUsd)}/day (office parts, 90-day rate)</div>
              <ul style={{ listStyle: 'none', margin: '0.3rem 0 0', padding: 0 }}>
                {billsByDay.slice(0, 10).map((b) => (
                  <li key={b.ymd} style={listRow}>
                    <span>
                      {md(b.ymd)} · {b.labels.join(' + ')}
                    </span>
                    <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-red-700)', fontVariantNumeric: 'tabular-nums' }}>−{money(b.usd)}</span>
                  </li>
                ))}
              </ul>
              <div style={{ ...det, marginTop: '0.4rem' }}>Insurance, rent, and card bills aren't scheduled yet — they arrive as bank transfers and only show once sorted.</div>
            </div>
            <div style={panel}>
              <div style={label}>Receipts expected · next 8 weeks</div>
              <div style={{ ...det, marginTop: '0.2rem' }}>promise date → this customer's pay speed → company pace → {DEFAULT_PAY_DAYS} days</div>
              <ul style={{ listStyle: 'none', margin: '0.3rem 0 0', padding: 0 }}>
                {receiptsByDay.slice(0, 10).map((r) => (
                  <li key={r.ymd} style={listRow}>
                    <span>
                      {md(r.ymd)} · {r.labels.slice(0, 2).join(', ')}
                      {r.labels.length > 2 ? ` +${r.labels.length - 2}` : ''}
                      <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{r.sources.join(' · ')}</span>
                    </span>
                    <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-green-700)', fontVariantNumeric: 'tabular-nums' }}>+{money(r.usd)}</span>
                  </li>
                ))}
                {fin.data && fin.data.arCollections.count > 0 && (
                  <li style={{ ...listRow, color: 'var(--text-muted)' }}>
                    <span>Collections ({fin.data.arCollections.count}) — not counted</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums' }}>{shortK(fin.data.arCollections.total)}</span>
                  </li>
                )}
              </ul>
            </div>
            <div style={panel}>
              <div style={label}>What would change it</div>
              <ul style={{ listStyle: 'none', margin: '0.3rem 0 0', padding: 0 }}>
                {fin.data && fin.data.unbilled.total > 0 && (
                  <li style={listRow}>
                    <span>
                      Bill the finished work<span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{shortK(fin.data.unbilled.total)} not yet billed — the biggest lever on both lines · <Link to="/jobs?tab=stages">Open Stages</Link></span>
                    </span>
                    <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-green-700)', whiteSpace: 'nowrap' }}>+ receipts</span>
                  </li>
                )}
                {data.crew.pendingClosedHours > 0 && (
                  <li style={listRow}>
                    <span>
                      Approve the {hrs(data.crew.pendingClosedHours)} pending<span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>the profit rate reads low until then · <Link to="/people?tab=hours">Open approvals</Link></span>
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>accuracy</span>
                  </li>
                )}
                <li style={listRow}>
                  <span>
                    Cut overhead 10%<span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>of {money(speed.overheadPerDay)}/day</span>
                  </span>
                  <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-green-700)', whiteSpace: 'nowrap' }}>+{money(speed.overheadPerDay * 0.1)}/day</span>
                </li>
                {data.totals.earnedUsd > 0 && data.crew.fieldHoursWindow > 0 && profit.contributionMargin != null && (
                  <li style={listRow}>
                    <span>
                      One more field day a week<span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>field earned {money(data.totals.earnedUsd / data.crew.fieldHoursWindow)} per approved hour; {Math.round(profit.contributionMargin * 100)}% of it is margin</span>
                    </span>
                    <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-green-700)', whiteSpace: 'nowrap' }}>+{money(((data.totals.earnedUsd / data.crew.fieldHoursWindow) * profit.contributionMargin * 8) / 7)}/day</span>
                  </li>
                )}
                {data.levers.bidsDue.slice(0, 3).map((b) => (
                  <li key={b.id} style={listRow}>
                    <span>
                      Win {b.label}<span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{money(b.bidValueUsd)} · due {md(b.dueYmd)}</span>
                    </span>
                    <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-green-700)', whiteSpace: 'nowrap' }}>
                      {profit.contributionMargin == null ? '—' : `+${money((b.bidValueUsd * profit.contributionMargin) / 60)}/day over 60d`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {(data.crew.pendingClosedHours > 0 || (data.hygiene.unattributedNoncard ?? 0) > 0 || (data.hygiene.unlinkedCard ?? 0) > 0 || data.earned.assumedHalfJobs.length > 0 || data.earned.noRevenueJobs.length > 0 || data.cashSetting) && (
            <div style={{ marginTop: '0.6rem', border: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)', borderRadius: 8, padding: '0.5rem 0.9rem', fontSize: '0.8rem', color: 'var(--text-amber-900)', display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <strong style={{ letterSpacing: '0.12em', fontSize: '0.68rem' }}>DATA GAPS</strong>
              {data.crew.pendingClosedHours > 0 && <span>{hrs(data.crew.pendingClosedHours)} unapproved</span>}
              {(data.hygiene.unattributedNoncard ?? 0) > 0 && <span>{data.hygiene.unattributedNoncard} bank transfers unsorted</span>}
              {(data.hygiene.unlinkedCard ?? 0) > 0 && <span>{data.hygiene.unlinkedCard} card purchases unsorted</span>}
              {data.earned.assumedHalfJobs.length > 0 && <span>{data.earned.assumedHalfJobs.length} open job{data.earned.assumedHalfJobs.length === 1 ? '' : 's'} with no % complete — assumed half done</span>}
              {data.earned.noRevenueJobs.length > 0 && <span>{data.earned.noRevenueJobs.length} worked job{data.earned.noRevenueJobs.length === 1 ? '' : 's'} with no contract $ — earning $0</span>}
              {data.cashSetting && <span>cash on hand is typed ({md(data.cashSetting.asOfYmd)}), not synced</span>}
            </div>
          )}

          <p style={{ ...det, marginTop: '0.8rem', maxWidth: '92ch' }}>
            <b>How it's counted:</b> profit rate = earned (each approved field hour × its job's contract ÷ expected hours) − job costs (field labor, purchases and supply invoices allocated to jobs, sub sheets) − overhead (the People → Overhead pool). Net position = cash + owed to you − owed by you, with history rebuilt from bank flows, invoices sent, payments received, and supply invoices dated and paid. Cash forecast = cash today, bills on due dates, receipts on expected dates, office parts as a daily drain. Window {data.windowStart} → {data.todayYmd}: earned {shortK(data.totals.earnedUsd)} · field labor {shortK(data.totals.fieldLaborUsd)} · materials {shortK(data.totals.materialsUsd)} · subs {shortK(data.totals.subLaborUsd)} · overhead {shortK(data.totals.overheadUsd)}.
          </p>
        </>
      )}
    </div>
  )
}

function groupByDay<T extends { ymd: string; usd: number; label: string; source?: string }>(rows: ReadonlyArray<T>): Array<{ ymd: string; usd: number; labels: string[]; sources: string[] }> {
  const m = new Map<string, { ymd: string; usd: number; labels: string[]; sources: string[] }>()
  for (const r of rows) {
    const cur = m.get(r.ymd) ?? { ymd: r.ymd, usd: 0, labels: [], sources: [] }
    cur.usd += r.usd
    if (!cur.labels.includes(r.label)) cur.labels.push(r.label)
    if (r.source && !cur.sources.includes(r.source)) cur.sources.push(r.source)
    m.set(r.ymd, cur)
  }
  return [...m.values()].sort((a, b) => (a.ymd < b.ymd ? -1 : a.ymd > b.ymd ? 1 : 0))
}
