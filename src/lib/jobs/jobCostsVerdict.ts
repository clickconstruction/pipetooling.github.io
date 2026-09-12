/**
 * The Costs tab's verdict (v2.3361 — the honest tab). Pure. Reads the burn
 * model, the spend by component, the resolved budget and the price, and
 * answers the four questions the tab now leads with:
 *
 *   true margin at completion   price − (spent ÷ % done) − overhead share
 *   spent so far                direct cost to date, as a share of the price
 *   earned so far               % done × PRICE — never the assumed budget
 *   time left                   working days at the progress pace so far
 *
 * …then the by-section build-up behind the margin tile (each section's spent,
 * at-completion at today's pace, and the bid's figure when the bid carried
 * one), and the baseline the job is producing (hours, hours per $1k, average
 * wage) for the labor book. Nothing here reads price × (1 − target) as a
 * budget: when the bid carried no hours the table says so instead of
 * pretending.
 */
import type { JobBurnModel } from './jobBurn'
import { componentBurn, type ResolvedJobBudget, type SpendByComponent } from './jobBudget'

export type VerdictMoney = { usd: number; pct: number | null }

export type VerdictSection = {
  key: 'labor' | 'materials' | 'subs' | 'other'
  label: string
  sub: string
  spentUsd: number
  hours: number | null
  /** spent ÷ % done; the spent amount when done or unknown. */
  atCompletionUsd: number | null
  /** The bid's (or typed) figure; null when it carried none. */
  budgetUsd: number | null
  budgetHours: number | null
  /** "no hours on B66" / "none on B66" / "◆ from B66" / "✎ typed" / "—". */
  budgetWords: string
  /** used ÷ budget × 100 when a budget exists. */
  pctOfBudget: number | null
  /** Positive = ahead of the work (pct of budget − % done). */
  aheadPts: number | null
}

export type CostsVerdict = {
  priceUsd: number | null
  pctDone: number | null
  pctSource: 'report' | 'job' | null
  /** The report that set % done — its day and age in days; null when % comes from the job. */
  pctReport: { ymd: string; ageDays: number } | null
  /** The job's own % when a report set pctDone and the two disagree; null otherwise. */
  pctJob: number | null
  /** The job is billed or paid. */
  finished: boolean
  trueMargin: VerdictMoney | null
  directMargin: VerdictMoney | null
  eacUsd: number | null
  overheadToDateUsd: number
  overheadProjectedUsd: number | null
  spent: { usd: number; pctOfPrice: number | null; teamHours: number; materialsUsd: number }
  earned: { usd: number; aheadUsd: number } | null
  /** True margin so far: earned − spent − overhead to date; null without earned. */
  trueMarginSoFar: VerdictMoney | null
  timeLeft: { workLeftFieldDays: number | null; progressPerFieldDay: number | null; burnPerFieldDayUsd: number | null; fieldDays: number; early: boolean; idle: boolean }
  sections: VerdictSection[]
  /** Where the bid's figures come from, for the section table's column head. */
  budgetSource: ResolvedJobBudget['source']
  budgetLabel: string
  assumedDirectUsd: number | null
  targetMarginPct: number | null
  baseline: CostsBaseline
}

export type CostsBaseline = {
  /** 'bid' when the bid carried hours (compare); 'none' when it did not (collect). */
  kind: 'bid' | 'none'
  bidLabel: string | null
  teamHours: number
  people: number | null
  hoursPerThousand: number | null
  avgWageUsd: number | null
  materialsUsd: number
  materialsPctOfPrice: number | null
  bidHours: number | null
  /** recorded ÷ bid hours; null without bid hours. */
  hoursShare: number | null
  /** Expected share at this % done (pct ÷ 100); null without a %. */
  expectedShare: number | null
  read: 'under' | 'near' | 'over' | null
}

const pctOf = (part: number, whole: number | null): number | null => (whole != null && whole > 0 ? (part / whole) * 100 : null)
const daysBetweenYmd = (a: string, b: string): number => Math.round((Date.UTC(Number(b.slice(0, 4)), Number(b.slice(5, 7)) - 1, Number(b.slice(8, 10))) - Date.UTC(Number(a.slice(0, 4)), Number(a.slice(5, 7)) - 1, Number(a.slice(8, 10)))) / 86_400_000)

