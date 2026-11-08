/**
 * The Money look's Timeline (v2.6493, punch list #257): the Job Summary's Charges & Value chart at the
 * scale of a development, for devs and controllers. Every job's charge events merged in date order on
 * one red line, the cash position in green; the overhead band and value created follow in the train.
 * The kernel is the Job Summary's own (`jobChargesTimeline.ts`): each job's events are built the way
 * its chart builds them, tagged with the job, folded per job and source for the tooltip, merged and
 * handed to `buildJobChargesTimelineChartData`, so the red line ends on the sum of the jobs' own ends.
 * The cost events come from the very rows `useSiteCosts` totals for the Costs column and the Scoreboard
 * (`siteChargeEventsFromCostRows`), so the three say one number. Pure; the reads are the page's hooks.
 */
import { mercuryLinesFromRows, supplyLinesFromRows, tallyLinesFromRows } from '../../../supabase/functions/_shared/jobMaterialsCostLines'
import { jobSubLaborInputsFromRows } from '../../../supabase/functions/_shared/jobSubLaborInputs'
import { laborJobSubCost } from '../../../supabase/functions/_shared/subLaborCost'
import {
  JOB_CHARGE_SOURCE_META,
  buildJobChargeEvents,
  buildJobChargesTimelineChartData,
  buildJobManualPercentEvents,
  buildJobPaymentEvents,
  buildJobValueEvents,
  type JobChargeEvent,
  type JobChargeSource,
  type JobChargesTimelineChartRow,
  type JobChargesTimelineData,
  type JobOverheadDayInput,
  type JobPaymentEvent,
  type JobValueEvent,
} from '../jobChargesTimeline'
import { buildCategoryTagLookups, categoryTagForCharge, pickFuelTag, type CategoryTagMemberRow, type CategoryTagRow } from '../banking/categoryTags'
import { cardEventRowsFromSnapshotLines } from '../jobs/jobCardChargeEvents'
import { scoreboardPct } from './scoreboard'
import type { JobOverheadDayLine } from '../jobs/jobDayLedger'
import type { SiteCostRows } from './siteCosts'
import type { SiteLabor } from './siteLabor'

export type ToYmd = (raw: string | null | undefined) => string | null

/** One job's events for the site's chart, each tagged with the job. */
export type SiteTimelineJob = {
  jobId: string
  label: string
  charges: JobChargeEvent[]
  payments: JobPaymentEvent[]
  /** The job's reports and hand-set percents (PR 3); empty until then. */
  values: JobValueEvent[]
  revenue: number | null
  fallbackPercent: number | null
  /** The job's overhead day lines (PR 2); empty until then. */
  overheadDays: JobOverheadDayInput[]
}

/** The same events, each carrying its job. */
export function tagJob<T extends { jobId?: string }>(jobId: string, events: readonly T[]): T[] {
  return events.map((e) => ({ ...e, jobId }))
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * The cost events per job from the site's cost rows: the five streams the Costs column totals (the
 * supply-house invoices by allocation, the card charges under the one card rule with fuel as its own
 * stream, the tally, the other charges, the sub-labor sheets), each built as the Job Summary chart builds
 * it. Team labor comes from the clock (`siteTeamLaborEvents`).
 */
