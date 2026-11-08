/** Jobs → Job Summary expanded row: "Charges & Value" timeline chart.
 *
 * stepAfter chart. LEFT axis: red COST-TO-DATE line (steps up as money goes out, carries the
 * per-source icons) and green PROFIT line (cumulative payments received − costs; rises only on
 * payments, marked 💵) — same scale family, so they share one axis. The blue VALUE-CREATED
 * line (each field report with a completion % steps it to % × job revenue; reports without a %
 * show a 🚩 marker only) lives on an opt-in RIGHT axis behind a "Value created (right axis)"
 * toggle, OFF by default — its scale (0 → revenue) usually dwarfs cost/profit. When shown, the
 * two axes share one $0 gridline — `computeChargesTimelineAxisDomains` aligns their zero
 * heights (unit-tested) so the dashed $0 reference is truthful for both; vertical comparisons
 * BETWEEN axes are otherwise meaningless (standard dual-axis caveat). All lines carry
 * end-of-line value labels, drawn as one column by `ChargesTimelineEndLabels` over the pure
 * `src/lib/jobs/chartEndLabels.ts` (v2.6718: drawn one per line they crossed each other on a
 * site's chart and sat under the icons). Data shaping lives in the pure kernel
 * `src/lib/jobChargesTimeline.ts` (unit-tested); this component only adapts props and renders.
 */
import { cardEventRowsFromJobSummaryRows } from '../../lib/jobs/jobCardChargeEvents'
import { useMemo, useState } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Customized,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  buildJobChargeEvents,
  buildJobChargesTimelineChartData,
  buildJobPaymentEvents,
  buildJobValueEvents,
  computeChargesTimelineAxisDomains,
  JOB_CHARGE_SOURCE_META,
  tallyPartEventAmount,
  ymdFromDateOnlyOrIso,
  type JobChargesTimelineChartRow,
  type JobChargesTimelineData,
} from '../../lib/jobChargesTimeline'
import type { JobOverheadDayLine } from '../../lib/jobs/jobDayLedger'
import { endLabelWidth, iconRowSpan, iconRowY, marksWithin, paymentMarkerY, placeEndLabels, type ChartMark, type EndLabelWant } from '../../lib/jobs/chartEndLabels'
import { formatCurrency, jobSummaryPartsCostIsZero } from '../../lib/jobs/jobFormatting'
import { resolveJobCurrentPercentFallback } from '../../lib/jobSummaryPercentComplete'
import { laborJobSubCost } from '../../lib/jobs/subLaborCost'
import { chartCashLegendLabel } from '../../lib/jobs/profitLabels'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import type {
  JobSummaryInvoiceAllocationLine,
  JobSummaryMercuryAllocationRow,
  JobSummaryReportRow,
} from '../../types/jobSummary'
import type { JobSummaryRow } from './JobsJobSummaryTab'

type Props = {
  row: JobSummaryRow
  /** undefined = still loading (lazy per-expand fetch in Jobs.tsx). */
  mercuryRows: JobSummaryMercuryAllocationRow[] | undefined
  invoiceLines: JobSummaryInvoiceAllocationLine[] | undefined
  reports: JobSummaryReportRow[] | undefined
  canAccessBankingForParts: boolean
  /** False when wage events are left out of the chart (pay-privacy gate) — the green line then says "before team labor" (v2.2852). */
  teamLaborIncluded: boolean
  mileageCost: number
  timePerMile: number
  /** The row's overhead day lines (v2.3271) — the amber band stacked on cost. Omit to draw the plain chart. */
  overheadDays?: JobOverheadDayLine[]
}

/** Amber = overhead, the app's existing overhead ink (Days view carry note, hygiene chips). */
const OVERHEAD_FILL = '#f59e0b'
const OVERHEAD_STROKE = '#d97706'

/** Loose shape recharts passes to custom dot renderers. */
type TimelineDotProps = {
  cx?: number
  cy?: number
  index?: number
  payload?: JobChargesTimelineChartRow
}

/** Signed money label: +$166.21 / −$83.79. */
function signedCurrency(n: number): string {
  return `${n < 0 ? '−' : '+'}$${formatCurrency(Math.abs(n))}`
}

/** Dot renderer for the costs line: source icons (clamped inside the plot) at charge buckets.
 * The end-of-line total is `ChargesTimelineEndLabels`'s (v2.6718). */
