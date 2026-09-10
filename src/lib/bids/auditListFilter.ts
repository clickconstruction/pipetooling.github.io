/**
 * The Audits lens filter row (Bids → 🤖 Robots → Audits). Thirty-odd cards
 * sorted by stake is right for the top of the list and wrong for finding one —
 * the auditor wants "just the shadows" or "the ones asking me something". A
 * filter narrows the list; the stake order inside it is untouched.
 */

export type AuditListFilter = 'all' | 'backtests' | 'shadows' | 'questions'

export const AUDIT_LIST_FILTERS: ReadonlyArray<{ key: AuditListFilter; label: string; title: string }> = [
  { key: 'all', label: 'All', title: 'Every audit, sorted by what your verdict unblocks' },
  { key: 'backtests', label: 'Backtests', title: 'Blind re-estimates of decided bids — the robot practiced on history' },
  { key: 'shadows', label: 'Shadows', title: 'Blind estimates of live bids — sealed until we send ours' },
  { key: 'questions', label: 'Asking you', title: 'Audits you can open that have a question the robot is still waiting on' },
]

export type AuditKind = 'backtest' | 'shadow'

/** The ZZ convention names the kind: `ZZ Shadow …` shadows a live bid; everything else is a backtest. */
export function auditKind(projectName: string | null | undefined): AuditKind {
  return /^\s*ZZ\s+Shadow\b/i.test(projectName ?? '') ? 'shadow' : 'backtest'
}

export type AuditListItem = {
  projectName: string | null | undefined
  openQuestions: number
  /** A sealed shadow renders as a 🔒 row the auditor can't open — its questions wait for the send. */
  sealed?: boolean
}

export function auditMatchesFilter(item: AuditListItem, filter: AuditListFilter): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'backtests':
      return auditKind(item.projectName) === 'backtest'
    case 'shadows':
      return auditKind(item.projectName) === 'shadow'
    case 'questions':
      return item.openQuestions > 0 && !item.sealed
  }
}

export function filterAuditList<T extends AuditListItem>(items: readonly T[], filter: AuditListFilter): T[] {
  return items.filter((it) => auditMatchesFilter(it, filter))
}

/** One count per pill, over the same list the pills narrow. */
export function auditFilterCounts(items: readonly AuditListItem[]): Record<AuditListFilter, number> {
  const counts: Record<AuditListFilter, number> = { all: 0, backtests: 0, shadows: 0, questions: 0 }
  for (const it of items) {
    for (const f of AUDIT_LIST_FILTERS) if (auditMatchesFilter(it, f.key)) counts[f.key] += 1
  }
  return counts
}