export function siteChargeEventsFromCostRows(rows: SiteCostRows, args: { fuelTxIds: ReadonlySet<string>; toYmd: ToYmd }): Map<string, JobChargeEvent[]> {
  const out = new Map<string, JobChargeEvent[]>()
  const settings = [...rows.settings]
  for (const jobId of rows.jobIds) {
    const sheets = rows.sheets.filter((s) => s.job_ledger_id === jobId)
    const sheetIds = new Set(sheets.map((s) => s.id))
    const labor = jobSubLaborInputsFromRows(sheets, rows.items.filter((i) => sheetIds.has(i.job_id)), settings)
    const cardLines = mercuryLinesFromRows(rows.cardAlloc.filter((r) => r.job_id === jobId))
    const events = buildJobChargeEvents({
      teamLaborBreakdown: [],
      // The sheets and the labor jobs line up one for one (`jobSubLaborInputsFromRows` maps the sheets in order).
      subLabor: sheets.map((s, i) => {
        const lj = labor.laborJobs[i]
        return { dateKey: args.toYmd(s.job_date ?? s.created_at), amount: lj ? laborJobSubCost(lj, labor.mileageCost, labor.timePerMile) : 0, assignedToName: s.assigned_to_name ?? '' }
      }),
      mercury: cardEventRowsFromSnapshotLines(cardLines, { exclusions: rows.cardExclusions, fuelTxIds: args.fuelTxIds, toYmd: args.toYmd }),
      supplyHouse: supplyLinesFromRows((rows.supplyAlloc ?? []).filter((r) => r.job_id === jobId)).map((l) => ({
        dateKey: args.toYmd(l.invoiceDate),
        allocatedAmount: l.allocatedAmount,
        supplyHouseName: l.supplyHouseName ?? '',
        invoiceNumber: l.invoiceNumber,
      })),
      tallyParts: tallyLinesFromRows(rows.tally, jobId).map((t) => ({ dateKey: args.toYmd(t.createdAt), amount: t.lineTotal, fixtureOrPartName: t.partName ?? t.fixtureName, createdByName: t.createdByName })),
      billedMaterials: rows.otherCharges.filter((m) => m.job_id === jobId).map((m) => ({ dateKey: args.toYmd(m.created_at), amount: Number(m.amount ?? 0), description: m.description ?? null })),
    })
    out.set(jobId, tagJob(jobId, events))
  }
  return out
}

/**
 * The clock's events per job from the site's labor read: each person's hours and labor dollars by day,
 * as the Job window's breakdown gives them. A read with no days (the man-hours read) gives no event.
 */
export function siteTeamLaborEvents(labor: SiteLabor): Map<string, JobChargeEvent[]> {
  const out = new Map<string, JobChargeEvent[]>()
  for (const [jobId, job] of labor.byJobId) {
    const events = buildJobChargeEvents({
      teamLaborBreakdown: job.people.map((p) => ({ personName: p.personName, byWorkDate: (p.byWorkDate ?? []).map((d) => ({ workDate: d.ymd, hours: d.hours, cost: d.costUsd })) })),
      subLabor: [],
      mercury: [],
      supplyHouse: [],
      tallyParts: [],
      billedMaterials: [],
    })
    if (events.length) out.set(jobId, tagJob(jobId, events))
  }
  return out
}

export type SitePaymentRow = { job_id: string; amount: number | string | null; paid_on: string | null; created_at: string | null; payment_type?: string | null; note?: string | null }

/** The payments per job from the page's rows, dated by the day paid, else the day booked. */
export function sitePaymentEvents(payments: ReadonlyArray<SitePaymentRow>, toYmd: ToYmd): Map<string, JobPaymentEvent[]> {
  const byJob = new Map<string, SitePaymentRow[]>()
  for (const p of payments) {
    const list = byJob.get(p.job_id)
    if (list) list.push(p)
    else byJob.set(p.job_id, [p])
  }
  const out = new Map<string, JobPaymentEvent[]>()
  for (const [jobId, rows] of byJob) {
    const events = buildJobPaymentEvents(rows.map((p) => ({ dateKey: toYmd(p.paid_on ?? p.created_at), amount: Number(p.amount ?? 0), paymentType: p.payment_type ?? null, note: p.note ?? null })))
    if (events.length) out.set(jobId, tagJob(jobId, events))
  }
  return out
}

/**
 * The card charges in the fuel family's tag (punch list #52), as the Job window's snapshot finds them: a
 * charge's accounting label first, else the bank's own category, matched to the fuel tag. No tag read,
 * or no fuel tag, means no fuel stream, and the card line keeps the charge.
 */
