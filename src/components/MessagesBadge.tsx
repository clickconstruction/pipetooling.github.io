/**
 * Messages in the header (residential R7, PR 3): the count on its link, the people waiting on us, each once, as
 * Follow up's own pill counts them (`follow_up_count`). New lane people are among them already, since the lane only
 * sorts people Needs a reply holds. Read on mount and again when the window comes back into focus. Nothing shows while
 * nobody waits or the read fails. The read loads on demand, so the header's own chunk does not grow.
 */
import { useEffect, useState } from 'react'

async function loadFollowUpCount(): Promise<number> {
  const { supabaseFollowUpIo } = await import('../lib/followUp/followUpIo')
  return supabaseFollowUpIo().count()
}

export function MessagesBadge({ load = loadFollowUpCount }: { load?: () => Promise<number> }) {
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => {
    let live = true
    const read = () => {
      load()
        .then((n) => {
          if (live) setCount(n)
        })
        .catch(() => {
          // The link still works; the count waits for a read that does.
        })
    }
    read()
    window.addEventListener('focus', read)
    return () => {
      live = false
      window.removeEventListener('focus', read)
    }
  }, [load])
  if (!count) return null
  return (
    <span
      data-messages-badge
      aria-label={`${count} waiting on us`}
      style={{
        marginLeft: '0.35rem',
        display: 'inline-block',
        minWidth: '1.25rem',
        padding: '0 0.35rem',
        borderRadius: 999,
        background: 'var(--text-red-700)',
        color: 'white',
        fontSize: '0.72rem',
        fontWeight: 700,
        lineHeight: '1.25rem',
        textAlign: 'center',
      }}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
