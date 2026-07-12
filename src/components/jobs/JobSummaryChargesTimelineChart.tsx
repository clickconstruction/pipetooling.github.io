/** Jobs → Job Summary expanded row: "Charges & Value" timeline chart.
 *
 * Main stepAfter line = PROFIT (cumulative payments received − charges): charges step it DOWN
 * in red with per-source icons; payments step it UP with those stretches overlaid in green
 * (one thin green Line per `paymentRiseSegment` — recharts can't color a single line
 * per-segment) and a 💵 marker. Above the dashed $0 line = job has collected more than it
 * cost; both money lines carry end-of-line value labels.
 * Blue stepAfter line = value created — each field report with a completion % steps it to
 * (% × job revenue); reports without a % show a 🚩 marker only. Data shaping lives in the pure
 * kernel `src/lib/jobChargesTimeline.ts` (unit-tested); this component only adapts props and renders.
 */
import { useMemo } from 'react'
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
  JOB_CHARGE_SOURCE_META,
  tallyPartEventAmount,
  ymdFromDateOnlyOrIso,
  type JobChargesTimelineChartRow,
  type JobPaymentRiseSegment,
} from '../../lib/jobChargesTimeline'
import { formatCurrency, jobSummaryPartsCostIsZero } from '../../lib/jobs/jobFormatting'
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

/** Dot renderer for the profit line: source icons (clamped inside the plot), 💵 payment
 * marker (flips above the point near the chart floor), and a bold end-of-line value label. */
