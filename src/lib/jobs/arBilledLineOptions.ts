/**
 * The Accounts Receivable billed-line picker's rows (v2.3383): what each open bill
 * says on its two lines, the order the list opens in, the closed trigger's words,
 * and the footer under the list.
 *
 * Order: the matched payer's bills first (the one equal to the deposit at the very
 * top, then largest remaining), then other bills equal to the deposit, then the
 * rest in the order the Stages board gave them.
 */
import {
  bankPaymentTargetPayerNames,
  formatBankPaymentTargetDollars,
  type BankPaymentTarget,
} from '../jobsStagesBoard'

/** The green tint for the row whose remaining equals the deposit — the option's `optionStyle`. */
export const AR_BILLED_LINE_MATCH_ROW_STYLE = {
  background: 'var(--bg-green-tint)',
  boxShadow: 'inset 3px 0 0 var(--text-green-700)',
} as const

export type ArBilledLineTier = 'payer_match' | 'payer' | 'amount_match' | 'other'

export type ArBilledLineOrderInput = {
  /** Target keys belonging to the deposit's matched payer (empty when no payer was read). */
  payerKeys: ReadonlySet<string>
  /** Target keys whose remaining equals the deposit's remaining. */
  amountMatchKeys: ReadonlySet<string>
}

const TIER_RANK: Record<ArBilledLineTier, number> = { payer_match: 0, payer: 1, amount_match: 2, other: 3 }

export function arBilledLineTier(t: BankPaymentTarget, input: ArBilledLineOrderInput): ArBilledLineTier {
  const payer = input.payerKeys.has(t.key)
  const amount = input.amountMatchKeys.has(t.key)
  if (payer && amount) return 'payer_match'
  if (payer) return 'payer'
  if (amount) return 'amount_match'
  return 'other'
}

/** The list's open order — stable within a tier except the payer's bills, which run largest first. */
export function orderArBilledLineTargets(targets: readonly BankPaymentTarget[], input: ArBilledLineOrderInput): BankPaymentTarget[] {
  return targets
    .map((t, index) => ({ t, index, rank: TIER_RANK[arBilledLineTier(t, input)] }))
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank
      if (a.rank === TIER_RANK.payer && a.t.remaining !== b.t.remaining) return b.t.remaining - a.t.remaining
      return a.index - b.index
    })
    .map((x) => x.t)
}

/** "Invoice #2" · "Billed line" · "Job balance" — the line's kind without the job number in front. */
export function arBilledLineKindWords(t: BankPaymentTarget): string {
  if (t.lineKind === 'invoice') return t.invoiceSequenceOrder != null ? `Invoice #${t.invoiceSequenceOrder}` : 'Invoice'
  if (t.lineKind === 'merged_billed') return 'Billed line'
  return 'Job balance'
}

export type ArBilledLineRowParts = {
  /** `$1,855.70` */
  dollars: string
  /** Job number, `—` when the job has none. */
  number: string
  /** The job's name; the line's kind when the job has no name. */
  title: string
  /** `Elaine Giesber · 1180 Cibolo Valley Dr, Cibolo · Billed line` — payers, address, line kind; '' when nothing is known. */
  secondary: string
  stripe: boolean
}

export function arBilledLineRowParts(t: BankPaymentTarget): ArBilledLineRowParts {
  const name = t.jobName.trim()
  const kind = arBilledLineKindWords(t)
  const secondaryParts = [...bankPaymentTargetPayerNames(t), t.jobAddress.trim()]
  if (name) secondaryParts.push(kind)
  return {
    dollars: formatBankPaymentTargetDollars(t.remaining),
    number: t.hcpNumber.trim() || '—',
    title: name || kind,
    secondary: secondaryParts.filter((s) => s.length > 0).join(' · '),
    stripe: t.stripeHosted,
  }
}

/** The closed trigger after a pick: `$250.00 · 1015 · Montolongo Post Test`. */
export function arBilledLineTriggerText(t: BankPaymentTarget): string {
  const p = arBilledLineRowParts(t)
  return `${p.dollars} · ${p.number} · ${p.title}`
}

/** `10 open bills · $28,371.20 unpaid` — the footer under the list. */
export function arBilledLineFooterText(targets: readonly BankPaymentTarget[]): string {
  if (targets.length === 0) return 'No open bills'
  const total = targets.reduce((sum, t) => sum + (Number.isFinite(t.remaining) ? t.remaining : 0), 0)
  const bills = targets.length === 1 ? '1 open bill' : `${targets.length} open bills`
  return `${bills} · ${formatBankPaymentTargetDollars(total)} unpaid`
}
