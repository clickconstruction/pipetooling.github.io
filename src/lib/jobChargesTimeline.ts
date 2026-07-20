/** Jobs → Job Summary expanded row: "Charges & Value" timeline kernel.
 *
 * Pure data shaping for the per-job step chart: a PROFIT series (cumulative payments received −
 * cumulative expense) built from `jobs_ledger_payments` minus the six cost streams (team labor,
 * sub labor, Mercury card charges, supply-house invoice allocations, tally parts, manual "Other
 * job charges"), plus a VALUE series that steps to (report completion % × job revenue) at each
 * field report. Charges step the line DOWN (red); payments step it UP with those stretches
 * rendered green (see `paymentRiseSegments`); above $0 = the job has collected more than it
 * cost. Rendered by `JobSummaryChargesTimelineChart.tsx`; charge amounts must stay in parity
 * with the `jobSummaryData` memo in `Jobs.tsx` so `endExpense` matches the row's cost columns.
 */
import {
  REPORT_FIELD_LABEL_JOB_COMPLETION,
  REPORT_FIELD_LABEL_LEGACY_WHO,
  tryParsePercent0to100,
} from './reportTemplateFieldDisplay'

export type JobChargeSource =
  | 'team_labor'
  | 'sub_labor'
  | 'mercury_card'
  | 'supply_house'
  | 'tally_part'
  | 'billed_material'

export const JOB_CHARGE_SOURCE_META: Record<JobChargeSource, { icon: string; name: string }> = {
  team_labor: { icon: '👷', name: 'Team labor' },
  sub_labor: { icon: '🔧', name: 'Sub labor' },
  mercury_card: { icon: '💳', name: 'Card charge' },
  supply_house: { icon: '🧾', name: 'Supply house invoice' },
  tally_part: { icon: '📦', name: 'Tally part' },
  billed_material: { icon: '🧱', name: 'Other job charge' },
}

/** One dated cost event; `dateKey` null = the source row had no usable date. */
export type JobChargeEvent = {
  source: JobChargeSource
  /** YYYY-MM-DD in APP_CALENDAR_TZ, or null when the row has no date. */
  dateKey: string | null
  amount: number
  label: string
}

/** One field report on the job; `percent` null = report without a completion %. */
export type JobValueEvent = {
  dateKey: string | null
  percent: number | null
  label: string
}

/** One payment received on the job (`jobs_ledger_payments`); steps the net line DOWN. */
export type JobPaymentEvent = {
  dateKey: string | null
  amount: number
  label: string
}

/** Flatten `jobs_ledger_payments` rows into payment events (note wins over payment_type for the label). */
export function buildJobPaymentEvents(
  payments: Array<{
    dateKey: string | null
    amount: number
    paymentType: string | null
    note: string | null
  }>,
): JobPaymentEvent[] {
  return payments
    .filter((p) => Number(p.amount) > 0)
    .map((p) => {
      const detail = (p.note ?? '').trim() || (p.paymentType ?? '').trim()
      return {
        dateKey: p.dateKey,
        amount: Number(p.amount),
        label: detail ? `Payment — ${detail}` : 'Payment',
      }
    })
}

/** Synthetic leading bucket for events without a date (keeps endExpense reconciled). */
export const JOB_CHARGES_UNKNOWN_DATE_KEY = 'unknown'

/**
 * Normalize a raw date/timestamp to YYYY-MM-DD. Date-only strings (and anything starting with
 * one, e.g. Postgres `date`) pass through as their first 10 chars; anything else is delegated to
 * the injected ISO→YMD converter (callers pass `calendarYmdInAppTzFromIso`, injected so this
 * module stays pure and the timezone policy lives in one place).
 */
export function ymdFromDateOnlyOrIso(
  raw: string | null | undefined,
  isoToYmd: (iso: string) => string,
): string | null {
  const t = (raw ?? '').trim()
  if (!t) return null
  if (/^\d{4}-\d{2}-\d{2}($|[T ])/.test(t)) return t.slice(0, 10)
  const ymd = isoToYmd(t)
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null
}

/** Tally line cost — MUST match the `jobSummaryData` memo in Jobs.tsx (fixture-only vs priced part). */
export function tallyPartEventAmount(row: {
  part_id: string | null
  quantity: number
  price_at_time: number | null
  fixture_cost: number | null
}): number {
  return row.part_id == null
    ? Number(row.fixture_cost ?? 0) * Number(row.quantity)
    : Number(row.price_at_time ?? 0) * Number(row.quantity)
}

