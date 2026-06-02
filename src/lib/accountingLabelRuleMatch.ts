import type { Json } from '../types/database'
import type { Database } from '../types/database'
import { mercuryBankDescriptionFromRaw } from './mercuryBankDescriptionFromRaw'

export type AccountingLabelRuleCriteriaV1 = {
  v: 1
  amount?: { min?: number; max?: number }
  counterparty?: { op: 'contains' | 'equals'; value: string }
  bankDescription?: { op: 'contains' | 'equals'; value: string }
}

export type AccountingLabelRuleMatchTx = Pick<
  Database['public']['Tables']['mercury_transactions']['Row'],
  'amount' | 'counterparty_name' | 'raw'
>

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x)
}

function normStr(s: string): string {
  return s.trim().toLowerCase()
}

/** Counts substantive rule clauses (empty strings do not count). */
export function accountingRuleEffectiveClauseCount(c: AccountingLabelRuleCriteriaV1): number {
  let n = 0
  const a = c.amount
  if (a != null && (a.min !== undefined || a.max !== undefined)) n += 1
  if (c.counterparty != null && c.counterparty.value.trim().length > 0) n += 1
  if (c.bankDescription != null && c.bankDescription.value.trim().length > 0) n += 1
  return n
}

/**
 * Parses criteria from DB jsonb. Returns null if unsupported or invalid.
 */
export function parseAccountingLabelRuleCriteria(raw: Json): AccountingLabelRuleCriteriaV1 | null {
  if (!isRecord(raw)) return null
  if (raw.v !== 1) return null
  const out: AccountingLabelRuleCriteriaV1 = { v: 1 }
  const amount = raw.amount
  if (amount !== undefined) {
    if (!isRecord(amount)) return null
    const minRaw = amount.min
    const maxRaw = amount.max
    const slice: { min?: number; max?: number } = {}
    if (minRaw !== undefined) {
      if (typeof minRaw !== 'number' || !Number.isFinite(minRaw)) return null
      slice.min = minRaw
    }
    if (maxRaw !== undefined) {
      if (typeof maxRaw !== 'number' || !Number.isFinite(maxRaw)) return null
      slice.max = maxRaw
    }
    if (slice.min !== undefined || slice.max !== undefined) out.amount = slice
  }
  const cp = raw.counterparty
  if (cp !== undefined) {
    if (!isRecord(cp)) return null
    const op = cp.op
    const value = cp.value
    if (op !== 'contains' && op !== 'equals') return null
    if (typeof value !== 'string') return null
    out.counterparty = { op, value }
  }
  const bd = raw.bankDescription
  if (bd !== undefined) {
    if (!isRecord(bd)) return null
    const op = bd.op
    const value = bd.value
    if (op !== 'contains' && op !== 'equals') return null
    if (typeof value !== 'string') return null
    out.bankDescription = { op, value }
  }
  return out
}

export function defaultAccountingLabelRuleCriteriaV1(): AccountingLabelRuleCriteriaV1 {
  return { v: 1 }
}

/**
 * Inclusive amount interval on the number line. When both min and max are set,
 * swaps if the user entered the smaller number in "Max" and the larger in "Min"
 * (common with negative ranges like -120 … -20).
 */
export function resolveAccountingRuleAmountBounds(amount: {
  min?: number
  max?: number
}): { lower?: number; upper?: number } {
  let lower = amount.min
  let upper = amount.max
  if (lower !== undefined && upper !== undefined && lower > upper) {
    const t = lower
    lower = upper
    upper = t
  }
  return { lower, upper }
}

function matchStringClause(
  haystack: string | null,
  op: 'contains' | 'equals',
  needleRaw: string,
): boolean {
  const needle = needleRaw.trim()
  if (needle.length === 0) return true
  const h = haystack == null ? '' : haystack.trim()
  const hn = normStr(h)
  const nn = normStr(needle)
  if (op === 'equals') return hn === nn
  return hn.includes(nn)
}

/**
 * Returns true when every substantive criterion matches. Rules with no substantive clauses never match.
 */
export function matchAccountingLabelRuleCriteria(
  tx: AccountingLabelRuleMatchTx,
  criteria: AccountingLabelRuleCriteriaV1,
): boolean {
  if (accountingRuleEffectiveClauseCount(criteria) === 0) return false
  const a = criteria.amount
  if (a != null) {
    const { lower, upper } = resolveAccountingRuleAmountBounds(a)
    const amt = Number(tx.amount)
    if (!Number.isFinite(amt)) return false
    if (lower !== undefined && amt < lower) return false
    if (upper !== undefined && amt > upper) return false
  }
  const cp = criteria.counterparty
  if (cp != null && cp.value.trim().length > 0) {
    if (!matchStringClause(tx.counterparty_name, cp.op, cp.value)) return false
  }
  const bd = criteria.bankDescription
  if (bd != null && bd.value.trim().length > 0) {
    const bankLine = mercuryBankDescriptionFromRaw(tx.raw)
    if (!matchStringClause(bankLine, bd.op, bd.value)) return false
  }
  return true
}

export type AccountingRuleForMatch = {
  id: string
  name: string
  label_id: string
  enabled: boolean
  sort_order: number
  criteria: Json
}

export type MatchingAccountingRule = {
  id: string
  name: string
  labelId: string
  /** True for the first matching rule in engine order — the label the engine would suggest. */
  isFirstMatch: boolean
}

/**
 * Returns the enabled rules that match a transaction, in engine order
 * (sort_order ASC, id ASC), flagging the first match. Read-only / informational
 * (e.g. the TransactionDetail "Applicable Rules" section).
 */
export function matchingAccountingRulesForTx(
  tx: AccountingLabelRuleMatchTx,
  rules: ReadonlyArray<AccountingRuleForMatch>,
): MatchingAccountingRule[] {
  const eligible = rules
    .filter((r) => r.enabled)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
  const out: MatchingAccountingRule[] = []
  for (const r of eligible) {
    const criteria = parseAccountingLabelRuleCriteria(r.criteria)
    if (!criteria) continue
    if (matchAccountingLabelRuleCriteria(tx, criteria)) {
      out.push({ id: r.id, name: r.name, labelId: r.label_id, isFirstMatch: out.length === 0 })
    }
  }
  return out
}
