import { useEffect, useState } from 'react'
import { fetchMyStatementRound } from '../lib/statementRoundEmailClient'
import { statementRoundNudgeFromPayload, type StatementRoundNudge } from '../lib/statementRoundEmail'

/**
 * The signed-in sender's statement round (v2.2771): GCs certified this week,
 * assigned to them, not yet marked sent — the Dashboard Needs You row. One
 * self-scoped RPC (get_my_statement_round); null while loading, disabled,
 * empty, or on error so the card stays quiet.
 */
export function useStatementRoundNudge(enabled: boolean): { nudge: StatementRoundNudge | null } {
  const [nudge, setNudge] = useState<StatementRoundNudge | null>(null)
  useEffect(() => {
    if (!enabled) {
      setNudge(null)
      return
    }
    let cancelled = false
    void fetchMyStatementRound().then((p) => {
      if (!cancelled) setNudge(statementRoundNudgeFromPayload(p))
    })
    return () => {
      cancelled = true
    }
  }, [enabled])
  return { nudge }
}