export type JobChargeEventsInput = {
  /** Per person, per work date labor cost (from `teamLaborRow.breakdown`). */
  teamLaborBreakdown: Array<{
    personName: string
    byWorkDate: Array<{ workDate: string; hours: number; cost: number }>
  }>
  /** One entry per sub-labor job; caller precomputes amount via `laborJobSubCost`. */
  subLabor: Array<{ dateKey: string | null; amount: number; assignedToName: string }>
  /** Mercury allocations; caller takes `Math.abs(amount)` (parity with partsPerPersonCostSummary). */
  mercury: Array<{
    dateKey: string | null
    amount: number
    counterpartyName: string | null
    attributionDisplayName: string | null
  }>
  supplyHouse: Array<{
    dateKey: string | null
    allocatedAmount: number
    supplyHouseName: string
    invoiceNumber: string
  }>
  tallyParts: Array<{
    dateKey: string | null
    amount: number
    fixtureOrPartName: string
    createdByName: string | null
  }>
  billedMaterials: Array<{ dateKey: string | null; amount: number; description: string | null }>
}

function roundHoursLabel(hours: number): string {
  const r = Math.round(hours * 100) / 100
  return `${r}h`
}

/** Flatten the six cost streams into dated charge events (labels are tooltip text without $). */
export function buildJobChargeEvents(input: JobChargeEventsInput): JobChargeEvent[] {
  const events: JobChargeEvent[] = []
  for (const person of input.teamLaborBreakdown) {
    for (const d of person.byWorkDate) {
      events.push({
        source: 'team_labor',
        dateKey: d.workDate ? d.workDate.slice(0, 10) : null,
        amount: d.cost,
        label: `${person.personName} — team labor (${roundHoursLabel(d.hours)})`,
      })
    }
  }
  for (const s of input.subLabor) {
    events.push({
      source: 'sub_labor',
      dateKey: s.dateKey,
      amount: s.amount,
      label: `${s.assignedToName || 'Sub'} — sub labor`,
    })
  }
  for (const m of input.mercury) {
    const who = m.attributionDisplayName ? ` (${m.attributionDisplayName})` : ''
    events.push({
      source: 'mercury_card',
      dateKey: m.dateKey,
      amount: m.amount,
      label: `${m.counterpartyName || 'Card charge'}${who}`,
    })
  }
  for (const s of input.supplyHouse) {
    events.push({
      source: 'supply_house',
      dateKey: s.dateKey,
      amount: s.allocatedAmount,
      label: `${s.supplyHouseName || 'Supply house'} — invoice ${s.invoiceNumber || '—'}`,
    })
  }
  for (const t of input.tallyParts) {
    const who = t.createdByName ? ` (${t.createdByName})` : ''
    events.push({
      source: 'tally_part',
      dateKey: t.dateKey,
      amount: t.amount,
      label: `${t.fixtureOrPartName || 'Tally part'}${who}`,
    })
  }
  for (const b of input.billedMaterials) {
    events.push({
      source: 'billed_material',
      dateKey: b.dateKey,
      amount: b.amount,
      label: b.description || 'Other job charge',
    })
  }
  return events
}

/** Completion % from a report's `field_values` (new key wins, legacy key fallback) — same parse as `reportSaysJobComplete`. */
export function reportCompletionPercent(
  fieldValues: Record<string, unknown> | null | undefined,
): number | null {
  if (!fieldValues) return null
  const raw =
    fieldValues[REPORT_FIELD_LABEL_JOB_COMPLETION] ?? fieldValues[REPORT_FIELD_LABEL_LEGACY_WHO]
  if (raw == null) return null
  return tryParsePercent0to100(typeof raw === 'string' ? raw : String(raw))
}

export function buildJobValueEvents(
  reports: Array<{
    dateKey: string | null
    createdByName: string | null
    fieldValues: Record<string, unknown> | null
  }>,
): JobValueEvent[] {
  return reports.map((r) => {
    const percent = reportCompletionPercent(r.fieldValues)
    return {
      dateKey: r.dateKey,
      percent,
      label: `Report by ${r.createdByName || 'someone'}`,
    }
  })
}

