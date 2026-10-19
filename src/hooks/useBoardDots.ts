/**
 * The Pipeline's waiting dots (v2.5632): one read of the open customers' lines in, mapped to the jobs whose customer
 * waits on us (`boardDotsByJob`). The office only; anyone else reads nothing and every row draws no dot. It reads again
 * when `refreshKey` changes (the board's jobs, so a load of the board refreshes the dots) and on `reload` (a send from
 * the customer's sheet). A read that fails keeps the last dots and says nothing: the dot is a courtesy. Since v2.5635
 * it reads again when a line lands or a contact changes, on the page's one Messages channel (`useMessagesLive`, one
 * hook per board and no channel per row), so a row's dot lights without a reload of the board; the newest read wins.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMessagesLive } from '../components/gc/messages/useMessagesLive'
import type { BoardDotHover } from '../lib/flows/stageSends'
import { boardDotsByJob } from '../lib/messages/boardDots'
import { loadBoardDotRows, type BoardDotRows } from '../lib/messages/boardDotsIo'
import { todayYmdInAppTz } from '../utils/dateUtils'

const NONE: ReadonlyMap<string, BoardDotHover> = new Map()

export interface UseBoardDotsOptions {
  /** The office: `canOpenMessages(role)`, the bubble's own gate. */
  enabled: boolean
  /** A change reads again: the board's jobs array. */
  refreshKey?: unknown
  /** For a smoke: the read, today and now. */
  load?: () => Promise<BoardDotRows>
  todayYmd?: string
  nowIso?: string
}

export interface BoardDots {
  dotByJobId: ReadonlyMap<string, BoardDotHover>
  reload: () => Promise<void>
}

export function useBoardDots({ enabled, refreshKey, load = loadBoardDotRows, todayYmd, nowIso }: UseBoardDotsOptions): BoardDots {
  const [rows, setRows] = useState<BoardDotRows | null>(null)
  const live = useRef(true)
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  const reads = useRef(0)
  const reload = useCallback(async () => {
    if (!enabled) return
    const mine = ++reads.current
    try {
      const got = await load()
      if (live.current && mine === reads.current) setRows(got)
    } catch {
      // A courtesy dot: the last dots stand.
    }
  }, [enabled, load])

  useEffect(() => {
    void reload()
  }, [reload, refreshKey])
  useMessagesLive(enabled, () => void reload())

  const dotByJobId = useMemo(() => {
    if (!enabled || !rows) return NONE
    return boardDotsByJob(rows.contacts, rows.lines, todayYmd ?? todayYmdInAppTz(), nowIso ? new Date(nowIso) : new Date())
  }, [enabled, rows, todayYmd, nowIso])

  return { dotByJobId, reload }
}
