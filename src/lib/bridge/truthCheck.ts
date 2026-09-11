/**
 * Truth check (v2.3335) — does the Bridge's paper profit agree with its net
 * position line over the same days?
 *
 * Two readings of the same window, each already on the page:
 *
 *   paper profit  P = Σ earned − Σ direct job cost − Σ overhead
 *   net position  N = Σ bank flow + Σ invoices sent − Σ payments received
 *                     − Σ supply invoices dated + Σ supply invoices paid
 *                     (exactly the flows `buildNetPositionHistory` walks)
 *
 * Rearranging N = Σ invoices sent − netCosts, with
 *   netCosts = Σ payments received − Σ bank flow + Σ supply dated − Σ supply paid
 * ("what the bank and the supply ledger charged"), the gap splits EXACTLY in two:
 *
 *   P − N = (Σ earned − Σ invoices sent)        … earned but not invoiced
 *         + (netCosts − paperCosts)             … costs the paper doesn't see
 *
 * The first term is the billing lag — legitimate, and the company's biggest
 * lever. The second is where dirty inputs live: unapproved hours (paid by
 * payroll, absent from paper), unsorted bank spend (rent, trucks, insurance
 * never attributed), and money in that isn't a customer payment (a loan or an
 * owner deposit pushes it negative). The signals size those causes; they
 * don't sum to the term, they say where to look.
 *
 * The window is the chart's: days after `windowStart` through `todayYmd`,
 * the days whose flows move the black line. Pure: no React, no Supabase.
 */

export type TruthCheckSignal = {
  key: 'unapproved_hours' | 'unsorted_transfers' | 'unlinked_card' | 'assumed_half' | 'no_contract'
  label: string
  detail: string
  /** Sized effect in dollars when one can be estimated; null when only a count is known. */
  usd: number | null
  count: number
}

export type TruthCheckVerdict = 'agree' | 'billing_lag' | 'costs_disagree' | 'thin'

export type TruthCheck = {
  /** Number of days reconciled (the chart's window). */
  days: number
  paper: { earnedUsd: number; directUsd: number; overheadUsd: number; costsUsd: number; profitUsd: number }
  net: { invoicesSentUsd: number; paymentsReceivedUsd: number; bankFlowUsd: number; supplyDatedUsd: number; supplyPaidUsd: number; costsUsd: number; deltaUsd: number }
  /** paper.profitUsd − net.deltaUsd. */
  gapUsd: number
  /** paper.earnedUsd − net.invoicesSentUsd — positive means made on paper, not yet billed. */
  billingLagUsd: number
  /** net.costsUsd − paper.costsUsd — positive means the bank charged more than the paper counted. */
  costGapUsd: number
  /** |costGapUsd| as a share of paper costs (null when paper costs are zero). */
  costGapShare: number | null
  signals: TruthCheckSignal[]
  verdict: TruthCheckVerdict
}

/** Cost gap share of paper costs at or below this reads as "costs agree". */
export const TRUTH_CHECK_COST_AGREE_SHARE = 0.15
/** Below this many dollars of paper costs the window is too thin to judge. */
export const TRUTH_CHECK_THIN_COSTS_USD = 5000

const num = (v: number | null | undefined): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

function sumAfter(map: ReadonlyMap<string, number>, windowStart: string, todayYmd: string): number {
  let s = 0
  for (const [d, v] of map) if (d > windowStart && d <= todayYmd) s += num(v)
  return s
}

const daysBetween = (windowStart: string, todayYmd: string): number => Math.max(0, Math.round((Date.parse(`${todayYmd}T00:00:00Z`) - Date.parse(`${windowStart}T00:00:00Z`)) / 86_400_000))

const hrs = (h: number): string => `${Math.round(h).toLocaleString('en-US')}h`
const money = (n: number): string => `$${Math.round(Math.abs(n)).toLocaleString('en-US')}`

