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
  jobsHref: string
  dayLabel: (ymd: string) => string
  /** A payer whose own pace is this long or longer gets terms on the next bid. */
  slowDays?: number
  max?: number
}

export function collectDecisions(cut: CollectPayerCut, opts: CollectDecisionOptions): CollectDecision[] {
  const slowDays = opts.slowDays ?? 60
  const out: CollectDecision[] = []
  for (const p of cut.payers) {
    const chip = opts.chipFor(p)
    if (p.isGc && !p.gcByRecord) {
      out.push({
        kind: 'gc_record',
        head: `Put ${p.payerName} on the job as the GC.`,
        words: `Today it is the customer, so the Lien desk and GC Review never see the ${stageUsd(p.usd)}. The statute's clock runs anyway. Two minutes in Edit Job.`,
        door: { label: 'Open the jobs', href: opts.jobsHref },
        usd: p.usd,
      })
    }
    if (chip && chip.paper === 'affidavit' && opts.lienHref) {
      out.push({
        kind: 'affidavit',
        head: chip.dueOn ? `File the ${p.payerName} lien by ${opts.dayLabel(chip.dueOn)}.` : `File the ${p.payerName} lien.`,
        words: `${stageUsd(p.usd)} open. ${chip.sentence} The affidavit needs a signature and a notary.`,
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
