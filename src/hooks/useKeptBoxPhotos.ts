import { useEffect } from 'react'
import { sendKeptBoxPhotos, supabaseKeptBoxPhotosIo } from '../lib/materials/keptBoxPhotosIo'
import { OUTBOX_LANDED_EVENT, type OutboxLandedDetail } from './useOutboxReplay'

/**
 * Materials on site: a box photo kept on the phone goes by itself (Take from a box, v2.7824). Mounted once in
 * `Layout`, beside the outbox's replay. A pass runs a moment after the app opens, when the browser says the signal is
 * back, when the page comes to the front, and when an on-site press lands, since a shot's row must reach the office
 * before its bytes are worth sending. One pass at a time.
 */
export function useKeptBoxPhotos(userId: string | null | undefined): void {
  useEffect(() => {
    if (!userId) return
    const io = supabaseKeptBoxPhotosIo()
    let running = false
    let live = true
    const pass = () => {
      if (running || !live) return
      running = true
      void sendKeptBoxPhotos(userId, io).finally(() => { running = false })
    }
    const first = window.setTimeout(pass, 8000)
    const onLanded = (e: Event) => { if ((e as CustomEvent<OutboxLandedDetail>).detail?.kind === 'on-site-press') window.setTimeout(pass, 1500) }
    const onFront = () => { if (document.visibilityState === 'visible') pass() }
    window.addEventListener('online', pass)
    window.addEventListener(OUTBOX_LANDED_EVENT, onLanded)
    document.addEventListener('visibilitychange', onFront)
    return () => {
      live = false
      window.clearTimeout(first)
      window.removeEventListener('online', pass)
      window.removeEventListener(OUTBOX_LANDED_EVENT, onLanded)
      document.removeEventListener('visibilitychange', onFront)
    }
  }, [userId])
}
