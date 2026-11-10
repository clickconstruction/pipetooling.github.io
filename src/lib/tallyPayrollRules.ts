/**
 * Job Parts Tally "mark as payroll" auto-rules. Reuses the banking accounting match kernel
 * (criteria shape + matcher) but targets a single boolean payroll flag instead of a label.
 *
 * A payroll-flagged transaction is resolved WITHOUT any job allocation, so per-job spend is
 * never double-counted against clocked labor. Rules therefore never flag a transaction that
 * already has job splits — those are surfaced as conflicts for the user to resolve manually.
 */

import type { Json } from '../types/database'
import { isControllerOrDev } from './doorRoles'
import {
  matchAccountingLabelRuleCriteria,
  parseAccountingLabelRuleCriteria,
  type AccountingLabelRuleMatchTx,
} from './accountingLabelRuleMatch'

/**
 * Who holds the payroll rules: the controller and a dev (punch list #188 row 62, v2.6761). One gate for the Payroll
 * rules chip, the window, Create a rule, **Apply now** and the auto-apply switch inside it, so a role that is shown
 * the press runs it; `mercury_tally_payroll_rules` and `bulk_apply_tally_payroll_rule_flags` admit the same two
 * (`20261109005000_dev_gates_banking_tally_forms.sql`). Marking one transaction is `canMarkTallyPayroll`'s.
 */
export function canEditTallyPayrollRules(role: string | null | undefined): boolean {
  return isControllerOrDev(role)
}

export type TallyPayrollRuleForMatch = {
  id: string
  enabled: boolean
  sort_order: number
  criteria: Json
}

export type TallyPayrollRuleMatchTx = AccountingLabelRuleMatchTx & { mercury_transaction_id: string }

export type TallyPayrollRuleApplyInput = {
  txs: ReadonlyArray<TallyPayrollRuleMatchTx>
  rules: ReadonlyArray<TallyPayrollRuleForMatch>
  /** Transaction ids that already have a flag row (marked OR tombstoned) — never re-touched by rules. */
  decidedTxIds: ReadonlySet<string>
  /** Transaction ids that currently have job allocations — cannot be flagged payroll (block+warn). */
  txIdsWithJobSplits: ReadonlySet<string>
}

export type TallyPayrollRuleApplyResult = {
  /** New payroll flags to insert (source='rule'). */
  toFlag: Array<{ mercury_transaction_id: string; rule_id: string }>
  /** Matched a rule but already allocated to jobs — surfaced, not flagged. */
  blockedByJobSplits: string[]
}

/**
 * First-match-wins over enabled rules (sort_order ASC, id ASC). Skips transactions that already
 * have a flag decision; routes split-conflicts aside.
 */
export function buildTallyPayrollRuleFlagsToInsert(
  input: TallyPayrollRuleApplyInput,
): TallyPayrollRuleApplyResult {
  const eligible = input.rules
    .filter((r) => r.enabled)
    .map((r) => ({ rule: r, criteria: parseAccountingLabelRuleCriteria(r.criteria) }))
    .filter((r): r is { rule: TallyPayrollRuleForMatch; criteria: NonNullable<typeof r.criteria> } => r.criteria !== null)
    .sort((a, b) => a.rule.sort_order - b.rule.sort_order || a.rule.id.localeCompare(b.rule.id))

  const toFlag: Array<{ mercury_transaction_id: string; rule_id: string }> = []
  const blockedByJobSplits: string[] = []

  for (const tx of input.txs) {
    if (input.decidedTxIds.has(tx.mercury_transaction_id)) continue
    const hit = eligible.find((e) => matchAccountingLabelRuleCriteria(tx, e.criteria))
    if (!hit) continue
    if (input.txIdsWithJobSplits.has(tx.mercury_transaction_id)) {
      blockedByJobSplits.push(tx.mercury_transaction_id)
      continue
    }
    toFlag.push({ mercury_transaction_id: tx.mercury_transaction_id, rule_id: hit.rule.id })
  }

  return { toFlag, blockedByJobSplits }
}
