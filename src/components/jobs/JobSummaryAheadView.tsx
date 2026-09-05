import { useMemo, useState, type CSSProperties } from 'react'
import { useAheadData } from '../../hooks/useAheadData'
import { useFieldRoster } from '../../hooks/useFieldRoster'
import type { JobDayLedger } from '../../lib/jobs/jobDayLedger'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { buildAheadSeries } from '../../lib/jobs/jobSummaryAhead'
import { buildCapacitySeries } from '../../lib/jobs/jobSummaryCapacity'
import type { JobSummaryEnrichedRow, JobSummaryTotals } from '../../lib/jobs/jobSummaryLedgerView'
import { ymdToDayNumber } from '../../lib/jobs/jobRunningTimeline'
import { formatStagesNextDateLabel } from '../../lib/stagesUpcomingSchedule'

/**
 * Job Summary → Ahead (v2.2830): the one forward-looking view. Remaining
 * value on open jobs, won bids not yet started, booked backlog in weeks at
 * this window's pace, expected true profit at the window margin and the
 * target, and eight weeks of field days booked against crew capacity with
 * won-bid starts marked. Presentational; kernel in `lib/jobs/jobSummaryAhead.ts`.
 */
type Props = {
  /** Every enriched row (not the Show filter) — open jobs are open whatever the table shows. */
  allRows: readonly JobSummaryEnrichedRow[]
  totals: JobSummaryTotals
  ledger: JobDayLedger | null
  startYmd: string
  endYmd: string
  todayYmd: string
  targetTrueMarginPct: number
  showMoney: boolean
}

