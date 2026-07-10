/**
 * Seed for the Payroll auto-mark rule form when created from a specific tally
 * transaction ("Create rule…" in the mark-payroll confirm dialog) — the tally
 * sibling of Banking's "Create rule from this counterparty" shortcut.
 *
 * Amount is deliberately never seeded: payroll amounts vary per run, so an
 * amount clause would silently stop matching future transactions. Counterparty
 * and bank description are both pre-filled when present (criteria AND
 * together — the form's live match count shows when a run-specific
 * description makes the rule too narrow, and the dev can clear it).
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
 * Build the pre-filled rule form for a transaction: counterparty-contains and
 * description-contains, each when present; null when neither exists (caller
 * opens the rules modal unseeded). The name comes from the counterparty,
 * falling back to the bank description.
 */
export function buildPayrollRuleSeedFromTransaction(tx: {
  counterparty_name: string | null
  raw: Json | null
}): TallyPayrollRuleFormSeed | null {
  const cp = (tx.counterparty_name ?? '').trim()
  const bank = mercuryBankDescriptionFromRaw(tx.raw)
  if (!cp && !bank) return null
  const seed: TallyPayrollRuleFormSeed = { name: seedName(cp || bank!) }
  if (cp) {
    seed.counterpartyOp = 'contains'
    seed.counterpartyValue = cp
  }
  if (bank) {
    seed.bankOp = 'contains'
    seed.bankValue = bank
  }
  return seed
}
