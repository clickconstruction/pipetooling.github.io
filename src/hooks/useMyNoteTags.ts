import { useEffect, useState } from 'react'
import { formatErrorMessage } from '../utils/errorHandling'
import type { MyTag } from '../lib/jobs/noteTags'
import { loadMyTags, onNoteTagsChanged } from '../lib/jobs/noteTagsIo'

/**
 * The reader's tagged job notes, read once for the whole tab (punch list #363). The count above
 * Jobs, the section on the Pipeline and the Needs you line all follow this one read, so they
 * never disagree and the header costs one small read.
 *
 * It reads when the first follower mounts, when a tag changes in this tab (`noteTagsChanged`),
 * when the window comes back into focus, and every 90 seconds while the tab is on screen.
 */

type Snapshot = { tags: MyTag[] | null; error: string | null }

const REREAD_MS = 90_000

let snapshot: Snapshot = { tags: null, error: null }
let reading = false
let again = false
const followers = new Set<(s: Snapshot) => void>()
let stop: (() => void) | null = null

function publish(next: Snapshot) {
  snapshot = next
  for (const f of [...followers]) f(next)
}

async function read(): Promise<void> {
  if (reading) {
    again = true
    return
  }
  reading = true
  try {
    publish({ tags: await loadMyTags(), error: null })
  } catch (e: unknown) {
    // What was read before stays on screen; the section says why the new read failed.
    publish({ tags: snapshot.tags, error: formatErrorMessage(e, 'The tagged job notes could not be read') })
  } finally {
    reading = false
    if (again) {
      again = false
      void read()
    }
  }
}

function start() {
  const offChanged = onNoteTagsChanged(() => void read())
  const onFocus = () => void read()
  window.addEventListener('focus', onFocus)
  const timer = window.setInterval(() => {
    if (document.visibilityState === 'visible') void read()
  }, REREAD_MS)
  stop = () => {
    offChanged()
    window.removeEventListener('focus', onFocus)
    window.clearInterval(timer)
  }
  void read()
}

/** `enabled` false follows nothing and reads nothing: a role that cannot be tagged has no count. */
export function useMyNoteTags(enabled: boolean): Snapshot {
  const [state, setState] = useState<Snapshot>(snapshot)
  useEffect(() => {
    if (!enabled) return
    followers.add(setState)
    if (followers.size === 1) start()
    else setState(snapshot)
    return () => {
      followers.delete(setState)
      if (followers.size === 0) {
        stop?.()
        stop = null
        // The next person to sign in on this tab must not see the last one's tags.
        snapshot = { tags: null, error: null }
      }
    }
  }, [enabled])
  return enabled ? state : { tags: null, error: null }
}