export function siteFuelTxIds(args: { cardAlloc: SiteCostRows['cardAlloc']; tags: readonly CategoryTagRow[]; members: readonly CategoryTagMemberRow[]; labelIdByTxId: ReadonlyMap<string, string> }): Set<string> {
  const out = new Set<string>()
  const fuelTag = pickFuelTag(args.tags)
  if (!fuelTag) return out
  const lookups = buildCategoryTagLookups(args.tags, args.members)
  for (const row of args.cardAlloc) {
    const id = row.mercury_transaction_id
    if (!id || out.has(id)) continue
    const nested = row.mercury_transactions
    const tx = (Array.isArray(nested) ? nested[0] : nested) as { mercury_category?: unknown } | null | undefined
    const cat = tx?.mercury_category
    const bank = typeof cat === 'string' ? cat : cat && typeof cat === 'object' && typeof (cat as { name?: unknown }).name === 'string' ? (cat as { name: string }).name : null
    if (categoryTagForCharge(lookups, args.labelIdByTxId.get(id) ?? null, bank)?.id === fuelTag.id) out.add(id)
  }
  return out
}

export type SiteReportRow = { id: string; job_ledger_id: string | null; created_at: string | null; field_values: Record<string, unknown> | null; users: { name: string | null } | { name: string | null }[] | null }
export type SitePctEventRow = { id: string; job_id: string; pct: number | null; changed_at: string | null; users: { name: string | null } | { name: string | null }[] | null }

const nameOf = (u: { name: string | null } | { name: string | null }[] | null): string | null => (Array.isArray(u) ? u[0]?.name ?? null : u?.name ?? null)

/**
 * The percent events per job (v2.6499): the field reports and the office's hand-set percents, built as the
 * Job window builds them, each tagged with its job. A report's completion percent comes from its fields.
 */
export function siteValueEventsFromRows(reports: readonly SiteReportRow[], pctEvents: readonly SitePctEventRow[], toYmd: ToYmd): Map<string, JobValueEvent[]> {
  const out = new Map<string, JobValueEvent[]>()
  const push = (jobId: string | null, events: JobValueEvent[]) => {
    if (!jobId || events.length === 0) return
    const list = out.get(jobId)
    const tagged = tagJob(jobId, events)
    if (list) list.push(...tagged)
    else out.set(jobId, tagged)
  }
  const reportsByJob = new Map<string, SiteReportRow[]>()
  for (const r of reports) {
    if (!r.job_ledger_id) continue
    const list = reportsByJob.get(r.job_ledger_id)
    if (list) list.push(r)
    else reportsByJob.set(r.job_ledger_id, [r])
  }
  for (const [jobId, rows] of reportsByJob) push(jobId, buildJobValueEvents(rows.map((r) => ({ dateKey: toYmd(r.created_at), createdByName: nameOf(r.users), fieldValues: r.field_values }))))
  const pctByJob = new Map<string, SitePctEventRow[]>()
  for (const e of pctEvents) {
    const list = pctByJob.get(e.job_id)
    if (list) list.push(e)
    else pctByJob.set(e.job_id, [e])
  }
  for (const [jobId, rows] of pctByJob) push(jobId, buildJobManualPercentEvents(rows.map((e) => ({ dateKey: toYmd(e.changed_at), pct: e.pct, changedByName: nameOf(e.users) }))))
  return out
}

/**
 * The site's value line (v2.6499): at each bucket, every job's newest percent so far times its price, summed.
 * On one day a hand-set beats a report, as `newestPercentEvent` rules. A job with no dated percent but a
 * current one (paid bills, the job's own percent) adds it at the last bucket, as the Job Summary kernel does
 * for one job; a job with no price adds nothing. Writes `value` onto the rows; says whether any value stands.
 */
