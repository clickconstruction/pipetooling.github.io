/**
 * The Collect desk, PR A (punch list #177, v2.5848): every open bill in the
 * billed-not-paid pile read by where it stands against its payer's own pace,
 * the way the Monday board draws it. A bill is `notdue` until its billed day
 * plus the payer's pace, `late` past that, `doubtful` once it is more than
 * DOUBTFUL_AFTER_DAYS past it, `promised` while a recorded promise's day has
 * not come, `broken` once that day is more than BROKEN_PROMISE_GRACE_DAYS gone,
 * and `collections` when the office parked the job. The pace is the payer's
 * own median when it has enough samples, else the GC pace here for a GC
 * (a GC by record, or by a pay application on the job: the owner's decision 1),
 * else the payer's segment median, else the company's. Pure: the loader
 * beside it does the reads; the rules are inputs, never constants.
 */
import { BROKEN_PROMISE_GRACE_DAYS } from '../../jobs/paymentChase'
import { DOUBTFUL_AFTER_DAYS } from '../cashForecast'
import { PAY_SPEED_MIN_SAMPLES, daysBetweenYmd, type PaySpeedData, type PaySpeedStat, type PromisedPayDate } from '../../jobs/billedExpectedPay'
import { ymdAddDays } from '../../../utils/dateUtils'

export type CollectBillState = 'collections' | 'promised' | 'broken' | 'doubtful' | 'late' | 'notdue'

/** The order the bar draws them, left to right; Collections is apart, off the bar. */
export const COLLECT_BAR_STATES: ReadonlyArray<Exclude<CollectBillState, 'collections'>> = ['notdue', 'promised', 'broken', 'late', 'doubtful']

export type CollectPaceSource = 'own' | 'gc' | 'segment' | 'company' | 'none'

export type CollectBill = {
  /** `inv:<invoice id>` or `job:<job id>`, the AR row's key. */
  key: string
  jobId: string | null
  /** The payer bill truth filed the bill under: the GC on a GC-billed bill, else the customer. */
  payerId: string | null
  payerName: string
  /** The day the bill was marked billed or went out, YYYY-MM-DD; null on a settled or shell row. */
  billedYmd: string | null
  /** What is still owed on it. */
  usd: number
  inCollections?: boolean
  /** False when the bill was marked billed by hand and never sent from here; null when unknown. */
  sentFromHere?: boolean | null
}

export type CollectRules = {
  /** Days after a promised day before the promise reads as broken. */
  brokenGraceDays: number
  /** Days past the expected day before a bill reads as doubtful. */
  doubtfulAfterDays: number
  /** Samples a payer needs before its own median is its pace. */
  minSamples: number
  /** Decision 1: a payer with a pay application on the job reads as a GC. */
  gcByPayApp: boolean
  /** Decision 1: a GC with no history reads at the GC pace here, else at the segment median. */
  gcPaceForNewGc: boolean
}

export const COLLECT_RULES_DEFAULT: CollectRules = {
  brokenGraceDays: BROKEN_PROMISE_GRACE_DAYS,
  doubtfulAfterDays: DOUBTFUL_AFTER_DAYS,
  minSamples: PAY_SPEED_MIN_SAMPLES,
  gcByPayApp: true,
  gcPaceForNewGc: true,
}

export type CollectPileInput = {
  bills: ReadonlyArray<CollectBill>
  paySpeeds: PaySpeedData | null
  /** Job id → the promise on it (`list_job_promised_pay_dates`). */
  promisesByJob: Readonly<Record<string, PromisedPayDate>> | null
  /** Jobs with a live pay application. */
  payAppJobIds: ReadonlySet<string>
  /** Payers that are GCs by record: a customer some job names as its GC. */
  gcPayerIds: ReadonlySet<string>
  todayYmd: string
  rules?: Partial<CollectRules>
}

export type CollectBillRead = CollectBill & {
  state: CollectBillState
  isGc: boolean
  /** Days the payer takes to pay, by the source named; null when nothing reads. */
  paceDays: number | null
  paceSource: CollectPaceSource
  paceSamples: number
  /** The billed day plus the pace; a promise's day when one stands; null with no day to read. */
  expectedYmd: string | null
  /** Days today is past the expected day; negative while it is still ahead; null with no day. */
  daysPastExpected: number | null
  /** Days since the bill was billed; null on a row with no day. */
  ageDays: number | null
  promise: PromisedPayDate | null
}

export type CollectStateTotal = { usd: number; count: number }

export type CollectPile = {
  bills: CollectBillRead[]
  byState: Record<CollectBillState, CollectStateTotal>
  /** Everything but Collections: the card's headline. */
  headlineUsd: number
  headlineCount: number
  /** `late` plus `broken`: the part a call can move. */
  latePileUsd: number
  latePileCount: number
  /** Bills past their expected day, late, broken or doubtful: the card's "N invoices late". */
  pastDueCount: number
  /** The GC pace here: the median of the GC payers' own medians, with how many payers it rests on. */
  gcPace: PaySpeedStat | null
  gcPacePayers: number
  rules: CollectRules
}

const EMPTY: CollectStateTotal = { usd: 0, count: 0 }

