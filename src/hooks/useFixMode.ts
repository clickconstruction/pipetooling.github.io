import { useCallback, useEffect, useState } from 'react'
import { FIX_MODE_CHANGED_EVENT, fixModeStorageKey, readFixMode, writeFixMode } from '../lib/tellTheDev/fixMode'

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

/**
 * Tell the dev's switch (punch list #380; the row read Fix Mode until v2.8043): whether this person's screens show the wrench. On until they switch
 * it off in the gear menu. Kept per person per device, and in step across tabs (the storage event)
 * and within the tab (`FIX_MODE_CHANGED_EVENT`), as Job Mode is.
 */
export function useFixMode(userId: string | null | undefined): [boolean, (next: boolean) => void] {
  const [on, setOn] = useState<boolean>(() => readFixMode(storage(), userId))

  useEffect(() => {
    setOn(readFixMode(storage(), userId))
  }, [userId])

  useEffect(() => {
    if (!userId) return
    const key = fixModeStorageKey(userId)
    const read = () => setOn(readFixMode(storage(), userId))
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) read()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener(FIX_MODE_CHANGED_EVENT, read)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(FIX_MODE_CHANGED_EVENT, read)
    }
  }, [userId])

  const set = useCallback(
    (next: boolean) => {
      writeFixMode(storage(), userId, next)
      setOn(readFixMode(storage(), userId))
      window.dispatchEvent(new Event(FIX_MODE_CHANGED_EVENT))
    },
    [userId],
  )

  return [on, set]
}