export function siteValueSeries(rows: JobChargesTimelineChartRow[], jobs: readonly Pick<SiteTimelineJob, 'jobId' | 'revenue' | 'fallbackPercent'>[]): { available: boolean; fallbackJobs: number } {
  const revenueOf = new Map(jobs.map((j) => [j.jobId, j.revenue != null && Number.isFinite(j.revenue) && j.revenue > 0 ? j.revenue : null]))
  const pctByJob = new Map<string, number>()
  let any = false
  const total = () => round2([...pctByJob.entries()].reduce((s, [jobId, pct]) => s + (pct / 100) * (revenueOf.get(jobId) ?? 0), 0))
  for (const row of rows) {
    const dayBest = new Map<string, JobValueEvent>()
    for (const v of row.valueEvents) {
      if (v.percent == null || !v.jobId) continue
      const cur = dayBest.get(v.jobId)
      if (!cur || (v.kind === 'manual' && cur.kind !== 'manual')) dayBest.set(v.jobId, v)
    }
    for (const [jobId, v] of dayBest) {
      if (!revenueOf.get(jobId)) continue
      pctByJob.set(jobId, v.percent as number)
      any = true
    }
    row.value = any ? total() : null
  }
  let fallbackJobs = 0
  const last = rows[rows.length - 1]
  if (last) {
    let add = 0
    for (const j of jobs) {
      if (pctByJob.has(j.jobId)) continue
      const rev = revenueOf.get(j.jobId)
      const p = j.fallbackPercent
      if (!rev || p == null || !Number.isFinite(p) || p < 0 || p > 100) continue
      add += (p / 100) * rev
      fallbackJobs += 1
    }
    if (fallbackJobs > 0) {
      last.value = round2((last.value ?? 0) + add)
      any = true
    }
  }
  return { available: any, fallbackJobs }
}

/** The words for a day's folded line of one source: *3 card charges*, *team labor, Luis and Mateo, 16h*. */
export function foldedSourceWords(source: JobChargeSource, events: readonly JobChargeEvent[]): string {
  const n = events.length
  const first = events[0]!
  const names = [...new Set(events.map((e) => (e.who ?? '').trim()).filter(Boolean))]
  if (source === 'team_labor') {
    const hours = round2(events.reduce((s, e) => s + (e.hours ?? 0), 0))
    if (n === 1) return first.label
    const who = names.length <= 2 ? names.join(' and ') : `${names.length} people`
    return `team labor, ${who}, ${hours}h`
  }
  if (source === 'sub_labor') {
    if (n === 1) return first.label
    return names.length === 1 ? `sub labor, ${names[0]}, ${n} sheets` : `sub labor, ${names.length} subs`
  }
  if (n === 1) return first.label
  const plural: Record<Exclude<JobChargeSource, 'team_labor' | 'sub_labor'>, string> = {
    mercury_card: 'card charges',
    fuel: 'fuel charges',
    supply_house: 'supply house invoices',
    tally_part: 'tally parts',
    billed_material: 'other charges',
  }
  return `${n} ${plural[source]}`
}

/**
 * One tooltip line per job and source on a day: *JP603 · 3 card charges*, the day's lines biggest
 * first. The amounts are summed, so the chart's buckets and its end are the same as unfolded.
 */
export function foldSiteChargeEvents(events: readonly JobChargeEvent[], jobLabel: (jobId: string) => string): JobChargeEvent[] {
  const groups = new Map<string, JobChargeEvent[]>()
  for (const e of events) {
    const k = `${e.dateKey ?? ''}\u0000${e.jobId ?? ''}\u0000${e.source}`
    const list = groups.get(k)
    if (list) list.push(e)
    else groups.set(k, [e])
  }
  const out: JobChargeEvent[] = []
  for (const list of groups.values()) {
    const first = list[0]!
    const folded: JobChargeEvent = {
      source: first.source,
      dateKey: first.dateKey,
      amount: round2(list.reduce((s, e) => s + e.amount, 0)),
      label: `${first.jobId ? jobLabel(first.jobId) : 'A job'} · ${foldedSourceWords(first.source, list)}`,
    }
    if (first.jobId) folded.jobId = first.jobId
    if (first.source === 'team_labor') folded.hours = round2(list.reduce((s, e) => s + (e.hours ?? 0), 0))
    out.push(folded)
  }
  return out.sort((a, b) => (a.dateKey ?? '').localeCompare(b.dateKey ?? '') || b.amount - a.amount)
}

/** How many days keep their source icons: a site's chart holds hundreds of days, and an icon on each is a wall. */
export const SITE_TIMELINE_ICON_DAYS = 40
/** A phone's plot is a third as wide, so a third as many days keep their icons. */
export const SITE_TIMELINE_ICON_DAYS_PHONE = 14