const BOOKED = '#2563eb'
const BID = '#0891b2'
const tile: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '0.45rem 0.65rem', background: 'var(--bg-subtle)', minWidth: 0 }
const tileK: CSSProperties = { fontSize: '0.64rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }
const tileV: CSSProperties = { fontSize: '1.05rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em', color: 'var(--text-strong)' }
const tileS: CSSProperties = { fontSize: '0.7rem', color: 'var(--text-700)' }
const money = (v: number | null | undefined): string => (v == null ? '—' : `${v < 0 ? '−' : ''}${formatUsdNoCents(Math.abs(v))}`)
const pct = (v: number | null | undefined): string => (v == null ? '—' : `${Math.round(v)}%`)

export default function JobSummaryAheadView({ allRows, totals, ledger, startYmd, endYmd, todayYmd, targetTrueMarginPct, showMoney }: Props) {
  const data = useAheadData(true, todayYmd)
  const { people } = useFieldRoster(true)
  const crewNow = useMemo(() => buildCapacitySeries({ ledger, people }).crewNow, [ledger, people])
  const windowDays = ymdToDayNumber(endYmd) - ymdToDayNumber(startYmd) + 1
  const series = useMemo(
    () =>
      buildAheadSeries({
        rows: allRows,
        bids: data?.bids ?? [],
        linkedBidIds: data?.linkedBidIds ?? new Set(),
        blocks: data?.blocks ?? [],
        todayYmd,
        crewNow,
        windowRevenueUsd: totals.revenueUsd,
        windowDays,
        trueMarginPct: showMoney ? totals.trueMarginPct : null,
        targetTrueMarginPct: showMoney ? targetTrueMarginPct : 0,
      }),
    [allRows, data, todayYmd, crewNow, totals.revenueUsd, totals.trueMarginPct, windowDays, showMoney, targetTrueMarginPct],
  )
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const W = 1000
  const H = 240
  const L = 44
  const R = 12
  const T = 22
  const B = 30
  const plotH = H - T - B
  const n = series.weeks.length
  const cw = (W - L - R) / n
  const bw = Math.min(cw * 0.5, 80)
  const maxY = Math.max(10, ...series.weeks.map((w) => Math.max(w.personDays, w.capacityDays))) * 1.15
  const yOf = (v: number) => T + plotH * (1 - v / maxY)
  const gridStep = maxY <= 30 ? 5 : maxY <= 80 ? 10 : 25
  const gridVals: number[] = []
  for (let v = 0; v <= maxY; v += gridStep) gridVals.push(v)
  const capacity = series.weeks[0]?.capacityDays ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9.5rem, 1fr))', gap: '0.5rem' }}>
        <div style={tile}>
          <div style={tileK}>Remaining on open jobs</div>
          <div style={tileV}>{money(series.remainingUsd)}</div>
          <div style={tileS}>
            {series.openJobs} {series.openJobs === 1 ? 'job' : 'jobs'} · contract minus earned
          </div>
        </div>
        <div style={tile}>
          <div style={tileK}>Won, not marked started</div>
          <div style={tileV}>{data ? money(series.wonNotStartedUsd) : '…'}</div>
          <div style={tileS}>
            {series.wonNotStarted} {series.wonNotStarted === 1 ? 'bid' : 'bids'}
            {series.wonNoDate > 0 ? ` · ${series.wonNoDate} with no start date` : ''}
            {series.wonStartPassed > 0 ? ` · ${series.wonStartPassed} past the start date` : ''}
          </div>
        </div>
        <div style={tile}>
          <div style={tileK}>Booked backlog</div>
          <div style={tileV}>{data ? money(series.backlogUsd) : '…'}</div>
          <div style={tileS}>{series.backlogWeeks == null ? 'no revenue in the window to pace against' : `${series.backlogWeeks.toFixed(1)} weeks at this window’s pace`}</div>
        </div>
        {showMoney ? (
          <div style={tile}>
            <div style={tileK}>Expected true profit</div>
            <div style={{ ...tileV, color: 'var(--text-green-700)' }}>{data ? money(series.expectedTrueProfitUsd) : '…'}</div>
            <div style={tileS}>
              at this window’s {pct(totals.trueMarginPct)} margin{series.expectedAtTargetUsd != null ? ` · ${money(series.expectedAtTargetUsd)} at the ${targetTrueMarginPct}% target` : ''}
            </div>
          </div>
        ) : null}
        <div style={tile}>
          <div style={tileK}>Field days booked</div>
          <div style={{ ...tileV, color: series.capacityDaysNext4 > 0 && series.bookedDaysNext4 / series.capacityDaysNext4 < 0.6 ? 'var(--text-amber-800)' : tileV.color }}>{data ? `${series.bookedDaysNext4} d` : '…'}</div>
          <div style={tileS}>next 4 weeks{series.capacityDaysNext4 > 0 ? ` · ${pct((series.bookedDaysNext4 / series.capacityDaysNext4) * 100)} of ${series.capacityDaysNext4} crew-days` : ''}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(16rem, 2fr)', gap: '0.75rem', alignItems: 'start' }}>
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.5rem 0.5rem 0.25rem', minWidth: 0 }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Field days booked per week for the next eight weeks, against crew capacity" style={{ display: 'block' }} onMouseLeave={() => setHoverIdx(null)}>
            {gridVals.map((v) => (
              <g key={v}>
                <line x1={L} x2={W - R} y1={yOf(v)} y2={yOf(v)} stroke="var(--border)" strokeWidth={1} />
                <text x={L - 6} y={yOf(v) + 4} textAnchor="end" fontSize={10} fill="var(--text-muted)">
                  {v}
                </text>
              </g>
            ))}
            <text transform={`rotate(-90 11 ${T + plotH / 2})`} x={11} y={T + plotH / 2} textAnchor="middle" fontSize={10} fill="var(--text-muted)" style={{ pointerEvents: 'none' }}>
              field days
            </text>
            {capacity > 0 ? (
              <g style={{ pointerEvents: 'none' }}>
                <line x1={L} x2={W - R} y1={yOf(capacity)} y2={yOf(capacity)} stroke="var(--text-muted)" strokeDasharray="4 3" />
                <text x={W - R - 2} y={yOf(capacity) - 4} textAnchor="end" fontSize={9.5} fill="var(--text-muted)">
                  capacity {capacity} field days / wk ({crewNow} crew)
                </text>
              </g>
            ) : null}
            {hoverIdx != null ? <rect x={L + hoverIdx * cw} y={T} width={cw} height={plotH} fill="var(--text-strong)" opacity={0.06} style={{ pointerEvents: 'none' }} /> : null}
            {series.weeks.map((w, i) => {
              const x = L + i * cw + (cw - bw) / 2
              const isThis = i === 0
              return (
                <g key={w.weekStartYmd}>
                  {w.personDays > 0 ? <rect x={x} y={yOf(w.personDays)} width={bw} height={yOf(0) - yOf(w.personDays)} rx={3} fill={BOOKED} opacity={0.9} /> : null}
                  {w.personDays > 0 ? (
                    <text x={x + bw / 2} y={yOf(w.personDays) - 4} textAnchor="middle" fontSize={10} fontWeight={700} fill="var(--text-700)">
                      {w.personDays}
                    </text>
                  ) : null}
                  {w.bidStarts.map((b, k) => (
                    <g key={b.id}>
                      <rect x={x + bw / 2 - 5 + k * 6} y={T + 2} width={10} height={10} transform={`rotate(45 ${x + bw / 2 + k * 6} ${T + 7})`} fill={BID} />
                    </g>
                  ))}
                  {isThis ? <rect x={L + i * cw + 1} y={T} width={cw - 2} height={plotH} fill="none" stroke="var(--text-red-700)" strokeDasharray="3 3" /> : null}
                  <text x={L + i * cw + cw / 2} y={T + plotH + 16} textAnchor="middle" fontSize={10.5} fill="var(--text-muted)">
                    {formatStagesNextDateLabel(w.weekStartYmd).replace(/^\w+ /, '')}
                  </text>
                  <rect x={L + i * cw} y={T} width={cw} height={plotH} fill="transparent" onMouseEnter={() => setHoverIdx(i)}>
                    <title>{`week of ${formatStagesNextDateLabel(w.weekStartYmd)} · ${w.personDays} field days booked on ${w.jobsBooked} ${w.jobsBooked === 1 ? 'job' : 'jobs'} · capacity ${w.capacityDays}${w.bidStarts.length ? ` · won bids starting: ${w.bidStarts.map((b) => `${b.label} (${money(b.valueUsd)})`).join(', ')}` : ''}`}</title>
                  </rect>
                </g>
              )
            })}
          </svg>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-700)', padding: '0.35rem 0.25rem 0.2rem' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <i style={{ display: 'inline-block', width: 12, height: 8, borderRadius: 2, background: BOOKED }} />
              field days on the schedule (person-days)
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <i style={{ display: 'inline-block', width: 8, height: 8, background: BID, transform: 'rotate(45deg)' }} />
              won bid’s estimated start
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <i style={{ display: 'inline-block', width: 12, height: 8, border: '1px dashed var(--text-red-700)', borderRadius: 2 }} />
              this week
            </span>
            <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>hover a week</span>
          </div>
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.5rem 0.65rem', minWidth: 0 }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>Won, not marked started</div>
          {!data ? (
            <p style={{ margin: '0.25rem 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading bids and the schedule…</p>
          ) : series.notStarted.length === 0 ? (
            <p style={{ margin: '0.25rem 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Every won bid has a job.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 300, overflow: 'auto' }}>
              {series.notStarted.slice(0, 30).map((b) => (
                <li key={b.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '0.25rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.78rem' }}>
                  <span style={{ minWidth: '5.2rem', fontVariantNumeric: 'tabular-nums', color: b.startYmd == null ? 'var(--text-amber-800)' : b.startYmd < todayYmd ? 'var(--text-red-700)' : 'var(--text-strong)', fontWeight: 600 }}>
                    {b.startYmd == null ? 'no date' : formatStagesNextDateLabel(b.startYmd)}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.label}</span>
                  <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{money(b.valueUsd)}</span>
                </li>
              ))}
            </ul>
          )}
          <p style={{ margin: '0.4rem 0 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Bids whose outcome is still “won” — set it to “started or complete” once the job begins and it leaves this list. {series.wonNoDate > 0 ? 'Amber = no estimated start date, so it can’t be placed on the chart. ' : ''}Set the date on the bid and it lands in its week.</p>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        Remaining value uses the same earned-revenue rule as the Jobs view (contract × % complete). Capacity is the field roster × 5 days. Pace is this window’s revenue per week.
        {data?.errors.length ? ` Couldn’t read: ${data.errors.join('; ')}.` : ''}
      </p>
    </div>
  )
}
