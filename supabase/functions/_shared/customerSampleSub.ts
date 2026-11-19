/**
 * The sample of a sub's page as `sub-portal` answers it for the sample token (Settings → What customers see → Sub
 * portal): Sam's Plumbing's statement from `customerSampleFixtures.ts`, with two more sheets that show the two
 * sentences of punch list #388. One waits on the customer and says how long this customer usually takes. One says
 * the customer paid, with the day.
 *
 * Its own file, never `customerSampleFixtures.ts`, which seven other public functions import: an edit there puts
 * every one of them behind its deploy, and this sample is read by `sub-portal` alone.
 *
 * Neither sentence is typed here. The weeks are `usualPayWeeks` on the sample payer's made-up gaps, and the day is
 * `customerPaidOn` on a made-up bill marked paid, so the sample obeys the rules a real page is fed by: nothing
 * below five payments, the day and never the amount.
 */
import { SAMPLE_OWNER, ymdPlusDays } from './customerSample.ts'
import { sampleSubPortalResponse } from './customerSampleFixtures.ts'
import type { SamplePortalCompany } from './customerSampleLegal.ts'
import { customerPaidOn, usualPayWeeks } from './subPortalCustomerPaid.ts'

/**
 * The sample payer's last six bills, each as the days from the bill to its money. Six is over the floor of five
 * payments, so `usualPayWeeks` answers, and it answers 4 to 6 weeks.
 */
export const SAMPLE_SUB_PAYER_GAP_DAYS: readonly number[] = [26, 29, 33, 36, 40, 44]

/** The bill the sample's paid sheet rides on, as the office's record holds it once nothing is left open on it. */
const SAMPLE_SUB_PAID_BILL = { id: 'sample-sub-bill-1', status: 'paid' } as const

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

export function sampleSubPortalPage(company: SamplePortalCompany, todayYmd: string, payRun: { day: string | null; nextRun: string | null; explainer: string | null }): Record<string, unknown> {
  const base = sampleSubPortalResponse(company, todayYmd, payRun)
  const usualWeeks = usualPayWeeks(SAMPLE_SUB_PAYER_GAP_DAYS)
  const paidOn = customerPaidOn({
    stage: 'customer_pay',
    drawInvoiceId: SAMPLE_SUB_PAID_BILL.id,
    bills: [SAMPLE_SUB_PAID_BILL],
    payments: [{ invoice_id: SAMPLE_SUB_PAID_BILL.id, paid_on: ymdPlusDays(todayYmd, -1) }],
  })
  const added = [
    // Waiting on the customer, with no pay day: the waiting sentence, and under it how long this customer usually takes.
    {
      id: 'sample-sheet-3',
      jobNumber: 'J-1003',
      address: '210 Sample Ln, Kyle, TX 78640',
      stage: 'customer_pay',
      stageChangedOn: ymdPlusDays(todayYmd, -6),
      stageSource: 'office',
      items: [{ label: '6 × Rough-in fixtures — 2.5 hr each @ $58/hr', amount: 870 }],
      agreed: 870,
      paid: 0,
      backcharges: 0,
      open: 870,
      payableAfter: null,
      payHoldReason: null,
      ...(usualWeeks ? { usualPayWeeks: usualWeeks } : {}),
    },
    // The customer paid this sheet's bill in full and the office has not picked a pay day yet: the day, never the amount.
    {
      id: 'sample-sheet-4',
      jobNumber: 'J-1004',
      address: SAMPLE_OWNER.address,
      stage: 'customer_pay',
      stageChangedOn: ymdPlusDays(todayYmd, -30),
      stageSource: 'office',
      items: [{ label: 'Gas line to the range (fixed price)', amount: 640 }],
      agreed: 640,
      paid: 0,
      backcharges: 0,
      open: 640,
      payableAfter: null,
      payHoldReason: null,
      ...(paidOn ? { customerPaidOn: paidOn } : {}),
    },
  ]
  // Owed to you holds the two sheets: nothing is paid on either, so what they add to earned they add to open.
  const addedOpen = added.reduce((n, s) => n + s.open, 0)
  const totals = (base.totals ?? {}) as Record<string, unknown>
  return {
    ...base,
    sheets: [...(Array.isArray(base.sheets) ? base.sheets : []), ...added],
    totals: { earned: num(totals.earned) + addedOpen, paid: num(totals.paid), open: num(totals.open) + addedOpen },
  }
}