/**
 * Keep the source icons on the `max` days with the biggest cost steps and take them off the rest; the
 * tooltip still lists every line and the line still steps. Returns whether anything came off.
 */
export function thinChargeIcons(rows: JobChargesTimelineChartRow[], max: number): boolean {
  const steps = rows.filter((r) => r.chargeSources.length > 0).map((r) => ({ index: r.index, step: r.expense - (r.index > 0 ? rows[r.index - 1]!.expense : 0) }))
  if (steps.length <= max) return false
  const keep = new Set(steps.sort((a, b) => b.step - a.step).slice(0, max).map((s) => s.index))
  for (const r of rows) if (!keep.has(r.index)) r.chargeSources = []
  return true
}

/** A job is on the chart when any of its events carries a date. */
export function siteJobHasDatedEvent(job: Pick<SiteTimelineJob, 'charges' | 'payments' | 'values'>): boolean {
  return job.charges.some((e) => e.dateKey != null) || job.payments.some((e) => e.dateKey != null) || job.values.some((e) => e.dateKey != null)
}

export type SiteTimelineChip = { jobId: string; label: string; endExpense: number }

/** A job the chart cannot draw (v2.6711): its cost, undated charges included, and the undated charges by source. */
export type SiteTimelineLeftOutJob = { jobId: string; label: string; endExpense: number; undated: { source: JobChargeSource; count: number }[] }

/** What the chart cannot draw, by job: the order given, the cost summed over every charge, the undated charges counted by source. */
export function siteTimelineLeftOutJobs(jobs: readonly SiteTimelineJob[]): SiteTimelineLeftOutJob[] {
  return jobs
    .filter((j) => !siteJobHasDatedEvent(j))
    .map((j) => {
      const counts = new Map<JobChargeSource, number>()
      for (const e of j.charges) if (e.dateKey == null) counts.set(e.source, (counts.get(e.source) ?? 0) + 1)
      return { jobId: j.jobId, label: j.label, endExpense: round2(j.charges.reduce((s, e) => s + e.amount, 0)), undated: [...counts].map(([source, count]) => ({ source, count })) }
    })
}

/** The noun for a source's undated charges: *sub labor sheet*, *card charge*, *supply house invoice*; the meta's name lowercased, a sheet or a day where the meta names the work. */
function undatedNoun(source: JobChargeSource, count: number): string {
  const base = source === 'sub_labor' ? 'sub labor sheet' : source === 'team_labor' ? 'team labor day' : source === 'fuel' ? 'fuel charge' : JOB_CHARGE_SOURCE_META[source].name.toLowerCase()
  return count === 1 ? base : `${base}s`
}

/**
 * Why a job is off the chart, for its strip row: *1 sub labor sheet and 2 card charges with no date · date them and the
 * job joins the chart*; with no charge at all, *nothing charged yet*.
 */
export function siteTimelineLeftOutReason(job: Pick<SiteTimelineLeftOutJob, 'undated'>): string {
  if (job.undated.length === 0) return 'nothing charged yet'
  const n = job.undated.reduce((s, u) => s + u.count, 0)
  const parts = job.undated.map((u) => `${u.count} ${undatedNoun(u.source, u.count)}`)
  const list = parts.length <= 2 ? parts.join(' and ') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
  return `${list} with no date · date ${n === 1 ? 'it' : 'them'} and the job joins the chart`
}

/** The strip's sum line (v2.6711): the chart's end, the left-out jobs' cost, and both together, the Scoreboard's cost before overhead. */
export function siteTimelineStripSum(model: Pick<SiteTimelineModel, 'siteEndExpense' | 'leftOutJobs'>): { chartEnd: number; offChart: number; together: number } {
  const offChart = round2(model.leftOutJobs.reduce((s, j) => s + j.endExpense, 0))
  return { chartEnd: model.siteEndExpense, offChart, together: round2(model.siteEndExpense + offChart) }
}

