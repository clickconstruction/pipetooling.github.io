/**
 * Pure queue kernel for Job Follow-Up Mode (v2.1718): which open jobs are
 * "quiet too long for their stage", why, and in what order the office should
 * review them. Since v2.5510 a Working or Waiting job with no approved field
 * day in 21+ days joins too (the idle rule), with a Next line saying what it
 * needs. IO lives in `jobFollowupStore.ts`; this file is data → data.
 */

import type { JobsBoardScope } from './boardScopes'

export type JobFollowupStage = 'waiting' | 'working' | 'ready_to_bill' | 'billed' | 'collections'

export const JOB_FOLLOWUP_STAGES: JobFollowupStage[] = [
  'waiting',
  'working',
  'ready_to_bill',
  'billed',
  'collections',
]

export const JOB_FOLLOWUP_STAGE_LABELS: Record<JobFollowupStage, string> = {
  waiting: 'Waiting',
  working: 'Working',
  ready_to_bill: 'Ready to Bill',
  billed: 'Billed',
  collections: 'Collections',
}

export type JobFollowupSettings = {
  workingDays: number
  waitingDays: number
  readyToBillDays: number
  billedDays: number
  collectionsDays: number
  /** How long a "Looks fine" keeps a job out of the queue. */
  restDays: number
}

export const DEFAULT_JOB_FOLLOWUP_SETTINGS: JobFollowupSettings = {
  workingDays: 5,
  waitingDays: 7,
  readyToBillDays: 2,
  billedDays: 7,
  collectionsDays: 3,
  restDays: 3,
}

export type JobFollowupCandidate = {
  id: string
  stage: JobFollowupStage
  hcpNumber: string
  jobName: string
  address: string
  customerName: string | null
  pctComplete: number | null
  /** Bid / revenue figure (null = no bid value yet). */
  revenue: number | null
  paymentsMade: number | null
  /** ISO timestamp of the newest note / status change / work / bill. */
  latestActivityAt: string
  /** Next scheduled visit (YYYY-MM-DD), if any, from job_schedule_blocks. */
  nextScheduledOn: string | null
  /**
   * The last approved field day (`jobs_ledger.last_work_date`, kept by the clock-session trigger),
   * for the idle rule (v2.5510); null when no crew day was ever approved.
   */
  lastWorkYmd?: string | null
  /** The day the job was made: the idle clock's start on a Working job with no field day yet. */
  createdYmd?: string | null
  /** The lead tech, so the Dashboard card can say how many idle jobs are the reader's own. */
  masterUserId?: string | null
}

/**
 * The idle rule (v2.5510, the owner's 2026-10-13 ask for Taunya): a Working or Waiting job with no approved
 * field day in this many days joins the deck whatever its notes say. Notes do not reset this clock — only a
 * Looks fine rest, a snooze, or a visit on the schedule keeps the job out.
 */
export const JOB_FOLLOWUP_IDLE_DAYS = 21

/** Why a card is in the deck: quiet too long for its stage, or idle (no field work) past the idle rule. */
export type JobFollowupWhy = 'quiet' | 'idle'

/** What the job needs next, from the facts the card carries — the deck's "Next" line and the Dashboard's words. */
export type JobFollowupNeed = {
  kind: 'bill' | 'schedule_or_close' | 'schedule' | 'nudge' | 'collect'
  words: string
}

export type JobFollowupReview = {
  jobId: string
  /** ISO timestamp. */
  reviewedAt: string
  /** YYYY-MM-DD; null = plain "Looks fine". */
  snoozedUntil: string | null
  /** Reviewer user id — used by the history view (v2.1722); queue math ignores it. */
  reviewedBy?: string | null
}

/** History row action label: '✓ Looks fine' or 'Snoozed until Aug 19'. */
export function jobFollowupReviewActionLabel(snoozedUntil: string | null): string {
  if (snoozedUntil == null) return '✓ Looks fine'
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(snoozedUntil)
  if (!m) return 'Snoozed'
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `Snoozed until ${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}`
}

