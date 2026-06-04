/**
 * Pure classification + formatting for the Mercury Reconciliation tab. The
 * `mercury-reconcile` edge function returns raw numbers (per-account, per-month
 * counts and balances); these helpers decide pass/fail and format for display,
 * so the thresholds live in one tested place. React/Deno-free.
 */

export type ReconMissingTx = {
  id?: string | null
  amount: number
  postedAt: string | null
  counterpartyName: string | null
}

export type ReconMonth = {
  period: string
  startDate: string | null
  endDate: string | null
  statementCount: number
  presentCount: number
  missingCount: number
  missingValue: number
  missingSample: ReconMissingTx[]
  endingBalance: number
  prevEndingBalance: number | null
  /** endingBalance − prevEndingBalance (null when there's no prior statement). */
  statementNet: number | null
  /** Sum of the statement's own transaction amounts. */
  statementTxSum: number
}

export type ReconCurrent = {
  mercuryCurrentBalance: number
  availableBalance: number
  latestStatementEnd: string | null
  expectedCurrent: number | null
  delta: number | null
  bookActivitySinceClose?: number
}

export type ReconAccount = {
  id: string
  name: string
  currentBalance: number
  availableBalance: number
  months: ReconMonth[]
  current: ReconCurrent
}

export type ReconResult = {
  ok: boolean
  generatedAt: string
  monthsBack: number
  accounts: ReconAccount[]
}

/** Dollar tolerance for "balanced" — covers float noise, not real discrepancies. */
export const RECON_EPSILON = 0.01

export type MonthStatus = 'ok' | 'missing'

/**
 * Completeness is the reliable signal: `missing` when at least one statement
 * transaction isn't in the books (a real gap), else `ok`.
 *
 * We intentionally do NOT classify on statement ending-balance deltas: Mercury's
 * statement `endingBalance` change does not arithmetically equal the sum of that
 * statement's listed transactions (boundary/settlement timing), so a balance-delta
 * check fires on nearly every month even when every transaction is present. The
 * raw `statementNet`/`statementTxSum` are still returned for informational display.
 */
export function classifyMonth(m: ReconMonth): MonthStatus {
  return m.missingCount > 0 ? 'missing' : 'ok'
}

/** True when the statement's listed transactions don't sum to its balance change — informational only. */
export function monthBalanceInfoOff(m: ReconMonth): boolean {
  return m.statementNet !== null && Math.abs(m.statementNet - m.statementTxSum) > RECON_EPSILON
}

export type CurrentStatus = 'ok' | 'drift' | 'unknown'

/** Compares Mercury's live balance to what the books imply since the last statement close. */
export function classifyCurrent(c: ReconCurrent): CurrentStatus {
  if (c.expectedCurrent === null || c.delta === null) return 'unknown'
  return Math.abs(c.delta) > RECON_EPSILON ? 'drift' : 'ok'
}

export type AccountStatus = 'ok' | 'attention'

export type AccountSummary = {
  status: AccountStatus
  totalMissing: number
  totalMissingValue: number
  monthsWithIssues: number
  currentStatus: CurrentStatus
}

export function summarizeAccount(a: ReconAccount): AccountSummary {
  let totalMissing = 0
  let totalMissingValue = 0
  let monthsWithIssues = 0
  for (const m of a.months) {
    totalMissing += m.missingCount
    totalMissingValue += m.missingValue
    if (classifyMonth(m) !== 'ok') monthsWithIssues += 1
  }
  const currentStatus = classifyCurrent(a.current)
  // "Needs review" is driven by completeness only (the reliable signal). Current-
  // balance drift is shown but kept informational — open-month transfer timing
  // legitimately moves it without anything being missing.
  const status: AccountStatus = totalMissing > 0 ? 'attention' : 'ok'
  return {
    status,
    totalMissing,
    totalMissingValue: Math.round(totalMissingValue * 100) / 100,
    monthsWithIssues,
    currentStatus,
  }
}

/** Roll-up across all accounts for the page header. */
export function summarizeResult(r: ReconResult): {
  accountsWithIssues: number
  totalMissing: number
} {
  let accountsWithIssues = 0
  let totalMissing = 0
  for (const a of r.accounts) {
    const s = summarizeAccount(a)
    if (s.status === 'attention') accountsWithIssues += 1
    totalMissing += s.totalMissing
  }
  return { accountsWithIssues, totalMissing }
}

export function formatSignedUsd(n: number): string {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
