import { useMemo, type CSSProperties } from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { JobChargesTimelineInputsState } from '../../hooks/useJobChargesTimelineInputs'
import type { JobBurnOverheadState } from '../../hooks/useJobBurnOverhead'
import { buildJobBurn, resolveJobBurnBudget, type JobBurnModel } from '../../lib/jobs/jobBurn'
import { JOB_SUMMARY_VIEW_STORAGE_KEY, readJobSummaryViewPrefs } from '../../lib/jobs/jobSummaryLedgerView'
import { todayYmdInAppTz } from '../../utils/dateUtils'

/**
 * Burn on the Costs tab (v2.3189): are we spending faster than we are finishing?
 * View-model from `buildJobBurn`; this file is layout. Wage roles only — the
 * host gates on `showJobCostBreakdownTeamLabor`, because spend without team
 * labor is not the spend the bid estimated.
 */

const usd0 = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const pct0 = (n: number) => `${Math.round(n)}%`
const dayLabel = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const days1 = (n: number) => `${Math.round(n * 10) / 10} ${Math.round(n * 10) / 10 === 1 ? 'working day' : 'working days'}`

const tileStyle: CSSProperties = {
  background: 'var(--bg-subtle)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.55rem 0.7rem',
  minWidth: 0,
}
const tileK: CSSProperties = { fontSize: '0.65rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }
const tileV: CSSProperties = { fontSize: '1.05rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginTop: 2, lineHeight: 1.2 }
const tileS: CSSProperties = { fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.3 }
const chartBox: CSSProperties = { background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.5rem 0.25rem' }
const chartTitle: CSSProperties = { fontSize: '0.75rem', fontWeight: 600, margin: '0 0 0.2rem 0.25rem', display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }
const chartSub: CSSProperties = { fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.68rem' }
const legendStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '0.6rem', fontSize: '0.68rem', color: 'var(--text-muted)', padding: '0.3rem 0.25rem 0.1rem' }
const swatch = (color: string, dashed = false): CSSProperties => ({
  display: 'inline-block',
  width: 14,
  height: dashed ? 0 : 3,
  borderTop: dashed ? `2px dashed ${color}` : undefined,
  background: dashed ? undefined : color,
  verticalAlign: 'middle',
  marginRight: 5,
  borderRadius: 2,
})
const rowStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem', padding: '0.5rem 0.75rem', borderTop: '1px solid var(--border)', fontSize: '0.875rem' }

const RED = '#ef4444'
const BLUE = '#2563eb'
const VIOLET = '#a855f7'
const AMBER = '#f59e0b'

function readTargetMarginPct(): number | null {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(JOB_SUMMARY_VIEW_STORAGE_KEY) : null
    const t = readJobSummaryViewPrefs(raw).targetTrueMarginPct
    return t > 0 ? t : null
  } catch {
    return null
  }
}

type DailyTipProps = { active?: boolean; payload?: Array<{ payload: JobBurnModel['daily'][number] }> }
function DailyTooltip({ active, payload }: DailyTipProps) {
  if (!active || !payload || payload.length === 0) return null
  const d = payload[0]!.payload
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.4rem 0.6rem', fontSize: '0.75rem', color: 'var(--text-strong)' }}>
      <div style={{ fontWeight: 600 }}>{dayLabel(d.ymd)}</div>
      <div>Team labor {usd0(d.team)} · Sub labor {usd0(d.sub)} · Parts {usd0(d.parts)}</div>
      <div style={{ color: 'var(--text-muted)' }}>Day {usd0(d.total)} · 7-day average {usd0(d.avg7)}</div>
    </div>
  )
}

type CumTipProps = { active?: boolean; payload?: Array<{ payload: JobBurnModel['cumulative'][number] }> }
function CumTooltip({ active, payload }: CumTipProps) {
  if (!active || !payload || payload.length === 0) return null
  const r = payload[0]!.payload
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.4rem 0.6rem', fontSize: '0.75rem', color: 'var(--text-strong)' }}>
      <div style={{ fontWeight: 600 }}>{dayLabel(r.ymd)}</div>
      {r.actual != null ? <div style={{ color: 'var(--text-red-600)' }}>Cost to date {usd0(r.actual)}</div> : null}
      {r.earned != null ? <div style={{ color: 'var(--text-link)' }}>Earned value {usd0(r.earned)}</div> : null}
      {r.actual == null && r.forecast != null ? <div style={{ color: 'var(--text-red-600)' }}>Forecast {usd0(r.forecast)}</div> : null}
    </div>
  )
}

