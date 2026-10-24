/**
 * To-do #152 (v2.5803): what every Call button needs to know, in one hook. Whether the signed-in person has a seat on
 * the Company phone seats card, whether this is a phone, the way kept on it, and the company number a box's calls
 * show as. The kept pick is one value for the whole page: a pick in one sheet turns every other button on the page
 * the same way at once (`useSyncExternalStore` over `localStorage`, as the owed strip's settling is). Pure parts in
 * `lib/quo/dial.ts`; the read in `lib/quo/dialIo.ts`.
 */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { boxSetting, type Mailbox } from '../lib/messages/boxes'
import { hasQuoSeat, isPhoneDevice, keepCallThrough, readCallThrough, type CallThrough } from '../lib/quo/dial'
import { loadDialSettings, NO_DIAL_SETTINGS, type DialSettings } from '../lib/quo/dialIo'
import { useOptionalAuth } from './useAuth'

export interface CallThroughState {
  seat: boolean
  phone: boolean
  kept: CallThrough | null
  /** The company number a call from this box shows as, as Settings keeps it; null while the boxes are not read. */
  fromFor: (box: Mailbox) => string | null
  keep: (pick: CallThrough | null) => void
}

const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getKept = (): CallThrough | null => readCallThrough()
const getNoneKept = (): CallThrough | null => null

export function useCallThrough(): CallThroughState {
  const auth = useOptionalAuth()
  const userId = auth?.user?.id ?? null
  const [settings, setSettings] = useState<DialSettings>(NO_DIAL_SETTINGS)
  useEffect(() => {
    let live = true
    loadDialSettings().then((s) => {
      if (live) setSettings(s)
    })
    return () => {
      live = false
    }
  }, [])
  const kept = useSyncExternalStore(subscribe, getKept, getNoneKept)
  const phone = useMemo(() => (typeof navigator === 'undefined' ? false : isPhoneDevice(navigator.userAgent, navigator.maxTouchPoints)), [])
  const seat = useMemo(() => hasQuoSeat(userId, settings.seats), [userId, settings.seats])
  const fromFor = useCallback(
    (box: Mailbox) => {
      if (!settings.boxes) return null
      return boxSetting(box, settings.boxes).phone || boxSetting('team', settings.boxes).phone || null
    },
    [settings.boxes],
  )
  const keep = useCallback((pick: CallThrough | null) => {
    keepCallThrough(pick)
    for (const l of listeners) l()
  }, [])
  return { seat, phone, kept, fromFor, keep }
}
