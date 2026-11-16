import type { LienNoticeFields } from '../jobsDocuments/lienNoticeFieldsType'

/**
 * A notice whose paper and whose bills have parted (v2.7517). A desk item keeps the notice as it was drafted
 * (`fields.notice`), and the run prints that stored paper, while the pay page, the envelope divider and the
 * enclosed invoices read the bills as they stand. A bill corrected after the draft was made left one packet
 * stating two amounts: the signed pages the old claim, the rest the new one. This kernel is the one rule that
 * sets the stored paper beside what the desk would draw today and says how they differ. Pure: the run holds a
 * parted notice out of the print (`runNoticeProblems`, `runEnvelopeHold`), and the desk reads the same answer.
 *
 * Three values are money the bills decide, so three are compared: the claim, the retainage named inside it and
 * the split by month. The typed wording, the names and the date are not money and are left alone.
 */
export type LienNoticeMoney = Pick<LienNoticeFields, 'claimAmount' | 'claimSplit' | 'retainageIncluded'>

export type LienNoticePartedKey = 'claim' | 'retainage' | 'split'

export type LienNoticeParted = {
  /** What differs, in the order the paper prints it. Never empty. */
  parts: LienNoticePartedKey[]
  /** The claim the stored paper prints, in dollars. */
  paperClaim: number
  /** The claim the desk would draw now, in dollars. */
  nowClaim: number
  /** The retainage the stored paper names inside its claim; 0 when it names none. */
  paperRetainage: number
  /** The retainage the desk would name now; 0 when none. */
  nowRetainage: number
  /** Where today's claim comes from: the bills, or a figure the office set by hand over them. */
  source: 'bills' | 'hand'
  /** On one paper for several jobs (`lienNoticeCombine.ts`): the job whose stored paper parted, so the hold names it and not the whole paper. */
  job?: string
}

/** A money value as the notice keeps it ("17585.00" or "$17,585.00") in cents; 0 when it is not a number. */
function cents(raw: string | null | undefined): number {
  const n = Number(String(raw ?? '').replace(/[$,\s]/g, ''))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

/**
 * How the stored paper differs from what the desk draws now, or null when the money agrees to the cent.
 * Null too when either side is missing: a caller that has nothing to compare holds nothing.
 */
export function lienNoticeParted(paper: LienNoticeMoney | null | undefined, now: LienNoticeMoney | null | undefined, source: 'bills' | 'hand' = 'bills'): LienNoticeParted | null {
  if (!paper || !now) return null
  const parts: LienNoticePartedKey[] = []
  if (cents(paper.claimAmount) !== cents(now.claimAmount)) parts.push('claim')
  if (cents(paper.retainageIncluded) !== cents(now.retainageIncluded)) parts.push('retainage')
  if ((paper.claimSplit ?? '').trim() !== (now.claimSplit ?? '').trim()) parts.push('split')
  if (parts.length === 0) return null
  return {
    parts,
    paperClaim: cents(paper.claimAmount) / 100,
    nowClaim: cents(now.claimAmount) / 100,
    paperRetainage: cents(paper.retainageIncluded) / 100,
    nowRetainage: cents(now.retainageIncluded) / 100,
    source,
  }
}

function usd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

/**
 * What parted, in words with both figures: *The paper claims $18,400.00. The bills now come to $6,150.00,
 * $12,250.00 less.* A claim that agrees says the part that does not: the retainage, or the split by month.
 */
export function lienNoticePartedWords(p: LienNoticeParted): string {
  const out: string[] = []
  if (p.parts.includes('claim')) {
    const gap = Math.abs(p.paperClaim - p.nowClaim)
    const way = p.nowClaim < p.paperClaim ? 'less' : 'more'
    const now = p.source === 'hand' ? `The claim set by hand is now ${usd(p.nowClaim)}` : `The bills now come to ${usd(p.nowClaim)}`
    out.push(`The paper claims ${usd(p.paperClaim)}. ${now}, ${usd(gap)} ${way}.`)
  }
  if (p.parts.includes('retainage')) {
    const paper = p.paperRetainage > 0 ? `The paper names ${usd(p.paperRetainage)} of retainage inside the claim.` : 'The paper names no retainage inside the claim.'
    const now = p.nowRetainage > 0 ? `The job now holds ${usd(p.nowRetainage)}.` : 'The job now holds none.'
    out.push(`${paper} ${now}`)
  }
  if (p.parts.includes('split') && !p.parts.includes('claim')) out.push('The paper splits the claim by month another way than the desk does now.')
  return out.join(' ')
}

/** The run's hold on a parted notice: the words, then what lifts it. */
export function lienNoticePartedHold(p: LienNoticeParted): string {
  return `${lienNoticePartedWords(p)} It prints once the notice is redrawn from the bills.`
}

/**
 * Why a notice may not print at all, or null: its stored paper and the bills have parted. The packet reads it through
 * the envelope's hold; the presses that print one copy or one envelope by itself ask here, so no route out of the run
 * prints signed pages the pay page contradicts. A notice already printed is past this: the paper is out of the printer
 * as it was, and the hold would only stop the record.
 */
export function runNoticePrintRefusal(n: { parted?: LienNoticeParted | null; printedAt?: string | null; jobNumber: string }): string | null {
  return n.parted && !n.printedAt ? `${n.parted.job ?? n.jobNumber}: ${lienNoticePartedHold(n.parted)}` : null
}