export function buildTruthCheck(input: {
  windowStart: string
  todayYmd: string
  earnedByDay: ReadonlyMap<string, number>
  directByDay: ReadonlyMap<string, number>
  overheadByDay: ReadonlyMap<string, number>
  bankFlowByDay: ReadonlyMap<string, number>
  invoicesSentByDay: ReadonlyMap<string, number>
  paymentsReceivedByDay: ReadonlyMap<string, number>
  supplyDatedByDay: ReadonlyMap<string, number>
  supplyPaidByDay: ReadonlyMap<string, number>
  /** Closed sessions still awaiting approval — labor the paper hasn't counted. */
  pendingClosedHours: number
  pendingClosedSessions: number
  /** Window field labor $ and approved field hours, for the average wage behind the unapproved-hours estimate. */
  fieldLaborUsd: number
  fieldHoursWindow: number
  /** Earned $ on the jobs the kernel assumed half done, and the count of worked jobs earning $0 for want of a contract price. */
  assumedHalfEarnedUsd: number
  assumedHalfJobs: number
  noContractJobs: number
  /** Hygiene counts from the loader (null when the RPC failed). */
  unattributedNoncard: number | null
  unlinkedCard: number | null
}): TruthCheck {
  const { windowStart, todayYmd } = input
  const earnedUsd = sumAfter(input.earnedByDay, windowStart, todayYmd)
  const directUsd = sumAfter(input.directByDay, windowStart, todayYmd)
  const overheadUsd = sumAfter(input.overheadByDay, windowStart, todayYmd)
  const paperCosts = directUsd + overheadUsd
  const profitUsd = earnedUsd - paperCosts

  const invoicesSentUsd = sumAfter(input.invoicesSentByDay, windowStart, todayYmd)
  const paymentsReceivedUsd = sumAfter(input.paymentsReceivedByDay, windowStart, todayYmd)
  const bankFlowUsd = sumAfter(input.bankFlowByDay, windowStart, todayYmd)
  const supplyDatedUsd = sumAfter(input.supplyDatedByDay, windowStart, todayYmd)
  const supplyPaidUsd = sumAfter(input.supplyPaidByDay, windowStart, todayYmd)
  const netCosts = paymentsReceivedUsd - bankFlowUsd + supplyDatedUsd - supplyPaidUsd
  const deltaUsd = invoicesSentUsd - netCosts

  const gapUsd = profitUsd - deltaUsd
  const billingLagUsd = earnedUsd - invoicesSentUsd
  const costGapUsd = netCosts - paperCosts
  const costGapShare = paperCosts > 0 ? Math.abs(costGapUsd) / paperCosts : null

  const signals: TruthCheckSignal[] = []
  const wage = input.fieldHoursWindow > 0 ? input.fieldLaborUsd / input.fieldHoursWindow : null
  if (input.pendingClosedHours > 0) {
    const usd = wage != null ? input.pendingClosedHours * wage : null
    signals.push({
      key: 'unapproved_hours',
      label: `${hrs(input.pendingClosedHours)} awaiting approval`,
      detail: usd != null ? `≈ ${money(usd)} of labor payroll pays that the paper hasn't counted (${input.pendingClosedSessions} sessions at the window's ${money(wage ?? 0)}/h)` : `${input.pendingClosedSessions} sessions — labor payroll pays that the paper hasn't counted`,
      usd,
      count: input.pendingClosedSessions,
    })
  }
  if ((input.unattributedNoncard ?? 0) > 0) {
    const n = input.unattributedNoncard ?? 0
    signals.push({ key: 'unsorted_transfers', label: `${n.toLocaleString('en-US')} bank transfers unsorted`, detail: 'rent, insurance, trucks and loans in there hit the bank but never the paper — sort them on Banking → Accounting', usd: null, count: n })
  }
  if ((input.unlinkedCard ?? 0) > 0) {
    const n = input.unlinkedCard ?? 0
    signals.push({ key: 'unlinked_card', label: `${n.toLocaleString('en-US')} card purchases unsorted`, detail: 'job parts on the bank, not on a job — sort them in Job Parts Tally', usd: null, count: n })
  }
  if (input.assumedHalfJobs > 0) {
    signals.push({
      key: 'assumed_half',
      label: `${input.assumedHalfJobs} open job${input.assumedHalfJobs === 1 ? '' : 's'} assumed half done`,
      detail: `${money(input.assumedHalfEarnedUsd)} of the earned figure rests on that guess — set % complete on each`,
      usd: input.assumedHalfEarnedUsd,
      count: input.assumedHalfJobs,
    })
  }
  if (input.noContractJobs > 0) {
    signals.push({ key: 'no_contract', label: `${input.noContractJobs} worked job${input.noContractJobs === 1 ? '' : 's'} with no contract $`, detail: 'their hours earned $0 on paper — put the price on the job', usd: null, count: input.noContractJobs })
  }

  let verdict: TruthCheckVerdict
  if (paperCosts < TRUTH_CHECK_THIN_COSTS_USD) verdict = 'thin'
  else if (costGapShare != null && costGapShare > TRUTH_CHECK_COST_AGREE_SHARE) verdict = 'costs_disagree'
  else if (Math.abs(billingLagUsd) > Math.abs(profitUsd) * 0.25) verdict = 'billing_lag'
  else verdict = 'agree'

  return {
    days: daysBetween(windowStart, todayYmd),
    paper: { earnedUsd, directUsd, overheadUsd, costsUsd: paperCosts, profitUsd },
    net: { invoicesSentUsd, paymentsReceivedUsd, bankFlowUsd, supplyDatedUsd, supplyPaidUsd, costsUsd: netCosts, deltaUsd },
    gapUsd,
    billingLagUsd,
    costGapUsd,
    costGapShare,
    signals,
    verdict,
  }
}

/** One sentence for the panel's right edge. */
export function truthCheckVerdictText(t: TruthCheck): string {
  const k = (n: number): string => `${n < 0 ? '−' : ''}$${(Math.abs(n) / 1000).toFixed(Math.abs(n) >= 100_000 ? 0 : 1)}k`
  switch (t.verdict) {
    case 'thin':
      return 'Too little in the window to judge'
    case 'agree':
      return `Paper and bank agree within ${k(Math.abs(t.gapUsd))} — steer by the profit rate`
    case 'billing_lag':
      return `${k(t.billingLagUsd)} earned but not invoiced — the profit is real on paper; bill it to see it`
    case 'costs_disagree':
      return `Costs disagree by ${k(Math.abs(t.costGapUsd))} (${Math.round((t.costGapShare ?? 0) * 100)}%) — not a number to steer by yet`
  }
}