/** The first dated event on the job — charge, payment or report — which says whether the overhead window's start cut history off (v2.3289). */
export function firstEventYmdOf(inputsState: JobChargesTimelineInputsState): string | null {
  if (inputsState.kind !== 'ready') return null
  let first: string | null = null
  const i = inputsState.inputs
  for (const e of [...i.chargeEvents, ...i.paymentEvents, ...i.valueEvents]) if (e.dateKey && (first == null || e.dateKey < first)) first = e.dateKey
  return first
}

export function JobCostsBurnSection({ inputsState, overheadState }: { inputsState: JobChargesTimelineInputsState; /** The host runs `useJobBurnOverhead` once for Burn and the Cost Timeline (v2.3271). */ overheadState: JobBurnOverheadState }) {
  const inputs = inputsState.kind === 'ready' ? inputsState.inputs : null
  const { loading: overheadLoading, overhead } = overheadState

  const model = useMemo(() => {
    if (!inputs) return null
    const budget = resolveJobBurnBudget({ priceUsd: inputs.revenue, bidEstimateUsd: null, targetMarginPct: readTargetMarginPct() })
    return buildJobBurn({
      chargeEvents: inputs.chargeEvents,
      valueEvents: inputs.valueEvents,
      fallbackPercent: inputs.fallbackPercent,
      priceUsd: inputs.revenue,
      budget,
      overhead,
      todayYmd: todayYmdInAppTz(),
    })
  }, [inputs, overhead])

  const header = (sub: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
      <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Burn</div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{sub}</div>
    </div>
  )

  if (inputsState.kind === 'loading' || !model) {
    return (
      <div style={{ marginTop: '0.25rem', display: 'grid', gap: '0.5rem' }}>
        {header('')}
        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0 }}>{inputsState.kind === 'error' ? 'Could not load the job’s costs.' : 'Loading…'}</p>
      </div>
    )
  }

  const m = model
  const budgetSub =
    m.budget == null
      ? 'no job total yet — set the price on the Bill tab'
      : m.budget.source === 'bid_estimate'
        ? 'bid estimate as budget'
        : `budget = price × ${100 - (m.budget.targetMarginPct ?? 0)}% (target margin ${m.budget.targetMarginPct}%)`
  const pctSub = m.percentSource === 'report' ? '% from the latest field report' : m.percentSource === 'job' ? '% from the job (no report %)' : 'no % complete yet'
  const hot = m.status === 'hot'
  const hotTile: CSSProperties = hot ? { borderColor: 'var(--border-red)', boxShadow: 'inset 3px 0 0 ' + RED } : {}
  const hotV: CSSProperties = hot ? { color: 'var(--text-red-600)' } : m.status === 'ok' ? { color: 'var(--text-green-600)' } : {}

  const cumMax = Math.max(m.budget?.usd ?? 0, ...m.cumulative.map((r) => Math.max(r.actual ?? 0, r.earned ?? 0, r.forecast ?? 0)), 1)
  const budgetGoneRow = m.cumulative.find((r) => r.actual == null && m.budget && r.forecast != null && r.forecast >= m.budget.usd - 0.5)

  return (
    <div style={{ marginTop: '0.25rem', display: 'grid', gap: '0.6rem' }}>
      {header(`${budgetSub} · ${pctSub}`)}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.5rem' }}>
        <div style={tileStyle}>
          <div style={tileK}>Spent to date</div>
          <div style={tileV}>{usd0(m.spentUsd)}</div>
          <div style={tileS}>team · subs · parts{m.undatedUsd > 0.5 ? ` · ${usd0(m.undatedUsd)} undated` : ''}</div>
        </div>
        <div style={tileStyle}>
          <div style={tileK}>Budget</div>
          <div style={tileV}>{m.budget ? usd0(m.budget.usd) : '—'}</div>
          <div style={tileS}>{m.budget ? `price ${inputs && inputs.revenue != null ? usd0(inputs.revenue) : '—'}` : 'set the job total'}</div>
        </div>
        <div style={{ ...tileStyle, ...hotTile }}>
          <div style={tileK}>% of budget vs % done</div>
          <div style={{ ...tileV, ...hotV, display: 'flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap' }}>
            <span>{m.spentPctOfBudget != null ? pct0(m.spentPctOfBudget) : '—'}</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>vs</span>
            <span>{m.percentDone != null ? pct0(m.percentDone) : '—'}</span>
          </div>
          <div style={tileS}>
            {m.status === 'early'
              ? `too early to call · ${m.fieldDays} field ${m.fieldDays === 1 ? 'day' : 'days'}`
              : m.leadPts == null
                ? 'needs a budget and a %'
                : m.leadPts > 0.5
                  ? `spend leads progress by ${Math.round(m.leadPts)} pts`
                  : m.leadPts < -0.5
                    ? `progress leads spend by ${Math.round(-m.leadPts)} pts`
                    : 'spend and progress level'}
          </div>
        </div>
        <div style={{ ...tileStyle, ...hotTile }}>
          <div style={tileK}>At completion</div>
          <div style={{ ...tileV, ...hotV }}>{m.eacUsd != null ? usd0(m.eacUsd) : '—'}</div>
          <div style={tileS}>
            {m.marginUsd != null && m.marginPct != null ? (
              <>
                direct cost · margin {usd0(m.marginUsd)} · {pct0(m.marginPct)}
                {m.overhead && m.overhead.trueMarginUsd != null && m.overhead.projectedRemainingUsd != null && m.overhead.trueMarginPct != null ? (
                  <div>
                    + {usd0(m.overhead.shareToDateUsd + m.overhead.projectedRemainingUsd)} overhead share
                    {m.overhead.perFieldDayUsd != null && m.workLeftFieldDays != null ? ` (${usd0(m.overhead.shareToDateUsd)} so far + ${Math.round(m.workLeftFieldDays)} d × ${usd0(m.overhead.perFieldDayUsd)})` : ''}
                    {' → '}true margin <strong style={{ color: m.overhead.trueMarginUsd >= 0 ? 'var(--text-green-600)' : 'var(--text-red-600)' }}>{usd0(m.overhead.trueMarginUsd)} · {pct0(m.overhead.trueMarginPct)}</strong>
                  </div>
                ) : overheadLoading ? (
                  <div>overhead share loading…</div>
                ) : null}
              </>
            ) : m.status === 'early' ? (
              'projection needs 3 field days and 10 %'
            ) : (
              'spent ÷ % done'
            )}
          </div>
        </div>
      </div>

      {/* Charts mount only once there is dated spend — an empty job shows the tiles'
          verdict, not two blank axes (and jsdom has no ResizeObserver for recharts). */}
      {m.daily.some((d) => d.total > 0) ? (
      <div style={chartBox}>
        <div style={chartTitle}>
          Daily spend <span style={chartSub}>last 14 working days · bars are team labor + subs + parts · line is the 7-day average</span>
        </div>
        <div style={{ width: '100%', height: 170 }}>
          <ResponsiveContainer>
            <ComposedChart data={m.daily} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="ymd" tickFormatter={dayLabel} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} interval={1} />
              <YAxis tickFormatter={(v: number) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`)} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} width={40} />
              <Tooltip content={<DailyTooltip />} cursor={{ fill: 'var(--bg-muted)' }} />
              <Bar dataKey="team" stackId="d" fill={RED} isAnimationActive={false} />
              <Bar dataKey="sub" stackId="d" fill={VIOLET} isAnimationActive={false} />
              <Bar dataKey="parts" stackId="d" fill={AMBER} isAnimationActive={false} radius={[2, 2, 0, 0]} />
              <Line type="monotone" dataKey="avg7" stroke="var(--text-muted)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div style={legendStyle}>
          <span><i style={swatch(RED)} />team labor</span>
          <span><i style={swatch(VIOLET)} />sub labor</span>
          <span><i style={swatch(AMBER)} />parts</span>
          <span><i style={swatch('var(--text-muted)')} />7-day average</span>
        </div>
      </div>
      ) : (
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>No spend in the last 14 working days.</p>
      )}

      {m.cumulative.length > 0 ? (
        <div style={chartBox}>
          <div style={chartTitle}>
            Cost against the budget <span style={chartSub}>cumulative · the value line steps at each report</span>
          </div>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <ComposedChart data={m.cumulative} margin={{ top: 14, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="ymd" tickFormatter={dayLabel} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} minTickGap={28} />
                <YAxis domain={[0, Math.ceil(cumMax * 1.08)]} tickFormatter={(v: number) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`)} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} width={44} />
                <Tooltip content={<CumTooltip />} />
                {m.budget ? <ReferenceLine y={m.budget.usd} stroke="var(--text-muted)" strokeDasharray="6 4" label={{ value: 'budget', position: 'insideTopRight', fontSize: 10, fill: 'var(--text-muted)' }} /> : null}
                <Line type="stepAfter" dataKey="earned" stroke={BLUE} strokeWidth={2.2} dot={false} connectNulls isAnimationActive={false} />
                <Line type="monotone" dataKey="actual" stroke={RED} strokeWidth={2.2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="forecast" stroke={RED} strokeWidth={1.8} strokeDasharray="2 4" dot={false} connectNulls isAnimationActive={false} />
                {budgetGoneRow ? <ReferenceLine x={budgetGoneRow.ymd} stroke={RED} strokeDasharray="2 4" /> : null}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div style={legendStyle}>
            <span><i style={swatch(RED)} />actual cost</span>
            <span><i style={swatch(BLUE)} />earned value (% done × budget)</span>
            <span><i style={swatch('var(--text-muted)', true)} />budget</span>
            <span><i style={swatch(RED, true)} />forecast at today’s burn{budgetGoneRow ? ` · budget gone ${dayLabel(budgetGoneRow.ymd)}` : ''}</span>
          </div>
        </div>
      ) : null}

      <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ ...rowStyle, borderTop: 'none' }}>
          <div>
            Burn rate
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>direct $ per field day, last {Math.min(10, m.fieldDays)} field {Math.min(10, m.fieldDays) === 1 ? 'day' : 'days'}</div>
          </div>
          <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{m.burnPerFieldDayUsd != null ? `${usd0(m.burnPerFieldDayUsd)} / day` : m.fieldDays === 0 ? 'no field days yet' : 'idle 30+ days'}</div>
        </div>
        <div style={rowStyle}>
          <div>
            Budget runs out
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{m.workLeftFieldDays === 0 ? 'the job is done' : `at that rate${m.percentDone != null ? `, with ${pct0(100 - m.percentDone)} of the work left` : ''}`}</div>
          </div>
          <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: m.budgetGoneYmd && m.workLeftFieldDays != null && m.budgetGoneInFieldDays != null && m.budgetGoneInFieldDays < m.workLeftFieldDays ? 'var(--text-red-600)' : undefined }}>
            {m.budgetRemainingUsd != null && m.budgetRemainingUsd <= 0
              ? `already over by ${usd0(-m.budgetRemainingUsd)}`
              : m.workLeftFieldDays === 0
                ? `not reached · ${usd0(m.budgetRemainingUsd ?? 0)} under`
                : m.budgetGoneYmd && m.budgetGoneInFieldDays != null
                  ? `${dayLabel(m.budgetGoneYmd)} · ${days1(m.budgetGoneInFieldDays)}`
                  : '—'}
          </div>
        </div>
        <div style={rowStyle}>
          <div>
            Work left at the current pace
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{m.progressPerFieldDay != null ? `${Math.round(m.progressPerFieldDay * 10) / 10} pts of progress per field day so far` : 'needs a % complete'}</div>
          </div>
          <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{m.workLeftFieldDays != null ? (m.workLeftFieldDays === 0 ? 'done' : `≈ ${days1(m.workLeftFieldDays)}`) : '—'}</div>
        </div>
      </div>
    </div>
  )
}
