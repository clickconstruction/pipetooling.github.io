import { useMemo, useState, type CSSProperties } from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link } from 'react-router-dom'
import { formatCurrency } from '../../lib/format'
import { PURSUIT_OUTCOME_LABELS, formatUsdShort, type PursuitOutcome, type PursuitRow } from '../../lib/bids/bidPursuit'
import {
  COHORT_BUCKET_LABELS,
  DECISION_TIMES_MIN_SAMPLE,
  FORECAST_MATURITY_DAYS,
  FORECAST_MIN_DECIDED_FOR_OWN_RATE,
  FORECAST_SIZE_BANDS,
  cohortsByMonth,
  decisionTimes,
  forecastByEstimator,
  forecastOpen,
  forecastRows,
  oddsBySize,
  oddsForPerson,
  oddsWords,
  openAgeBuckets,
  type CohortBucket,
  type CohortMonth,
} from '../../lib/bids/bidForecast'

/**
 * Bids → Bid Costs → History & forecast (v2.3355). Three panels from the pure
 * kernel in `bidForecast.ts`: bids sent by month and what they became (with
 * the win-rate lines), how long a decision takes (fills in as
 * `bids.outcome_at` accumulates), and what the open bids should bring in,
 * each counted at the odds of its size, by person.
 *
 * Everything on the page opens: click a bar segment, an odds card, an age
 * bucket, or a person's row and the bids behind that number list below it;
 * click a bid there to select it across the workflow tabs.
 */
type Props = {
  rows: PursuitRow[]
  todayYmd: string
  showRobots: boolean
  onToggleRobots: (on: boolean) => void
  robotCount: number
  onSelectBid: (bidId: string) => void
}

type Mode = 'count' | 'value'
type Drill = { title: string; sub?: string; rows: PursuitRow[] } | null

const WON = '#1e8a57', LOST = '#c64b3a', OPEN = '#b8801f', OPEN_STALE = 'rgba(184, 128, 31, 0.42)', VALUE_LINE = '#2f6be0'
const OUTCOME_COLORS: Record<PursuitOutcome, { fg: string; bg: string }> = {
  open: { fg: OPEN, bg: 'rgba(184, 128, 31, 0.14)' },
  won: { fg: WON, bg: 'rgba(30, 138, 87, 0.14)' },
  lost: { fg: LOST, bg: 'rgba(198, 75, 58, 0.14)' },
  unsent: { fg: 'var(--text-muted)', bg: 'var(--bg-subtle)' },
}

const usd = (n: number): string => `$${formatCurrency(n)}`
const pct = (r: number | null): string => (r == null ? '—' : `${Math.round(r * 100)}%`)
const panel: CSSProperties = { border: '1px solid var(--border)', borderRadius: 6, padding: '0.7rem 0.85rem', marginBottom: 12 }
const h5: CSSProperties = { margin: '0 0 2px', fontSize: '0.85rem', fontWeight: 600 }
const sub: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.75rem', margin: '0 0 8px' }
const chipBase: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 999, padding: '2px 9px', fontSize: '0.75rem', border: '1px solid var(--border)', background: 'none', color: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }
const tile: CSSProperties = { border: '1px solid var(--border)', borderRadius: 6, padding: '0.6rem 0.75rem', background: 'var(--surface)', textAlign: 'left', color: 'inherit', cursor: 'pointer', font: 'inherit' }
const tileN: CSSProperties = { display: 'block', fontSize: '1.2rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }
const tileL: CSSProperties = { fontSize: '0.74rem', color: 'var(--text-muted)' }
const cell: CSSProperties = { padding: '0.45rem 0.6rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top', whiteSpace: 'nowrap' }
const num: CSSProperties = { ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
const th: CSSProperties = { padding: '0.45rem 0.6rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }
const thNum: CSSProperties = { ...th, textAlign: 'right' }
const subLine: CSSProperties = { display: 'block', color: 'var(--text-muted)', fontSize: '0.7rem', whiteSpace: 'normal' }

type Datum = { month: string; label: string; won: number; lost: number; open: number; openStale: number; rateByCount: number | null; rateByValue: number | null; deciding: boolean; cohort: CohortMonth }

function CohortTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Datum }> }) {
  if (!active || !payload?.[0]) return null
  const d = payload[0].payload
  const c = d.cohort
  const line = (label: string, n: number, u: number, color: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ color }}>{label}</span><span>{n} · {formatUsdShort(u)}</span></div>
  )
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', fontSize: '0.75rem', minWidth: 190 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.label}{d.deciding ? <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · still deciding</span> : null}</div>
      {line('Won', c.won, c.wonUsd, WON)}
      {line('Lost', c.lost, c.lostUsd, LOST)}
      {line('Still open', c.open, c.openUsd, OPEN)}
      {c.openStale > 0 ? line('Open 120+ days', c.openStale, c.openStaleUsd, 'var(--text-muted)') : null}
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 4, color: 'var(--text-muted)' }}>win rate · {pct(c.rateByCount)} by count · {pct(c.rateByValue)} by value</div>
      <div style={{ color: 'var(--text-muted)' }}>click a bar to list its bids</div>
    </div>
  )
}