export function buildCostsVerdict(args: {
  burn: JobBurnModel
  priceUsd: number | null
  spend: SpendByComponent
  teamHours: number
  teamPeople: number | null
  resolved: ResolvedJobBudget
  bidLabel: string | null
  /** The day of the latest report that carried a %; null when none. */
  latestReportYmd: string | null
  /** The job's own % complete (the fallback when no report carries one). */
  jobPct?: number | null
  /** Billed or paid — the % came from the job being finished when no report or job % existed. */
  jobFinished?: boolean
  todayYmd: string
}): CostsVerdict {
  const { burn: m, priceUsd, spend, resolved: r } = args
  const c = r.components
  // A snapshot with nothing on it (an estimate taken before any hours or materials existed) is no footing.
  const emptySnapshot = c != null && c.laborHours <= 0 && c.laborUsd <= 0 && c.materialsUsd <= 0 && c.subsUsd <= 0 && c.otherUsd <= 0
  const fromBid = r.source !== 'assumed' && c != null && !emptySnapshot
  const bidTag = args.bidLabel ? `B${args.bidLabel}` : 'the bid'
  const budgetLabel = fromBid && r.source === 'bid' ? `◆ from ${bidTag}` : fromBid && r.source === 'typed' ? '✎ typed' : args.bidLabel ? `no figures on ${bidTag}` : 'no bid linked'
  const words = (has: boolean, noun: string): string => (fromBid ? (has ? (r.source === 'bid' ? `◆ ${bidTag}` : '✎ typed') : `no ${noun} on ${bidTag}`) : args.bidLabel ? `no ${noun} on ${bidTag}` : '—')

  const section = (key: VerdictSection['key'], label: string, sub: string, spentUsd: number, hours: number | null, budgetUsd: number | null, budgetHours: number | null, noun: string): VerdictSection => {
    const b = componentBurn({ usedUsd: spentUsd, budgetUsd, pctDone: m.percentDone })
    return { key, label, sub, spentUsd, hours, atCompletionUsd: b.atCompletionUsd, budgetUsd: b.budgetUsd, budgetHours, budgetWords: words(b.budgetUsd != null || (budgetHours != null && budgetHours > 0), noun), pctOfBudget: b.pct, aheadPts: b.aheadPts }
  }
  const sections: VerdictSection[] = [
    section('labor', 'Labor', 'team hours × wages', spend.teamUsd, args.teamHours, c && c.laborUsd > 0 ? c.laborUsd : null, c && c.laborHours > 0 ? c.laborHours : null, 'hours'),
    section('materials', 'Materials', 'supply house · cards · tally', spend.partsUsd, null, c && c.materialsUsd > 0 ? c.materialsUsd : null, null, 'materials'),
    section('subs', 'Subs', 'sub labor sheets', spend.subUsd, null, c && c.subsUsd > 0 ? c.subsUsd : null, null, 'subs'),
    section('other', 'Other', 'permits · equipment · driving', 0, null, c && c.otherUsd > 0 ? c.otherUsd : null, null, 'other'),
  ]

  const overheadToDate = m.overhead?.shareToDateUsd ?? 0
  const earnedUsd = m.percentDone != null && priceUsd != null ? (Math.min(m.percentDone, 100) / 100) * priceUsd : null
  const earned = earnedUsd != null ? { usd: earnedUsd, aheadUsd: earnedUsd - m.spentUsd } : null
  const soFar = earned ? earned.usd - m.spentUsd - overheadToDate : null
  const trueMargin = m.overhead?.trueMarginUsd != null ? { usd: m.overhead.trueMarginUsd, pct: m.overhead.trueMarginPct } : null

  const bidHours = c && c.laborHours > 0 ? c.laborHours : null
  const hoursShare = bidHours != null ? args.teamHours / bidHours : null
  const expectedShare = m.percentDone != null ? Math.max(m.percentDone, 1) / 100 : null
  const read: CostsBaseline['read'] = hoursShare == null ? null : expectedShare == null ? (hoursShare > 1.1 ? 'over' : hoursShare >= 0.8 ? 'near' : 'under') : hoursShare > expectedShare * 1.1 ? 'over' : hoursShare >= expectedShare * 0.8 ? 'near' : 'under'

  return {
    priceUsd,
    pctDone: m.percentDone,
    pctSource: m.percentSource,
    pctReport: m.percentSource === 'report' && args.latestReportYmd ? { ymd: args.latestReportYmd, ageDays: daysBetweenYmd(args.latestReportYmd, args.todayYmd) } : null,
    pctJob: m.percentSource === 'report' && args.jobPct != null && m.percentDone != null && Math.round(args.jobPct) !== Math.round(m.percentDone) ? args.jobPct : null,
    finished: !!args.jobFinished,
    trueMargin,
    directMargin: m.marginUsd != null ? { usd: m.marginUsd, pct: m.marginPct } : null,
    eacUsd: m.eacUsd,
    overheadToDateUsd: overheadToDate,
    overheadProjectedUsd: m.overhead?.projectedRemainingUsd ?? null,
    spent: { usd: m.spentUsd, pctOfPrice: pctOf(m.spentUsd, priceUsd), teamHours: args.teamHours, materialsUsd: spend.partsUsd },
    earned,
    trueMarginSoFar: soFar != null ? { usd: soFar, pct: pctOf(soFar, priceUsd) } : null,
    timeLeft: { workLeftFieldDays: m.workLeftFieldDays, progressPerFieldDay: m.progressPerFieldDay, burnPerFieldDayUsd: m.burnPerFieldDayUsd, fieldDays: m.fieldDays, early: m.status === 'early', idle: m.fieldDays > 0 && m.burnPerFieldDayUsd == null },
    sections,
    budgetSource: r.source,
    budgetLabel,
    assumedDirectUsd: r.source === 'assumed' ? r.directUsd : null,
    targetMarginPct: r.targetMarginPct,
    baseline: {
      kind: bidHours != null ? 'bid' : 'none',
      bidLabel: args.bidLabel ? `B${args.bidLabel}` : null,
      teamHours: args.teamHours,
      people: args.teamPeople,
      hoursPerThousand: priceUsd != null && priceUsd > 0 && args.teamHours > 0 ? args.teamHours / (priceUsd / 1000) : null,
      avgWageUsd: args.teamHours > 0 ? spend.teamUsd / args.teamHours : null,
      materialsUsd: spend.partsUsd,
      materialsPctOfPrice: pctOf(spend.partsUsd, priceUsd),
      bidHours,
      hoursShare,
      expectedShare,
      read,
    },
  }
}

