import { useEffect, useState } from 'react'
import { useMessagesLive } from '../components/gc/messages/useMessagesLive'
import type { JobActivityMessage } from '../lib/jobs/jobActivityMessages'
import { loadJobMessages } from '../lib/messages/messagesIo'

type JobKey = { id: string; status: string | null; createdAt: string | null }

/**
 * One Pipeline job's calls, texts and emails for its Job activity (Messages cut 10, J2), read when the activity opens
 * and again when the job or its status changes. Null while the first read is out. No job (a reader who may not read a
 * job's lines, `canReadJobMessages`): none to read, so an empty list at once. A first read that fails shows the feed
 * without them: the job's own activity never waits on Messages. Since v2.5635 the lines are live: the page's one
 * Messages channel (`useMessagesLive`, on `messages` and `contacts` since v2.5572) reads again after a line lands or
 * changes, as does `rev` (Job Mode's card bumps it after Message the customer sent, v2.5528). Realtime and the read
 * both run under the rows' policies, so a tech hears and gets only what R5's door gives them. The lines on screen stay
 * until the new read is in and a read again that fails keeps them, so the feed never empties to load; a line that
 * lands is the newest and takes the next number, and the numbers on screen stay. `load` is a smoke's seam.
 */
export function useJobMessages(job: JobKey | null, rev = 0, load: (job: JobKey) => Promise<JobActivityMessage[]> = loadJobMessages): JobActivityMessage[] | null {
  const key = job ? `${job.id}|${job.status ?? ''}|${job.createdAt ?? ''}` : ''
  const [read, setRead] = useState<{ key: string; messages: JobActivityMessage[] } | null>(null)
  const [heard, setHeard] = useState(0)
  useMessagesLive(job !== null, () => setHeard((n) => n + 1))
  useEffect(() => {
    if (!job) return
    let live = true
    load(job)
      .then((messages) => {
        if (live) setRead({ key, messages })
      })
      .catch(() => {
        if (live) setRead((was) => (was?.key === key ? was : { key, messages: [] }))
      })
    return () => {
      live = false
    }
    // `key` stands for the job, its status and its start, which `job` carries. `rev` and `heard` read again under the same key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, rev, heard, load])
  if (!job) return NONE
  return read?.key === key ? read.messages : null
}

const NONE: JobActivityMessage[] = []
