import {
  type AccountingLabelRuleCriteriaV1,
  type AccountingLabelRuleMatchTx,
  accountingRuleEffectiveClauseCount,
  matchAccountingLabelRuleCriteria,
} from './accountingLabelRuleMatch'

/**
 * Pure helper that mirrors the matching loop in
 * `BankingMercuryAccountingTab.applyRulesWithSnapshot` (sort by `sort_order, id`,
 * walk rules in order, first match wins) but, instead of `break`-ing on the first
 * hit, collects *every* matching rule per transaction so callers can surface the
 * silently-shadowed ones to the user.
 *
 * The engine itself is not changed by this helper — it's a read-only audit.
 */

export type OverlapRuleInput = {
  id: string
  name: string
  label_id: string
  sort_order: number
  enabled: boolean
  criteria: AccountingLabelRuleCriteriaV1 | null
}

export type OverlapTxInput = AccountingLabelRuleMatchTx & { id: string }

export type OverlapMatch = {
  ruleId: string
  ruleName: string
  labelId: string
  sortOrder: number
  isWinner: boolean
}

export type OverlapTxRow = {
  txId: string
  matches: ReadonlyArray<OverlapMatch>
  /**
   * Set when an existing assignment exists AND winner.label_id !== assigned label.
   * Carries the *assigned* label id so the UI can render
   * "Currently labeled <X> · winning rule labels <Y>".
   */
  conflictWithAssignedLabelId: string | null
}

export type AccountingRuleOverlapReport = {
  /** Rows that have 2+ rule matches OR an assignment-vs-winner conflict. */
  txRows: ReadonlyArray<OverlapTxRow>
  /** Count of txs whose `matches.length >= 2`. */
  overlappingTxCount: number
  /** Count of txs where `conflictWithAssignedLabelId != null`. */
  conflictTxCount: number
  perRule: ReadonlyMap<string, { matched: number; winner: number; shadowed: number }>
  /** (winner, shadowed) pair tx counts, sorted desc by `txCount`. */
  pairCounts: ReadonlyArray<{ winnerRuleId: string; shadowedRuleId: string; txCount: number }>
}

/** Same comparator the engine uses (`applyRulesWithSnapshot` line 766). */
function compareRulesForEngineOrder(a: OverlapRuleInput, b: OverlapRuleInput): number {
  return a.sort_order - b.sort_order || a.id.localeCompare(b.id)
}

export function buildAccountingRuleOverlapReport(
  rules: ReadonlyArray<OverlapRuleInput>,
  txs: ReadonlyArray<OverlapTxInput>,
  opts: {
    /** Map<txId, dragSortLabelId> from `assignmentLabelByTxId`. */
    assignmentLabelByTxId?: ReadonlyMap<string, string>
    /** When true, disabled rules participate in the audit. Default: false. */
    includeDisabled?: boolean
  } = {},
): AccountingRuleOverlapReport {
  const { assignmentLabelByTxId, includeDisabled = false } = opts

  const eligibleRules = rules
    .filter((r) => {
      if (!includeDisabled && !r.enabled) return false
      if (r.criteria == null) return false
      if (accountingRuleEffectiveClauseCount(r.criteria) === 0) return false
      return true
    })
    .slice()
    .sort(compareRulesForEngineOrder)

  const perRuleStats = new Map<string, { matched: number; winner: number; shadowed: number }>()
  for (const r of eligibleRules) {
    perRuleStats.set(r.id, { matched: 0, winner: 0, shadowed: 0 })
  }

  const pairCountMap = new Map<string, { winnerRuleId: string; shadowedRuleId: string; txCount: number }>()
  const txRows: OverlapTxRow[] = []
  let overlappingTxCount = 0
  let conflictTxCount = 0

  for (const tx of txs) {
    const matched: OverlapMatch[] = []
    for (const r of eligibleRules) {
      if (r.criteria == null) continue
      if (!matchAccountingLabelRuleCriteria(tx, r.criteria)) continue
      matched.push({
        ruleId: r.id,
        ruleName: r.name,
        labelId: r.label_id,
        sortOrder: r.sort_order,
        isWinner: matched.length === 0,
      })
    }

    const winner = matched[0]
    if (winner === undefined) continue

    for (const m of matched) {
      const stats = perRuleStats.get(m.ruleId)
      if (!stats) continue
      stats.matched += 1
      if (m.isWinner) stats.winner += 1
      else stats.shadowed += 1
    }

    const isOverlap = matched.length >= 2
    if (isOverlap) {
      overlappingTxCount += 1
      for (let i = 1; i < matched.length; i += 1) {
        const shadowed = matched[i]
        if (shadowed === undefined) continue
        const key = `${winner.ruleId}::${shadowed.ruleId}`
        const existing = pairCountMap.get(key)
        if (existing) {
          existing.txCount += 1
        } else {
          pairCountMap.set(key, {
            winnerRuleId: winner.ruleId,
            shadowedRuleId: shadowed.ruleId,
            txCount: 1,
          })
        }
      }
    }

    let conflictWithAssignedLabelId: string | null = null
    if (assignmentLabelByTxId) {
      const assigned = assignmentLabelByTxId.get(tx.id) ?? null
      if (assigned != null && assigned !== winner.labelId) {
        conflictWithAssignedLabelId = assigned
        conflictTxCount += 1
      }
    }

    if (isOverlap || conflictWithAssignedLabelId != null) {
      txRows.push({
        txId: tx.id,
        matches: matched,
        conflictWithAssignedLabelId,
      })
    }
  }

  const pairCounts = Array.from(pairCountMap.values()).sort((a, b) => {
    if (b.txCount !== a.txCount) return b.txCount - a.txCount
    if (a.winnerRuleId !== b.winnerRuleId) return a.winnerRuleId.localeCompare(b.winnerRuleId)
    return a.shadowedRuleId.localeCompare(b.shadowedRuleId)
  })

  return {
    txRows,
    overlappingTxCount,
    conflictTxCount,
    perRule: perRuleStats,
    pairCounts,
  }
}
