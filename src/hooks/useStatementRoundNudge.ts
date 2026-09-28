import { useEffect, useState } from 'react'
import { fetchMyStatementRound, fetchMyStatementWeek } from '../lib/statementRoundEmailClient'
import { statementRoundNudgeFromPayload, statementWeekNudgeFromPayload, type StatementRoundNudge } from '../lib/statementRoundEmail'

/**
 * The Dashboard Needs You row for GC statements. The office's week (punch
 * list #49): every GC checked this week whose statement is not out, whoever
 * its account man is — get_my_statement_week. A database without that
 * function yet answers with the signed-in sender's own round instead
 * (get_my_statement_round, v2.2771). Null while loading, disabled, empty, or
 * on error so the card stays quiet.
 */
export function useStatementRoundNudge(enabled: boolean): { nudge: StatementRoundNudge | null } {
  const [nudge, setNudge] = useState<StatementRoundNudge | null>(null)
  useEffect(() => {
    if (!enabled) {
      setNudge(null)
      return
    }
    let cancelled = false
    void fetchMyStatementWeek().then(async ({ week, missing }) => {
      if (cancelled) return
      if (!missing) {
        setNudge(statementWeekNudgeFromPayload(week))
        return
      }
      const round = await fetchMyStatementRound()
      if (!cancelled) setNudge(statementRoundNudgeFromPayload(round))
    })
    return () => {
      cancelled = true
    }
  }, [enabled])
  return { nudge }
}