function makeCostsDot(iconsOnTrueCost = false) {
  return function renderCostsDot(props: TimelineDotProps) {
    const { cx, cy, index, payload } = props
    const key = `costs-dot-${index ?? 'x'}`
    // With the overhead band on, the icon row rides the band's top edge (see makeTrueCostDot).
    const sources = iconsOnTrueCost ? [] : payload?.chargeSources ?? []
    if (cx == null || cy == null || sources.length === 0) {
      return <g key={key} />
    }
    const rowY = iconRowY(cy)
    return (
      <g key={key}>
        <circle cx={cx} cy={cy} r={2.5} fill="#dc2626" />
        {sources.map((s, i) => (
          <text
            key={s}
            x={cx + (i - (sources.length - 1) / 2) * 24}
            y={rowY}
            fontSize={22}
            textAnchor="middle"
          >
            {JOB_CHARGE_SOURCE_META[s].icon}
          </text>
        ))}
      </g>
    )
  }
}

/** Dot renderer for the true-cost edge (v2.3271): the source icons ride the band's top so they
 * never sit inside the fill. */
function renderTrueCostDot(props: TimelineDotProps) {
  const { cx, cy, index, payload } = props
  const key = `true-cost-dot-${index ?? 'x'}`
  const sources = payload?.chargeSources ?? []
  if (cx == null || cy == null || sources.length === 0) return <g key={key} />
  const rowY = iconRowY(cy)
  return (
    <g key={key}>
      <circle cx={cx} cy={cy} r={2.5} fill={OVERHEAD_STROKE} />
      {sources.map((s, i) => (
        <text key={s} x={cx + (i - (sources.length - 1) / 2) * 24} y={rowY} fontSize={22} textAnchor="middle">
          {JOB_CHARGE_SOURCE_META[s].icon}
        </text>
      ))}
    </g>
  )
}

/** Dot renderer for the profit line: 💵 payment marker (flips above the point near the chart floor). */
function renderProfitDot(props: TimelineDotProps) {
  const { cx, cy, index, payload } = props
  const key = `profit-dot-${index ?? 'x'}`
  if (cx == null || cy == null || payload?.hasPaymentMarker !== true) {
    return <g key={key} />
  }
  return (
    <g key={key}>
      <circle cx={cx} cy={cy} r={2.5} fill="#16a34a" />
      <text x={cx} y={paymentMarkerY(cy)} fontSize={22} textAnchor="middle">
        💵
      </text>
    </g>
  )
}

/** Dot renderer for the value line: 🚩 report markers. */
function renderValueDot(props: TimelineDotProps) {
  const { cx, cy, index, payload } = props
  const key = `value-dot-${index ?? 'x'}`
  if (cx == null || cy == null || payload?.hasReportMarker !== true) return <g key={key} />
  return (
    <g key={key}>
      <circle cx={cx} cy={cy} r={2.5} fill="#2563eb" />
      <text x={cx} y={cy - 12} fontSize={22} textAnchor="middle">
        🚩
      </text>
    </g>
  )
}

/** What recharts hands a `Customized` layer: the axes with their scales and the plot's box. */
type ChartStateProps = {
  xAxisMap?: Record<string, { scale?: ((v: unknown) => number) & { bandwidth?: () => number } }>
  yAxisMap?: Record<string, { scale?: (v: number) => number }>
  offset?: { top?: number; height?: number }
}

const END_LABEL_LINE_HEIGHT = 15

/**
 * The end-of-line labels as one column at the last point (v2.6718): cost, true cost, cash position and
 * value, each wanting to sit just above or below its line, spread by `placeEndLabels` so no two overlap,
 * clear of every mark their text reaches across (the icon rows, the 💵 and the 🚩 of the last buckets)
 * and inside the plot. One layer knows every line's end, which the per-line dot renderers never did.
 */
