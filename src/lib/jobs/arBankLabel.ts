/**
 * Deposits applied in Accounts Receivable count as Income.
 *
 * The rule itself lives in the database (trigger on `jobs_ledger_payments`,
 * behind the org switch `app_settings.ar_applied_deposits_count_as_income`):
 * the first payment recorded against a bank deposit labels that deposit
 * "Income" in Banking unless a rule or a person already labelled it. This
 * kernel only decides what the Accounts Receivable modal says about it —
 * the footer clause, the one-line deviation note, the toast — from the
 * switch and the deposit's current label. Pure; tested beside it.
 */

import { ruleShortName } from './arCloseBooking'

export const AR_APPLIED_INCOME_SETTING_KEY = 'ar_applied_deposits_count_as_income'
/** `mercury_drag_sort_labels.default_key` of the built-in Income label. */
export const INCOME_LABEL_DEFAULT_KEY = 'income_part_i'

export type ArBankLabelSlice = {
  /** The org switch: applied deposits are labelled Income by the database. */
  switchOn: boolean
  /** The deposit's current Banking label name, or null when unlabelled. */
  labelName: string | null
  labelDefaultKey: string | null
  /** True when the provenance sidecar says Accounts Receivable set the label. */
  setByAr: boolean
}

export function parseArIncomeSettingValue(valueText: string | null | undefined): boolean {
  return (valueText ?? '').trim().toLowerCase() === 'true'
}

export function arBankLabelIsIncome(s: Pick<ArBankLabelSlice, 'labelName' | 'labelDefaultKey'>): boolean {
  if (s.labelDefaultKey === INCOME_LABEL_DEFAULT_KEY) return true
  return (s.labelName ?? '').trim().toLowerCase() === 'income'
}

/** Apply will label this deposit Income: the switch is on and nothing has labelled it yet. */
export function arApplyBooksIncome(s: ArBankLabelSlice | null | undefined): boolean {
  return s != null && s.switchOn && s.labelName == null
}

/** The label Apply will leave alone, when it is something other than Income; null otherwise. */
export function arBankLabelStays(s: ArBankLabelSlice | null | undefined): string | null {
  if (!s || !s.switchOn) return null
  const name = (s.labelName ?? '').trim()
  if (!name) return null
  return arBankLabelIsIncome(s) ? null : name
}

/**
 * The quiet line under the deposit header — only when the label deviates.
 * The common case (unlabelled, or already Income) says nothing here; the
 * footer sentence carries the act.
 */
export function arBankLabelNote(s: ArBankLabelSlice | null | undefined): { text: string; tone: 'warn' } | null {
  const stays = arBankLabelStays(s)
  if (!stays) return null
  return { text: `Labelled ${stays} in Banking, not Income. Apply leaves that alone.`, tone: 'warn' }
}

/**
 * Book it as Income (v2.4369): a deposit that paid a bill but carries another Banking label —
 * a rule that labels money in as well as out (the City of Seguin's $4,890 for #908 read as a
 * tax refund). It replaces the quiet note on an applied deposit with words and one button.
 * Null when the deposit paid nothing, carries no label, or is already Income.
 */
export function arAppliedIncomeFix(
  s: Pick<ArBankLabelSlice, 'labelName' | 'labelDefaultKey'> | null | undefined,
  consumed: number,
  ruleName?: string | null,
): { text: string; ruleLine: string | null } | null {
  if (!s) return null
  const name = (s.labelName ?? '').trim()
  if (!name || arBankLabelIsIncome(s)) return null
  if (!(Number(consumed) > 0.0005)) return null
  const rule = (ruleName ?? '').trim()
  return {
    text: `Banking books it as ${name}. It paid a bill, so it is income.`,
    ruleLine: rule ? `Your rule ${ruleShortName(rule, name)} labelled it. In Banking, that rule can be limited to money going out.` : null,
  }
}

function money(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** The success toast after Apply: "Applied $5,574.60 · booked as Income". */
export function arAppliedToast(total: number, booksIncome: boolean): string {
  const base = total > 0.005 ? `Applied ${money(total)}` : 'Applied'
  return booksIncome ? `${base} · booked as Income` : base
}