/** The strip as lines for the print (v2.6711): the head, one line per job with its reason and cost, the sum line. Empty when nothing is left out. */
export function siteTimelineStripLines(model: Pick<SiteTimelineModel, 'siteEndExpense' | 'leftOutJobs'>, money: (n: number) => string): string[] {
  const n = model.leftOutJobs.length
  if (n === 0) return []
  const sum = siteTimelineStripSum(model)
  return [
    `Not on the chart · ${n} ${n === 1 ? 'job' : 'jobs'} with no dated charge or payment`,
    ...model.leftOutJobs.map((j) => `${j.label} · ${siteTimelineLeftOutReason(j)} · ${money(j.endExpense)}`),
    `Chart ends at ${money(sum.chartEnd)} · Not on the chart ${money(sum.offChart)} · Together ${money(sum.together)}, the Scoreboard’s cost before overhead`,
  ]
}

export type SiteTimelineModel = {
  data: JobChargesTimelineData
  /** The jobs with a dated event, in the Money look's order, each with its own end expense. */
  chips: SiteTimelineChip[]
  /** The jobs the chart draws: the selection among the chips, or all of them. */
  drawn: ReadonlySet<string>
  /** How many of the site's jobs have no dated event and are left out. */
  leftOut: number
  /** The jobs left out, in the order given, each with its cost and what it holds with no date (v2.6711, the ledger strip). */
  leftOutJobs: SiteTimelineLeftOutJob[]
  /** The whole site's end expense, the chart's end with nothing narrowed: the strip's sum reads it whatever the chips say. */
  siteEndExpense: number
  /** True when the icons were kept to the biggest days. */
  iconsThinned: boolean
  /** Jobs with no dated percent whose current percent adds to the value line's last point (v2.6499). */
  valueFallbackJobs: number
}

/**
 * The chart's data for the site, or for the selected jobs: the jobs with a dated event in the order
 * given, their events folded per job and source, merged and bucketed by the Job Summary's kernel.
 */
export function buildSiteTimeline(args: { jobs: readonly SiteTimelineJob[]; selected: ReadonlySet<string>; iconDays?: number }): SiteTimelineModel {
  const dated = args.jobs.filter(siteJobHasDatedEvent)
  const chosen = dated.filter((j) => args.selected.has(j.jobId))
  const drawnJobs = chosen.length ? chosen : dated
  const labelOf = new Map(args.jobs.map((j) => [j.jobId, j.label]))
  const charges = foldSiteChargeEvents(
    drawnJobs.flatMap((j) => j.charges),
    (id) => labelOf.get(id) ?? id,
  )
  const payments = drawnJobs.flatMap((j) => j.payments.map((p) => ({ ...p, label: `${j.label} · ${p.label}` })))
  const values = drawnJobs.flatMap((j) => j.values.map((v) => ({ ...v, label: `${j.label} · ${v.label}` })))
  const overhead = drawnJobs.flatMap((j) => j.overheadDays)
  // The kernel buckets the percent events (the 🚩 markers, the tooltip's lines) with no price of its own; the site's value is summed over the jobs after.
  const data = buildJobChargesTimelineChartData(charges, values, null, payments, null, overhead)
  const value = siteValueSeries(data.chartRows, drawnJobs)
  data.valueSeriesAvailable = value.available
  data.valueFromFallbackPercent = false
  const iconsThinned = thinChargeIcons(data.chartRows, args.iconDays ?? SITE_TIMELINE_ICON_DAYS)
  // The whole site's end, for the strip's sum: the chart's own end unless the chips narrowed it, then the same sum over every dated job.
  const siteCharges = chosen.length ? foldSiteChargeEvents(dated.flatMap((j) => j.charges), (id) => labelOf.get(id) ?? id) : charges
  const siteEndExpense = chosen.length ? round2(siteCharges.reduce((s, e) => s + e.amount, 0)) : data.endExpense
  return {
    data,
    valueFallbackJobs: value.fallbackJobs,
    chips: dated.map((j) => ({ jobId: j.jobId, label: j.label, endExpense: round2(j.charges.reduce((s, e) => s + e.amount, 0)) })),
    drawn: new Set(drawnJobs.map((j) => j.jobId)),
    leftOut: args.jobs.length - dated.length,
    leftOutJobs: siteTimelineLeftOutJobs(args.jobs),
    siteEndExpense,
    iconsThinned,
  }
}