export type JobFollowupQueueEntry = {
  job: JobFollowupCandidate
  /** Whole days since the newest activity (reviews count as activity). */
  quietDays: number
  /** Human sentence for the "Why it's here" band. */
  reason: string
  /** Quiet for its stage, or idle past the field-day rule (v2.5510). Idle wins when both hold. */
  why: JobFollowupWhy
  /** Whole days since the last approved field day (else the job's first day); null off the idle rule's stages. */
  idleDays: number | null
  /** What the job needs next; null when the facts do not say. */
  need: JobFollowupNeed | null
}

const DAY_MS = 86400000

function ymdToUtcMs(ymd: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return Number.NaN
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/** Whole days from an ISO instant to the (company-tz) wall date, floored at 0. */
export function jobFollowupQuietDays(latestActivityAtIso: string, todayYmd: string): number {
  const t = new Date(latestActivityAtIso).getTime()
  const today = ymdToUtcMs(todayYmd)
  if (Number.isNaN(t) || Number.isNaN(today)) return 0
  return Math.max(0, Math.floor((today - t) / DAY_MS))
}

export function jobFollowupThresholdDays(stage: JobFollowupStage, settings: JobFollowupSettings): number {
  switch (stage) {
    case 'waiting':
      return settings.waitingDays
    case 'working':
      return settings.workingDays
    case 'ready_to_bill':
      return settings.readyToBillDays
    case 'billed':
      return settings.billedDays
    case 'collections':
      return settings.collectionsDays
  }
}

function reasonFor(entry: { stage: JobFollowupStage; quietDays: number; nextScheduledOn: string | null; pctComplete: number | null; revenue: number | null }): string {
  const quiet = `quiet ${entry.quietDays} day${entry.quietDays === 1 ? '' : 's'}`
  switch (entry.stage) {
    case 'waiting':
      return `Waiting ${quiet} — nothing on the schedule`
    case 'working': {
      const pct = entry.pctComplete != null ? ` · ${entry.pctComplete}% done` : ''
      const bid = entry.revenue != null && entry.revenue > 0 ? ` on a $${Math.round(entry.revenue).toLocaleString()} bid` : ''
      return `Working ${quiet} — no notes or work logged${pct}${bid}`
    }
    case 'ready_to_bill':
      return `Ready to Bill for ${entry.quietDays} day${entry.quietDays === 1 ? '' : 's'} — invoice not sent`
    case 'billed':
      return `Billed, ${quiet} — no payment and no nudge`
    case 'collections':
      return `In Collections, ${quiet}`
  }
}

/**
 * The queue: open jobs past their stage's quiet threshold, stalest first.
 * Reviews count as activity; a snooze (or the rest window after a plain
 * "Looks fine") excludes the job outright until it expires. Jobs in Waiting
 * or Working with a FUTURE scheduled visit are exempt — the crew is coming,
 * nothing is forgotten.
 */
/** Whole days from a wall date to today, floored at 0; null when either date is off. */
function ymdDaysUntil(fromYmd: string, todayYmd: string): number | null {
  const a = ymdToUtcMs(fromYmd)
  const b = ymdToUtcMs(todayYmd)
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.max(0, Math.floor((b - a) / DAY_MS))
}

/**
 * Days since the job's last approved field day — the Cycle view's idle clock (`staleOpenJobs`): the last
 * work date, else the day the job was made. Only Working and Waiting jobs have one, and a Waiting job only
 * once a crew has been on site (a job still waiting to begin is queued, not idle). Null otherwise.
 */
export function jobFollowupIdleDays(job: Pick<JobFollowupCandidate, 'stage' | 'lastWorkYmd' | 'createdYmd'>, todayYmd: string): number | null {
  if (job.stage !== 'working' && job.stage !== 'waiting') return null
  const lastWork = (job.lastWorkYmd ?? '').slice(0, 10)
  if (job.stage === 'waiting' && !lastWork) return null
  const from = lastWork || (job.createdYmd ?? '').slice(0, 10)
  if (!from) return null
  return ymdDaysUntil(from, todayYmd)
}

/** What the job needs next, from its stage and % done; the deck's Next line and the Dashboard card's words. */
export function jobFollowupNeed(job: Pick<JobFollowupCandidate, 'stage' | 'pctComplete'>): JobFollowupNeed | null {
  switch (job.stage) {
    case 'ready_to_bill':
      return { kind: 'bill', words: 'Bill it' }
    case 'working':
      return job.pctComplete != null && job.pctComplete >= 100
        ? { kind: 'bill', words: 'Bill it, the work is done' }
        : { kind: 'schedule_or_close', words: 'Schedule the next visit or close it' }
    case 'waiting':
      return { kind: 'schedule', words: 'Put the next visit on the schedule' }
    case 'billed':
      return { kind: 'nudge', words: 'Nudge the customer for payment' }
    case 'collections':
      return { kind: 'collect', words: 'Work the account' }
  }
}

/** "No field work in 140 days · 70% done · $41,550 bid" — the idle card's Why it's here line. */
function idleReasonFor(job: Pick<JobFollowupCandidate, 'stage' | 'pctComplete' | 'revenue'>, idleDays: number): string {
  const head = `No field work in ${idleDays} day${idleDays === 1 ? '' : 's'}`
  if (job.stage === 'waiting') return `${head} · nothing on the schedule`
  const pct = job.pctComplete != null ? ` · ${job.pctComplete}% done` : ''
  const bid = job.revenue != null && job.revenue > 0 ? ` · $${Math.round(job.revenue).toLocaleString()} bid` : ''
  return `${head}${pct}${bid}`
}

export function computeJobFollowupQueue(
  candidates: JobFollowupCandidate[],
  reviews: JobFollowupReview[],
  settings: JobFollowupSettings,
  todayYmd: string,
): JobFollowupQueueEntry[] {
  const latestReviewByJob = new Map<string, JobFollowupReview>()
  for (const r of reviews) {
    const prev = latestReviewByJob.get(r.jobId)
    if (!prev || r.reviewedAt > prev.reviewedAt) latestReviewByJob.set(r.jobId, r)
  }

  const entries: JobFollowupQueueEntry[] = []
  for (const job of candidates) {
    const review = latestReviewByJob.get(job.id)
    if (review) {
      if (review.snoozedUntil != null) {
        if (review.snoozedUntil >= todayYmd) continue
      } else {
        const restEndsMs = new Date(review.reviewedAt).getTime() + settings.restDays * DAY_MS
        if (restEndsMs > ymdToUtcMs(todayYmd)) continue
      }
    }

    if ((job.stage === 'waiting' || job.stage === 'working') && job.nextScheduledOn != null && job.nextScheduledOn >= todayYmd) {
      continue
    }

    const latest =
      review && review.reviewedAt > job.latestActivityAt ? review.reviewedAt : job.latestActivityAt
    const quietDays = jobFollowupQuietDays(latest, todayYmd)
    // The idle rule (v2.5510): no approved field day in 21+ days, whatever the notes say.
    const idleDays = jobFollowupIdleDays(job, todayYmd)
    const idle = idleDays != null && idleDays >= JOB_FOLLOWUP_IDLE_DAYS
    if (!idle && quietDays <= jobFollowupThresholdDays(job.stage, settings)) continue

    entries.push({
      job,
      quietDays,
      reason: idle
        ? idleReasonFor(job, idleDays)
        : reasonFor({
            stage: job.stage,
            quietDays,
            nextScheduledOn: job.nextScheduledOn,
            pctComplete: job.pctComplete,
            revenue: job.revenue,
          }),
      why: idle ? 'idle' : 'quiet',
      idleDays,
      need: jobFollowupNeed(job),
    })
  }

  // Stalest first: an idle card ranks by its field-day gap, a quiet card by its quiet days.
  const rank = (e: JobFollowupQueueEntry) => (e.why === 'idle' ? Math.max(e.idleDays ?? 0, e.quietDays) : e.quietDays)
  entries.sort((a, b) => rank(b) - rank(a) || a.job.hcpNumber.localeCompare(b.job.hcpNumber))
  return entries
}

/** The idle cards' figures for the Dashboard card (v2.5510): how many, the contract behind them, how many are the reader's. */
export function jobFollowupIdleSummary(entries: readonly JobFollowupQueueEntry[], userId: string | null | undefined): { count: number; total: number; mine: number } {
  let count = 0
  let total = 0
  let mine = 0
  for (const e of entries) {
    if (e.why !== 'idle') continue
    count += 1
    total += e.job.revenue ?? 0
    if (userId && e.job.masterUserId === userId) mine += 1
  }
  return { count, total, mine }
}

/** The quiet cards alone — the "waiting on a follow-up" card counts these, so an idle job is never counted twice. */
export function jobFollowupQuietEntries(entries: readonly JobFollowupQueueEntry[]): JobFollowupQueueEntry[] {
  return entries.filter((e) => e.why === 'quiet')
}

/** Quiet-days badge severity for the queue list view (v2.1721). */
export type JobFollowupSeverity = 'soft' | 'amber' | 'red'

export function jobFollowupQuietSeverity(quietDays: number): JobFollowupSeverity {
  if (quietDays >= 14) return 'red'
  if (quietDays >= 7) return 'amber'
  return 'soft'
}

/** Stage counts for the deck's filter chips (over the computed queue). */
export function jobFollowupStageCounts(entries: JobFollowupQueueEntry[]): Record<JobFollowupStage, number> {
  const counts: Record<JobFollowupStage, number> = {
    waiting: 0,
    working: 0,
    ready_to_bill: 0,
    billed: 0,
    collections: 0,
  }
  for (const e of entries) counts[e.job.stage] += 1
  return counts
}

const BREAKDOWN_PHRASES: Record<JobFollowupStage, (n: number) => string> = {
  billed: (n) => `${n} billed with no nudge`,
  working: (n) => `${n} working with no recent notes`,
  waiting: (n) => `${n} waiting with nothing scheduled`,
  ready_to_bill: (n) => `${n} ready to bill`,
  collections: (n) => `${n} in collections`,
}
/** Breakdown order: money first. */
const BREAKDOWN_ORDER: JobFollowupStage[] = ['billed', 'working', 'waiting', 'ready_to_bill', 'collections']

/**
 * "68 billed with no nudge · 4 working with no recent notes · …" — the
 * one-line stage breakdown the dashboard banner rendered (v2.1720), shared
 * with the Needs You item (v2.2487). Empty string when nothing is non-zero.
 */
export function jobFollowupBreakdownPhrase(counts: Record<JobFollowupStage, number> | null, max = 3): string {
  if (!counts) return ''
  return BREAKDOWN_ORDER.filter((s) => counts[s] > 0)
    .slice(0, max)
    .map((s) => BREAKDOWN_PHRASES[s](counts[s]))
    .join(' · ')
}

/**
 * The follow-up stages a set of loaded board scopes is authoritative for.
 * Mirrors buildJobsListStagesQuery's per-scope status filters: `billed_all`
 * fetches only status='billed', and no scoped fetch returns a literal
 * 'collections' status (the board derives Collections from billed +
 * collections_at, so real candidates carry 'billed' anyway).
 */
export function followupStagesCoveredByScopes(scopes: ReadonlySet<JobsBoardScope>): Set<JobFollowupStage> {
  const covered = new Set<JobFollowupStage>()
  if (scopes.has('waiting')) covered.add('waiting')
  if (scopes.has('working')) covered.add('working')
  if (scopes.has('ready_to_bill')) covered.add('ready_to_bill')
  if (scopes.has('billed_all')) covered.add('billed')
  return covered
}

/**
 * Drops candidates whose job no longer exists in the tab's live jobs list —
 * a job deleted while the deck is open (Job window Edit tab, migrate-to-bid,
 * another user) otherwise lingers as a stale card whose every action errors
 * "Job not found" (v2.1756). Since scoped loading (v2.1824) the tab's list
 * only holds the sections the device has open, so "missing from the list"
 * only means "deleted" for stages whose scope was actually fetched —
 * `coveredStages` says which those are; candidates in other stages always
 * survive. An empty live set means the jobs list hasn't loaded yet — never
 * wipe the deck on that flash. Returns the same array when nothing is
 * missing so memoized consumers skip re-renders.
 */
export function dropDeletedFollowupCandidates(
  candidates: JobFollowupCandidate[],
  liveJobIds: ReadonlySet<string>,
  coveredStages: ReadonlySet<JobFollowupStage>,
): JobFollowupCandidate[] {
  if (liveJobIds.size === 0 || coveredStages.size === 0) return candidates
  const deleted = (c: JobFollowupCandidate) => coveredStages.has(c.stage) && !liveJobIds.has(c.id)
  return candidates.some(deleted) ? candidates.filter((c) => !deleted(c)) : candidates
}
