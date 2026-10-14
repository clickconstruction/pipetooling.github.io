import { useEffect, useState } from 'react'
import type { JobActivityMessage } from '../lib/jobs/jobActivityMessages'
import { loadJobMessages } from '../lib/messages/messagesIo'

/**
 * One Pipeline job's calls, texts and emails for its Job activity (Messages cut 10, J2), read when the activity opens
 * and again when the job or its status changes. Null while the read is out. No job (a reader who may not read a job's
 * lines, `canReadJobMessages`): none to read, so an empty list at once. A read that fails shows the
 * feed without them: the job's own activity never waits on Messages. `messages` is not in the realtime publication,
 * so a line that lands while the feed is open shows on the next open, or when `rev` goes up: Job Mode's card bumps it
 * after Message the customer sent (v2.5528), and the lines it had stay on screen until the new read is in.
 */
export function useJobMessages(job: { id: string; status: string | null; createdAt: string | null } | null, rev = 0): JobActivityMessage[] | null {
  const key = job ? `${job.id}|${job.status ?? ''}|${job.createdAt ?? ''}` : ''
  const [read, setRead] = useState<{ key: string; messages: JobActivityMessage[] } | null>(null)
  useEffect(() => {
    if (!job) return
    let live = true
    loadJobMessages(job)
      .then((messages) => {
        if (live) setRead({ key, messages })
      })
      .catch(() => {
        if (live) setRead({ key, messages: [] })
      })
    return () => {
      live = false
    }
    // `key` stands for the job, its status and its start, which `job` carries. `rev` reads again under the same key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, rev])
  if (!job) return NONE
  return read?.key === key ? read.messages : null
}

const NONE: JobActivityMessage[] = []
