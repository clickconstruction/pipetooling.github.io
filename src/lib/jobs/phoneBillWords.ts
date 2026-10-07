import type { BillingActivityDetail } from '../stagesJobReferenceDates'
import { billedReferenceYmd } from './billedExpectedPay'
import { effectiveInvoiceEstBillDate } from './invoiceBilling'
import type { JobNextStage } from './jobNextLine'
import { stripBillParts, stripDistancePhrase } from './stagesScheduleStrip'

type PhoneBillInvoice = Parameters<typeof effectiveInvoiceEstBillDate>[0]

/**
 * The phone card's billing clause — "billed 5 weeks ago" / "paid today" (v2.3792).
 *
 * On a Billed or Collections bill row the words read the bill's own reference day
 * (`billedReferenceYmd`: the hand-set estimate, else the day it was billed — the day the
 * desktop row's dates block prints), never the job's latest billing event: a bill resent
 * after a returned check is still the May bill, and the card used to say "billed 5 weeks
 * ago" of a bill 144 days old (punch list #93 B, v2.4760). Everywhere else — a working job's
 * progress bill, a Collections shell with no line — the latest event still speaks.
 */
export function phoneBillWords(args: {
  stage: JobNextStage
  inv: PhoneBillInvoice | null
  detail: BillingActivityDetail | null
  todayYmd: string
}): string | null {
  const { stage, inv, detail, todayYmd } = args
  if ((stage === 'billed' || stage === 'collections') && inv) {
    const ymd = billedReferenceYmd({ billedAtIso: inv.billed_at, estBillYmd: effectiveInvoiceEstBillDate(inv) })
    if (ymd) return `billed ${stripDistancePhrase(ymd, todayYmd) ?? stripBillParts({ ymd, labels: ['Invoice billed'] }, todayYmd).main}`
  }
  if (!detail) return null
  const bill = stripBillParts(detail, todayYmd)
  return `${bill.label === 'Paid' ? 'paid' : 'billed'} ${stripDistancePhrase(detail.ymd, todayYmd) ?? bill.main}`
}
