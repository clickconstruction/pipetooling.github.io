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
  buildJobChargeEvents,
  buildJobChargesTimelineChartData,
  buildJobPaymentEvents,
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

export type SiteTimelineModel = {
  data: JobChargesTimelineData
  /** The jobs with a dated event, in the Money look's order, each with its own end expense. */
  chips: SiteTimelineChip[]
  /** The jobs the chart draws: the selection among the chips, or all of them. */
  drawn: ReadonlySet<string>
  /** How many of the site's jobs have no dated event and are left out. */
  leftOut: number
  /** True when the icons were kept to the biggest days. */
  iconsThinned: boolean
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
  const overhead = drawnJobs.flatMap((j) => j.overheadDays)
  const data = buildJobChargesTimelineChartData(charges, [], null, payments, null, overhead)
  const iconsThinned = thinChargeIcons(data.chartRows, args.iconDays ?? SITE_TIMELINE_ICON_DAYS)
  return {
    data,
    chips: dated.map((j) => ({ jobId: j.jobId, label: j.label, endExpense: round2(j.charges.reduce((s, e) => s + e.amount, 0)) })),
    drawn: new Set(drawnJobs.map((j) => j.jobId)),
    leftOut: args.jobs.length - dated.length,
    iconsThinned,
  }
}

/**
 * The site's jobs as the chart takes them: the Money look's order first, any job it does not list after,
 * each with its cost events from the cost rows and the clock, and its payments.
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
}): SiteTimelineJob[] {
  const ids = new Set(args.jobIds)
  const ordered = [...args.order.filter((id) => ids.has(id)), ...args.jobIds.filter((id) => !args.order.includes(id))]
  const costEvents = siteChargeEventsFromCostRows(args.costs, { fuelTxIds: args.fuelTxIds, toYmd: args.toYmd })
  const laborEvents = args.labor ? siteTeamLaborEvents(args.labor) : new Map<string, JobChargeEvent[]>()
  const payments = sitePaymentEvents(args.payments, args.toYmd)
  return ordered.map((jobId) => ({
    jobId,
    label: args.jobLabel(jobId),
    charges: [...(laborEvents.get(jobId) ?? []), ...(costEvents.get(jobId) ?? [])],
    payments: payments.get(jobId) ?? [],
    values: [],
    revenue: null,
    fallbackPercent: null,
    overheadDays: [],
  }))
}

/** The line under the chips: how many jobs are left out, and why. */
export function siteTimelineLeftOutWords(leftOut: number): string | null {
  if (leftOut <= 0) return null
  return leftOut === 1 ? '1 job with no dated charge or payment is left out.' : `${leftOut} jobs with no dated charge or payment are left out.`
}

/** The chip row's title words for the chart's scope. */
export function siteTimelineScopeWords(model: Pick<SiteTimelineModel, 'chips' | 'drawn'>): string {
  const n = model.chips.length
  if (model.drawn.size === n) return `all ${n} ${n === 1 ? 'job' : 'jobs'}`
  return `${model.drawn.size} of ${n} jobs`
}
