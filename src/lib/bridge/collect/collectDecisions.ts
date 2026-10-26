/**
 * The Collect desk, PR C (v2.5854): only the owner can decide these. The rows
 * the office cannot act on alone, lifted out of the call sheet into a strip
 * of their own: a payer that reads as a GC while the job records it as the
 * customer, a lien affidavit with a window open, a slow payer whose next bid
 * needs terms, a dispute recorded this week. At most three, money first. Pure.
 */
import type { LienArChip } from '../../jobs/lienArChip'
import { stageUsd } from '../stageFlow'
import type { CollectPayer, CollectPayerCut } from './collectPayers'
import { chipSentence } from './collectWords'

export type CollectDecision = {
  kind: 'gc_record' | 'affidavit' | 'terms' | 'dispute'
  head: string
  words: string
  door: { label: string; href: string }
  usd: number
}

export type CollectDecisionOptions = {
  chipFor: (p: CollectPayer) => LienArChip | null
  lienHref?: ((door: LienArChip['door']) => string) | null
  customerHref: (payerId: string) => string
  /** The door to the payer's jobs (v2.5873): one job opens its Edit Job, several open the board. */
  jobsHref: (jobIds: ReadonlyArray<string>) => string
  dayLabel: (ymd: string) => string
  /** A payer whose own pace is this long or longer gets terms on the next bid. */
  slowDays?: number
  max?: number
}

export function collectDecisions(cut: CollectPayerCut, opts: CollectDecisionOptions): CollectDecision[] {
  const slowDays = opts.slowDays ?? 60
  const out: CollectDecision[] = []
  const inCut = new Set(cut.cut)
  for (const p of cut.payers) {
    const chip = opts.chipFor(p)
    // A GC by hand-marked bill or pay application, not by record: asked, on the payers that hold the pile (v2.5873).
    // A commercial owner billed by hand reads the same, so it is a question, never an order.
    if (p.isGc && !p.gcByRecord && inCut.has(p)) {
      const jobIds = [...new Set(p.bills.map((b) => b.jobId).filter((id): id is string => !!id))]
      out.push({
        kind: 'gc_record',
        head: `Is ${p.payerName} the GC on ${jobIds.length === 1 ? 'this job' : 'these jobs'}?`,
        words: `${stageUsd(p.usd)} was marked billed by hand, the way a pay application is recorded. If it is the GC, put it on as the GC in Edit Job. Then the Lien desk and GC Review see the money. The statute's clock runs anyway.`,
        door: { label: jobIds.length === 1 ? 'Open the job' : 'Open the jobs', href: opts.jobsHref(jobIds) },
        usd: p.usd,
      })
    }
    if (chip && chip.paper === 'affidavit' && opts.lienHref) {
      out.push({
        kind: 'affidavit',
        head: chip.dueOn ? `File the ${p.payerName} lien by ${opts.dayLabel(chip.dueOn)}.` : `File the ${p.payerName} lien.`,
        words: `${stageUsd(p.usd)} open. ${chipSentence(chip.sentence)} The affidavit needs a signature and a notary.`,
        door: { label: 'Open the affidavit', href: opts.lienHref(chip.door) },
        usd: p.usd,
      })
    }
    if (p.lastTouch?.outcome === 'dispute' && p.payerId) {
      out.push({
        kind: 'dispute',
        head: `${p.payerName} disputes it.`,
        words: `${stageUsd(p.usd)} open. ${p.lastTouch.note ? `Their words: ${p.lastTouch.note}` : 'No words were recorded.'} The bills stay in the pile until you decide.`,
        door: { label: 'Open the customer', href: opts.customerHref(p.payerId) },
        usd: p.usd,
      })
    }
    if (p.paceSource === 'own' && p.paceDays != null && p.paceDays >= slowDays && p.payerId) {
      out.push({
        kind: 'terms',
        head: `Terms for ${p.payerName} on the next bid.`,
        words: `${p.paceDays} days to pay on the ${p.paceSamples} ${p.paceSamples === 1 ? 'job' : 'jobs'} on record. A deposit, or shorter terms, or the price carries the wait.`,
        door: { label: 'Open the customer', href: opts.customerHref(p.payerId) },
        usd: p.usd,
      })
    }
  }
  out.sort((a, b) => b.usd - a.usd)
  return out.slice(0, opts.max ?? 3)
}
