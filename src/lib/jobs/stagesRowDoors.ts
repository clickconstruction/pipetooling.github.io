/**
 * One door for each thing on a Pipeline row (v2.4324, owner-approved canvas
 * https://claude.ai/artifact/WsmWFwKjA9nHxLHRgxv3AM). The row used to open the
 * same place twice: Reports and See all (the job's trail), Sessions and the
 * hours chip (the job's clock sessions), the ✍ quick action and the contract
 * chip (the Contract window), and it printed the bill date twice. These are the
 * words and the rule the renderers share; the doors themselves stay in
 * `jobsStagesRowShared.tsx` and `JobsStagesActivityBox.tsx`.
 */
import { billedReferenceYmd } from './billedExpectedPay'

/**
 * The words on the one door into a job's notes and reports: the activity box's
 * strip on a wide screen, the Job column's pill where there is no box.
 * `count` is what the box has loaded (null before it loads); `reports` keeps the
 * signal the old "N Reports" pill carried. "See all" · "See all 3" ·
 * "See all 9 · 1 report" · "See all · 2 reports".
 */
export function seeAllDoorWords(count: number | null, reports: number): string {
  const head = count != null && count > 0 ? `See all ${count}` : 'See all'
  if (!(reports > 0)) return head
  return `${head} · ${reports} report${reports === 1 ? '' : 's'}`
}

/**
 * The date on the Billed line of a row's dates block (`buildBilledDatesLedger`):
 * the bill's `billed_at`, else its estimated bill date. Null when the row has
 * no bill line, so its block prints no Billed line.
 */
export function datesBlockBilledYmd(inv: { billed_at: string | null; estimated_bill_date?: string | null } | null | undefined): string | null {
  if (!inv) return null
  return billedReferenceYmd({ billedAtIso: inv.billed_at, estBillYmd: inv.estimated_bill_date ?? null })
}

/**
 * The Crew & Dates column's bill line repeats the dates block on a Billed or
 * Collections row: both say *Billed Sep 3*. It goes there. A *Paid* line says
 * something the block does not (when money last came in), so it stays, and so
 * does every line on a row that draws no dates block or no Billed line in it.
 */
export function crewBillLineRepeatsDates(args: {
  /** `stripBillParts(...).label`: 'Billed' or 'Paid'; null when the job has no bill activity. */
  billLabel: string | null
  jobStatus: string | null | undefined
  /** `datesBlockBilledYmd` of the row's bill; null when the row draws no dates block. */
  datesBilledYmd: string | null
}): boolean {
  return args.billLabel === 'Billed' && args.jobStatus === 'billed' && args.datesBilledYmd != null
}
