import { useCallback, useEffect, useState } from 'react'
import { useMessagesLive } from '../components/gc/messages/useMessagesLive'
import { loadThreadSummaryFacts, type ThreadSummaryFacts, type ThreadSummaryJob } from '../lib/jobs/threadSummaryIo'
import { calendarYmdInAppTzFromIso } from '../utils/dateUtils'

export interface JobThreadSummaryRead {
  /** The facts and when they were read; null until the first read lands. */
  facts: (ThreadSummaryFacts & { readAtIso: string; todayYmd: string }) | null
  loading: boolean
  failed: boolean
  /** Read again now: the card's Read again press. */
  reread: () => void
}

/**
 * The job window's Where it stands card (punch list #186, item 2A, v2.5895): the facts read when the window opens on a
 * job, read again when a line lands or changes (the page's one Messages channel, `useMessagesLive`) and on Read again.
 * The stamp's time is when the read landed, so the card says what it read and when. A read that fails keeps the last
 * facts on screen and says so; nothing is written. `load` is a smoke's seam.
 */
export function useJobThreadSummary(job: ThreadSummaryJob | null, load: typeof loadThreadSummaryFacts = loadThreadSummaryFacts): JobThreadSummaryRead {
  const key = job ? `${job.id}|${job.status ?? ''}|${job.createdAt ?? ''}|${job.customerId ?? ''}` : ''
  const [read, setRead] = useState<{ key: string; facts: JobThreadSummaryRead['facts'] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [rev, setRev] = useState(0)
  useMessagesLive(job !== null, () => setRev((n) => n + 1))
  useEffect(() => {
    if (!job) return
    let live = true
    setLoading(true)
    const nowIso = new Date().toISOString()
    load(job, calendarYmdInAppTzFromIso(nowIso))
      .then((facts) => {
        if (!live) return
        setRead({ key, facts: { ...facts, readAtIso: new Date().toISOString(), todayYmd: calendarYmdInAppTzFromIso(nowIso) } })
        setFailed(false)
      })
      .catch(() => {
        if (live) setFailed(true)
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
    // `key` stands for the job; `rev` reads again under the same key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, rev, load])
  const reread = useCallback(() => setRev((n) => n + 1), [])
  return { facts: read?.key === key ? read.facts : null, loading, failed, reread }
}