function makeProfitDot(lastIndex: number) {
  return function renderProfitDot(props: TimelineDotProps) {
    const { cx, cy, index, payload } = props
    const key = `profit-dot-${index ?? 'x'}`
    const sources = payload?.chargeSources ?? []
    const hasPayment = payload?.hasPaymentMarker === true
    const isLast = index === lastIndex && payload != null
    if (cx == null || cy == null || (sources.length === 0 && !hasPayment && !isLast)) {
      return <g key={key} />
    }
    const iconRowY = Math.max(24, cy - 12)
    const paymentY = cy > 190 ? cy - 16 : cy + 26
    return (
      <g key={key}>
        {(sources.length > 0 || hasPayment) && (
          <circle cx={cx} cy={cy} r={2.5} fill={sources.length === 0 ? '#16a34a' : '#dc2626'} />
        )}
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
        {hasPayment && (
          <text x={cx} y={paymentY} fontSize={22} textAnchor="middle">
            💵
          </text>
        )}
        {isLast && payload && (
          <text
            x={cx + 8}
            y={cy + 4}
            fontSize={13}
            fontWeight={700}
            textAnchor="start"
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
            x={cx + 8}
            y={cy - 6}
            fontSize={13}
            fontWeight={700}
            textAnchor="start"
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
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 6,
        padding: '0.4rem 0.6rem',
        fontSize: '0.75rem',
        maxWidth: 320,
        boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
      }}
    >
      <div style={{ fontWeight: 600, color: '#374151', marginBottom: '0.25rem' }}>
        {row.dateLabel}
      </div>
      {row.chargeEvents.map((e, i) => (
        <div key={`c-${i}`} style={{ color: '#7f1d1d' }}>
          {JOB_CHARGE_SOURCE_META[e.source].icon} {e.label} — ${formatCurrency(e.amount)}
        </div>
      ))}
      {row.paymentEvents.map((e, i) => (
        <div key={`p-${i}`} style={{ color: '#15803d' }}>
          💵 {e.label} — ${formatCurrency(e.amount)}
        </div>
      ))}
      {row.valueEvents.map((e, i) => (
        <div key={`v-${i}`} style={{ color: '#1e40af' }}>
          🚩 {e.label}
          {e.percent != null ? ` — ${e.percent}% complete` : ' — no completion %'}
        </div>
      ))}
      <div style={{ marginTop: '0.25rem', borderTop: '1px solid #f3f4f6', paddingTop: '0.25rem' }}>
        <span style={{ color: '#dc2626' }}>Cost: ${formatCurrency(row.expense)}</span>
        {row.paymentsToDate > 0 && (
          <span style={{ color: '#15803d', marginLeft: '0.6rem' }}>
            Paid: ${formatCurrency(row.paymentsToDate)}
          </span>
        )}
        <span
          style={{
            fontWeight: 600,
            color: row.profit >= 0 ? '#15803d' : '#b91c1c',
            marginLeft: '0.6rem',
          }}
        >
          Profit: {signedCurrency(row.profit)}
        </span>
        {row.value != null && (
          <span style={{ color: '#2563eb', marginLeft: '0.6rem' }}>
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
    return buildJobChargesTimelineChartData(chargeEvents, valueEvents, revenue, paymentEvents)
  }, [loading, row, mercuryRows, invoiceLines, reports, mercuryNeeded, invoicesNeeded, mileageCost, timePerMile])

  const lastIndex = data ? data.chartRows.length - 1 : -1
  const profitDot = useMemo(() => makeProfitDot(lastIndex), [lastIndex])
  const valueDot = useMemo(() => makeValueDot(lastIndex), [lastIndex])

  if (loading) {
    return (
      <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: '0 0 0.75rem' }}>
        Loading charge timeline…
      </p>
    )
  }
  if (!data || data.chartRows.length === 0) {
    return (
      <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: '0 0 0.75rem' }}>
        No dated cost events or reports yet.
      </p>
    )
  }

  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ width: '100%', minHeight: 260, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data.chartRows} margin={{ top: 36, right: 72, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
              minTickGap={8}
              padding={{ left: 28, right: 12 }}
            />
            <YAxis
              width={56}
              tick={{ fontSize: 10 }}
              domain={[
                (dataMin: number) => Math.min(0, dataMin) * 1.15 - 5,
                (dataMax: number) => Math.max(0, dataMax) * 1.15 + 5,
              ]}
              tickFormatter={(v: number) => `$${Math.round(v).toLocaleString('en-US')}`}
            />
            <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="4 4" />
            <Tooltip content={<JobChargesTimelineTooltip />} />
            <Line
              type="stepAfter"
              dataKey="profit"
              name="Profit"
              stroke="#dc2626"
              strokeWidth={2}
              dot={profitDot}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
              connectNulls
            />
            {data.paymentRiseSegments.map((seg: JobPaymentRiseSegment) => (
              <Line
                key={`payseg-${seg.from}-${seg.to}`}
                type="stepAfter"
                dataKey={(r: JobChargesTimelineChartRow) =>
                  r.index >= seg.from && r.index <= seg.to ? r.profit : null
                }
                stroke="#16a34a"
                strokeWidth={2.5}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
                legendType="none"
              />
            ))}
            {data.valueSeriesAvailable && (
              <Line
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
      <p style={{ color: '#374151', fontSize: '0.75rem', margin: '0.25rem 0 0' }}>
        <span style={{ color: '#dc2626', fontWeight: 600 }}>Red falls</span> = money out ·{' '}
        <span style={{ color: '#16a34a', fontWeight: 600 }}>Green rises</span> = payment received
        (💵) · <span style={{ color: '#2563eb', fontWeight: 600 }}>Blue</span> = value created
        (report % × job total) · 🚩 = field report · above the $0 line ={' '}
        <span style={{ color: '#15803d', fontWeight: 600 }}>profit</span>
      </p>
      <p style={{ color: '#9ca3af', fontSize: '0.6875rem', margin: '0.15rem 0 0' }}>
        Cost sources:{' '}
        {Object.values(JOB_CHARGE_SOURCE_META)
          .map((m) => `${m.icon} ${m.name}`)
          .join(' · ')}
        {data.hasUnknownDateBucket && ' · “No date” bucket holds items without a date'}
        {!data.valueSeriesAvailable &&
          (row.job.revenue == null || Number(row.job.revenue) === 0
            ? ' · Value line hidden: job total not set'
            : ' · Value line hidden: no report has a completion %')}
        {cardChargesExcluded && ' · Card charges not included (no Banking access)'}
      </p>
    </div>
  )
}
