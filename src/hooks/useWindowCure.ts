import { useEffect } from 'react'
import { isDialogOpen, isEditableFocused } from '../lib/autoReload'
import { browserSaysOffline, msSinceChunkRecoveryReload } from '../lib/chunkLoadRecovery'
import { lostWindowCount, rewarmLostWindows, subscribeLostWindows } from '../lib/lazyWindow'
import { probeForSignal } from '../lib/publicPageLoad'
import { pageHoldsTypedText } from '../lib/typedText'
import { inFlightWriteCount, unsavedHoldCount } from '../lib/unsavedWork'
import {
  decideWindowCure,
  msSinceWindowCure,
  stampWindowCure,
  WINDOW_CURE_NO_ANSWER_MS,
  type WindowCureSnapshot,
} from '../lib/windowCure'

/** What the cure reads and does, so a test can hand in its own. */
export type WindowCureDeps = {
  snapshot: () => WindowCureSnapshot
  /** Asks the network once. True only on the site's own answer. */
  ask: () => Promise<boolean>
  /** Writes down the try, then asks again for every lost window. */
  cure: () => void
}

function sessionStore(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

const pageDeps: WindowCureDeps = {
  snapshot: () => {
    const now = Date.now()
    const store = sessionStore()
    return {
      lostWindows: lostWindowCount(),
      browserOffline: browserSaysOffline(),
      framed: window.self !== window.top,
      msSinceLastCure: msSinceWindowCure(now, store),
      msSinceLastRecovery: msSinceChunkRecoveryReload(now, store),
      typedText: pageHoldsTypedText(),
      editableFocused: isEditableFocused(document),
      dialogOpen: isDialogOpen(document),
      unsavedHolds: unsavedHoldCount(),
      inFlightWrites: inFlightWriteCount(),
    }
  },
  ask: () => probeForSignal(),
  cure: () => {
    stampWindowCure(Date.now(), sessionStore())
    void rewarmLostWindows()
  },
}

/**
 * Mends a page that lost a window's code, before the next press (`windowCure.ts`). It looks when a window is
 * lost, when the browser says the signal is back, when the tab is looked at again, and after every hold. On
 * a quiet page with the network there it asks for the lost windows again. Nothing typed is ever lost to it.
 *
 * `on` is false until someone is signed in. A customer's page has its own road (`PublicPage`).
 */
export function useWindowCure(on: boolean, deps: WindowCureDeps = pageDeps): void {
  useEffect(() => {
    if (!on) return
    let stopped = false
    let asking = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const lookIn = (ms: number) => {
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(look, ms)
    }
    function look(): void {
      if (stopped || asking) return
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
      const first = decideWindowCure(deps.snapshot())
      if (first.act === 'none') return
      if (first.act === 'wait') {
        lookIn(first.lookAgainInMs)
        return
      }
      asking = true
      void deps.ask().then(
        (answered) => {
          asking = false
          if (stopped) return
          if (!answered) {
            lookIn(WINDOW_CURE_NO_ANSWER_MS)
            return
          }
          // The second look: the ask can take five seconds, and someone may have typed in them.
          const second = decideWindowCure(deps.snapshot())
          if (second.act === 'wait') lookIn(second.lookAgainInMs)
          if (second.act === 'ask') deps.cure()
        },
        () => {
          asking = false
          if (!stopped) lookIn(WINDOW_CURE_NO_ANSWER_MS)
        },
      )
    }
    const unsubscribe = subscribeLostWindows(look)
    window.addEventListener('online', look)
    document.addEventListener('visibilitychange', look)
    look()
    return () => {
      stopped = true
      if (timer !== undefined) clearTimeout(timer)
      unsubscribe()
      window.removeEventListener('online', look)
      document.removeEventListener('visibilitychange', look)
    }
  }, [on, deps])
}
