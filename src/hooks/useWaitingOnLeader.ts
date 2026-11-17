import { useCallback, useEffect, useMemo, useState } from 'react'
import { buildWaitingOnLeader, type WaitingOnLeaderAsk, type WaitingOnLeaderCard } from '../lib/dashboard/waitingOnLeader'
import { waitingOnLeaderIo, type WaitingOnLeaderIo, type WaitingOnLeaderPerson } from '../lib/dashboard/waitingOnLeaderIo'
import { waitingOnLeaderLien, type WaitingOnLeaderDesk } from '../lib/dashboard/waitingOnLeaderLien'
import { todayYmdInAppTz } from '../utils/dateUtils'
import { useLineBudgetsReview } from './useLineBudgetsReview'

type Reads = { leaders: WaitingOnLeaderPerson[]; waivers: WaitingOnLeaderAsk[] | null; tags: WaitingOnLeaderAsk[] | null; notRead: string[] }

/**
 * The office's Waiting on card, read (punch list #365, PR 2). The Lien desk's piles come from the read the
 * Dashboard already made for Needs you, handed in, so the desk is not read twice. The leaders, the waivers and
 * the tagged notes are three small reads of this hook's own, and the line budgets are the weekly review's read.
 * A read that fails leaves its row out and is named in `notRead`, so a short list never passes for a whole one.
 */
export function useWaitingOnLeader(
  enabled: boolean,
  desk: WaitingOnLeaderDesk | null | undefined,
  deskReading: boolean,
  io: WaitingOnLeaderIo = waitingOnLeaderIo,
): { card: WaitingOnLeaderCard | null; notRead: string[]; reload: () => void } {
  const [reads, setReads] = useState<Reads | null>(null)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])
  const { review } = useLineBudgetsReview(enabled)

  useEffect(() => {
    if (!enabled) {
      setReads(null)
      return
    }
    let cancelled = false
    void (async () => {
      const notRead: string[] = []
      let leaders: WaitingOnLeaderPerson[] = []
      let waivers: WaitingOnLeaderAsk[] | null = null
      let tags: WaitingOnLeaderAsk[] | null = null
      try {
        leaders = await io.leaders()
        const ids = leaders.map((l) => l.id)
        const [w, t] = await Promise.allSettled([io.waivers(ids), io.tags(ids)])
        if (w.status === 'fulfilled') waivers = w.value
        else notRead.push('The lien waivers')
        if (t.status === 'fulfilled') tags = t.value
        else notRead.push('The tagged job notes')
      } catch {
        notRead.push('The lien waivers and the tagged job notes')
      }
      if (!cancelled) setReads({ leaders, waivers, tags, notRead })
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, io, tick])

  // The desk's read has started at least once, so *not reading with no data* means it failed.
  const [deskStarted, setDeskStarted] = useState(false)
  useEffect(() => {
    if (deskReading) setDeskStarted(true)
  }, [deskReading])
  const deskFailed = enabled && deskStarted && !deskReading && !desk

  const lien = useMemo(() => waitingOnLeaderLien(desk), [desk])
  const card = useMemo(
    () =>
      enabled && reads
        ? buildWaitingOnLeader({ leaders: reads.leaders, lien, waivers: reads.waivers, tags: reads.tags, lineBudgets: review ? { lines: review.lines.length, projects: review.jobIds.length } : null, todayYmd: todayYmdInAppTz() })
        : null,
    [enabled, reads, lien, review],
  )
  const notRead = useMemo(() => [...(deskFailed ? ['The Lien desk'] : []), ...(reads?.notRead ?? [])], [deskFailed, reads])
  return { card, notRead, reload }
}
