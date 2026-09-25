/**
 * score_backtest's two gates (v2.3835), shared by twin-mcp and its unit test.
 *
 * - The LOCK gate: the blind total must be on the twin bid's ledger before the reference
 *   unseals. The lock notes spell it as its own capital word — `[STG-3..5 + LOCK] $NN,NNN …`,
 *   `[shadow LOCK] …` — and the gate used to be `ilike('notes', '%LOCK%')`, which any note
 *   saying "blocked", "unlock" or "clock" satisfied.
 * - The run-label scope: `twin_run_scores.run_label` is globally UNIQUE, and the amend lookup
 *   read it by label alone, so a shell reusing another run's label got that run's row back —
 *   reference value included — and could amend its verdict.
 */

/** True when a ledger note carries LOCK as a whole, capitalized word. */
export function isBacktestLockNote(notes: string | null | undefined): boolean {
  return /\bLOCK\b/.test(notes ?? '')
}

export type ExistingRunScore = { kind: string | null; twin_bid_number: string | null }

/**
 * Whose is the `twin_run_scores` row already holding this run label?
 * `free` — none, score it; `mine` — this backtest shell's own row, reuse or amend it;
 * `taken` — another run's (another shell, or a shadow), refuse and ask for a new label.
 */
export function backtestRunLabelOwner(existing: ExistingRunScore | null, twinBidNumber: string): 'free' | 'mine' | 'taken' {
  if (!existing) return 'free'
  return existing.kind === 'backtest' && existing.twin_bid_number === twinBidNumber ? 'mine' : 'taken'
}
