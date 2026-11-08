/**
 * Punch list #125, PR 1 (v2.6683): the Pipeline board's customer lines, one read per slice of the board's jobs beside
 * the thread stats (`refresh(ids)`, called where `refreshJobThreadStatsForJobIds` is), folded to the newest three
 * calls, texts, emails and portal lines per job (`pipeline_customer_lines`). The office only; anyone else reads nothing
 * and every row draws no line. It reads again on `reload` (a send from the customer's sheet) and, as the waiting dot
 * does since v2.5635, when a line lands or a contact changes on the page's one Messages channel (`useMessagesLive`), so
 * a text that arrives while the board is open shows in the box without a reload. A read that fails keeps the last lines
 * and says nothing: the box's line is a courtesy, and Job activity holds the record. The newest read wins.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useMessagesLive } from '../components/gc/messages/useMessagesLive'
import type { JobActivityMessage } from '../lib/jobs/jobActivityMessages'
import { loadPipelineCustomerLines } from '../lib/messages/pipelineCustomerLinesIo'

const NONE: ReadonlyMap<string, JobActivityMessage[]> = new Map()

export interface UseBoardCustomerLinesOptions {
  /** The office: `canOpenMessages(role)`, the bubble's own gate. */
  enabled: boolean
  /** For a smoke: the read. */
  load?: (jobIds: readonly string[]) => Promise<Map<string, JobActivityMessage[]>>
}

export interface BoardCustomerLines {
  /** Each job's newest lines, oldest first; a job with none is absent. */
  linesByJobId: ReadonlyMap<string, JobActivityMessage[]>
  /** Read for these jobs, replacing what was held: the board's rows, at the moment the stats read. */
  refresh: (jobIds: readonly string[]) => Promise<void>
  /** Read again for the last jobs given. */
  reload: () => Promise<void>
}

export function useBoardCustomerLines({ enabled, load = loadPipelineCustomerLines }: UseBoardCustomerLinesOptions): BoardCustomerLines {
  const [lines, setLines] = useState<ReadonlyMap<string, JobActivityMessage[]>>(NONE)
  const live = useRef(true)
  const lastIds = useRef<readonly string[]>([])
  const reads = useRef(0)
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  const refresh = useCallback(
    async (jobIds: readonly string[]) => {
      lastIds.current = jobIds
      if (!enabled) return
      const mine = ++reads.current
      if (jobIds.length === 0) {
        setLines(NONE)
        return
      }
      try {
        const got = await load(jobIds)
        if (live.current && mine === reads.current) setLines(got)
      } catch {
        // A courtesy line: the last lines stand.
      }
    },
    [enabled, load],
  )

  const reload = useCallback(() => refresh(lastIds.current), [refresh])
  useMessagesLive(enabled, () => void reload())

  return { linesByJobId: enabled ? lines : NONE, refresh, reload }
}
