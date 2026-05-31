/**
 * Pure helpers for the Banking Mercury Accounting "Apply rules by default"
 * toggle (per `docs/RECENT_FEATURES.md` v2.580). Lives outside React so the gate
 * predicate and signature builder can be unit-tested without rendering the
 * toolbar.
 *
 * The auto-apply effect in `BankingMercuryAccountingTab.tsx` walks the same
 * gate set that the manual Apply rules button respects (loaded, rules
 * loaded, no in-flight apply) plus a signature ref that blocks an immediate
 * re-fire when `loadPending` round-trips with no behavior change.
 *
 * `buildAutoApplySignature` is intentionally cheap and stable: sorted tx ids
 * + sorted enabled rule ids joined with `|`. Sort independence means
 * upstream re-orderings (e.g. a different `posted_at` tiebreak) don't
 * invalidate the signature and re-fire auto-apply on the same set.
 *
 * The `autoApplyResetTick` counter from `Banking.tsx` is *not* part of the
 * signature — it's wired through a separate effect that nulls
 * `lastAutoAppliedSignatureRef` on every Refresh from Mercury / Backfill so a
 * fresh sync still triggers one auto-apply pass even on identical id sets
 * (e.g. a sync that only updated counterparties).
 */

export function buildAutoApplySignature(
  txs: ReadonlyArray<{ id: string }>,
  rules: ReadonlyArray<{ id: string; enabled: boolean }>,
): string {
  const txIds = txs.map((t) => t.id).sort().join(',')
  const ruleIds = rules
    .filter((r) => r.enabled)
    .map((r) => r.id)
    .sort()
    .join(',')
  return `${txIds}|${ruleIds}`
}

export type ShouldAutoApplyAccountingRulesState = {
  enabled: boolean
  loading: boolean
  rulesLoading: boolean
  assignmentsLoading: boolean
  applyRulesBusy: boolean
  rulesCount: number
  currentSignature: string
  lastSignature: string | null
}

export function shouldAutoApplyAccountingRules(state: ShouldAutoApplyAccountingRulesState): boolean {
  if (!state.enabled) return false
  if (state.loading) return false
  if (state.rulesLoading) return false
  if (state.assignmentsLoading) return false
  if (state.applyRulesBusy) return false
  if (state.rulesCount === 0) return false
  if (state.currentSignature === state.lastSignature) return false
  return true
}