/** A job's overhead day lines as the chart's band takes them (v2.6498): the share by day, with its split. */
export function overheadDaysFromLines(lines: readonly JobOverheadDayLine[] | undefined): JobOverheadDayInput[] {
  return (lines ?? []).map((l) => ({ dateKey: l.ymd, amount: l.shareUsd, activityUsd: l.activityUsd, carryUsd: l.carryUsd }))
}

/** The day the office pool began, as the chart's key says it: *Feb 19, 2026*. */
export function overheadSinceWords(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return ymd
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * The site's jobs as the chart takes them: the Money look's order first, any job it does not list after,
 * each with its cost events from the cost rows and the clock, its payments and, when the day ledger is
 * in (v2.6498), its overhead day lines.
 */
export function assembleSiteTimelineJobs(args: {
  jobIds: readonly string[]
  order: readonly string[]
  jobLabel: (jobId: string) => string
  costs: SiteCostRows
  labor: SiteLabor | null
  payments: ReadonlyArray<SitePaymentRow>
  fuelTxIds: ReadonlySet<string>
  toYmd: ToYmd
  /** Each job's overhead day share with its lines (v2.6498); null while the ledger is out or when it failed, and the band stays off. */
  overhead?: ReadonlyMap<string, { lines?: readonly JobOverheadDayLine[] }> | null
  /** Each job's percent events (v2.6499); null while the reports are out or when they failed, and the value line stays off. */
  values?: ReadonlyMap<string, readonly JobValueEvent[]> | null
  /** The jobs' prices, stages and own percents, and the site's bills, for the value line's price and its end-point fallback (v2.6499): the Scoreboard's percent rule, a paid job at 100, else the Job Summary chain. */
  jobRows?: ReadonlyArray<{ id: string; status: string | null; revenue: number | null; pct_complete?: number | null }>
  invoices?: ReadonlyArray<{ job_id: string; status: string; amount: number }>
}): SiteTimelineJob[] {
  const ids = new Set(args.jobIds)
  const rowOf = new Map((args.jobRows ?? []).map((j) => [j.id, j]))
  const ordered = [...args.order.filter((id) => ids.has(id)), ...args.jobIds.filter((id) => !args.order.includes(id))]
  const costEvents = siteChargeEventsFromCostRows(args.costs, { fuelTxIds: args.fuelTxIds, toYmd: args.toYmd })
  const laborEvents = args.labor ? siteTeamLaborEvents(args.labor) : new Map<string, JobChargeEvent[]>()
  const payments = sitePaymentEvents(args.payments, args.toYmd)
  return ordered.map((jobId) => ({
    jobId,
    label: args.jobLabel(jobId),
    charges: [...(laborEvents.get(jobId) ?? []), ...(costEvents.get(jobId) ?? [])],
    payments: payments.get(jobId) ?? [],
    values: [...(args.values?.get(jobId) ?? [])],
    revenue: rowOf.get(jobId)?.revenue != null ? Number(rowOf.get(jobId)!.revenue) : null,
    fallbackPercent: args.values && rowOf.has(jobId) ? scoreboardPct({ status: rowOf.get(jobId)!.status, pct_complete: rowOf.get(jobId)!.pct_complete ?? null, revenue: rowOf.get(jobId)!.revenue }, (args.invoices ?? []).filter((i) => i.job_id === jobId)).pct : null,
    overheadDays: overheadDaysFromLines(args.overhead?.get(jobId)?.lines),
  }))
}

/** The line under the chips about the value line (v2.6499): how many jobs add their current percent at its end. */
export function siteTimelineValueWords(fallbackJobs: number): string | null {
  if (fallbackJobs <= 0) return null
  return fallbackJobs === 1 ? '1 job with no dated percent adds its current percent at the end of the value line.' : `${fallbackJobs} jobs with no dated percent add their current percent at the end of the value line.`
}

/** The chart's ends in words, for the print (v2.6499). */
export function siteTimelineEndWords(data: Pick<JobChargesTimelineData, 'endExpense' | 'endProfit' | 'endTrueCost' | 'overheadSeriesAvailable' | 'valueSeriesAvailable' | 'chartRows'>, money: (n: number) => string): string[] {
  const out = [`Cost to date ${money(data.endExpense)}`]
  if (data.overheadSeriesAvailable) out.push(`True cost ${money(data.endTrueCost)}`)
  out.push(`Cash position ${data.endProfit < 0 ? '−' : '+'}${money(Math.abs(data.endProfit))}`)
  const last = data.chartRows[data.chartRows.length - 1]
  if (data.valueSeriesAvailable && last?.value != null) out.push(`Value created ${money(last.value)}`)
  return out
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * The print page (v2.6499): the chart as the screen drew it (its SVG, the theme's surface made white), under the
 * site's name, the scope line and the ends, with the key and the printed stamp. A printed page has no theme, so
 * its colours are literal, as on the other print documents. Pure; `openHtmlPrintWindow` opens it.
 */
export function siteTimelinePrintHtml(input: { siteName: string; customerName: string | null; scopeLine: string; endWords: readonly string[]; keyLines: readonly string[]; svg: string; printedAt: string; printedBy: string | null; /** The ledger strip's lines (v2.6711), under the key: the jobs the chart cannot draw and the sum line. */ stripLines?: readonly string[] }): string {
  const svg = input.svg.replace(/var\(--surface\)/g, '#ffffff').replace(/var\(--[a-z0-9-]+\)/g, '#374151')
  const stamp = `Printed ${input.printedAt}${input.printedBy ? ` by ${input.printedBy}` : ''}`
  return `<!doctype html>
<html lang="en" data-theme="light"><head><meta charset="utf-8"><title>${esc(input.siteName)} · cost timeline</title>
<style>
@page { size: landscape; margin: 12mm; }
body { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; color: #111827; margin: 0; padding: 16px; background: #ffffff; }
h1 { font-size: 18px; margin: 0 0 2px; }
.line { font-size: 12px; color: #4b5563; margin: 0 0 4px; }
.ends { font-size: 13px; font-weight: 600; margin: 4px 0 10px; }
.chart svg { width: 100%; height: auto; }
.key { font-size: 11px; color: #374151; text-align: center; margin: 6px 0 0; }
.strip { font-size: 11px; color: #374151; text-align: left; margin: 10px 0 0; }
.strip p { margin: 2px 0 0; }
.strip .head { font-weight: 600; }
.stamp { font-size: 10px; color: #6b7280; margin-top: 10px; }
</style></head><body>
<h1>${esc(input.siteName)} · cost timeline</h1>
<p class="line">${input.customerName ? `${esc(input.customerName)} · ` : ''}${esc(input.scopeLine)}</p>
<p class="ends">${input.endWords.map(esc).join(' · ')}</p>
<div class="chart">${svg}</div>
${input.keyLines.map((l) => `<p class="key">${esc(l)}</p>`).join('\n')}
${input.stripLines?.length ? `<div class="strip">${input.stripLines.map((l, i) => `<p${i === 0 ? ' class="head"' : ''}>${esc(l)}</p>`).join('')}</div>` : ''}
<p class="stamp">${esc(stamp)}</p>
</body></html>`
}

/** The line under the chips: how many jobs are off the chart, and where they are listed (the strip, v2.6711). */
export function siteTimelineLeftOutWords(leftOut: number): string | null {
  if (leftOut <= 0) return null
  return leftOut === 1 ? '1 job has no dated charge or payment. It is listed under the chart.' : `${leftOut} jobs have no dated charge or payment. They are listed under the chart.`
}

/** The chip row's title words for the chart's scope. */
export function siteTimelineScopeWords(model: Pick<SiteTimelineModel, 'chips' | 'drawn'>): string {
  const n = model.chips.length
  if (model.drawn.size === n) return `all ${n} ${n === 1 ? 'job' : 'jobs'}`
  return `${model.drawn.size} of ${n} jobs`
}