function ChargesTimelineEndLabels({ xAxisMap, yAxisMap, offset, rows, overheadShown, valueShown }: ChartStateProps & { rows: readonly JobChargesTimelineChartRow[]; overheadShown: boolean; valueShown: boolean }) {
  const xAxis = xAxisMap ? Object.values(xAxisMap)[0] : undefined
  const dollars = yAxisMap?.dollars?.scale
  const last = rows[rows.length - 1]
  if (!last || !xAxis?.scale || !dollars) return null
  const scale = xAxis.scale
  const xOf = (row: JobChargesTimelineChartRow) => {
    const at = scale(row.dateLabel)
    return Number.isFinite(at) ? at + (scale.bandwidth ? scale.bandwidth() / 2 : 0) : null
  }
  const cx = xOf(last)
  if (cx == null) return null
  const costY = dollars(last.expense)
  const trueCostY = overheadShown ? dollars(last.trueCost) : null
  const cashY = dollars(last.profit)
  const valueScale = yAxisMap?.value?.scale
  const valueY = valueShown && last.value != null && valueScale ? valueScale(last.value) : null
  const wants: EndLabelWant[] = [
    ...(trueCostY != null ? [{ key: 'trueCost', lineY: trueCostY, side: 'above' as const }] : []),
    { key: 'cost', lineY: costY, side: overheadShown ? ('below' as const) : ('above' as const) },
    { key: 'cash', lineY: cashY, side: 'below' as const },
    ...(valueY != null ? [{ key: 'value', lineY: valueY, side: 'above' as const }] : []),
  ]
  const texts: Record<string, string> = {
    trueCost: `$${formatCurrency(last.trueCost)} true cost`,
    cost: `$${formatCurrency(last.expense)}`,
    cash: signedCurrency(last.profit),
    value: `$${formatCurrency(last.value ?? 0)}`,
  }
  // The marks the labels' text reaches across: every bucket's icon row, 💵 and 🚩 within the widest label's reach of the end.
  const reachLeft = cx - 8 - Math.max(...wants.map((w) => endLabelWidth(texts[w.key] ?? '')))
  const marks: ChartMark[] = []
  for (const row of rows) {
    const x = xOf(row)
    if (x == null || x + 60 < reachLeft) continue
    if (row.chargeSources.length > 0) marks.push({ x, halfWidth: 12 * (row.chargeSources.length - 1) + 11, ...iconRowSpan(iconRowY(dollars(overheadShown ? row.trueCost : row.expense))) })
    if (row.hasPaymentMarker) marks.push({ x, halfWidth: 11, ...iconRowSpan(paymentMarkerY(dollars(row.profit))) })
    if (valueShown && row.hasReportMarker && row.value != null && valueScale) marks.push({ x, halfWidth: 11, ...iconRowSpan(valueScale(row.value) - 12) })
  }
  const obstacles = marksWithin(marks, reachLeft, cx - 8)
  const top = 2
  const bottom = (offset?.top ?? 0) + (offset?.height ?? 300)
  const placed = placeEndLabels(wants, { lineHeight: END_LABEL_LINE_HEIGHT, top, bottom, obstacles })
  const label = (key: string, fill: string, text: string, stroke = true) => (
    <text key={key} x={cx - 8} y={placed.get(key)} dominantBaseline="middle" fontSize={13} fontWeight={700} textAnchor="end" fill={fill} stroke={stroke ? 'var(--surface)' : undefined} strokeWidth={stroke ? 2 : undefined} paintOrder={stroke ? 'stroke' : undefined} data-end-label={key}>
      {text}
    </text>
  )
  return (
    <g data-testid="charges-timeline-end-labels">
      {trueCostY != null && label('trueCost', OVERHEAD_STROKE, texts.trueCost!)}
      {label('cost', '#dc2626', texts.cost!)}
      {label('cash', last.profit >= 0 ? '#15803d' : '#b91c1c', texts.cash!)}
      {valueY != null && label('value', '#2563eb', texts.value!, false)}
    </g>
  )
}

type TimelineTooltipProps = {
  active?: boolean
  payload?: Array<{ payload?: JobChargesTimelineChartRow }>
}

