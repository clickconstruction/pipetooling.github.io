import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchTeamBoardWeek, type TeamBoardWeekData } from '../lib/fetchTeamBoardWeek'
import { buildTeamBoard, DEFAULT_RAN_LONG_RULE, type RanLongRule, type TeamBoard } from '../lib/teamBoard'
import type { LedgerPrefixMap } from '../lib/ledgerDisplayPrefixes'
import { ymdAddDays } from '../utils/dateUtils'
import { formatErrorMessage } from '../utils/errorHandling'

/** The seven company-calendar days from a Sunday. */
export function weekDaysFrom(weekStartYmd: string): string[] {
  return Array.from({ length: 7 }, (_, i) => ymdAddDays(weekStartYmd, i))
}

/** Loads one week for Jobs → Team and builds the board. `reload` re-reads after an action. */
export function useTeamBoardWeek(weekStartYmd: string, prefixMap: LedgerPrefixMap, ranLong: RanLongRule | null = DEFAULT_RAN_LONG_RULE) {
  const days = useMemo(() => weekDaysFrom(weekStartYmd), [weekStartYmd])
  const [data, setData] = useState<TeamBoardWeekData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchTeamBoardWeek(days[0]!, days[6]!, prefixMap)
      .then((d) => {
        if (cancelled) return
        setData(d)
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(formatErrorMessage(e))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [days, prefixMap, tick])

  const board: TeamBoard | null = useMemo(
    () => (data ? buildTeamBoard({ days, sessions: data.sessions, blocks: data.blocks, subSheets: data.subSheets, labels: data.labels, officeJobId: data.officeJobId, payFlags: data.payFlags, ranLong, acks: new Set(Object.keys(data.ackIdByKey)) }) : null),
    [data, days, ranLong],
  )

  return { days, board, data, loading, error, reload }
}
