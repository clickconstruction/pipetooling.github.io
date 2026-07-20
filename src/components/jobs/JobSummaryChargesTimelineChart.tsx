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
 * end-of-line value labels. Data shaping lives in the pure kernel
 * `src/lib/jobChargesTimeline.ts` (unit-tested); this component only adapts props and renders.
 */
import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
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
import { formatCurrency, jobSummaryPartsCostIsZero } from '../../lib/jobs/jobFormatting'
import { resolveJobCurrentPercentFallback } from '../../lib/jobSummaryPercentComplete'
import { laborJobSubCost } from '../../lib/jobs/subLaborCost'
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
  mileageCost: number
  timePerMile: number
}

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

/** Dot renderer for the costs line: source icons (clamped inside the plot) at charge
 * buckets + a bold end-of-line total (anchored left of the point — the right axis owns
 * the gutter now). */
function makeCostsDot(lastIndex: number) {
  return function renderCostsDot(props: TimelineDotProps) {
    const { cx, cy, index, payload } = props
    const key = `costs-dot-${index ?? 'x'}`
    const sources = payload?.chargeSources ?? []
    const isLast = index === lastIndex && payload != null
    if (cx == null || cy == null || (sources.length === 0 && !isLast)) {
      return <g key={key} />
    }
    const iconRowY = Math.max(24, cy - 12)
    return (
      <g key={key}>
        {sources.length > 0 && <circle cx={cx} cy={cy} r={2.5} fill="#dc2626" />}
        {sources.map((s, i) => (
          <text
            key={s}
            x={cx + (i - (sources.length - 1) / 2) * 24}
            y={iconRowY}
            fontSize={22}
            textAnchor="middle"
          >
            {JOB_CHARGE_SOURCE_META[s].icon}
          </text>
        ))}
        {isLast && payload && (
          <text
            x={cx - 8}
            y={cy - 8}
            fontSize={13}
            fontWeight={700}
            textAnchor="end"
            fill="#dc2626"
          >
            ${formatCurrency(payload.expense)}
          </text>
        )}
      </g>
    )
  }
}

/** Dot renderer for the profit line: 💵 payment marker (flips above the point near the
 * chart floor) + a bold end-of-line value label. */
function makeProfitDot(lastIndex: number) {
  return function renderProfitDot(props: TimelineDotProps) {
    const { cx, cy, index, payload } = props
    const key = `profit-dot-${index ?? 'x'}`
    const hasPayment = payload?.hasPaymentMarker === true
    const isLast = index === lastIndex && payload != null
    if (cx == null || cy == null || (!hasPayment && !isLast)) {
      return <g key={key} />
    }
    const paymentY = cy > 190 ? cy - 16 : cy + 26
    return (
      <g key={key}>
        {hasPayment && (
          <>
            <circle cx={cx} cy={cy} r={2.5} fill="#16a34a" />
            <text x={cx} y={paymentY} fontSize={22} textAnchor="middle">
              💵
            </text>
          </>
        )}
        {isLast && payload && (
          <text
            x={cx - 8}
            y={cy + 16}
            fontSize={13}
            fontWeight={700}
            textAnchor="end"
            fill={payload.profit >= 0 ? '#15803d' : '#b91c1c'}
          >
            {signedCurrency(payload.profit)}
          </text>
        )}
      </g>
    )
  }
}

