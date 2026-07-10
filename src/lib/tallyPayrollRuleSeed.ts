/**
 * Seed for the Payroll auto-mark rule form when created from a specific tally
 * transaction ("Create rule…" in the mark-payroll confirm dialog) — the tally
 * sibling of Banking's "Create rule from this counterparty" shortcut.
 *
 * Amount is deliberately never seeded: payroll amounts vary per run, so an
 * amount clause would silently stop matching future transactions. Counterparty
 * is the stable signal; bank description is the fallback when it's missing.
 *
 * Separate from tallyPayrollRules.ts (the rule APPLY engine) — this is form
 * seeding, and TallyPayrollRulesModal imports the seed type from here.
 */
import type { Json } from '../types/database'
import { mercuryBankDescriptionFromRaw } from './mercuryBankDescriptionFromRaw'

export type TallyPayrollRuleFormSeed = {
  name: string
  counterpartyOp?: 'contains' | 'equals'
  counterpartyValue?: string
  bankOp?: 'contains' | 'equals'
  bankValue?: string
}

const SEED_NAME_MAX = 60

function seedName(base: string): string {
  const clipped = base.length > SEED_NAME_MAX ? `${base.slice(0, SEED_NAME_MAX - 1)}…` : base
  return `${clipped} - payroll`
}

/**
 * Build the pre-filled rule form for a transaction. Counterparty-contains when
 * present; bank-description-contains as fallback; null when neither exists
 * (caller opens the rules modal unseeded).
 */
export function buildPayrollRuleSeedFromTransaction(tx: {
  counterparty_name: string | null
  raw: Json | null
}): TallyPayrollRuleFormSeed | null {
  const cp = (tx.counterparty_name ?? '').trim()
  if (cp) {
    return { name: seedName(cp), counterpartyOp: 'contains', counterpartyValue: cp }
  }
  const bank = mercuryBankDescriptionFromRaw(tx.raw)
  if (bank) {
    return { name: seedName(bank), bankOp: 'contains', bankValue: bank }
  }
  return null
}