export type JobChargesTimelineChartRow = {
  /** Position in `chartRows` (drives the per-segment green payment overlays). */
  index: number
  /** `JOB_CHARGES_UNKNOWN_DATE_KEY` or YYYY-MM-DD; the x-axis category. */
  dateKey: string
  dateLabel: string
  /** Cumulative expense at end of this bucket. */
  expense: number
  /** Cumulative payments received at end of this bucket. */
  paymentsToDate: number
  /** Running profit = paymentsToDate − expense (the main line; above 0 = money made). */
  profit: number
  /** Last-known completion% × revenue; null until the first % report (or when revenue missing). */
  value: number | null
  chargeEvents: JobChargeEvent[]
  valueEvents: JobValueEvent[]
  paymentEvents: JobPaymentEvent[]
  /** Unique sources with an event in this bucket (drives the icon stack on the red line). */
  chargeSources: JobChargeSource[]
  hasReportMarker: boolean
  hasPaymentMarker: boolean
}

/** Inclusive row-index range whose profit-line stretch renders green (payment rise). */
export type JobPaymentRiseSegment = { from: number; to: number }

export type JobChargesTimelineData = {
  chartRows: JobChargesTimelineChartRow[]
  /** Reconciles with teamLaborCost + subLaborCost + partsCost for the row. */
  endExpense: number
  endPayments: number
  /** endPayments − endExpense (what the last chart point shows). */
  endProfit: number
  /** Transitions where a payment lifted the profit line; consecutive rises merged. */
  paymentRiseSegments: JobPaymentRiseSegment[]
  valueSeriesAvailable: boolean
  hasUnknownDateBucket: boolean
}

/** 'No date' for the unknown bucket; else e.g. "Jun 12", with ’YY appended when the year differs from the last row's. */
export function formatJobChargesDateLabel(dateKey: string, lastYear: number | null): string {
  if (dateKey === JOB_CHARGES_UNKNOWN_DATE_KEY) return 'No date'
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!m) return dateKey
  const y = Number(m[1])
  const dt = new Date(y, Number(m[2]) - 1, Number(m[3]))
  const base = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (lastYear != null && y !== lastYear) return `${base} ’${String(y).slice(2)}`
  return base
}

/** Left (cost + profit) and right (value created) Y-axis domains for the chart. */
export type ChargesTimelineAxisDomains = {
  /** Cost-to-date + profit axis — same scale family (profit = payments − cost); can be negative. */
  left: [number, number]
  /** Value-created axis (report % × revenue) — shown only when the user toggles it on. */
  right: [number, number]
}

/**
 * Compute the two Y-axis domains. Cost and profit share the LEFT axis — they are
 * the same scale family (profit = payments − cost), so no cross-scale tricks are
 * needed there. Value created (0 → revenue, often much larger) gets the RIGHT
 * axis, whose domain is stretched below zero so the $0 gridline lands at the
 * SAME height on both axes (otherwise dual-axis crossings lie). Padding matches
 * the old single-axis domain (×1.15 + $5 headroom each side).
 */
export function computeChargesTimelineAxisDomains(
  rows: Array<Pick<JobChargesTimelineChartRow, 'expense' | 'profit' | 'value'>>,
): ChargesTimelineAxisDomains {
  let maxLeft = 0
  let minLeft = 0
  let maxValue = 0
  for (const r of rows) {
    if (r.expense > maxLeft) maxLeft = r.expense
    if (r.profit > maxLeft) maxLeft = r.profit
    if (r.profit < minLeft) minLeft = r.profit
    if (r.value != null && r.value > maxValue) maxValue = r.value
  }
  const left1 = maxLeft * 1.15 + 5
  const left0 = minLeft * 1.15 - 5
  // Fraction of the left axis sitting below $0 (left1 ≥ 5 keeps this < 1);
  // the right axis mirrors it so the shared $0 gridline is truthful for both.
  const f = -left0 / (left1 - left0)
  const right1 = maxValue * 1.15 + 5
  const right0 = (-f / (1 - f)) * right1
  return { left: [left0, left1], right: [right0, right1] }
}