/** The median of the GC payers' own medians: the pace a first-job GC reads at. */
export function gcPaceHere(paySpeeds: PaySpeedData | null, gcPayerIds: ReadonlySet<string>, minSamples: number): { stat: PaySpeedStat | null; payers: number } {
  if (!paySpeeds) return { stat: null, payers: 0 }
  const medians: number[] = []
  let samples = 0
  for (const id of gcPayerIds) {
    const own = paySpeeds.customers[id]
    if (!own || own.samples < minSamples) continue
    medians.push(own.medianDays)
    samples += own.samples
  }
  if (!medians.length) return { stat: null, payers: 0 }
  medians.sort((a, b) => a - b)
  const mid = Math.floor(medians.length / 2)
  const median = medians.length % 2 ? medians[mid]! : (medians[mid - 1]! + medians[mid]!) / 2
  return { stat: { medianDays: Math.round(median), samples }, payers: medians.length }
}

/** The pace one payer reads at, by the first source that has one. */
export function collectPaceFor(args: { payerId: string | null; isGc: boolean; paySpeeds: PaySpeedData | null; gcPace: PaySpeedStat | null; rules: CollectRules }): { paceDays: number | null; source: CollectPaceSource; samples: number } {
  const { payerId, isGc, paySpeeds, gcPace, rules } = args
  if (!paySpeeds) return { paceDays: null, source: 'none', samples: 0 }
  const own = payerId ? paySpeeds.customers[payerId] : undefined
  if (own && own.samples >= rules.minSamples) return { paceDays: own.medianDays, source: 'own', samples: own.samples }
  if (isGc && rules.gcPaceForNewGc && gcPace) return { paceDays: gcPace.medianDays, source: 'gc', samples: gcPace.samples }
  const segment = payerId ? paySpeeds.customerTypes[payerId] : undefined
  const seg = segment ? paySpeeds.segments[segment] : null
  if (seg && seg.samples >= rules.minSamples) return { paceDays: seg.medianDays, source: 'segment', samples: seg.samples }
  if (paySpeeds.company && paySpeeds.company.samples >= rules.minSamples) return { paceDays: paySpeeds.company.medianDays, source: 'company', samples: paySpeeds.company.samples }
  return { paceDays: null, source: 'none', samples: 0 }
}

export function buildCollectPile(input: CollectPileInput): CollectPile {
  const rules: CollectRules = { ...COLLECT_RULES_DEFAULT, ...(input.rules ?? {}) }
  const { stat: gcPace, payers: gcPacePayers } = gcPaceHere(input.paySpeeds, input.gcPayerIds, rules.minSamples)
  const bills: CollectBillRead[] = []
  const byState: Record<CollectBillState, CollectStateTotal> = { collections: { ...EMPTY }, promised: { ...EMPTY }, broken: { ...EMPTY }, doubtful: { ...EMPTY }, late: { ...EMPTY }, notdue: { ...EMPTY } }

  for (const b of input.bills) {
    if (!(b.usd > 0)) continue
    const isGc = (b.payerId != null && input.gcPayerIds.has(b.payerId)) || (rules.gcByPayApp && b.jobId != null && input.payAppJobIds.has(b.jobId))
    const pace = collectPaceFor({ payerId: b.payerId, isGc, paySpeeds: input.paySpeeds, gcPace, rules })
    const promise = b.jobId && input.promisesByJob ? (input.promisesByJob[b.jobId] ?? null) : null
    const ageDays = b.billedYmd ? daysBetweenYmd(b.billedYmd, input.todayYmd) : null
    let state: CollectBillState
    let expectedYmd: string | null = null
    let daysPastExpected: number | null = null
    if (b.inCollections) {
      state = 'collections'
      expectedYmd = promise?.promisedYmd ?? (b.billedYmd && pace.paceDays != null ? ymdAddDays(b.billedYmd, pace.paceDays) : null)
      daysPastExpected = expectedYmd ? daysBetweenYmd(expectedYmd, input.todayYmd) : null
    } else if (promise) {
      expectedYmd = promise.promisedYmd
      daysPastExpected = daysBetweenYmd(promise.promisedYmd, input.todayYmd)
      state = daysPastExpected != null && daysPastExpected > rules.brokenGraceDays ? 'broken' : 'promised'
    } else if (b.billedYmd && pace.paceDays != null) {
      expectedYmd = ymdAddDays(b.billedYmd, pace.paceDays)
      daysPastExpected = daysBetweenYmd(expectedYmd, input.todayYmd)
      state = daysPastExpected == null || daysPastExpected <= 0 ? 'notdue' : daysPastExpected > rules.doubtfulAfterDays ? 'doubtful' : 'late'
    } else {
      state = 'notdue'
    }
    bills.push({ ...b, state, isGc, paceDays: pace.paceDays, paceSource: pace.source, paceSamples: pace.samples, expectedYmd, daysPastExpected, ageDays, promise })
    byState[state].usd += b.usd
    byState[state].count += 1
  }

  const sum = (...states: CollectBillState[]): CollectStateTotal => states.reduce((acc, s) => ({ usd: acc.usd + byState[s].usd, count: acc.count + byState[s].count }), { ...EMPTY })
  const headline = sum('notdue', 'promised', 'broken', 'late', 'doubtful')
  const latePile = sum('late', 'broken')
  const pastDue = sum('late', 'broken', 'doubtful')
  return { bills, byState, headlineUsd: headline.usd, headlineCount: headline.count, latePileUsd: latePile.usd, latePileCount: latePile.count, pastDueCount: pastDue.count, gcPace, gcPacePayers, rules }
}
