import { useMemo, useState, type CSSProperties } from 'react'
import type { JobSummaryCompareBundle } from '../../hooks/useJobSummaryView'
import type { JobDayLedger } from '../../lib/jobs/jobDayLedger'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { STALE_OPEN_DAY_OPTIONS, bucketJobCycleByMonth, jobCycleRows, staleOpenJobs, summarizeJobCycle, type StaleOpenJobInput } from '../../lib/jobs/jobSummaryCycle'
import type { JobSummaryEnrichedRow } from '../../lib/jobs/jobSummaryLedgerView'
import { formatStagesNextDateLabel } from '../../lib/stagesUpcomingSchedule'

/**
 * Job Summary → Cycle (v2.2823): work → bill → paid, and who's stuck. Two
 * medians per bill month on one day axis (last field day → bill, bill →
 * paid) with a 30-day line, tiles for the whole cycle and the slowest payer,
 * and the stale-open list — open jobs with no field work for N days — each
 * row a door to the job. Presentational; kernel in `lib/jobs/jobSummaryCycle.ts`.
 */
type Props = {
  rows: readonly JobSummaryEnrichedRow[]
  ledger: JobDayLedger | null
  ledgerLoading: boolean
  startYmd: string
  endYmd: string
  todayYmd: string
  /** Every job the page knows, for the stale-open list (Show doesn't apply to it). */
  allJobs: readonly StaleOpenJobInput[]
  userNameById: ReadonlyMap<string, string | null | undefined>
  compare: JobSummaryCompareBundle | null
  compareLabel: string
  showMoney: boolean
  onOpenJob: (jobNumber: string) => void
}

const WORK_TO_BILL = '#2563eb'
const BILL_TO_PAID = '#d97706'

