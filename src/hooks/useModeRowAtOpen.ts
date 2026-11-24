import { useCallback, useEffect, useState } from 'react'
import { MODE_ROW_AT_OPEN_CHANGED_EVENT, MODE_ROW_AT_OPEN_OFF_STORAGE_KEY, readModeRowAtOpen, writeModeRowAtOpen } from '../lib/modeRow'

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

/**
 * The mode row's switch, **Modes at open** (`lib/modeRow.ts`, punch list #433): whether this phone
 * shows the row of three modes when the app opens. Kept per phone, on until someone unticks it, and
 * in step across tabs (the storage event) and within the tab (`MODE_ROW_AT_OPEN_CHANGED_EVENT`), as
 * the gear menu's other ticks are. `ModeRow` reads it and the gear menu's Show group writes it.
 */
export function useModeRowAtOpen(): [boolean, (next: boolean) => void] {
  const [on, setOn] = useState<boolean>(() => readModeRowAtOpen(storage()))

  useEffect(() => {
    const read = () => setOn(readModeRowAtOpen(storage()))
    const onStorage = (e: StorageEvent) => {
      // A cleared storage reports no key.
      if (e.key === MODE_ROW_AT_OPEN_OFF_STORAGE_KEY || e.key === null) read()
    }
    read()
    window.addEventListener('storage', onStorage)
    window.addEventListener(MODE_ROW_AT_OPEN_CHANGED_EVENT, read)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(MODE_ROW_AT_OPEN_CHANGED_EVENT, read)
    }
  }, [])

  const set = useCallback((next: boolean) => {
    writeModeRowAtOpen(storage(), next)
    setOn(readModeRowAtOpen(storage()))
    window.dispatchEvent(new Event(MODE_ROW_AT_OPEN_CHANGED_EVENT))
  }, [])

  return [on, set]
}