export function buildJobChargesTimelineChartData(
  chargeEvents: JobChargeEvent[],
  valueEvents: JobValueEvent[],
  revenue: number | null,
  paymentEvents: JobPaymentEvent[] = [],
): JobChargesTimelineData {
  const bucketKey = (dateKey: string | null): string => dateKey ?? JOB_CHARGES_UNKNOWN_DATE_KEY

  const chargesByKey = new Map<string, JobChargeEvent[]>()
  for (const e of chargeEvents) {
    const k = bucketKey(e.dateKey)
    const list = chargesByKey.get(k)
    if (list) list.push(e)
    else chargesByKey.set(k, [e])
  }
  const valuesByKey = new Map<string, JobValueEvent[]>()
  for (const e of valueEvents) {
    const k = bucketKey(e.dateKey)
    const list = valuesByKey.get(k)
    if (list) list.push(e)
    else valuesByKey.set(k, [e])
  }
  const paymentsByKey = new Map<string, JobPaymentEvent[]>()
  for (const e of paymentEvents) {
    const k = bucketKey(e.dateKey)
    const list = paymentsByKey.get(k)
    if (list) list.push(e)
    else paymentsByKey.set(k, [e])
  }

  const allKeys = new Set<string>([
    ...chargesByKey.keys(),
    ...valuesByKey.keys(),
    ...paymentsByKey.keys(),
  ])
  const hasUnknownDateBucket = allKeys.has(JOB_CHARGES_UNKNOWN_DATE_KEY)
  const datedKeys = [...allKeys].filter((k) => k !== JOB_CHARGES_UNKNOWN_DATE_KEY).sort()
  const orderedKeys = hasUnknownDateBucket
    ? [JOB_CHARGES_UNKNOWN_DATE_KEY, ...datedKeys]
    : datedKeys

  const revenueUsable = revenue != null && revenue > 0
  const lastDatedKey = datedKeys.length > 0 ? datedKeys[datedKeys.length - 1] : undefined
  const lastYear = lastDatedKey ? Number(lastDatedKey.slice(0, 4)) : null

  let runningExpense = 0
  let runningPayments = 0
  let runningValue: number | null = null
  let sawPercentReport = false

  const chartRows: JobChargesTimelineChartRow[] = orderedKeys.map((dateKey, index) => {
    const dayCharges = chargesByKey.get(dateKey) ?? []
    const dayValues = valuesByKey.get(dateKey) ?? []
    const dayPayments = paymentsByKey.get(dateKey) ?? []
    for (const e of dayCharges) runningExpense += e.amount
    for (const p of dayPayments) runningPayments += p.amount
    for (const v of dayValues) {
      if (v.percent != null) {
        sawPercentReport = true
        if (revenueUsable) runningValue = (v.percent / 100) * (revenue as number)
      }
    }
    const chargeSources: JobChargeSource[] = []
    for (const e of dayCharges) {
      if (!chargeSources.includes(e.source)) chargeSources.push(e.source)
    }
    const expense = Math.round(runningExpense * 100) / 100
    const paymentsToDate = Math.round(runningPayments * 100) / 100
    return {
      index,
      dateKey,
      dateLabel: formatJobChargesDateLabel(dateKey, lastYear),
      expense,
      paymentsToDate,
      profit: Math.round((paymentsToDate - expense) * 100) / 100,
      value: runningValue != null ? Math.round(runningValue * 100) / 100 : null,
      chargeEvents: dayCharges,
      valueEvents: dayValues,
      paymentEvents: dayPayments,
      chargeSources,
      hasReportMarker: dayValues.length > 0,
      hasPaymentMarker: dayPayments.length > 0,
    }
  })

  // A transition (i-1 → i) renders green when a payment landed in bucket i and the profit
  // line rose. Same-day charges can outweigh a payment — that transition stays red; the 💵
  // marker + tooltip still surface the payment. Consecutive rises merge.
  const paymentRiseSegments: JobPaymentRiseSegment[] = []
  for (let i = 1; i < chartRows.length; i++) {
    const row = chartRows[i]
    const prev = chartRows[i - 1]
    if (!row || !prev || !row.hasPaymentMarker || row.profit <= prev.profit) continue
    const last = paymentRiseSegments[paymentRiseSegments.length - 1]
    if (last && last.to === i - 1) last.to = i
    else paymentRiseSegments.push({ from: i - 1, to: i })
  }

  const endExpense = Math.round(runningExpense * 100) / 100
  const endPayments = Math.round(runningPayments * 100) / 100
  return {
    chartRows,
    endExpense,
    endPayments,
    endProfit: Math.round((endPayments - endExpense) * 100) / 100,
    paymentRiseSegments,
    valueSeriesAvailable: revenueUsable && sawPercentReport,
    hasUnknownDateBucket,
  }
}
