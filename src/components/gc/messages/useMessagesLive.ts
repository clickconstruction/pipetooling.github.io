/**
 * v2.5572: Messages hears a new or changed row as it lands. One realtime channel on `messages` and `contacts`
 * (migration `20261016010000_messages_realtime.sql`; Realtime reads the tables' own row policies) feeds one bus
 * (`lib/messages/liveReread.ts`) shared by the host, Follow up and the header's badge, so a page holds one channel
 * however many of them draw. A burst settles into one read; a tab coming back to focus or into view reads too.
 */
import { useEffect, useRef } from 'react'
import { makeLiveBus } from '../../../lib/messages/liveReread'
import { supabase } from '../../../lib/supabase'

export const MESSAGES_LIVE_TABLES = ['messages', 'contacts'] as const

let channel: ReturnType<typeof supabase.channel> | null = null
const onFocus = () => bus.bump()
const onVisible = () => {
  if (document.visibilityState === 'visible') bus.bump()
}

const bus = makeLiveBus({
  attach: () => {
    let ch = supabase.channel('messages-live')
    for (const table of MESSAGES_LIVE_TABLES) ch = ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => bus.bump())
    ch.subscribe()
    channel = ch
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
  },
  detach: () => {
    window.removeEventListener('focus', onFocus)
    document.removeEventListener('visibilitychange', onVisible)
    if (channel) void supabase.removeChannel(channel)
    channel = null
  },
})

/** Calls `onChange` after every settled change to the Messages tables while `enabled`; the newest `onChange` is used. */
export function useMessagesLive(enabled: boolean, onChange: () => void): void {
  const latest = useRef(onChange)
  latest.current = onChange
  useEffect(() => {
    if (!enabled) return
    return bus.subscribe(() => latest.current())
  }, [enabled])
}
