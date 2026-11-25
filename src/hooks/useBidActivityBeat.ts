import { useEffect } from 'react'
import { beatSeconds, type BidInFront } from '../lib/bids/bidInFront'
import { isImpersonationSessionActive } from '../lib/impersonationSession'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

const INTERVAL_MS = 60_000
/** The signs of a person at work: a press, a key, a scroll. Listened for once, on the window. */
const INPUT_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const

/**
 * Best effort and never retried, like the app activity heartbeat. Held while View as is on: the session is the
 * imitated person's, so the beat would say they were at work on a bid from the dev's browser. The flag is read at
 * each send, so a minute already scheduled when an imitation starts is held too.
 */
function bumpBid(front: BidInFront, seconds: number): void {
  if (seconds <= 0 || isImpersonationSessionActive()) return
  void withSupabaseRetry(
    () => supabase.rpc('bump_user_bid_activity', { p_bid: front.bidId, p_tab: front.tab, p_seconds: seconds }),
    'bump_user_bid_activity',
    { maxRetries: 0, logRetries: false },
  ).catch(() => {
    /* a lost beat costs a few seconds of a rough size */
  })
}

/**
 * The bids of the day (punch list #445): while a bid is in front and the person is at work on it, adds that time to
 * the bid, a minute at a time.
 *
 * - "In front" is the bid in the Bids page's address (`bidInFrontFromLocation`) on a visible tab.
 * - "At work" is a press, a key or a scroll in the last five minutes. A tab left in front on a second screen stops
 *   counting five minutes after the last one, where the app activity heartbeat counts on.
 * - Every 60 seconds one beat goes out with the seconds that counted. Leaving the bid, hiding the tab or closing the
 *   page sends the part of a minute, and nothing for a glance under five seconds.
 * - Nothing is sent while View as is on.
 *
 * `frontKey` is `bidInFrontKey(front)`: the effect is keyed on it, so a new bid or tab ends the old stretch.
 */
export function useBidActivityBeat(userId: string | undefined, front: BidInFront | null, frontKey: string): void {
  useEffect(() => {
    if (!userId || !front) return

    let intervalId: ReturnType<typeof setInterval> | null = null
    /** Start (ms) of the stretch not yet sent; null while the tab is hidden. */
    let stretchStart: number | null = null
    /** Opening a bid is itself a sign of the person. */
    let lastInputAt = Date.now()

    const onInput = () => {
      lastInputAt = Date.now()
    }
    const clear = () => {
      if (intervalId != null) {
        clearInterval(intervalId)
        intervalId = null
      }
    }
    const send = () => {
      const startedAt = stretchStart
      if (startedAt == null) return
      const now = Date.now()
      bumpBid(front, beatSeconds(startedAt, lastInputAt, now))
      stretchStart = now
    }
    const start = () => {
      if (document.visibilityState !== 'visible') return
      clear()
      stretchStart = Date.now()
      intervalId = setInterval(send, INTERVAL_MS)
    }
    const stop = () => {
      clear()
      send()
      stretchStart = null
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') stop()
      else {
        // Coming back to the tab is a sign of the person.
        lastInputAt = Date.now()
        start()
      }
    }

    start()
    for (const name of INPUT_EVENTS) window.addEventListener(name, onInput, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    // pagehide covers mobile Safari and a closed tab, where visibilitychange may not fire.
    window.addEventListener('pagehide', stop)
    return () => {
      for (const name of INPUT_EVENTS) window.removeEventListener(name, onInput)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', stop)
      stop()
    }
    // `front` is rebuilt on every render; `frontKey` is its identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, frontKey])
}
