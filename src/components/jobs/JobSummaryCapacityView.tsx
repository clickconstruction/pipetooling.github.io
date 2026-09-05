import { useMemo, useState, type CSSProperties } from 'react'
import { useFieldRoster } from '../../hooks/useFieldRoster'
import type { JobDayLedger } from '../../lib/jobs/jobDayLedger'
import { CAPACITY_HOURS_PER_DAY, buildCapacitySeries, type CapacityWeek } from '../../lib/jobs/jobSummaryCapacity'
import { formatStagesNextDateLabel } from '../../lib/stagesUpcomingSchedule'

/**
 * Job Summary → Capacity (v2.2828): were we full? One bar per week — available
 * field hours as an outline, approved field hours filled, utilization on top —
 * with tiles for the window, the peak week, weeks under 60% and over 100%, and
 * the crew today. Reads the same day ledger as Days and Timeline plus the field
 * roster; when the roster can't be read it estimates from who clocked in and
 * says so. Presentational; kernel in `lib/jobs/jobSummaryCapacity.ts`.
 */
type Props = {
  ledger: JobDayLedger | null
  ledgerLoading: boolean
  ledgerError: string | null
}

const USED = '#2563eb'
const tile: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '0.45rem 0.65rem', background: 'var(--bg-subtle)', minWidth: 0 }
const tileK: CSSProperties = { fontSize: '0.64rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }
const tileV: CSSProperties = { fontSize: '1.05rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em', color: 'var(--text-strong)' }
const tileS: CSSProperties = { fontSize: '0.7rem', color: 'var(--text-700)' }
const pct = (v: number | null | undefined): string => (v == null ? '—' : `${Math.round(v)}%`)
const weekLabel = (w: CapacityWeek) => `week of ${formatStagesNextDateLabel(w.weekStartYmd)}`

export default function JobSummaryCapacityView({ ledger, ledgerLoading, ledgerError }: Props) {
  const { people, error: rosterError } = useFieldRoster(ledger != null)
  const series = useMemo(() => buildCapacitySeries({ ledger, people }), [ledger, people])
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  if (!ledger) {
    return <p style={{ color: ledgerError ? 'var(--text-red-700)' : 'var(--text-muted)' }}>{ledgerError ? `Day ledger failed: ${ledgerError}` : ledgerLoading ? 'Loading the day ledger…' : 'No day ledger yet.'}</p>
  }

  const W = 1000
  const H = 260
  const L = 52
  const R = 12
  const T = 20
  const B = 30
  const plotH = H - T - B
  const n = Math.max(1, series.weeks.length)
  const cw = (W - L - R) / n
  const maxY = Math.max(40, ...series.weeks.map((w) => Math.max(w.availableHours, w.fieldHours))) * 1.12
  const yOf = (v: number) => T + plotH * (1 - v / maxY)
  const gridStep = maxY <= 120 ? 20 : maxY <= 400 ? 50 : maxY <= 1000 ? 100 : 250
  const gridVals: number[] = []
  for (let v = 0; v <= maxY; v += gridStep) gridVals.push(v)
  const monthTicksAll = series.weeks.map((w, i) => ({ i, ym: w.weekStartYmd.slice(0, 7) })).filter((t, k, arr) => k === 0 || arr[k - 1]!.ym !== t.ym)
  // A window that starts in the last days of a month would print two labels on top of each other.
  const monthTicks = monthTicksAll.filter((t, k) => !(k === 0 && monthTicksAll[1] && monthTicksAll[1].i - t.i < 2))
  const noHourWeeks = series.weeks.filter((w) => w.workdays > 0 && w.fieldHours === 0).length
  const monthName = (ym: string) => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(ym.slice(5, 7)) - 1]
  const tone = (u: number | null) => (u == null ? 'var(--text-muted)' : u > 100 ? 'var(--text-red-700)' : u < 60 ? 'var(--text-amber-800)' : 'var(--text-muted)')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9.5rem, 1fr))', gap: '0.5rem' }}>
        <div style={tile}>
          <div style={tileK}>Utilization</div>
          <div style={{ ...tileV, color: tone(series.totals.utilizationPct) === 'var(--text-muted)' ? tileV.color : tone(series.totals.utilizationPct) }}>{pct(series.totals.utilizationPct)}</div>
          <div style={tileS}>
            {series.totals.fieldHours.toFixed(0)} of {series.totals.availableHours.toFixed(0)} available hours
          </div>
        </div>
        <div style={tile}>
          <div style={tileK}>Peak week</div>
          <div style={tileV}>{series.peak ? pct(series.peak.utilizationPct) : '—'}</div>
          <div style={tileS}>{series.peak ? weekLabel(series.peak) : 'no full week in the window'}</div>
        </div>
        <div style={tile}>
          <div style={tileK}>Weeks under 60%</div>
          <div style={{ ...tileV, color: series.weeksUnder60 > 0 ? 'var(--text-amber-800)' : tileV.color }}>{series.weeksUnder60}</div>
          <div style={tileS}>room to sell</div>
        </div>
        <div style={tile}>
          <div style={tileK}>Weeks over 100%</div>
          <div style={{ ...tileV, color: series.weeksOver100 > 0 ? 'var(--text-red-700)' : tileV.color }}>{series.weeksOver100}</div>
          <div style={tileS}>more field hours than the roster’s day</div>
        </div>
        <div style={tile}>
          <div style={tileK}>Crew now</div>
          <div style={tileV}>{series.crewNow}</div>
          <div style={tileS}>{series.source === 'roster' ? 'masters + helpers on the roster' : 'people who clocked in last week'}</div>
        </div>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.5rem 0.5rem 0.25rem' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Available field hours against approved field hours, by week" style={{ display: 'block' }} onMouseLeave={() => setHoverIdx(null)}>
          {gridVals.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={yOf(v)} y2={yOf(v)} stroke="var(--border)" strokeWidth={1} />
              <text x={L - 6} y={yOf(v) + 4} textAnchor="end" fontSize={10} fill="var(--text-muted)">
                {v}
              </text>
            </g>
          ))}
          <text transform={`rotate(-90 11 ${T + plotH / 2})`} x={11} y={T + plotH / 2} textAnchor="middle" fontSize={10} fill="var(--text-muted)" style={{ pointerEvents: 'none' }}>
            hours that week
          </text>
          {hoverIdx != null ? <rect x={L + hoverIdx * cw} y={T} width={cw} height={plotH} fill="var(--text-strong)" opacity={0.06} style={{ pointerEvents: 'none' }} /> : null}
          {series.weeks.map((w, i) => {
            const x = L + i * cw + 1.5
            const bw = Math.max(2, cw - 3)
            const u = w.utilizationPct
            const showLabel = n <= 20 || i % Math.ceil(n / 20) === 0
            return (
              <g key={w.weekStartYmd}>
                <rect x={x} y={yOf(w.availableHours)} width={bw} height={Math.max(0, yOf(0) - yOf(w.availableHours))} fill="var(--bg-subtle)" stroke="var(--border-strong)" />
                <rect x={x + 2} y={yOf(w.fieldHours)} width={Math.max(1, bw - 4)} height={Math.max(0, yOf(0) - yOf(w.fieldHours))} rx={2} fill={USED} opacity={0.9} />
                {u != null && showLabel ? (
                  w.fieldHours === 0 ? (
                    <text x={x + bw / 2} y={yOf(w.availableHours) - 4} textAnchor="middle" fontSize={8.5} fill="var(--text-muted)">
                      no hours
                    </text>
                  ) : (
                    <text x={x + bw / 2} y={yOf(Math.max(w.availableHours, w.fieldHours)) - 4} textAnchor="middle" fontSize={9.5} fontWeight={u > 100 || u < 60 ? 700 : 400} fill={tone(u)}>
                      {Math.round(u)}%
                    </text>
                  )
                ) : null}
                <rect x={L + i * cw} y={T} width={cw} height={plotH} fill="transparent" onMouseEnter={() => setHoverIdx(i)}>
                  <title>{`${weekLabel(w)} · ${w.fieldHours.toFixed(0)} field h of ${w.availableHours.toFixed(0)} available (${w.people} ${series.source === 'roster' ? 'on the roster' : 'clocked in'}, ${w.workdays} workdays) · ${pct(u)} · ${w.peopleWorked} people on jobs`}</title>
                </rect>
              </g>
            )
          })}
          {monthTicks.map((t) => (
            <g key={t.ym}>
              <line x1={L + t.i * cw} x2={L + t.i * cw} y1={T + plotH} y2={T + plotH + 5} stroke="var(--border-strong)" />
              <text x={L + t.i * cw + 3} y={T + plotH + 16} fontSize={10} fill="var(--text-muted)">
                {monthName(t.ym)}
                {t.ym.endsWith('-01') || t.i === 0 ? ` ${t.ym.slice(0, 4)}` : ''}
              </text>
            </g>
          ))}
        </svg>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-700)', padding: '0.35rem 0.25rem 0.2rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <i style={{ display: 'inline-block', width: 12, height: 8, borderRadius: 2, background: 'var(--bg-subtle)', border: '1px solid var(--border-strong)' }} />
            available ({series.source === 'roster' ? 'roster' : 'people who clocked in'} × weekdays × {CAPACITY_HOURS_PER_DAY} h)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <i style={{ display: 'inline-block', width: 12, height: 8, borderRadius: 2, background: USED }} />
            approved field hours
          </span>
          <span style={{ color: 'var(--text-amber-800)' }}>amber = under 60%</span>
          <span style={{ color: 'var(--text-red-700)' }}>red = over 100%</span>
          <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>label = utilization · hover a week</span>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        {series.source === 'roster'
          ? `Available hours count every master technician and helper active on the roster that weekday, at ${CAPACITY_HOURS_PER_DAY} hours each. PTO and holidays aren’t subtracted yet, so a holiday week reads low.${noHourWeeks > 0 ? ` ${noHourWeeks} ${noHourWeeks === 1 ? 'week has' : 'weeks have'} no approved field hours at all — before the clock history starts, or sessions still awaiting approval — and they pull the window’s utilization down.` : ''}`
          : `The roster couldn’t be read${rosterError ? ` (${rosterError})` : ''}, so available hours are estimated from the people who clocked field hours that week — a week nobody worked reads as no capacity.`}{' '}
        Office hours by field people count against capacity, not toward it.
      </p>
    </div>
  )
}