/** "77% done per the Sep 4 report (8 days old)" / "77% done (job)" / "no % complete yet". */
export function pctDoneWords(v: Pick<CostsVerdict, 'pctDone' | 'pctSource' | 'pctReport' | 'pctJob' | 'finished'>, fmtDay: (ymd: string) => string): string {
  if (v.pctDone == null) return v.finished ? 'billed · no % recorded' : 'no % complete yet'
  if (v.finished && v.pctSource === 'job' && v.pctDone >= 100) return '100% done (billed)'
  const pct = `${Math.round(v.pctDone)}% done`
  if (v.pctReport) return `${pct} per the ${fmtDay(v.pctReport.ymd)} report${v.pctReport.ageDays >= 7 ? ` (${v.pctReport.ageDays} days old)` : ''}${v.pctJob != null ? ` · the job says ${Math.round(v.pctJob)}%` : ''}`
  return v.pctSource === 'job' ? `${pct} (set on the job)` : pct
}

/** The time-left tile's words. */
export function timeLeftWords(t: CostsVerdict['timeLeft'], fmtUsd: (n: number) => string): { big: string; sub: string } {
  if (t.workLeftFieldDays === 0) return { big: 'done', sub: 'the job reads 100%' }
  if (t.early) return { big: '—', sub: `too early to call · ${t.fieldDays} field ${t.fieldDays === 1 ? 'day' : 'days'}` }
  if (t.workLeftFieldDays == null) return { big: '—', sub: t.fieldDays === 0 ? 'no field days yet' : 'needs a % complete' }
  const days = Math.round(t.workLeftFieldDays * 10) / 10
  const rate = t.progressPerFieldDay != null ? `${Math.round(t.progressPerFieldDay * 10) / 10}% of the work a day` : ''
  const spend = t.burnPerFieldDayUsd != null ? `spending ${fmtUsd(t.burnPerFieldDayUsd)} a field day` : t.idle ? 'idle 30+ days' : ''
  return { big: `≈ ${days} working ${days === 1 ? 'day' : 'days'}`, sub: [rate, spend].filter(Boolean).join(' · ') }
}

/** The baseline strip's read on a costed bid: "17% of the bid's hours at 50% done · the book was heavy here". */
export function baselineReadWords(b: CostsBaseline, pctDone: number | null): string {
  if (b.kind !== 'bid' || b.hoursShare == null) return ''
  const share = `${Math.round(b.hoursShare * 100)}% of the bid's hours`
  const at = pctDone != null ? ` at ${Math.round(pctDone)}% done` : ''
  const verdict = b.read === 'over' ? 'the book was light here' : b.read === 'under' ? 'the book was heavy here' : 'on the book'
  return `${share}${at} · ${verdict}`
}
