import {
  type AccountingLabelRuleCriteriaV1,
  type AccountingLabelRuleMatchTx,
  accountingRuleEffectiveClauseCount,
  matchAccountingLabelRuleCriteria,
} from './accountingLabelRuleMatch'

/**
 * Pure helper that mirrors the matching loop inside
 * `BankingMercuryAccountingTab.applyRulesWithSnapshot`:
 *
 *   - Filter to enabled rules with at least one substantive criteria clause.
 *   - Sort by `sort_order ASC, id ASC` (engine ordering).
 *   - For each transaction, walk the sorted rules and `break` on the first match
 *     ("first-match-wins"). Skip transactions that already have an assignment
 *     or a pending suggestion.
 *
 * Returns the *uncapped* list of `(tx_id, rule_id, label_id)` rows the engine
 * would insert into `mercury_accounting_label_suggestions`. The cap at
 * `APPLY_RULES_PER_CLICK_CAP` is enforced one layer up in the React component
 * so the preflight can show "X total match" before the cap is applied.
 */

export type ApplyRulesPreflightRuleInput = {
  id: string
  label_id: string
  sort_order: number
  enabled: boolean
  /** Already-parsed criteria, or null when criteria was malformed. Null rules are skipped. */
  criteria: AccountingLabelRuleCriteriaV1 | null
}

export type ApplyRulesPreflightTxInput = AccountingLabelRuleMatchTx & { id: string }

export type ApplyRulesToInsertRow = {
  mercury_transaction_id: string
  rule_id: string
  suggested_label_id: string
}

/** Same comparator the engine uses (`applyRulesWithSnapshot` line 803). */
function compareRulesForEngineOrder(
  a: ApplyRulesPreflightRuleInput,
  b: ApplyRulesPreflightRuleInput,
): number {
  return a.sort_order - b.sort_order || a.id.localeCompare(b.id)
}

export function buildAccountingRulesToInsert(opts: {
  rules: ReadonlyArray<ApplyRulesPreflightRuleInput>
  filteredTransactions: ReadonlyArray<ApplyRulesPreflightTxInput>
  assignedTxIds: ReadonlySet<string>
  pendingTxIds: ReadonlySet<string>
}): ApplyRulesToInsertRow[] {
  const { rules, filteredTransactions, assignedTxIds, pendingTxIds } = opts

  const eligibleRules = rules
    .filter((r) => {
      if (!r.enabled) return false
      if (r.criteria == null) return false
      if (accountingRuleEffectiveClauseCount(r.criteria) === 0) return false
      return true
    })
    .slice()
    .sort(compareRulesForEngineOrder)

  if (eligibleRules.length === 0) return []

  const seenTxIds = new Set<string>()
  const out: ApplyRulesToInsertRow[] = []

  for (const tx of filteredTransactions) {
    if (assignedTxIds.has(tx.id)) continue
    if (pendingTxIds.has(tx.id)) continue
    if (seenTxIds.has(tx.id)) continue

    for (const rule of eligibleRules) {
      if (rule.criteria == null) continue
      if (matchAccountingLabelRuleCriteria(tx, rule.criteria)) {
        out.push({
          mercury_transaction_id: tx.id,
          rule_id: rule.id,
          suggested_label_id: rule.label_id,
        })
        seenTxIds.add(tx.id)
        break
      }
    }
  }

  return out
}