function JobChargesTimelineTooltip({ active, payload }: TimelineTooltipProps) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '0.4rem 0.6rem',
        fontSize: '0.75rem',
        maxWidth: 320,
        boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
      }}
    >
      <div style={{ fontWeight: 600, color: 'var(--text-700)', marginBottom: '0.25rem' }}>
        {row.dateLabel}
        {row.overheadOnlyBucket ? <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · overhead landed since the last charge</span> : null}
      </div>
      {row.chargeEvents.map((e, i) => (
        <div key={`c-${i}`} style={{ color: 'var(--text-red-900)' }}>
          {JOB_CHARGE_SOURCE_META[e.source].icon} {e.label} — ${formatCurrency(e.amount)}
        </div>
      ))}
      {row.paymentEvents.map((e, i) => (
        <div key={`p-${i}`} style={{ color: 'var(--text-green-700)' }}>
          💵 {e.label} — ${formatCurrency(e.amount)}
        </div>
      ))}
      {row.valueEvents.map((e, i) => (
        <div key={`v-${i}`} style={{ color: 'var(--text-blue-800)' }}>
          {e.kind === 'manual' ? '✎' : '🚩'} {e.label}
          {e.percent != null ? ` — ${e.percent}% complete` : ' — no completion %'}
        </div>
      ))}
      <div style={{ marginTop: '0.25rem', borderTop: '1px solid var(--border)', paddingTop: '0.25rem' }}>
        <div style={{ color: 'var(--text-red-600)' }}>Cost: ${formatCurrency(row.expense)}</div>
        {row.overheadToDate > 0 && (
          <>
            <div style={{ color: 'var(--text-amber-800)' }}>
              Overhead to date: ${formatCurrency(row.overheadToDate)}
              {row.overheadCarryToDate > 0 ? ` · by hours $${formatCurrency(row.overheadActivityToDate)} · carry $${formatCurrency(row.overheadCarryToDate)}` : ''}
            </div>
            <div style={{ color: 'var(--text-amber-800)', fontWeight: 600 }}>True cost: ${formatCurrency(row.trueCost)}</div>
          </>
        )}
        {row.paymentsToDate > 0 && (
          <div style={{ color: 'var(--text-green-700)' }}>
            Paid: ${formatCurrency(row.paymentsToDate)}
          </div>
        )}
        <div
          style={{
            fontWeight: 600,
            color: row.profit >= 0 ? 'var(--text-green-700)' : 'var(--text-red-700)',
          }}
        >
          Cash position: {signedCurrency(row.profit)}
        </div>
        {row.value != null && (
          <div style={{ color: 'var(--text-link)' }}>
            Value created: ${formatCurrency(row.value)}
          </div>
        )}
      </div>
    </div>
  )
}

export default function JobSummaryChargesTimelineChart({
  row,
  mercuryRows,
  invoiceLines,
  reports,
  canAccessBankingForParts,
  teamLaborIncluded,
  mileageCost,
  timePerMile,
  overheadDays,
}: Props) {
  // `> 0` mirrors the lazy-load gates in Jobs.tsx exactly — never wait on a fetch that won't fire.
  const mercuryNeeded = canAccessBankingForParts && row.cardCharges > 0
  const invoicesNeeded = row.invoicesFromSupplyHouses > 0
  const cardChargesExcluded = !canAccessBankingForParts && !jobSummaryPartsCostIsZero(row.cardCharges)
  const loading =
    (mercuryNeeded && mercuryRows === undefined) ||
    (invoicesNeeded && invoiceLines === undefined) ||
    reports === undefined

  const data = useMemo(() => {
    if (loading) return null
    const toYmd = (raw: string | null | undefined) => ymdFromDateOnlyOrIso(raw, calendarYmdInAppTzFromIso)
    const chargeEvents = buildJobChargeEvents({
      teamLaborBreakdown: (row.teamLaborRow?.breakdown ?? []).map((b) => ({
        personName: b.personName,
        byWorkDate: b.byWorkDate,
      })),
      subLabor: row.subLaborJobs.map((lj) => ({
        dateKey: toYmd(lj.job_date ?? lj.created_at),
        amount: laborJobSubCost(lj, mileageCost, timePerMile),
        assignedToName: lj.assigned_to_name,
      })),
      mercury: mercuryNeeded
        ? // The row's parts cost's rule, signed, fuel as its own ⛽ stream — so the line ends on it.
          cardEventRowsFromJobSummaryRows(mercuryRows ?? [], toYmd)
        : [],
      supplyHouse: invoicesNeeded
        ? (invoiceLines ?? []).map((l) => ({
            dateKey: toYmd(l.invoice_date),
            allocatedAmount: l.allocated_amount,
            supplyHouseName: l.supply_house_name,
            invoiceNumber: l.invoice_number,
          }))
        : [],
      tallyParts: row.tallyPartsForJob.map((t) => ({
        dateKey: toYmd(t.created_at),
        amount: tallyPartEventAmount(t),
        fixtureOrPartName: t.part_name ?? t.fixture_name,
        createdByName: t.created_by_name,
      })),
      billedMaterials: (row.job.materials ?? []).map((m) => ({
        dateKey: toYmd(m.created_at),
        amount: Number(m.amount ?? 0),
        description: m.description,
      })),
    })
    const valueEvents = buildJobValueEvents(
      (reports ?? []).map((r) => ({
        dateKey: toYmd(r.created_at),
        createdByName: r.users?.name ?? null,
        fieldValues: r.field_values,
      })),
    )
    const paymentEvents = buildJobPaymentEvents(
      (row.job.payments ?? []).map((p) => ({
        dateKey: toYmd(p.paid_on ?? p.created_at),
        amount: Number(p.amount ?? 0),
        paymentType: p.payment_type,
        note: p.note,
      })),
    )
    const revenue = row.job.revenue != null ? Number(row.job.revenue) : null
    return buildJobChargesTimelineChartData(
      chargeEvents,
      valueEvents,
      revenue,
      paymentEvents,
      resolveJobCurrentPercentFallback(row.job),
      (overheadDays ?? []).map((l) => ({ dateKey: l.ymd, amount: l.shareUsd, activityUsd: l.activityUsd, carryUsd: l.carryUsd })),
    )
  }, [loading, row, mercuryRows, invoiceLines, reports, mercuryNeeded, invoicesNeeded, mileageCost, timePerMile, overheadDays])

  if (loading) {
    return (
      <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: '0 0 0.75rem' }}>
        Loading charge timeline…
      </p>
    )
  }
  if (!data || data.chartRows.length === 0) {
    return (
      <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: '0 0 0.75rem' }}>
        No dated cost events or reports yet.
      </p>
    )
  }

  return (
    <JobChargesTimelineChartView
      data={data}
      revenue={row.job.revenue != null ? Number(row.job.revenue) : null}
      cardChargesExcluded={cardChargesExcluded}
      teamLaborIncluded={teamLaborIncluded}
    />
  )
}

