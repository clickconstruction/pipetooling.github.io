/** Jobs → Job Summary expanded row: "Charges & Value" timeline chart.
 *
 * Red stepAfter line = cumulative expense (team labor, sub labor, card charges, supply-house
 * invoices, tally parts, other job charges), with per-source icons at each day's step.
 * Green stepAfter line = value created — each field report with a completion % steps it to
 * (% × job revenue); reports without a % show a 🚩 marker only. Data shaping lives in the pure
 * kernel `src/lib/jobChargesTimeline.ts` (unit-tested); this component only adapts props and renders.
 */
import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  buildJobChargeEvents,
  buildJobChargesTimelineChartData,
  buildJobValueEvents,
  JOB_CHARGE_SOURCE_META,
  tallyPartEventAmount,
  ymdFromDateOnlyOrIso,
  type JobChargesTimelineChartRow,
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

function renderExpenseDot(props: TimelineDotProps) {
  const { cx, cy, index, payload } = props
  const key = `expense-dot-${index ?? 'x'}`
  const sources = payload?.chargeSources ?? []
  if (cx == null || cy == null || sources.length === 0) return <g key={key} />
  return (
    <g key={key}>
      <circle cx={cx} cy={cy} r={2.5} fill="#dc2626" />
      {sources.map((s, i) => (
        <text
          key={s}
          x={cx + (i - (sources.length - 1) / 2) * 24}
          y={cy - 12}
          fontSize={22}
          textAnchor="middle"
        >
          {JOB_CHARGE_SOURCE_META[s].icon}
        </text>
      ))}
    </g>
  )
}

function renderValueDot(props: TimelineDotProps) {
  const { cx, cy, index, payload } = props
  const key = `value-dot-${index ?? 'x'}`
  if (cx == null || cy == null || !payload?.hasReportMarker) return <g key={key} />
  return (
    <g key={key}>
      <circle cx={cx} cy={cy} r={2.5} fill="#16a34a" />
      <text x={cx} y={cy + 26} fontSize={22} textAnchor="middle">
        🚩
      </text>
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
      {row.valueEvents.map((e, i) => (
        <div key={`v-${i}`} style={{ color: '#14532d' }}>
          🚩 {e.label}
          {e.percent != null ? ` — ${e.percent}% complete` : ' — no completion %'}
        </div>
      ))}
      <div style={{ marginTop: '0.25rem', borderTop: '1px solid #f3f4f6', paddingTop: '0.25rem' }}>
        <span style={{ color: '#dc2626' }}>Expense to date: ${formatCurrency(row.expense)}</span>
        {row.value != null && (
          <span style={{ color: '#16a34a', marginLeft: '0.6rem' }}>
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
    const revenue = row.job.revenue != null ? Number(row.job.revenue) : null
    return buildJobChargesTimelineChartData(chargeEvents, valueEvents, revenue)
  }, [loading, row, mercuryRows, invoiceLines, reports, mercuryNeeded, invoicesNeeded, mileageCost, timePerMile])

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
          <LineChart data={data.chartRows} margin={{ top: 36, right: 20, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="dateLabel" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={8} />
            <YAxis
              width={56}
              tick={{ fontSize: 10 }}
              domain={[0, 'auto']}
              tickFormatter={(v: number) => `$${Math.round(v).toLocaleString('en-US')}`}
            />
            <Tooltip content={<JobChargesTimelineTooltip />} />
            <Line
              type="stepAfter"
              dataKey="expense"
              name="Expense"
              stroke="#dc2626"
              strokeWidth={2}
              dot={renderExpenseDot}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
              connectNulls
            />
            {data.valueSeriesAvailable && (
              <Line
                type="stepAfter"
                dataKey="value"
                name="Value created"
                stroke="#16a34a"
                strokeWidth={2}
                dot={renderValueDot}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p style={{ color: '#6b7280', fontSize: '0.6875rem', margin: '0.25rem 0 0' }}>
        <span style={{ color: '#dc2626', fontWeight: 600 }}>Red</span> = cost to date (
        {Object.values(JOB_CHARGE_SOURCE_META)
          .map((m) => `${m.icon} ${m.name}`)
          .join(' · ')}
        ) · <span style={{ color: '#16a34a', fontWeight: 600 }}>Green</span> = value created
        (report completion % × job total) · 🚩 = field report
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
