import { useCallback, useEffect, useState } from 'react'
import { fetchMyStatementWeek } from '../lib/statementRoundEmailClient'
import { statementWeekNudgeFromPayload, type StatementRoundNudge } from '../lib/statementRoundEmail'

/**
 * The Dashboard Needs You row for GC statements: the office's week (punch
 * list #49) — every GC checked this week whose statement is not out, whoever
 * its account man is — from get_my_statement_week. Null while loading,
 * disabled, empty, or on error so the card stays quiet. The per-sender round
 * it once fell back to (get_my_statement_round, v2.2771) is gone (v2.6220).
 */
export function useStatementRoundNudge(enabled: boolean): { nudge: StatementRoundNudge | null; reload: () => void } {
  const [nudge, setNudge] = useState<StatementRoundNudge | null>(null)
  const [nonce, setNonce] = useState(0)
  /** Re-read after the round's window closes (v2.6096, punch list #178). */
  const reload = useCallback(() => setNonce((n) => n + 1), [])
  useEffect(() => {
    if (!enabled) {
      setNudge(null)
      return
    }
    let cancelled = false
    void fetchMyStatementWeek().then((week) => {
      if (!cancelled) setNudge(statementWeekNudgeFromPayload(week))
    })
    return () => {
      cancelled = true
    }
  }, [enabled, nonce])
  return { nudge, reload }
}