/** Presentational chart (shared by Job Summary and the modal Parts-cost sections). Always
 * fits the container width — no horizontal scrolling (owner call, v2.2327); recharts
 * compresses the day buckets to fit. */
export function JobChargesTimelineChartView({
  data,
  revenue,
  cardChargesExcluded,
  teamLaborIncluded = true,
  overheadSinceLabel = null,
  valueHiddenNote,
  compact = false,
  valueWords = '(report % × job total, right axis)',
}: {
  data: JobChargesTimelineData
  revenue: number | null
  cardChargesExcluded: boolean
  /**
   * What the key says when the value line is hidden (v2.6493): omitted, the job's own reason (no total, no report);
   * null, nothing, for a chart that has no value line to hide, the Development page's Timeline before its value series.
   */
  valueHiddenNote?: string | null
  /** A shorter plot for a phone's width (v2.6493). */
  compact?: boolean
  /** The key's words after *Blue = value created* (v2.6499): a site's chart sums every job's. */
  valueWords?: string
  /** When the overhead window's floor cut off part of the job's history (v2.3289): the first day charged, e.g. "Feb 19, 2026". */
  overheadSinceLabel?: string | null
  /** See `Props.teamLaborIncluded`; defaults to the owner's full-cost reading. */
  teamLaborIncluded?: boolean
}) {
  const overheadShown = data.overheadSeriesAvailable
  const costsDot = useMemo(() => makeCostsDot(overheadShown), [overheadShown])
  const axisDomains = useMemo(() => computeChargesTimelineAxisDomains(data.chartRows), [data])
  // Opt-in second axis: the value-created line's scale (0 → revenue) usually
  // dwarfs cost/profit, so it stays hidden until asked for.
  const [showValueAxis, setShowValueAxis] = useState(false)
  // Legend details (marker + cost-source key) fold behind an ⓘ (owner call, v2.1692).
  const valueShown = data.valueSeriesAvailable && showValueAxis

  return (
    <div style={{ marginBottom: '0.75rem' }}>
      {data.valueSeriesAvailable && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 2 }}>
          <label
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={showValueAxis}
              onChange={(e) => setShowValueAxis(e.target.checked)}
            />
            Value created (right axis)
          </label>
        </div>
      )}
      <div style={{ width: '100%', minWidth: 0, height: compact ? 260 : 320 }}>
        <ResponsiveContainer width="100%" height={compact ? 260 : 320}>
          {/* ComposedChart (v2.3271): the overhead band is an Area under two Lines. */}
          <ComposedChart data={data.chartRows} margin={{ top: 36, right: 8, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
              minTickGap={8}
              padding={{ left: 28, right: 12 }}
            />
            <YAxis
              yAxisId="dollars"
              width={56}
              tick={{ fontSize: 10 }}
              domain={axisDomains.left}
              tickFormatter={(v: number) => `$${Math.round(v).toLocaleString('en-US')}`}
            />
            {valueShown && (
              <YAxis
                yAxisId="value"
                orientation="right"
                width={56}
                tick={{ fontSize: 10, fill: '#2563eb' }}
                domain={axisDomains.right}
                tickFormatter={(v: number) => `$${Math.round(v).toLocaleString('en-US')}`}
              />
            )}
            <ReferenceLine yAxisId="dollars" y={0} stroke="#9ca3af" strokeDasharray="4 4" />
            <Tooltip content={<JobChargesTimelineTooltip />} />
            {overheadShown && (
              // The overhead band (v2.3271): the fill between cost and true cost, drawn under both lines.
              <Area
                yAxisId="dollars"
                type="stepAfter"
                dataKey="overheadBand"
                name="Overhead"
                stroke="none"
                fill={OVERHEAD_FILL}
                fillOpacity={0.22}
                activeDot={false}
                isAnimationActive={false}
                connectNulls
                legendType="none"
              />
            )}
            {overheadShown && (
              <Line
                yAxisId="dollars"
                type="stepAfter"
                dataKey="trueCost"
                name="True cost"
                stroke={OVERHEAD_STROKE}
                strokeWidth={1.5}
                dot={renderTrueCostDot}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
                connectNulls
              />
            )}
            <Line
              yAxisId="dollars"
              type="stepAfter"
              dataKey="expense"
              name="Cost to date"
              stroke="#dc2626"
              strokeWidth={2}
              dot={costsDot}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
              connectNulls
            />
            <Line
              yAxisId="dollars"
              type="stepAfter"
              dataKey="profit"
              name="Cash position"
              stroke="#16a34a"
              strokeWidth={2}
              dot={renderProfitDot}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
              connectNulls
            />
            {valueShown && (
              <Line
                yAxisId="value"
                type="stepAfter"
                dataKey="value"
                name="Value created"
                stroke="#2563eb"
                strokeWidth={2}
                dot={renderValueDot}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
                connectNulls
              />
            )}
            {/* The end-of-line labels as one column (v2.6718): drawn last, over every line. */}
            <Customized component={<ChargesTimelineEndLabels rows={data.chartRows} overheadShown={overheadShown} valueShown={valueShown} />} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p style={{ color: 'var(--text-700)', fontSize: '0.75rem', margin: '0.25rem 0 0', textAlign: 'center' }}>
        <span style={{ color: 'var(--text-red-600)', fontWeight: 600 }}>Red</span> = cost to date ·{' '}
        <span style={{ color: '#16a34a', fontWeight: 600 }}>Green</span> = {chartCashLegendLabel(teamLaborIncluded)}
        {overheadShown && (
          <>
            {' · '}
            <span style={{ color: OVERHEAD_STROKE, fontWeight: 600 }}>Amber</span> = overhead landed so far, stacked on cost (true cost on top)
            {overheadSinceLabel ? ` · since ${overheadSinceLabel}, where office cost begins` : ''}
          </>
        )}
        {valueShown && (
          <>
            {' · '}
            <span style={{ color: 'var(--text-link)', fontWeight: 600 }}>Blue</span> = value created {valueWords}
          </>
        )}
      </p>
      {/* The marker key is always on (v2.3178, owner call) — the 👷 team-labor marker was invisible behind a link. */}
      <p style={{ color: 'var(--text-faint)', fontSize: '0.6875rem', margin: '0.15rem 0 0', textAlign: 'center' }}>
          💵 = payment received · 🚩 = field report · Cost sources:{' '}
          {Object.values(JOB_CHARGE_SOURCE_META)
            .map((m) => `${m.icon} ${m.name}`)
            .join(' · ')}
          {data.hasUnknownDateBucket && ' · “No date” bucket holds items without a date'}
          {!data.valueSeriesAvailable &&
            (valueHiddenNote === undefined
              ? revenue == null || revenue === 0
                ? ' · Value line hidden: job total not set'
                : ' · Value line hidden: no report or % set on the job'
              : valueHiddenNote
                ? ` · ${valueHiddenNote}`
                : '')}
          {data.valueFromFallbackPercent &&
            ' · Value point uses the job’s current % (no dated field report)'}
          {cardChargesExcluded && ' · Card charges not included (no Banking access)'}
        </p>
    </div>
  )
}
