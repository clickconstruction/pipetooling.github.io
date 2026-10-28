/**
 * The pace a payer reads at: one rule for the Collect desk's pile and the
 * expected-pay model (punch list #177, decision 1; v2.5848 wrote it for the
 * pile, v2.6034 moves the model onto it). The pace is the payer's own median
 * when it has `minSamples`; else the GC pace here, the median of the GC
 * payers' own medians, when the payer is a GC and `gcPaceForNewGc`; else the
 * payer's segment median, residential or commercial; else the company's.
 * A payer is a GC by record (some job names it as its GC), by a pay
 * application on the job, or by a commercial payer's bill marked billed by
 * hand, which is how a pay application is recorded today. The rules are
 * inputs, never constants; a caller that cannot say whether the payer is a
 * GC passes nothing, and the payer reads as one that is not. Pure:
 * `payPaceIo.ts` beside it does the reads.
 */
import type { PaySpeedData, PaySpeedStat } from './billedExpectedPay'

/**
 * Below this many samples a payer's own median is ignored for the fallbacks.
 * 1 since v2.4376 (owner call, 2026-10-02: "use the builder's history after only one payment"):
 * a payer's own record beats the company median, which homeowners pull down. Was 3.
 * The hover says how many payments it rests on ("~74 days over 1 payment").
 */
export const PAY_SPEED_MIN_SAMPLES = 1

export type PaceSource = 'own' | 'gc' | 'segment' | 'company' | 'none'

export type PaceRules = {
  /** Samples a payer needs before its own median is its pace. */
  minSamples: number
  /** Decision 1: a payer with a pay application on the job reads as a GC. */
  gcByPayApp: boolean
  /** Decision 1: a commercial payer whose bill was marked billed by hand reads as a GC, since that is how a pay application is recorded today. */
  gcByHandMarked: boolean
  /** Decision 1: a GC with no history reads at the GC pace here, else at the segment median. */
  gcPaceForNewGc: boolean
}

export const PACE_RULES_DEFAULT: PaceRules = {
  minSamples: PAY_SPEED_MIN_SAMPLES,
  gcByPayApp: true,
  gcByHandMarked: true,
  gcPaceForNewGc: true,
}

export type PaceRead = { paceDays: number | null; source: PaceSource; samples: number }

/** The median of the GC payers' own medians: the pace a first-job GC reads at, with how many payers it rests on. */
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
export function paceFor(args: { payerId: string | null; isGc: boolean; paySpeeds: PaySpeedData | null; gcPace: PaySpeedStat | null; rules: PaceRules }): PaceRead {
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

/** The two facts decision 1 reads, loaded by `loadPaceFacts`. */
export type PaceFacts = {
  /** Payers that are GCs by record: a customer some job names as its GC. */
  gcPayerIds: ReadonlySet<string>
  /** Jobs with a live pay application. */
  payAppJobIds: ReadonlySet<string>
}

/** What decides whether one bill's payer reads as a GC. */
export type PaceBill = {
  payerId: string | null
  jobId: string | null
  /** False when the bill was marked billed by hand and never sent from here; null or absent when unknown. */
  sentFromHere?: boolean | null
}

/** Decision 1: whether a bill's payer reads as a GC, and whether it is one by record. */
export function readsAsGc(bill: PaceBill, args: { paySpeeds: PaySpeedData | null; facts: PaceFacts; rules: PaceRules }): { isGc: boolean; gcByRecord: boolean } {
  const { paySpeeds, facts, rules } = args
  const commercial = bill.payerId != null && paySpeeds?.customerTypes[bill.payerId] === 'commercial'
  const gcByRecord = bill.payerId != null && facts.gcPayerIds.has(bill.payerId)
  const isGc = gcByRecord || (rules.gcByPayApp && bill.jobId != null && facts.payAppJobIds.has(bill.jobId)) || (rules.gcByHandMarked && commercial && bill.sentFromHere === false)
  return { isGc, gcByRecord }
}

/** Whether a bill went out from here, as the pile reads it: a send stamp means yes, none means marked billed by hand, an absent column means unknown. */
export function sentFromHereOf(inv: object | null | undefined): boolean | null {
  if (!inv || !('sent_to_customer_at' in inv)) return null
  const at = (inv as { sent_to_customer_at?: string | null }).sent_to_customer_at
  return at === undefined ? null : !!at
}

/** What `billedExpectedPayModel` reads the pace by: whether the payer is a GC, the GC pace here and its payer count, and the rule. */
export type PaceInput = {
  isGc?: boolean
  gcPace?: PaySpeedStat | null
  gcPacePayers?: number
  rules?: Partial<PaceRules>
}

/** The facts with the GC pace here worked out once, for every bill a screen reads. */
export type PaceContext = {
  facts: PaceFacts
  /** The GC pace here and how many payers it rests on. */
  gcPace: PaySpeedStat | null
  gcPacePayers: number
  rules: PaceRules
}

/**
 * The context a screen reads its bills in: the facts, and the GC pace here over the GC
 * payers among `payerIds`, the ones we are collecting from now, the way the Collect desk
 * rests it on the GC payers in the pile. Null without the facts, so every bill reads as
 * one whose payer is not a GC.
 */
export function paceContextFor(args: { facts: PaceFacts | null; paySpeeds: PaySpeedData | null; payerIds: Iterable<string | null | undefined>; rules?: Partial<PaceRules> }): PaceContext | null {
  if (!args.facts) return null
  const rules: PaceRules = { ...PACE_RULES_DEFAULT, ...(args.rules ?? {}) }
  const here = new Set<string>()
  for (const id of args.payerIds) if (id && args.facts.gcPayerIds.has(id)) here.add(id)
  const { stat, payers } = gcPaceHere(args.paySpeeds, here, rules.minSamples)
  return { facts: args.facts, gcPace: stat, gcPacePayers: payers, rules }
}

/** One bill's pace input for `billedExpectedPayModel`; null with no context, and the model reads own → segment → company. */
export function paceInputFor(ctx: PaceContext | null, bill: PaceBill, paySpeeds: PaySpeedData | null): PaceInput | null {
  if (!ctx) return null
  const { isGc } = readsAsGc(bill, { paySpeeds, facts: ctx.facts, rules: ctx.rules })
  return { isGc, gcPace: ctx.gcPace, gcPacePayers: ctx.gcPacePayers, rules: ctx.rules }
}
