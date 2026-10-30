/**
 * Messages in the header (residential R7, PR 3): the count on its link, the people waiting on us, each once, as
 * Follow up's own pill counts them (`follow_up_count`). New lane people are among them already, since the lane only
 * sorts people Needs a reply holds. Read on mount, after every settled change to the Messages tables and when the window
 * comes back into focus (`useMessagesLive`, v2.5572). Nothing shows while nobody waits or the read fails. The read loads
 * on demand, so the header's own chunk does not grow.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useMessagesLive } from './gc/messages/useMessagesLive'

async function loadFollowUpCount(): Promise<number> {
  const { supabaseFollowUpIo } = await import('../lib/followUp/followUpIo')
  return supabaseFollowUpIo().count()
}

export function MessagesBadge({ load = loadFollowUpCount }: { load?: () => Promise<number> }) {
  const [count, setCount] = useState<number | null>(null)
  const live = useRef(true)
  const read = useCallback(() => {
    load()
      .then((n) => {
        if (live.current) setCount(n)
      })
      .catch(() => {
        // The link still works; the count waits for a read that does.
      })
  }, [load])
  useEffect(() => {
    live.current = true
    read()
    return () => {
      live.current = false
    }
  }, [read])
  // v2.5572: the count follows the tables (a line in, a take), and a tab coming back to focus still reads.
  useMessagesLive(true, read)
  if (!count) return null
  return (
    <span
      data-messages-badge
      aria-label={`${count} waiting on us`}
      // The top-right corner of the word, as the Inbox dock and the stage bar wear their counts (v2.5762); the link's
      // text is wrapped in a relative span for it. The count reads --surface on the red: white in light, the dark
      // surface on dark mode's light red, where white read 2.77:1 (punch list #194, v2.6130).
      style={{
        position: 'absolute',
        top: '-0.55rem',
        right: '-0.9rem',
        display: 'inline-block',
        minWidth: '1.25rem',
        padding: '0 0.35rem',
        borderRadius: 999,
        border: '2px solid var(--surface)',
        background: 'var(--text-red-700)',
        color: 'var(--surface)',
        fontSize: '0.72rem',
        fontWeight: 700,
        lineHeight: '1.25rem',
        textAlign: 'center',
        pointerEvents: 'none',
      }}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