export function BidsForecastLens({ rows, todayYmd, showRobots, onToggleRobots, robotCount, onSelectBid }: Props) {
  const [person, setPerson] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('count')
  const [drill, setDrill] = useState<Drill>(null)

  const everyoneRows = useMemo(() => forecastRows(rows, { showRobots, estimator: null }), [rows, showRobots])
  const shown = useMemo(() => forecastRows(rows, { showRobots, estimator: person }), [rows, showRobots, person])
  const cohorts = useMemo(() => cohortsByMonth(shown, todayYmd), [shown, todayYmd])
  const everyoneOdds = useMemo(() => oddsBySize(everyoneRows, todayYmd), [everyoneRows, todayYmd])
  const personOdds = useMemo(() => (person == null ? { odds: everyoneOdds, own: true, decided: everyoneOdds.won + everyoneOdds.lost, ownBand: { small: true, mid: true, large: true } } : oddsForPerson(shown, everyoneOdds, todayYmd)), [person, shown, everyoneOdds, todayYmd])
  const forecast = useMemo(() => forecastOpen(shown, personOdds.odds, todayYmd), [shown, personOdds, todayYmd])
  const people = useMemo(() => forecastByEstimator(everyoneRows, todayYmd), [everyoneRows, todayYmd])
  const times = useMemo(() => decisionTimes(shown), [shown])
  const ages = useMemo(() => openAgeBuckets(shown, todayYmd), [shown, todayYmd])
  const personChips = useMemo(() => people.people.filter((p) => p.sent >= 3).map((p) => ({ key: p.key, label: p.label, sent: p.sent })), [people])

  const data: Datum[] = useMemo(() => cohorts.map((c) => ({
    month: c.month, label: c.label,
    won: mode === 'count' ? c.won : c.wonUsd / 1000,
    lost: mode === 'count' ? c.lost : c.lostUsd / 1000,
    open: mode === 'count' ? c.open : c.openUsd / 1000,
    openStale: mode === 'count' ? c.openStale : c.openStaleUsd / 1000,
    rateByCount: c.rateByCount == null ? null : Math.round(c.rateByCount * 100),
    rateByValue: c.rateByValue == null ? null : Math.round(c.rateByValue * 100),
    deciding: c.deciding, cohort: c,
  })), [cohorts, mode])
  const firstDeciding = data.find((d) => d.deciding)?.label
  const lastLabel = data[data.length - 1]?.label

  const openBar = (bucket: CohortBucket) => (d: unknown) => {
    const p = (d as { payload?: Datum })?.payload ?? (d as Datum)
    if (!p?.cohort) return
    const list = p.cohort.bids[bucket]
    setDrill({ title: `${COHORT_BUCKET_LABELS[bucket]} · sent ${p.label}`, sub: `${list.length} bid${list.length === 1 ? '' : 's'} · ${formatUsdShort(list.reduce((s, r) => s + (r.bidValue ?? 0), 0))}`, rows: list })
  }
  const bandOdds = personOdds.odds
  const whoWords = person == null ? 'everyone' : person || 'no estimator'

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12, fontSize: '0.8rem' }}>
        <button type="button" aria-pressed={person == null} onClick={() => { setPerson(null); setDrill(null) }} style={{ ...chipBase, ...(person == null ? { borderColor: 'var(--text-link)', color: 'var(--text-link)', fontWeight: 600 } : {}) }}>Everyone</button>
        {personChips.map((p) => (
          <button key={p.key} type="button" aria-pressed={person === p.key} onClick={() => { setPerson(p.key); setDrill(null) }} style={{ ...chipBase, ...(person === p.key ? { borderColor: 'var(--text-link)', color: 'var(--text-link)', fontWeight: 600 } : {}), ...(p.key === '' ? { color: person === '' ? 'var(--text-link)' : 'var(--text-muted)' } : {}) }}>
            {p.label}{p.key === '' ? ` · ${p.sent}` : ''}
          </button>
        ))}
        <span role="group" aria-label="Bars by" style={{ marginLeft: 'auto', display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 5, overflow: 'hidden' }}>
          {(['count', 'value'] as const).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} style={{ border: 'none', background: mode === m ? 'var(--bg-subtle)' : 'none', color: mode === m ? 'inherit' : 'var(--text-muted)', fontWeight: mode === m ? 600 : 400, padding: '4px 9px', cursor: 'pointer' }}>
              {m === 'count' ? 'By count' : 'By value'}
            </button>
          ))}
        </span>
        <label style={{ color: 'var(--text-muted)', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
          <input type="checkbox" checked={showRobots} onChange={(e) => onToggleRobots(e.target.checked)} /> robot bids ({robotCount})
        </label>
      </div>

      <div style={panel}>
        <h5 style={h5}>Sent by month, and how each month turned out</h5>
        <p style={sub}>Bars are the bids {whoWords === 'everyone' ? 'we' : whoWords === 'no estimator' ? 'bids with no estimator' : whoWords} sent that month, by what they became. The lines are the win rate of the ones that have been decided. Months inside the last {FORECAST_MATURITY_DAYS} days are still deciding — read their rate lightly. Click a bar to see the bids in it.</p>
        {data.length === 0 ? (
          <p style={{ ...sub, margin: 0 }}>No sent bids to chart.</p>
        ) : (
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} interval={0} minTickGap={4} />
                <YAxis yAxisId="n" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => (mode === 'count' ? String(v) : formatUsdShort(v * 1000))} allowDecimals={false} />
                <YAxis yAxisId="r" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} width={36} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip content={<CohortTooltip />} cursor={{ fill: 'var(--bg-subtle)' }} />
                {firstDeciding && lastLabel ? <ReferenceArea yAxisId="n" x1={firstDeciding} x2={lastLabel} fill="var(--bg-subtle)" fillOpacity={0.6} label={{ value: 'still deciding', position: 'insideTop', fontSize: 10, fill: 'var(--text-muted)' }} /> : null}
                <Bar yAxisId="n" dataKey="won" name="Won" stackId="c" fill={WON} isAnimationActive={false} onClick={openBar('won')} cursor="pointer" />
                <Bar yAxisId="n" dataKey="lost" name="Lost" stackId="c" fill={LOST} isAnimationActive={false} onClick={openBar('lost')} cursor="pointer" />
                <Bar yAxisId="n" dataKey="open" name="Still open" stackId="c" fill={OPEN} isAnimationActive={false} onClick={openBar('open')} cursor="pointer" />
                <Bar yAxisId="n" dataKey="openStale" name="Open 120+ days" stackId="c" fill={OPEN_STALE} isAnimationActive={false} onClick={openBar('openStale')} cursor="pointer" radius={[2, 2, 0, 0]} />
                <Line yAxisId="r" type="monotone" dataKey="rateByCount" name="Win rate by count" stroke="var(--text-primary, currentColor)" strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
                <Line yAxisId="r" type="monotone" dataKey="rateByValue" name="Win rate by value" stroke={VALUE_LINE} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
          <span><i style={swatch(WON)} />Won</span><span><i style={swatch(LOST)} />Lost</span><span><i style={swatch(OPEN)} />Still open</span><span><i style={swatch(OPEN_STALE)} />Open, sent {FORECAST_MATURITY_DAYS}+ days ago</span>
          <span><i style={{ ...swatch('transparent'), borderTop: '2px solid currentColor', height: 0, verticalAlign: '3px' }} />Win rate by count</span><span><i style={{ ...swatch('transparent'), borderTop: `2px dashed ${VALUE_LINE}`, height: 0, verticalAlign: '3px' }} />by value</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        <div style={{ ...panel, marginBottom: 0 }}>
          <h5 style={h5}>How long a decision takes</h5>
          <p style={sub}>Days from sent to the day someone marked the bid won or lost.</p>
          {times.enough ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                <button type="button" style={tile} onClick={() => setDrill({ title: 'Decided bids with a decision date', sub: `${times.n} bids`, rows: times.sample.map((s) => s.row) })}><span style={tileN}>{times.medianDays} d</span><span style={tileL}>median · {times.n} decided</span></button>
                <div style={{ ...tile, cursor: 'default' }}><span style={tileN}>{times.p10Days} d</span><span style={tileL}>fastest 10%</span></div>
                <div style={{ ...tile, cursor: 'default' }}><span style={tileN}>{times.p90Days} d</span><span style={tileL}>slowest 10%</span></div>
              </div>
              <div style={{ marginTop: 8, fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {times.byMonth.map((m) => <span key={m.month} style={{ display: 'inline-block', marginRight: 10 }}>{m.label} <b style={{ color: 'var(--text-primary, inherit)' }}>{m.medianDays} d</b> · {m.n}</span>)}
              </div>
            </>
          ) : (
            <div style={{ border: '1px dashed var(--border)', borderRadius: 6, padding: '10px 12px', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              <b style={{ color: 'inherit' }}>Not enough yet.</b> Bids only started recording the day they were decided on 2026-09-11; {times.n} of {shown.filter((r) => r.outcome === 'won' || r.outcome === 'lost').length} decided bids carry a date so far. This fills in as bids are marked won or lost (it needs {DECISION_TIMES_MIN_SAMPLE}).
              {times.n > 0 ? <span style={{ display: 'block', marginTop: 4 }}>So far: median {times.medianDays} days. <button type="button" onClick={() => setDrill({ title: 'Decided bids with a decision date', rows: times.sample.map((s) => s.row) })} style={{ ...chipBase, color: 'var(--text-link)', borderColor: 'var(--text-link)' }}>see them</button></span> : null}
            </div>
          )}
          <p style={{ ...sub, margin: '10px 0 4px' }}>Open bids, by how long they've waited. Past {FORECAST_MATURITY_DAYS} days a bid is more often forgotten than pending — the forecast leaves those out; Followup → Waiting to hear is where to chase or mark them.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {ages.map((a) => (
              <button key={a.key} type="button" onClick={() => setDrill({ title: `Open · waiting ${a.label}`, sub: `${a.n} bids · ${formatUsdShort(a.usd)}`, rows: a.bids })} style={{ ...tile, padding: '0.45rem 0.6rem', background: a.stale ? 'rgba(184, 128, 31, 0.12)' : 'var(--bg-subtle)', border: 'none' }}>
                <span style={{ ...tileN, fontSize: '1rem' }}>{a.n}</span><span style={tileL}>{a.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ ...panel, marginBottom: 0 }}>
          <h5 style={h5}>The odds we use{person != null && !personOdds.own ? ` · everyone's (${whoWords} has ${personOdds.decided} decided, needs ${FORECAST_MIN_DECIDED_FOR_OWN_RATE})` : person != null ? ` · ${whoWords}'s own` : ''}</h5>
          <p style={sub}>Win rate by count on bids sent {FORECAST_MATURITY_DAYS}+ days ago (decided enough to trust), split by size. Click a card for the bids behind it.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {FORECAST_SIZE_BANDS.map((b) => {
              const o = bandOdds.bands[b.key]
              const own = person == null || personOdds.ownBand[b.key]
              return (
                <button key={b.key} type="button" onClick={() => setDrill({ title: `${b.label} · decided, sent ${FORECAST_MATURITY_DAYS}+ days ago`, sub: `${o.won} won · ${o.lost} lost`, rows: o.bids })} style={tile}>
                  <span style={tileL}>{b.label}</span>
                  <span style={tileN}>{pct(o.byCount)}</span>
                  <span style={tileL}>{o.won} won · {o.lost} lost{!own ? ' · everyone’s' : ''}</span>
                </button>
              )
            })}
          </div>
          <p style={{ ...sub, margin: '8px 0 0' }}>{whoWords === 'everyone' ? 'Everyone' : whoWords}, all sizes: <b style={{ color: 'var(--text-primary, inherit)' }}>{pct(bandOdds.byCount)} by count · {pct(bandOdds.byValue)} by value</b> ({bandOdds.won} won, {bandOdds.lost} lost).</p>
        </div>
      </div>

      <div style={{ ...panel, marginTop: 12 }}>
        <h5 style={h5}>What's open, and what to expect from it</h5>
        <p style={sub}>Open bids sent in the last {FORECAST_MATURITY_DAYS} days, each counted at the odds of its size. The range is one standard deviation — wide when a few bids are very large.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, marginBottom: 10 }}>
          <button type="button" style={tile} onClick={() => setDrill({ title: `Open · sent in the last ${FORECAST_MATURITY_DAYS} days`, sub: `${forecast.n} bids · ${formatUsdShort(forecast.usd)}`, rows: forecast.fresh })}>
            <span style={tileN}>{forecast.n} · {formatUsdShort(forecast.usd)}</span><span style={tileL}>open, sent in the last {FORECAST_MATURITY_DAYS} days</span>
            <span style={{ ...tileL, display: 'block' }}>{forecast.stale.n} more · {formatUsdShort(forecast.stale.usd)} open longer, left out</span>
          </button>
          <div style={{ ...tile, cursor: 'default' }}><span style={tileN}>≈ {Math.round(forecast.expCount)} win{Math.round(forecast.expCount) === 1 ? '' : 's'}</span><span style={tileL}>expected from those {forecast.n}</span><span style={{ ...tileL, display: 'block' }}>at the odds by size</span></div>
          <div style={{ ...tile, cursor: 'default' }}><span style={tileN}>≈ {formatUsdShort(forecast.expUsd)}</span><span style={tileL}>expected value won</span><span style={{ ...tileL, display: 'block' }}>likely {formatUsdShort(forecast.lowUsd)} – {formatUsdShort(forecast.highUsd)}</span></div>
          {forecast.largest ? (
            <button type="button" style={tile} onClick={() => onSelectBid(forecast.largest!.row.bidId)} title="Select this bid across the workflow tabs">
              <span style={tileN}>{pct(forecast.largest.share)}</span><span style={tileL}>of that {formatUsdShort(forecast.usd)} is one bid</span>
              <span style={{ ...tileL, display: 'block' }}>{forecast.largest.row.label} · {formatUsdShort(forecast.largest.row.bidValue ?? 0)} · counted at {pct(forecast.largest.p)}</span>
            </button>
          ) : null}
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead style={{ background: 'var(--bg-subtle)' }}>
              <tr>
                <th style={th}>Estimator</th><th style={thNum}>Sent</th><th style={thNum} title={`Decided bids sent ${FORECAST_MATURITY_DAYS}+ days ago`}>Decided · mature</th><th style={thNum}>Win rate · count</th><th style={thNum}>Win rate · value</th><th style={thNum}>Open · fresh</th><th style={thNum}>Open value</th><th style={thNum}>Expected wins</th><th style={thNum}>Expected value</th>
              </tr>
            </thead>
            <tbody>
              {[...people.people, people.everyone].map((p) => (
                <tr key={p.key} onClick={() => setDrill({ title: `${p.label} · open, sent in the last ${FORECAST_MATURITY_DAYS} days`, sub: `${p.fresh} bids · ${formatUsdShort(p.freshUsd)}`, rows: p.freshBids })} style={{ cursor: 'pointer', ...(p.key === '*' ? { background: 'var(--bg-subtle)', fontWeight: 600 } : {}) }} title="List this person's fresh open bids">
                  <td style={{ ...cell, whiteSpace: 'normal' }}>{p.label}{p.key === '' ? <span style={subLine}>{p.sent} sent bids carry no estimator</span> : null}</td>
                  <td style={num}>{p.sent}</td>
                  <td style={num}>{p.matureDecided}</td>
                  <td style={num}>{pct(p.byCount)}{p.key !== '*' && !p.ownRate ? <span style={{ ...subLine, textAlign: 'right' }}>{oddsWords(p)}</span> : null}</td>
                  <td style={num}>{pct(p.byValue)}</td>
                  <td style={num}>{p.open} · {p.fresh}</td>
                  <td style={num}>{p.openUsd > 0 ? formatUsdShort(p.openUsd) : '—'}</td>
                  <td style={num}>{p.fresh > 0 ? `≈ ${p.expCount < 1 ? p.expCount.toFixed(1) : Math.round(p.expCount)}` : '—'}</td>
                  <td style={num}>{p.fresh > 0 ? `≈ ${formatUsdShort(p.expUsd)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ ...sub, margin: '8px 0 0' }}>A person with {FORECAST_MIN_DECIDED_FOR_OWN_RATE}+ decided mature bids uses their own odds per size; fewer uses everyone's. Assign the bids with no estimator (Edit Bid → Estimator) and they join a person's history. <Link to="/bids?tab=bid-board" style={{ color: 'var(--text-link)' }}>Estimating Health on the Bid Board</Link> keeps the weekly view.</p>
      </div>

      {drill ? (
        <div style={{ ...panel, marginTop: 12, borderColor: 'var(--text-link)' }} id="bid-forecast-drill">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
            <h5 style={{ ...h5, margin: 0 }}>{drill.title}</h5>
            {drill.sub ? <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{drill.sub}</span> : null}
            <button type="button" onClick={() => setDrill(null)} style={{ ...chipBase, marginLeft: 'auto' }} aria-label="Close this list">Close ×</button>
          </div>
          {drill.rows.length === 0 ? (
            <p style={{ ...sub, margin: 0 }}>No bids here.</p>
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead style={{ background: 'var(--bg-subtle)' }}><tr><th style={th}>Bid</th><th style={th}>Estimator</th><th style={th}>Sent</th><th style={thNum}>Value</th><th style={th}>Outcome</th><th style={th}>Decided</th></tr></thead>
                <tbody>
                  {[...drill.rows].sort((a, b) => (b.bidValue ?? 0) - (a.bidValue ?? 0)).map((r) => (
                    <tr key={r.bidId} onClick={() => onSelectBid(r.bidId)} style={{ cursor: 'pointer' }} title="Select this bid across the workflow tabs">
                      <td style={{ ...cell, whiteSpace: 'normal' }}>{r.label}{r.gcName ? <span style={subLine}>{r.gcName}</span> : null}</td>
                      <td style={cell}>{r.estimatorName ?? '—'}</td>
                      <td style={cell}>{r.sentYmd ?? r.dateYmd ?? '—'}</td>
                      <td style={num}>{r.bidValue != null ? usd(r.bidValue) : '—'}</td>
                      <td style={cell}><span style={{ ...chipBase, cursor: 'default', border: 'none', color: OUTCOME_COLORS[r.outcome].fg, background: OUTCOME_COLORS[r.outcome].bg, fontWeight: 500 }}>{PURSUIT_OUTCOME_LABELS[r.outcome]}</span></td>
                      <td style={cell}>{r.outcomeAtYmd ?? (r.outcome === 'won' || r.outcome === 'lost' ? <span style={{ color: 'var(--text-muted)' }}>no date</span> : '—')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

function swatch(color: string): CSSProperties {
  return { display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: color, marginRight: 5, verticalAlign: '-1px' }
}
