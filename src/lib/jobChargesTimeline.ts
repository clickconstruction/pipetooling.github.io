/** Jobs → Job Summary expanded row: "Charges & Value" timeline kernel.
 *
 * Pure data shaping for the per-job step chart: a cumulative EXPENSE series built from the six
 * cost streams (team labor, sub labor, Mercury card charges, supply-house invoice allocations,
 * tally parts, manual "Other job charges") and a VALUE series that steps to
 * (report completion % × job revenue) at each field report. Rendered by
 * `JobSummaryChargesTimelineChart.tsx`; amounts here must stay in parity with the
 * `jobSummaryData` memo in `Jobs.tsx` so the red line's end matches the row's cost columns.
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
  /** `JOB_CHARGES_UNKNOWN_DATE_KEY` or YYYY-MM-DD; the x-axis category. */
  dateKey: string
  dateLabel: string
  /** Cumulative expense at end of this bucket. */
  expense: number
  /** Last-known completion% × revenue; null until the first % report (or when revenue missing). */
  value: number | null
  chargeEvents: JobChargeEvent[]
  valueEvents: JobValueEvent[]
  /** Unique sources with an event in this bucket (drives the icon stack on the red line). */
  chargeSources: JobChargeSource[]
  hasReportMarker: boolean
}

export type JobChargesTimelineData = {
  chartRows: JobChargesTimelineChartRow[]
  /** Reconciles with teamLaborCost + subLaborCost + partsCost for the row. */
  endExpense: number
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

export function buildJobChargesTimelineChartData(
  chargeEvents: JobChargeEvent[],
  valueEvents: JobValueEvent[],
  revenue: number | null,
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

  const allKeys = new Set<string>([...chargesByKey.keys(), ...valuesByKey.keys()])
  const hasUnknownDateBucket = allKeys.has(JOB_CHARGES_UNKNOWN_DATE_KEY)
  const datedKeys = [...allKeys].filter((k) => k !== JOB_CHARGES_UNKNOWN_DATE_KEY).sort()
  const orderedKeys = hasUnknownDateBucket
    ? [JOB_CHARGES_UNKNOWN_DATE_KEY, ...datedKeys]
    : datedKeys

  const revenueUsable = revenue != null && revenue > 0
  const lastDatedKey = datedKeys.length > 0 ? datedKeys[datedKeys.length - 1] : undefined
  const lastYear = lastDatedKey ? Number(lastDatedKey.slice(0, 4)) : null

  let runningExpense = 0
  let runningValue: number | null = null
  let sawPercentReport = false

  const chartRows: JobChargesTimelineChartRow[] = orderedKeys.map((dateKey) => {
    const dayCharges = chargesByKey.get(dateKey) ?? []
    const dayValues = valuesByKey.get(dateKey) ?? []
    for (const e of dayCharges) runningExpense += e.amount
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
    return {
      dateKey,
      dateLabel: formatJobChargesDateLabel(dateKey, lastYear),
      expense: Math.round(runningExpense * 100) / 100,
      value: runningValue != null ? Math.round(runningValue * 100) / 100 : null,
      chargeEvents: dayCharges,
      valueEvents: dayValues,
      chargeSources,
      hasReportMarker: dayValues.length > 0,
    }
  })

  return {
    chartRows,
    endExpense: Math.round(runningExpense * 100) / 100,
    valueSeriesAvailable: revenueUsable && sawPercentReport,
    hasUnknownDateBucket,
  }
}
