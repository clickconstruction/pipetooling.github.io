/**
 * Server-side auto-approval of bank-label rule matches (journey-map Tier-2 #27).
 *
 * The suggestion machine (rules → `mercury_accounting_label_suggestions`) is
 * always-on and server-side (the Mercury webhook mints on every delivery), but
 * until this change the only approver was a per-user browser checkbox that ran
 * while someone had Banking → Accounting mounted — 349 rule matches (~$139K
 * "Unlabeled") sat pending for 16 days waiting for nobody. Now the org-level
 * switch `app_settings.accounting_label_auto_approve_rule_matches` lets a rule
 * match approve itself where it is minted, and this kernel is the executable
 * spec of that gate. The SQL writer
 * (`auto_approve_pending_accounting_label_suggestions`) applies the same checks
 * in the same order; the Mercury webhook evaluates this kernel before calling
 * it; the Accounting tab uses it to badge the exceptions that stay pending.
 *
 * TWIN: Deno copy of `src/lib/accountingLabelAutoApprove.ts` (consumed by
 * mercury-webhook). Must stay identical in behaviour —
 * `src/lib/accountingLabelAutoApproveSharedParity.test.ts` fails when they
 * drift. No imports so it runs under both Deno and vitest.
 */

/** `app_settings.key` holding the org switch (`value_text` 'true' | 'false'; absent = off). */
export const ACCOUNTING_LABEL_AUTO_APPROVE_SETTING_KEY = 'accounting_label_auto_approve_rule_matches'

/** `mercury_drag_sort_labels.default_key` of the Internal Transfers system label. */
export const AUTO_APPROVE_INTERNAL_TRANSFERS_DEFAULT_KEY = 'internal_transfers'

export type AutoApproveSuggestionInput = {
  /** `mercury_accounting_label_suggestions.status` — only 'pending' rows are candidates. */
  status: string | null | undefined
  /** `default_key` of the suggested label (null for user-made labels). */
  suggestedLabelDefaultKey: string | null | undefined
  /** The transaction already has rows in `mercury_transaction_job_allocations`. */
  txHasJobSplits: boolean
  /** The transaction already has a `mercury_transaction_drag_sort_assignments` row (a human labeled it). */
  txHasAssignment: boolean
}

export type AutoApproveRuleInput = { enabled: boolean } | null | undefined

export type AutoApproveSettings = {
  /** The org switch, parsed (`parseAutoApproveSettingValue`). */
  autoApproveRuleMatches: boolean
}

export type AutoApproveSkipReason =
  | 'switch_off'
  | 'not_pending'
  | 'rule_missing_or_disabled'
  | 'already_labeled'
  | 'internal_transfers_conflict'

export type AutoApproveDecision =
  | { approve: true; reason: 'rule_match' }
  | { approve: false; reason: AutoApproveSkipReason }

/** `app_settings.value_text` → boolean. Only the literal 'true' (any case, trimmed) turns the switch on. */
export function parseAutoApproveSettingValue(valueText: string | null | undefined): boolean {
  return (valueText ?? '').trim().toLowerCase() === 'true'
}

/**
 * Should this freshly minted suggestion approve itself? Checks run in the same
 * order as the SQL writer so a skip reason here names the clause that would
 * have excluded the row there:
 *   1. the org switch is on;
 *   2. the suggestion is still pending;
 *   3. its rule still exists and is enabled;
 *   4. nobody has labeled the transaction by hand (a hand-set label always wins);
 *   5. Internal Transfers × job splits are mutually exclusive — those stay
 *      pending for a human (the same four-place client guard).
 */
export function shouldAutoApproveSuggestion(
  suggestion: AutoApproveSuggestionInput,
  rule: AutoApproveRuleInput,
  settings: AutoApproveSettings,
): AutoApproveDecision {
  if (!settings.autoApproveRuleMatches) return { approve: false, reason: 'switch_off' }
  if (suggestion.status !== 'pending') return { approve: false, reason: 'not_pending' }
  if (!rule || !rule.enabled) return { approve: false, reason: 'rule_missing_or_disabled' }
  if (suggestion.txHasAssignment) return { approve: false, reason: 'already_labeled' }
  if (
    (suggestion.suggestedLabelDefaultKey ?? '') === AUTO_APPROVE_INTERNAL_TRANSFERS_DEFAULT_KEY &&
    suggestion.txHasJobSplits
  ) {
    return { approve: false, reason: 'internal_transfers_conflict' }
  }
  return { approve: true, reason: 'rule_match' }
}