/** Dot renderer for the value line: 🚩 report markers + an end-of-line value label. */
function makeValueDot(lastIndex: number) {
  return function renderValueDot(props: TimelineDotProps) {
    const { cx, cy, index, payload } = props
    const key = `value-dot-${index ?? 'x'}`
    const hasMarker = payload?.hasReportMarker === true
    const isLast = index === lastIndex && payload?.value != null
    if (cx == null || cy == null || (!hasMarker && !isLast)) return <g key={key} />
    return (
      <g key={key}>
        {hasMarker && (
          <>
            <circle cx={cx} cy={cy} r={2.5} fill="#2563eb" />
            <text x={cx} y={cy - 12} fontSize={22} textAnchor="middle">
              🚩
            </text>
          </>
        )}
        {isLast && payload?.value != null && (
          <text
            x={cx - 8}
            y={cy - 6}
            fontSize={13}
            fontWeight={700}
            textAnchor="end"
            fill="#2563eb"
          >
            ${formatCurrency(payload.value)}
          </text>
        )}
      </g>
    )
  }
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
      </div>
      {row.chargeEvents.map((e, i) => (
        <div key={`c-${i}`} style={{ color: 'var(--text-red-900)' }}>
          {JOB_CHARGE_SOURCE_META[e.source].icon} {e.label} — ${formatCurrency(e.amount)}
        </div>
      ))}
      {row.paymentEvents.map((e, i) => (
        <div key={`p-${i}`} style={{ color: '#15803d' }}>
          💵 {e.label} — ${formatCurrency(e.amount)}
        </div>
      ))}
      {row.valueEvents.map((e, i) => (
        <div key={`v-${i}`} style={{ color: 'var(--text-blue-800)' }}>
          🚩 {e.label}
          {e.percent != null ? ` — ${e.percent}% complete` : ' — no completion %'}
        </div>
      ))}
      <div style={{ marginTop: '0.25rem', borderTop: '1px solid var(--border)', paddingTop: '0.25rem' }}>
        <span style={{ color: 'var(--text-red-600)' }}>Cost: ${formatCurrency(row.expense)}</span>
        {row.paymentsToDate > 0 && (
          <span style={{ color: '#15803d', marginLeft: '0.6rem' }}>
            Paid: ${formatCurrency(row.paymentsToDate)}
          </span>
        )}
        <span
          style={{
            fontWeight: 600,
            color: row.profit >= 0 ? '#15803d' : 'var(--text-red-700)',
            marginLeft: '0.6rem',
          }}
        >
          Profit: {signedCurrency(row.profit)}
        </span>
        {row.value != null && (
          <span style={{ color: 'var(--text-link)', marginLeft: '0.6rem' }}>
            Value created: ${formatCurrency(row.value)}
          </span>
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
  mileageCost,
  timePerMile,
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
        ? (mercuryRows ?? []).map((m) => ({
            dateKey: toYmd(m.mercury_transactions?.posted_at),
            amount: Math.abs(m.amount),
            counterpartyName: m.mercury_transactions?.counterparty_name ?? null,
            attributionDisplayName: m.attributionDisplayName,
          }))
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
    )
  }, [loading, row, mercuryRows, invoiceLines, reports, mercuryNeeded, invoicesNeeded, mileageCost, timePerMile])

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
    />
  )
}

/** Presentational chart (shared by Job Summary and the modal Parts-cost sections). Scrolls
 * horizontally once the day-bucket count outgrows the container (~56px per bucket). */
export function JobChargesTimelineChartView({
  data,
  revenue,
  cardChargesExcluded,
}: {
  data: JobChargesTimelineData
  revenue: number | null
  cardChargesExcluded: boolean
}) {
  const lastIndex = data.chartRows.length - 1
  const costsDot = useMemo(() => makeCostsDot(lastIndex), [lastIndex])
  const profitDot = useMemo(() => makeProfitDot(lastIndex), [lastIndex])
  const valueDot = useMemo(() => makeValueDot(lastIndex), [lastIndex])
  const axisDomains = useMemo(() => computeChargesTimelineAxisDomains(data.chartRows), [data])
  // Opt-in second axis: the value-created line's scale (0 → revenue) usually
  // dwarfs cost/profit, so it stays hidden until asked for.
  const [showValueAxis, setShowValueAxis] = useState(false)
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
      <div style={{ width: '100%', overflowX: 'auto', minWidth: 0 }}>
        <div style={{ minWidth: Math.max(520, data.chartRows.length * 56), height: 260 }}>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data.chartRows} margin={{ top: 36, right: 8, left: 8, bottom: 4 }}>
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
              name="Profit"
              stroke="#16a34a"
              strokeWidth={2}
              dot={profitDot}
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
                dot={valueDot}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
        </div>
      </div>
      <p style={{ color: 'var(--text-700)', fontSize: '0.75rem', margin: '0.25rem 0 0' }}>
        <span style={{ color: 'var(--text-red-600)', fontWeight: 600 }}>Red</span> = cost to date ·{' '}
        <span style={{ color: '#16a34a', fontWeight: 600 }}>Green</span> = profit (above the $0 line
        = collected more than it cost)
        {valueShown && (
          <>
            {' · '}
            <span style={{ color: 'var(--text-link)', fontWeight: 600 }}>Blue</span> = value created
            (report % × job total, right axis)
          </>
        )}{' '}
        · 💵 = payment received · 🚩 = field report
      </p>
      <p style={{ color: 'var(--text-faint)', fontSize: '0.6875rem', margin: '0.15rem 0 0' }}>
        Cost sources:{' '}
        {Object.values(JOB_CHARGE_SOURCE_META)
          .map((m) => `${m.icon} ${m.name}`)
          .join(' · ')}
        {data.hasUnknownDateBucket && ' · “No date” bucket holds items without a date'}
        {!data.valueSeriesAvailable &&
          (revenue == null || revenue === 0
            ? ' · Value line hidden: job total not set'
            : ' · Value line hidden: no report or % set on the job')}
        {data.valueFromFallbackPercent &&
          ' · Value point uses the job’s current % (no dated field report)'}
        {cardChargesExcluded && ' · Card charges not included (no Banking access)'}
      </p>
    </div>
  )
}