const tile: CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '0.45rem 0.65rem', background: 'var(--bg-subtle)', minWidth: 0 }
const tileK: CSSProperties = { fontSize: '0.64rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }
const tileV: CSSProperties = { fontSize: '1.05rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em', color: 'var(--text-strong)' }
const tileS: CSSProperties = { fontSize: '0.7rem', color: 'var(--text-700)' }
const segWrap: CSSProperties = { display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)' }
const segLabel: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', whiteSpace: 'nowrap' }
function segButton(active: boolean, last: boolean): CSSProperties {
  return { padding: '0.3rem 0.65rem', fontSize: '0.78rem', fontWeight: 600, border: 'none', borderRight: last ? 'none' : '1px solid var(--border)', background: active ? '#2563eb' : 'transparent', color: active ? '#fff' : 'var(--text-700)', cursor: 'pointer', whiteSpace: 'nowrap' }
}
const money = (v: number | null | undefined): string => (v == null ? '—' : `${v < 0 ? '−' : ''}${formatUsdNoCents(Math.abs(v))}`)
const days = (v: number | null | undefined): string => (v == null ? '—' : `${Math.round(v)} d`)

function Delta({ now, prior, vs }: { now: number | null; prior: number | null; vs: string }) {
  if (now == null || prior == null) return <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>— vs {vs}</div>
  const d = now - prior
  const flat = Math.abs(d) < 0.5
  // Fewer days is the good direction on both lags.
  return <div style={{ fontSize: '0.7rem', fontVariantNumeric: 'tabular-nums', color: flat ? 'var(--text-muted)' : d < 0 ? 'var(--text-green-700)' : 'var(--text-red-700)' }}>{flat ? '•' : d > 0 ? '▲' : '▼'} {Math.abs(Math.round(d))} d vs {vs}</div>
}

export default function JobSummaryCycleView({ rows, ledger, ledgerLoading, startYmd, endYmd, todayYmd, allJobs, userNameById, compare, compareLabel, showMoney, onOpenJob }: Props) {
  const cycle = useMemo(() => jobCycleRows(rows, ledger), [rows, ledger])
  const summary = useMemo(() => summarizeJobCycle(cycle), [cycle])
  const months = useMemo(() => bucketJobCycleByMonth(cycle, startYmd, endYmd), [cycle, startYmd, endYmd])
  const prior = useMemo(() => (compare ? summarizeJobCycle(jobCycleRows(compare.rows, compare.ledger)) : null), [compare])
  const [minIdle, setMinIdle] = useState(21)
  const stale = useMemo(() => staleOpenJobs(allJobs, todayYmd, minIdle, ledger), [allJobs, todayYmd, minIdle, ledger])
  const openCount = useMemo(() => allJobs.filter((j) => j.status !== 'billed' && j.status !== 'paid').length, [allJobs])
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  // ---- chart geometry ----
  const W = 1000
  const H = 250
  const L = 44
  const R = 12
  const T = 18
  const B = 30
  const plotH = H - T - B
  const n = Math.max(1, months.length)
  const cw = (W - L - R) / n
  const bw = Math.min(cw * 0.3, 40)
  const dataMax = Math.max(0, ...months.map((m) => Math.max(m.medianWorkToBill ?? 0, m.medianBillToPaid ?? 0)))
  // Fit the data: a company that bills same-day and gets paid in three shouldn't read as a flat line under a 45-day ceiling.
  const maxY = Math.max(8, dataMax * 1.25)
  const yOf = (v: number) => T + plotH * (1 - v / maxY)
  const gridStep = maxY <= 12 ? 2 : maxY <= 30 ? 5 : maxY <= 60 ? 15 : maxY <= 120 ? 30 : 60
  const showThirty = maxY >= 30
  const gridVals: number[] = []
  for (let v = 0; v <= maxY; v += gridStep) gridVals.push(v)
  const maxIdle = Math.max(1, ...stale.map((s) => s.idleDays))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9.5rem, 1fr))', gap: '0.5rem' }}>
        <div style={tile}>
          <div style={tileK}>Work → bill</div>
          <div style={tileV}>{days(summary.medianWorkToBill)}</div>
          <div style={tileS}>median · last field day to the bill · {summary.billedJobs} billed</div>
          {prior ? <Delta now={summary.medianWorkToBill} prior={prior.medianWorkToBill} vs={compareLabel} /> : null}
        </div>
        <div style={tile}>
          <div style={tileK}>Bill → paid</div>
          <div style={tileV}>{days(summary.medianBillToPaid)}</div>
          <div style={tileS}>median · bill to the money · {summary.paidJobs} paid</div>
          {prior ? <Delta now={summary.medianBillToPaid} prior={prior.medianBillToPaid} vs={compareLabel} /> : null}
        </div>
        <div style={tile}>
          <div style={tileK}>Whole cycle</div>
          <div style={tileV}>{days(summary.medianCycle)}</div>
          <div style={tileS}>median · last day on site to cash</div>
          {prior ? <Delta now={summary.medianCycle} prior={prior.medianCycle} vs={compareLabel} /> : null}
        </div>
        <div style={tile}>
          <div style={tileK}>Slowest payer</div>
          <div style={{ ...tileV, color: summary.slowestPayer ? 'var(--text-red-700)' : tileV.color }}>{summary.slowestPayer ? days(summary.slowestPayer.medianDays) : '—'}</div>
          <div style={tileS}>{summary.slowestPayer ? `${summary.slowestPayer.label} · ${summary.slowestPayer.jobs} jobs` : 'needs two paid jobs on one payer'}</div>
          {summary.fastestPayer ? <div style={{ fontSize: '0.7rem', color: 'var(--text-green-700)' }}>fastest {summary.fastestPayer.label} · {days(summary.fastestPayer.medianDays)}</div> : null}
        </div>
        <div style={tile}>
          <div style={tileK}>Open jobs</div>
          <div style={{ ...tileV, color: stale.length > 0 ? 'var(--text-red-700)' : tileV.color }}>{openCount}</div>
          <div style={tileS}>
            {stale.length} idle {minIdle}+ days{showMoney && stale.length > 0 ? ` · ${money(stale.reduce((a, s) => a + s.contractUsd, 0))} of contract` : ''}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(16rem, 2fr)', gap: '0.75rem', alignItems: 'start' }}>
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.5rem 0.5rem 0.25rem', minWidth: 0 }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Median days from work to bill and from bill to paid, by bill month" style={{ display: 'block' }} onMouseLeave={() => setHoverIdx(null)}>
            {gridVals.map((v) => (
              <g key={v}>
                <line x1={L} x2={W - R} y1={yOf(v)} y2={yOf(v)} stroke="var(--border)" strokeWidth={1} />
                <text x={L - 6} y={yOf(v) + 4} textAnchor="end" fontSize={10} fill="var(--text-muted)">
                  {v}
                </text>
              </g>
            ))}
            <text transform={`rotate(-90 11 ${T + plotH / 2})`} x={11} y={T + plotH / 2} textAnchor="middle" fontSize={10} fill="var(--text-muted)" style={{ pointerEvents: 'none' }}>
              median days
            </text>
            {showThirty ? (
              <>
                <line x1={L} x2={W - R} y1={yOf(30)} y2={yOf(30)} stroke="var(--text-muted)" strokeDasharray="4 3" />
                <text x={W - R - 2} y={yOf(30) - 4} textAnchor="end" fontSize={9.5} fill="var(--text-muted)">
                  30 days
                </text>
              </>
            ) : null}
            {hoverIdx != null ? <rect x={L + hoverIdx * cw} y={T} width={cw} height={plotH} fill="var(--text-strong)" opacity={0.06} style={{ pointerEvents: 'none' }} /> : null}
            {months.map((m, i) => {
              const cx = L + i * cw + cw / 2
              return (
                <g key={m.ym}>
                  {m.medianWorkToBill != null ? <rect x={cx - bw - 1} y={yOf(m.medianWorkToBill)} width={bw} height={Math.max(1.5, yOf(0) - yOf(m.medianWorkToBill))} rx={3} fill={WORK_TO_BILL} /> : null}
                  {m.medianBillToPaid != null ? <rect x={cx + 1} y={yOf(m.medianBillToPaid)} width={bw} height={Math.max(1.5, yOf(0) - yOf(m.medianBillToPaid))} rx={3} fill={BILL_TO_PAID} /> : null}
                  {m.medianWorkToBill != null ? (
                    <text x={cx - bw / 2 - 1} y={yOf(m.medianWorkToBill) - 4} textAnchor="middle" fontSize={9.5} fill="var(--text-muted)">
                      {Math.round(m.medianWorkToBill)}
                    </text>
                  ) : null}
                  {m.medianBillToPaid != null ? (
                    <text x={cx + bw / 2 + 1} y={yOf(m.medianBillToPaid) - 4} textAnchor="middle" fontSize={9.5} fill={m.medianBillToPaid > 30 ? 'var(--text-red-700)' : 'var(--text-muted)'} fontWeight={m.medianBillToPaid > 30 ? 700 : 400}>
                      {Math.round(m.medianBillToPaid)}
                    </text>
                  ) : null}
                  <text x={cx} y={T + plotH + 16} textAnchor="middle" fontSize={10.5} fill="var(--text-muted)">
                    {m.label.replace(/ \d{4}$/, '')}
                    {i === 0 || m.ym.endsWith('-01') ? ` ${m.ym.slice(0, 4)}` : ''}
                  </text>
                  <rect x={L + i * cw} y={T} width={cw} height={plotH} fill="transparent" onMouseEnter={() => setHoverIdx(i)}>
                    <title>{`${m.label} · ${m.billed} ${m.billed === 1 ? 'job' : 'jobs'} billed · work → bill ${days(m.medianWorkToBill)} · ${m.paid} paid so far · bill → paid ${days(m.medianBillToPaid)}`}</title>
                  </rect>
                </g>
              )
            })}
          </svg>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-700)', padding: '0.35rem 0.25rem 0.2rem' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <i style={{ display: 'inline-block', width: 12, height: 8, borderRadius: 2, background: WORK_TO_BILL }} />
              work → bill (median days)
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <i style={{ display: 'inline-block', width: 12, height: 8, borderRadius: 2, background: BILL_TO_PAID }} />
              bill → paid (median days)
            </span>
            {showThirty ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <i style={{ display: 'inline-block', width: 14, height: 0, borderTop: '1px dashed var(--text-muted)' }} />
                30 days
              </span>
            ) : (
              <span style={{ color: 'var(--text-green-700)' }}>every month’s medians are under 30 days</span>
            )}
            <span style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}>by the month the bill went out · hover a month</span>
          </div>
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.5rem 0.65rem', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={segLabel}>Stale open</span>
            <span style={segWrap} role="group" aria-label="Idle days">
              {STALE_OPEN_DAY_OPTIONS.map((o, i) => (
                <button key={o.key} type="button" aria-pressed={minIdle === o.key} title={o.title} onClick={() => setMinIdle(o.key)} style={segButton(minIdle === o.key, i === STALE_OPEN_DAY_OPTIONS.length - 1)}>
                  {o.label}
                </button>
              ))}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>open, no field work since</span>
          </div>
          {stale.length === 0 ? (
            <p style={{ margin: '0.25rem 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{ledgerLoading ? 'Loading the day ledger…' : `Nothing open has sat idle ${minIdle} days.`}</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 300, overflow: 'auto' }}>
              {stale.slice(0, 40).map((s) => (
                <li key={s.jobId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.25rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.78rem' }}>
                  <b style={{ minWidth: '2.6rem', fontVariantNumeric: 'tabular-nums', color: 'var(--text-strong)' }}>{s.idleDays} d</b>
                  <span style={{ display: 'inline-block', height: 6, borderRadius: 3, background: BILL_TO_PAID, width: Math.round(16 + 70 * (s.idleDays / maxIdle)), flex: '0 0 auto' }} />
                  <button
                    type="button"
                    onClick={() => onOpenJob(s.number)}
                    title={`Open ${s.number} on the Jobs view${s.lastWorkYmd ? ` · last field day ${formatStagesNextDateLabel(s.lastWorkYmd)}` : ''}`}
                    style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 'none', background: 'transparent', padding: 0, font: 'inherit', color: 'var(--text-link)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    <b>{s.number}</b> {s.name}
                    <span style={{ color: 'var(--text-muted)' }}>
                      {' '}
                      · {s.gcLabel}
                      {s.masterUserId ? ` · ${userNameById.get(s.masterUserId) ?? '—'}` : ''}
                      {showMoney && s.contractUsd > 0 ? ` · ${money(s.contractUsd)}` : ''}
                    </span>
                  </button>
                </li>
              ))}
              {stale.length > 40 ? <li style={{ padding: '0.25rem 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>… {stale.length - 40} more</li> : null}
            </ul>
          )}
          <p style={{ margin: '0.4rem 0 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Every open job on the ledger, whatever Show says. Idle = today minus the last approved field day (else the job’s last work or creation date). Click a row to open it.</p>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        Work → bill runs from the last approved field day to the earliest invoice’s billed date; bill → paid runs to the last payment once the job is paid in full. Both by the month the bill went out. Jobs billed before their last field day read 0.
      </p>
    </div>
  )
}
