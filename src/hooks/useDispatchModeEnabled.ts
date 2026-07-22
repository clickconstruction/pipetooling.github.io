import { useCallback, useEffect, useState } from 'react'
import {
  DISPATCH_MODE_CHANGED_EVENT,
  dispatchModeStorageKey,
  fetchDispatchModeEnabledFromServer,
  readDispatchModeEnabled,
  writeDispatchModeEnabled,
  writeDispatchModeEnabledToServer,
} from '../lib/dispatchModeToggle'

/**
 * Per-user Dispatch Mode flag. localStorage is the instant-boot cache, the
 * server (`users.dispatch_mode_enabled`) is the cross-device truth, and
 * `defaultEnabled` fills in when the user has never chosen (server NULL) —
 * assistants pass true so the mode is on by default for them.
 */
export function useDispatchModeEnabled(
  userId: string | null | undefined,
  defaultEnabled = false,
): [boolean, (next: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(
    () => readDispatchModeEnabled(userId) ?? defaultEnabled,
  )

  useEffect(() => {
    setEnabled(readDispatchModeEnabled(userId) ?? defaultEnabled)
    // Server is the cross-device truth; reconcile the per-device cache to it.
    if (!userId) return
    let cancelled = false
    void fetchDispatchModeEnabledFromServer(userId).then((server) => {
      if (cancelled || server == null) return
      const resolved = server.value ?? defaultEnabled
      if (server.value == null) {
        // No explicit choice anywhere: use the role default without caching it
        // as if the user picked it.
        setEnabled(resolved)
        return
      }
      if (resolved !== readDispatchModeEnabled(userId)) {
        writeDispatchModeEnabled(userId, resolved)
        setEnabled(resolved)
        window.dispatchEvent(new Event(DISPATCH_MODE_CHANGED_EVENT))
      }
    })
    return () => {
      cancelled = true
    }
  }, [userId, defaultEnabled])

  useEffect(() => {
    if (!userId) return
    const key = dispatchModeStorageKey(userId)
    function onStorage(e: StorageEvent) {
      if (e.key !== key) return
      setEnabled(e.newValue === '1')
    }
    function onLocalChange() {
      setEnabled(readDispatchModeEnabled(userId) ?? defaultEnabled)
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener(DISPATCH_MODE_CHANGED_EVENT, onLocalChange)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(DISPATCH_MODE_CHANGED_EVENT, onLocalChange)
    }
  }, [userId, defaultEnabled])

  const set = useCallback(
    (next: boolean) => {
      writeDispatchModeEnabled(userId, next)
      setEnabled(next)
      window.dispatchEvent(new Event(DISPATCH_MODE_CHANGED_EVENT))
      if (userId) void writeDispatchModeEnabledToServer(userId, next)
    },
    [userId],
  )

  return [enabled, set]
}
