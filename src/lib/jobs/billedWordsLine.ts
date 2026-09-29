/**
 * The words line under a Billed row's bar (v2.4130).
 *
 * Working rows print the crew's story — "Worked Fri · 80% Sep 3". On a Billed
 * row the job is finished, so the line tells the bill's story instead:
 *
 *   Billed Sep 15 · expect ~Oct 6
 *   Billed Sep 15 · 21 d past expected
 *   Billed Sep 15 · 21 d past expected · they said Oct 3
 *   Billed Sep 15 · they said Oct 3 · 4 d past it
 *
 * `billed` is plain text; `expect` is the one clause a click acts on — it opens
 * They said… (a first promise) or New date… (one is already on record). The
 * tone follows the money: plain inside the window the customer's own pay
 * history predicts, amber once past it (or past what they promised), red in
 * Collections. Hours never colour a Billed row.
 */
import {
  billedExpectedPayModel,
  billedReferenceYmd,
  daysBetweenYmd,
  formatYmdMonthDay,
  type ExpectedPayRowInput,
  type PaySpeedData,
  type PromisedPayDate,
} from './billedExpectedPay'
import type { ProgressPaymentTone } from './progressPaymentCell'

export type BilledWordsLine = {
  /** "Billed Sep 15" · "No bill date". */
  billed: string
  /** The expectation clause, or null when nothing is known yet. */
  expect: string | null
  /** What a click on `expect` records. */
  action: 'they-said' | 'new-date'
  tone: ProgressPaymentTone
  /** The tooltip: the math behind the estimate and the promise on record. */
  title: string
  /** The whole line as one sentence (the bar's accessible name). */
  full: string
}

export type BilledWordsLineInput = {
  row: ExpectedPayRowInput
  data: PaySpeedData | null
  todayYmd: string
  promise: PromisedPayDate | null
  inCollections: boolean
}

export function buildBilledWordsLine({ row, data, todayYmd, promise, inCollections }: BilledWordsLineInput): BilledWordsLine {
  const refYmd = billedReferenceYmd(row)
  const billed = refYmd ? `Billed ${formatYmdMonthDay(refYmd)}` : 'No bill date'

  const parts: string[] = []
  const titles: string[] = []
  let late = false

  // The statistical estimate, promise or not — a promise sits beside it, never in place of it.
  const stat = billedExpectedPayModel(row, data, todayYmd, null)
  if (stat) {
    parts.push(stat.state === 'late' ? `${stat.daysLate} d past expected` : `expect ~${formatYmdMonthDay(stat.expectedYmd)}`)
    titles.push(stat.title)
    if (stat.state === 'late') late = true
  }

  if (promise) {
    const since = daysBetweenYmd(promise.promisedYmd, todayYmd)
    const pastIt = since != null && since > 0
    parts.push(`they said ${formatYmdMonthDay(promise.promisedYmd)}${pastIt ? ` · ${since} d past it` : ''}`)
    const promised = billedExpectedPayModel(row, data, todayYmd, promise)
    if (promised) titles.push(promised.title)
    if (pastIt) late = true
  }

  const expect = parts.length > 0 ? parts.join(' · ') : null
  const tone: ProgressPaymentTone = inCollections ? 'red' : late ? 'amber' : 'plain'
  const title = titles.length > 0 ? titles.join(' — ') : refYmd ? `${billed} · no pay-speed history yet` : 'No bill date on this line, so it cannot age or be forecast'
  return {
    billed,
    expect,
    action: promise ? 'new-date' : 'they-said',
    tone,
    title,
    full: expect ? `${billed} · ${expect}` : billed,
  }
}
